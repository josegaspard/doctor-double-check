import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { VaultFilePreviewModal } from '@/components/vault/VaultFilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Folder,
  FileText,
  Image,
  ArrowLeft,
  Lock,
  User,
  Calendar,
  Eye,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { VaultFile } from '@/contexts/VaultContext';
import { toast } from 'sonner';

export default function DoctorVault() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getAccessibleFiles } = useVault();
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // OTP state
  const [otpDialog, setOtpDialog] = useState<{ open: boolean; patientId: string; patientName: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [verifiedPatients, setVerifiedPatients] = useState<Set<string>>(new Set());

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const accessibleFiles = getAccessibleFiles(user?.id || '');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const handleViewFile = (file: VaultFile) => {
    // Check if we've verified OTP for this patient
    if (!verifiedPatients.has(file.patientId)) {
      setOtpDialog({
        open: true,
        patientId: file.patientId,
        patientName: file.patientName || `Paciente`,
      });
      setSelectedFile(file);
      return;
    }
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const handleRequestOtp = async (patientId: string) => {
    if (!user?.id) return;
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: { patientId },
      });

      if (error) throw new Error(error.message || 'Error al solicitar código');
      if (data && !data.success) throw new Error(data.error || 'Error del servidor');

      toast.success('Código OTP enviado al paciente (notificación + correo). Expira en 2 minutos.');
    } catch (error: any) {
      console.error('Error requesting OTP:', error);
      toast.error(error.message || 'Error al solicitar código');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!user?.id || !otpDialog) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase
        .from('expediente_otp')
        .select('*')
        .eq('patient_id', otpDialog.patientId)
        .eq('doctor_id', user.id)
        .eq('otp_code', otpCode.trim())
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Código inválido o expirado. Solicita uno nuevo.');
        return;
      }

      // Mark OTP as used
      await supabase
        .from('expediente_otp')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);

      // Grant access for this session
      setVerifiedPatients(prev => new Set([...prev, otpDialog.patientId]));
      setOtpDialog(null);
      setOtpCode('');
      toast.success('Verificación exitosa. Acceso al expediente concedido.');

      // Open the file that was originally requested
      if (selectedFile) {
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Error al verificar código');
    } finally {
      setIsVerifying(false);
    }
  };

  // Group files by patient
  const filesByPatient: Record<string, { patientName: string; files: VaultFile[] }> = {};
  accessibleFiles.forEach(file => {
    if (!filesByPatient[file.patientId]) {
      filesByPatient[file.patientId] = {
        patientName: file.patientName || `Paciente ${file.patientId.slice(-3)}`,
        files: [],
      };
    }
    filesByPatient[file.patientId].files.push(file);
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Panel
        </Button>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Folder className="w-6 h-6 text-primary" />
          Vault de Pacientes
        </h1>
        <p className="text-muted-foreground mb-6">
          Expedientes médicos a los que tienes acceso por autorización del paciente
        </p>

        {/* Info Banner */}
        <Card className="mb-6 bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Acceso Controlado por el Paciente + OTP</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para ver el expediente, necesitas un código de verificación (OTP) que el paciente recibirá por notificación y correo electrónico. 
                  El código expira en 2 minutos y solo puede usarse una vez. El acceso es de solo lectura (sin descarga).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Files by Patient */}
        {Object.keys(filesByPatient).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(filesByPatient).map(([patientId, { patientName, files }]) => (
              <Card key={patientId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {patientName}
                    <Badge variant="outline" className="ml-auto">{files.length} expedientes</Badge>
                    {verifiedPatients.has(patientId) && (
                      <Badge variant="success" className="gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Verificado
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!verifiedPatients.has(patientId) && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-warning" />
                        <span className="text-xs text-foreground font-medium">Requiere verificación OTP para acceder</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOtpDialog({ open: true, patientId, patientName });
                          setOtpCode('');
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        Verificar
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {files.map(file => (
                      <div 
                        key={file.id} 
                        className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg transition-colors ${
                          verifiedPatients.has(patientId) ? 'cursor-pointer hover:bg-muted' : 'opacity-60'
                        }`}
                        onClick={() => handleViewFile(file)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                          {getIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{file.category}</span>
                            <span>•</span>
                            <span>{formatSize(file.size)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                          </span>
                          {verifiedPatients.has(patientId) ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title={t('common.viewFile')}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewFile(file);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Lock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Sin acceso a expedientes
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Ningún paciente te ha concedido acceso a su vault médico todavía.
              Cuando un paciente te autorice, podrás ver sus expedientes aquí.
            </p>
          </Card>
        )}
      </div>

      {/* OTP Verification Dialog */}
      <Dialog open={!!otpDialog?.open} onOpenChange={(open) => {
        if (!open) {
          setOtpDialog(null);
          setOtpCode('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Verificación de Acceso
            </DialogTitle>
            <DialogDescription>
              Para acceder al expediente de <strong>{otpDialog?.patientName}</strong>, ingresa el código OTP que el paciente te proporcionará.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Input
                placeholder="Código de 6 dígitos"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground text-center">
                El paciente recibirá el código por notificación y correo electrónico. Expira en 2 minutos.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => otpDialog && handleRequestOtp(otpDialog.patientId)}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Solicitar código al paciente
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOtpDialog(null); setOtpCode(''); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleVerifyOtp} 
              disabled={otpCode.length !== 6 || isVerifying}
              className="gap-2"
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Verificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Modal - view only for doctors */}
      <VaultFilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        viewOnly={true}
      />
    </MainLayout>
  );
}
