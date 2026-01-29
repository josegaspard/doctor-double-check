import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  Search,
  ShieldCheck,
  User,
  GraduationCap,
  Building,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface CedulaVerificationResult {
  nombre: string;
  paterno: string;
  materno: string;
  titulo: string;
  institucion: string;
  anioRegistro: number;
}

interface CedulaAutoVerifyProps {
  cedula: string;
  userId: string;
  onVerified?: (verificationId: string, data: CedulaVerificationResult) => void;
  onClaimed?: () => void;
  language?: 'es' | 'en';
}

export function CedulaAutoVerify({ 
  cedula, 
  userId, 
  onVerified, 
  onClaimed,
  language = 'es' 
}: CedulaAutoVerifyProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    verificationId?: string;
    data?: CedulaVerificationResult;
    error?: string;
    alreadyClaimed?: boolean;
  } | null>(null);

  const handleVerify = useCallback(async () => {
    if (!cedula || cedula.length < 7) {
      toast.error(language === 'es' 
        ? 'Ingresa un número de cédula válido (7-8 dígitos)' 
        : 'Enter a valid license number (7-8 digits)');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-cedula-sep', {
        body: { cedula: cedula.trim(), userId }
      });

      if (error) throw error;

      setVerificationResult({
        verified: data.verified,
        verificationId: data.verificationId,
        data: data.data,
        error: data.error,
        alreadyClaimed: data.alreadyClaimed,
      });

      if (data.verified && data.verificationId && onVerified) {
        onVerified(data.verificationId, data.data);
      }

      if (!data.verified) {
        toast.error(data.error || (language === 'es' 
          ? 'No se pudo verificar la cédula' 
          : 'Could not verify license'));
      }
    } catch (error: any) {
      console.error('Error verifying cedula:', error);
      setVerificationResult({
        verified: false,
        error: error.message || (language === 'es' 
          ? 'Error al verificar' 
          : 'Verification error'),
      });
      toast.error(error.message || (language === 'es' 
        ? 'Error al verificar la cédula' 
        : 'Error verifying license'));
    } finally {
      setIsVerifying(false);
    }
  }, [cedula, userId, language, onVerified]);

  const handleClaim = useCallback(async () => {
    if (!verificationResult?.verificationId) return;

    setIsClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke('claim-cedula', {
        body: { verificationId: verificationResult.verificationId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || (language === 'es' 
          ? 'Cédula reclamada exitosamente' 
          : 'License claimed successfully'));
        
        if (data.autoApproved) {
          toast.success(language === 'es' 
            ? '¡Tu perfil ha sido verificado automáticamente!' 
            : 'Your profile has been automatically verified!', {
            duration: 5000,
          });
        }

        if (onClaimed) {
          onClaimed();
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error claiming cedula:', error);
      toast.error(error.message || (language === 'es' 
        ? 'Error al reclamar la cédula' 
        : 'Error claiming license'));
    } finally {
      setIsClaiming(false);
    }
  }, [verificationResult, language, onClaimed]);

  const cedulaValid = cedula && /^\d{7,8}$/.test(cedula.trim());

  return (
    <div className="space-y-4">
      {/* Verify Button */}
      {!verificationResult?.verified && (
        <Button
          onClick={handleVerify}
          disabled={isVerifying || !cedulaValid}
          variant="outline"
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {language === 'es' ? 'Verificando en SEP...' : 'Verifying with SEP...'}
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              {language === 'es' ? 'Verificar cédula automáticamente' : 'Verify license automatically'}
            </>
          )}
        </Button>
      )}

      {/* Error State */}
      {verificationResult && !verificationResult.verified && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  {language === 'es' ? 'No se pudo verificar' : 'Could not verify'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {verificationResult.error}
                </p>
                {verificationResult.alreadyClaimed && (
                  <p className="text-sm text-destructive mt-2">
                    {language === 'es' 
                      ? 'Esta cédula ya fue verificada por otro usuario. Contacta soporte si crees que es un error.'
                      : 'This license was already verified by another user. Contact support if you believe this is an error.'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {verificationResult?.verified && verificationResult.data && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-success">
                    {language === 'es' ? '¡Cédula verificada!' : 'License verified!'}
                  </p>
                  <Badge variant="verified" className="text-xs">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    SEP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'es' 
                    ? 'Los datos coinciden con el registro de la SEP' 
                    : 'Data matches SEP registry'}
                </p>
              </div>
            </div>

            {/* Verification Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Nombre' : 'Name'}
                  </p>
                  <p className="font-medium">
                    {verificationResult.data.nombre} {verificationResult.data.paterno} {verificationResult.data.materno}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Título' : 'Degree'}
                  </p>
                  <p className="font-medium truncate">{verificationResult.data.titulo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <Building className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Institución' : 'Institution'}
                  </p>
                  <p className="font-medium truncate">{verificationResult.data.institucion}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Año de registro' : 'Registration year'}
                  </p>
                  <p className="font-medium">{verificationResult.data.anioRegistro}</p>
                </div>
              </div>
            </div>

            {/* Claim Button */}
            <Button
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full mt-4 bg-success hover:bg-success/90"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'es' ? 'Confirmando...' : 'Confirming...'}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {language === 'es' ? 'Confirmar y verificar mi perfil' : 'Confirm and verify my profile'}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-2">
              {language === 'es' 
                ? 'Al confirmar, esta cédula quedará asociada a tu cuenta y no podrá ser usada por otro usuario.'
                : 'By confirming, this license will be associated with your account and cannot be used by another user.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info text */}
      {!verificationResult && cedulaValid && (
        <p className="text-xs text-muted-foreground text-center">
          {language === 'es' 
            ? 'Verificamos tu cédula directamente con la base de datos de la SEP (Secretaría de Educación Pública)'
            : 'We verify your license directly with the SEP (Secretary of Public Education) database'}
        </p>
      )}
    </div>
  );
}
