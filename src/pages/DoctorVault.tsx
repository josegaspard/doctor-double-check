import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { useOtp } from '@/contexts/OtpContext';
import MainLayout from '@/components/layout/MainLayout';
import { VaultFilePreviewModal } from '@/components/vault/VaultFilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Folder, FileText, Image, ArrowLeft, Lock, User,
  Calendar, Eye, KeyRound, ShieldCheck,
} from 'lucide-react';
import { VaultFile } from '@/contexts/VaultContext';

export default function DoctorVault() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getAccessibleFiles } = useVault();
  const { openOtpForPatient, isPatientVerified } = useOtp();
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoOpenHandled, setAutoOpenHandled] = useState(false);

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const accessibleFiles = getAccessibleFiles(user?.id || '');

  // Auto-open patient content when redirected from OTP verification
  const targetPatientId = searchParams.get('patient');
  useEffect(() => {
    if (!targetPatientId || autoOpenHandled) return;
    if (!isPatientVerified(targetPatientId)) return;
    const patientFiles = accessibleFiles.filter(f => f.patientId === targetPatientId);
    if (patientFiles.length > 0) {
      setSelectedFile(patientFiles[0]);
      setIsPreviewOpen(true);
    }
    setAutoOpenHandled(true);
    // Clean up the query param
    setSearchParams({}, { replace: true });
  }, [targetPatientId, autoOpenHandled, accessibleFiles, isPatientVerified, setSearchParams]);

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
    if (!isPatientVerified(file.patientId)) {
      openOtpForPatient(file.patientId, file.patientName || 'Paciente');
      setSelectedFile(file);
      return;
    }
    setSelectedFile(file);
    setIsPreviewOpen(true);
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="hidden sm:inline-flex mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Panel
        </Button>

        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Vault de Pacientes
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Expedientes médicos a los que tienes acceso por autorización del paciente
        </p>

        {/* Info Banner */}
        <Card className="mb-6 bg-info/5 border-info/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Acceso Controlado por el Paciente + OTP</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Para ver el expediente, necesitas un código de verificación (OTP) que el paciente recibirá por notificación, correo electrónico o SMS.
                  El código expira en 2 minutos y solo puede usarse una vez.
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
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{patientName}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{files.length} exp.</Badge>
                    {isPatientVerified(patientId) && (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <ShieldCheck className="w-3 h-3" />
                        Verificado
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {!isPatientVerified(patientId) && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <KeyRound className="w-4 h-4 text-warning flex-shrink-0" />
                        <span className="text-xs text-foreground font-medium truncate">Requiere verificación OTP</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openOtpForPatient(patientId, patientName)}
                        className="h-8 text-xs gap-1 flex-shrink-0"
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
                        className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg transition-colors min-w-0 ${
                          isPatientVerified(patientId) ? 'cursor-pointer hover:bg-muted active:scale-[0.98]' : 'opacity-60'
                        }`}
                        onClick={() => handleViewFile(file)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                          {getIcon(file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="truncate">{file.category}</span>
                            <span>•</span>
                            <span className="flex-shrink-0">{formatSize(file.size)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                          </span>
                          {isPatientVerified(patientId) ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-9 h-9"
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
          <Card className="p-8 sm:p-12 text-center">
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
              Sin acceso a expedientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Ningún paciente te ha concedido acceso a su vault médico todavía.
            </p>
          </Card>
        )}
      </div>

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
