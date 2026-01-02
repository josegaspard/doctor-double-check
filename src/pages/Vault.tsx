import React, { useState, useRef } from 'react';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Folder,
  Upload,
  FileText,
  Image,
  Trash2,
  Share2,
  Lock,
  Plus,
  Loader2,
  UserPlus,
  UserMinus,
  Shield,
  Eye,
  Calendar,
  Stethoscope,
  CheckCircle,
} from 'lucide-react';
import { VaultFile } from '@/types';

const CATEGORIES = ['Laboratorios', 'Imagenología', 'Estudios Cardíacos', 'Recetas', 'Otros'];

// Mock doctors for permission management
const AVAILABLE_DOCTORS = [
  { id: 'doctor-001', name: 'Dr. Carlos Mendoza', specialty: 'Cardiología' },
  { id: 'doctor-002', name: 'Dra. Laura Jiménez', specialty: 'Medicina del Dolor' },
  { id: 'doctor-003', name: 'Dr. Roberto Sánchez', specialty: 'Endocrinología' },
];

export default function Vault() {
  const { files, uploadFile, deleteFile, grantAccess, revokeAccess, uploadProgress, isLoading } = useVault();
  const { role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('Otros');
  const [description, setDescription] = useState('');
  const [permissionFile, setPermissionFile] = useState<VaultFile | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  if (role !== 'patient') return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, selectedCategory, description);
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const handleGrantAccess = async (doctorId: string, doctorName: string) => {
    if (!permissionFile) return;
    await grantAccess(permissionFile.id, doctorId, doctorName);
    // Refresh the permission file data
    const updatedFiles = files.find(f => f.id === permissionFile.id);
    if (updatedFiles) setPermissionFile(updatedFiles);
  };

  const handleRevokeAccess = async (doctorId: string) => {
    if (!permissionFile) return;
    await revokeAccess(permissionFile.id, doctorId);
    // Refresh the permission file data
    const updatedFiles = files.find(f => f.id === permissionFile.id);
    if (updatedFiles) setPermissionFile(updatedFiles);
  };

  const openPermissions = (file: VaultFile) => {
    setPermissionFile(file);
    setShowPermissionDialog(true);
  };

  // Get fresh data for permission file
  const currentPermissionFile = permissionFile ? files.find(f => f.id === permissionFile.id) : null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Folder className="w-6 h-6 text-primary" />
          Mi Vault Médico
        </h1>
        <p className="text-muted-foreground mb-6">
          Guarda tus estudios de forma segura y controla quién puede verlos
        </p>

        {/* Security Info */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Tú controlas el acceso</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo los médicos que tú autorices podrán ver tus archivos. Puedes revocar el acceso en cualquier momento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir Archivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Seleccionar Archivo
            </Button>
            {uploadProgress !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subiendo...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mis Archivos ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="space-y-3">
                {files.map(file => (
                  <div key={file.id} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                      {getIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{file.category}</span>
                        <span>•</span>
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      
                      {/* Permissions info */}
                      <div className="flex items-center flex-wrap gap-2 mt-3">
                        {file.permissions.length > 0 ? (
                          file.permissions.map(perm => (
                            <Badge key={perm.doctorId} variant="verified" className="text-xs gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {perm.doctorName.split(' ').slice(0, 2).join(' ')}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Lock className="w-3 h-3" />
                            Sin accesos
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPermissions(file)}
                        className="gap-1"
                      >
                        <Share2 className="w-3 h-3" />
                        Permisos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFile(file.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Tu vault está vacío</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Sube tus estudios médicos para tenerlos siempre disponibles y compartirlos de forma segura con tus médicos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permission Management Dialog */}
        <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                Gestionar Permisos
              </DialogTitle>
              <DialogDescription>
                {currentPermissionFile?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Current Permissions */}
              {currentPermissionFile?.permissions && currentPermissionFile.permissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Con acceso actualmente:</h4>
                  <div className="space-y-2">
                    {currentPermissionFile.permissions.map(perm => (
                      <div key={perm.doctorId} className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{perm.doctorName}</p>
                            <p className="text-xs text-muted-foreground">
                              Desde {new Date(perm.grantedAt).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeAccess(perm.doctorId)}
                          className="text-destructive hover:text-destructive gap-1"
                        >
                          <UserMinus className="w-4 h-4" />
                          Revocar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Grant New Access */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Dar acceso a:</h4>
                <div className="space-y-2">
                  {AVAILABLE_DOCTORS.filter(
                    doc => !currentPermissionFile?.permissions?.some(p => p.doctorId === doc.id)
                  ).map(doctor => (
                    <div key={doctor.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doctor.name}</p>
                          <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGrantAccess(doctor.id, doctor.name)}
                        className="gap-1"
                      >
                        <UserPlus className="w-4 h-4" />
                        Dar acceso
                      </Button>
                    </div>
                  ))}
                  
                  {AVAILABLE_DOCTORS.filter(
                    doc => !currentPermissionFile?.permissions?.some(p => p.doctorId === doc.id)
                  ).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                      Todos los médicos disponibles ya tienen acceso
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={() => setShowPermissionDialog(false)} className="w-full">
              Cerrar
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
