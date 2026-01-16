import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLives } from '@/contexts/LivesContext';
import { useVault } from '@/contexts/VaultContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  PlayCircle,
  MessageSquare,
  Folder,
  Clock,
  AlertTriangle,
  CheckCircle,
  Upload,
  Radio,
  Star,
  Users,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SPECIALTIES = [
  'Cardiología',
  'Medicina Interna',
  'Pediatría',
  'Neurología',
  'Dermatología',
  'Oftalmología',
  'Neumología',
  'Endocrinología',
  'Psiquiatría',
  'Ginecología',
  'Traumatología',
  'Otro',
];

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { getLivesByDoctor, getRecordingsByDoctor, createLive } = useLives();
  const { getAccessibleFiles } = useVault();
  const { toast } = useToast();

  const [isLiveDialogOpen, setIsLiveDialogOpen] = useState(false);
  const [liveForm, setLiveForm] = useState({
    title: '',
    description: '',
    specialty: '',
  });
  const [isStartingLive, setIsStartingLive] = useState(false);

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const doctorProfile = user?.doctorProfile;
  const myLives = getLivesByDoctor(user?.id || '');
  const myRecordings = getRecordingsByDoctor(user?.id || '');
  const accessibleVaultFiles = getAccessibleFiles(user?.id || '');

  const isApproved = doctorProfile?.status === 'approved';
  const isPending = doctorProfile?.status === 'pending';
  const isRejected = doctorProfile?.status === 'rejected';

  const handleStartLive = async () => {
    if (!liveForm.title.trim() || !liveForm.specialty) {
      toast({
        title: 'Campos requeridos',
        description: 'El título y la especialidad son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setIsStartingLive(true);

    const result = await createLive({
      title: liveForm.title.trim(),
      description: liveForm.description.trim() || undefined,
      specialty: liveForm.specialty,
    });

    setIsStartingLive(false);

    if (result.success) {
      toast({
        title: '🔴 Live iniciado',
        description: 'Se notificó a tus suscriptores',
      });
      setIsLiveDialogOpen(false);
      setLiveForm({ title: '', description: '', specialty: '' });
      // Navigate to the live
      if (result.liveId) {
        navigate(`/live/${result.liveId}`);
      }
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Panel de Médico
            </h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido, {user?.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isApproved && (
              <>
                <Button onClick={() => navigate('/doctor/go-live')} className="gap-2 bg-red-600 hover:bg-red-700">
                  <Radio className="w-4 h-4" />
                  Iniciar Live
                </Button>
                <Badge variant="verified" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Verificado
                </Badge>
              </>
            )}
            {isPending && (
              <Badge variant="warning" className="gap-1">
                <Clock className="w-3 h-3" />
                Verificación Pendiente
              </Badge>
            )}
            {isRejected && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Verificación Rechazada
              </Badge>
            )}
          </div>
        </div>

        {/* Start Live Dialog */}
        <Dialog open={isLiveDialogOpen} onOpenChange={setIsLiveDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                Iniciar transmisión en vivo
              </DialogTitle>
              <DialogDescription>
                Tus suscriptores recibirán una notificación automáticamente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="live-title">Título *</Label>
                <Input
                  id="live-title"
                  placeholder="Ej: Cómo interpretar un ECG correctamente"
                  value={liveForm.title}
                  onChange={(e) => setLiveForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="live-specialty">Especialidad *</Label>
                <Select
                  value={liveForm.specialty}
                  onValueChange={(v) => setLiveForm(prev => ({ ...prev, specialty: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="live-description">Descripción (opcional)</Label>
                <Textarea
                  id="live-description"
                  placeholder="Describe brevemente de qué tratará tu live..."
                  value={liveForm.description}
                  onChange={(e) => setLiveForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">
                  {doctorProfile?.followersCount || 0} suscriptores serán notificados
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLiveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleStartLive}
                disabled={isStartingLive}
                className="bg-red-600 hover:bg-red-700"
              >
                {isStartingLive ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 mr-2" />
                    Iniciar Live
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pending/Rejected Alert */}
        {!isApproved && (
          <Card className={`mb-6 ${isPending ? 'border-warning/50 bg-warning/5' : 'border-destructive/50 bg-destructive/5'}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {isPending ? (
                  <Clock className="w-6 h-6 text-warning flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                )}
                <div>
                  <h3 className="font-semibold text-foreground">
                    {isPending ? 'Tu verificación está en proceso' : 'Verificación rechazada'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isPending
                      ? 'Estamos revisando tu documentación. Este proceso puede tomar 24-48 horas. Mientras tanto, puedes explorar la plataforma pero no podrás crear contenido ni atender consultas.'
                      : 'Tu solicitud de verificación fue rechazada. Por favor contacta a soporte para más información.'}
                  </p>
                  {isPending && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-warning w-1/2 animate-pulse" />
                      </div>
                      <span className="text-xs text-muted-foreground">En revisión</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-live/10 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-live" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{myLives.filter(l => l.status === 'live').length}</p>
                  <p className="text-xs text-muted-foreground">Lives Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate('/doctor/recordings')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-premium/10 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-premium" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{myRecordings.length}</p>
                  <p className="text-xs text-muted-foreground">Grabaciones</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Folder className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{accessibleVaultFiles.length}</p>
                  <p className="text-xs text-muted-foreground">Acceso Vault</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{doctorProfile?.rating || 0}</p>
                  <p className="text-xs text-muted-foreground">Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card className={!isApproved ? 'opacity-50 pointer-events-none' : 'hover:shadow-md transition-shadow cursor-pointer'}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-live/10 flex items-center justify-center">
                  <Radio className="w-6 h-6 text-live" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Iniciar Live</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Comienza una transmisión en vivo para tus pacientes
                  </p>
                  <Button 
                    size="sm" 
                    disabled={!isApproved}
                    onClick={() => isApproved && navigate('/doctor/go-live')}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isApproved ? 'Iniciar' : 'No disponible'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={!isApproved ? 'opacity-50 pointer-events-none' : 'hover:shadow-md transition-shadow cursor-pointer'}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Subir Contenido</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Sube videos, PDFs o imágenes educativas
                  </p>
                  <Button size="sm" variant="outline" disabled={!isApproved} onClick={() => navigate('/doctor/upload')}>
                    {isApproved ? 'Subir' : 'No disponible'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/chat')}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-info" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Consultas</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Revisa tus chats con pacientes
                  </p>
                  <Button size="sm" variant="outline">
                    Ver Chats
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vault Access Section */}
        {accessibleVaultFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary" />
                Archivos de Pacientes con Acceso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accessibleVaultFiles.slice(0, 5).map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      <Folder className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.category}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Paciente
                    </Badge>
                  </div>
                ))}
              </div>
              {accessibleVaultFiles.length > 5 && (
                <Button variant="ghost" className="w-full mt-3" onClick={() => navigate('/doctor/vault')}>
                  Ver todos ({accessibleVaultFiles.length})
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
