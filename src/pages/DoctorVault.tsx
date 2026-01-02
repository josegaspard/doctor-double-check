import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FileText,
  Image,
  ArrowLeft,
  Lock,
  User,
  Calendar,
  Eye,
} from 'lucide-react';
import { Doctor, VaultFile } from '@/types';

export default function DoctorVault() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { getAccessibleFiles } = useVault();

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const doctor = user as Doctor;
  const accessibleFiles = getAccessibleFiles(doctor?.id || '');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  // Group files by patient
  const filesByPatient: Record<string, { patientName: string; files: VaultFile[] }> = {};
  accessibleFiles.forEach(file => {
    if (!filesByPatient[file.patientId]) {
      filesByPatient[file.patientId] = {
        patientName: `Paciente ${file.patientId.slice(-3)}`,
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
          Archivos médicos a los que tienes acceso por autorización del paciente
        </p>

        {/* Info Banner */}
        <Card className="mb-6 bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Acceso Controlado por el Paciente</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo puedes ver archivos cuando el paciente te ha concedido permiso explícito. 
                  El paciente puede revocar el acceso en cualquier momento.
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
                    <Badge variant="outline" className="ml-auto">{files.length} archivos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {files.map(file => (
                      <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
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
                          <Button variant="ghost" size="icon" title="Ver archivo">
                            <Eye className="w-4 h-4" />
                          </Button>
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
              Sin acceso a archivos
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Ningún paciente te ha concedido acceso a su vault médico todavía.
              Cuando un paciente te autorice, podrás ver sus archivos aquí.
            </p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
