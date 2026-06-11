import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
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
  language?: 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de';
}

export function CedulaAutoVerify({ 
  cedula, 
  userId, 
  onVerified, 
  onClaimed,
  language = 'es'
}: CedulaAutoVerifyProps) {
  const { t } = useLanguage();
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
      toast.error(t('autoI18n.cedulaAuto1'));
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // userId is now extracted from auth token on server side - do not send from client
      const { data, error } = await supabase.functions.invoke('verify-cedula-sep', {
        body: { cedula: cedula.trim() }
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
        toast.error(data.error || t('autoI18n.cedulaAuto2'));
      }
    } catch (error: any) {
      console.error('Error verifying cedula:', error);
      setVerificationResult({
        verified: false,
        error: error.message || t('autoI18n.cedulaAuto3'),
      });
      toast.error(error.message || t('autoI18n.cedulaAuto4'));
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
        toast.success(data.message || t('autoI18n.cedulaAuto5'));
        
        if (data.autoApproved) {
          toast.success(t('autoI18n.cedulaAuto6'), {
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
      toast.error(error.message || t('autoI18n.cedulaAuto7'));
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
              {t('autoI18n.cedulaAuto8')}
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              {t('autoI18n.cedulaAuto9')}
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
                  {t('autoI18n.cedulaAuto10')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {verificationResult.error}
                </p>
                {verificationResult.alreadyClaimed && (
                  <p className="text-sm text-destructive mt-2">
                    {t('autoI18n.cedulaAuto11')}
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
                    {t('autoI18n.cedulaAuto12')}
                  </p>
                  <Badge variant="verified" className="text-xs">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    SEP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('autoI18n.cedulaAuto13')}
                </p>
              </div>
            </div>

            {/* Verification Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('autoI18n.cedulaAuto14')}
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
                    {t('autoI18n.cedulaAuto15')}
                  </p>
                  <p className="font-medium truncate">{verificationResult.data.titulo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <Building className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('autoI18n.cedulaAuto16')}
                  </p>
                  <p className="font-medium truncate">{verificationResult.data.institucion}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('autoI18n.cedulaAuto17')}
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
                  {t('autoI18n.cedulaAuto18')}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('autoI18n.cedulaAuto19')}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('autoI18n.cedulaAuto20')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info text */}
      {!verificationResult && cedulaValid && (
        <p className="text-xs text-muted-foreground text-center">
          {t('autoI18n.cedulaAuto21')}
        </p>
      )}
    </div>
  );
}
