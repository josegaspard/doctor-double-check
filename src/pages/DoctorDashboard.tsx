import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLives } from '@/contexts/LivesContext';
import { useVault } from '@/contexts/VaultContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  Newspaper,
  UserCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmailHistoryCard } from '@/components/doctor/EmailHistoryCard';
import { EmailStatsCard } from '@/components/doctor/EmailStatsCard';
import { EmailTrendsChart } from '@/components/doctor/EmailTrendsChart';
import { EarningsCard } from '@/components/doctor/EarningsCard';
import { ConsultationFeeEditor } from '@/components/doctor/ConsultationFeeEditor';
import { OfficeHoursConfig } from '@/components/doctor/OfficeHoursConfig';
import { DoctorAnalytics } from '@/components/doctor/DoctorAnalytics';
import { FundHoldsCard } from '@/components/doctor/FundHoldsCard';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';

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
  const { t } = useLanguage();
  const { getLivesByDoctor, createLive } = useLives();
  const { getAccessibleFiles } = useVault();
  const { toast } = useToast();

  const [isLiveDialogOpen, setIsLiveDialogOpen] = useState(false);
  const [liveForm, setLiveForm] = useState({
    title: '',
    description: '',
    specialty: '',
  });
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);

  // Fetch recordings count directly from database
  useEffect(() => {
    const fetchRecordingsCount = async () => {
      if (!user?.id) return;
      
      const { count, error } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id);

      if (!error && count !== null) {
        setRecordingsCount(count);
      }
    };

    fetchRecordingsCount();
  }, [user?.id]);

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const doctorProfile = user?.doctorProfile;
  const myLives = getLivesByDoctor(user?.id || '');
  const accessibleVaultFiles = getAccessibleFiles(user?.id || '');

  const isApproved = doctorProfile?.status === 'approved';
  const isPending = doctorProfile?.status === 'pending';
  const isRejected = doctorProfile?.status === 'rejected';

  const handleStartLive = async () => {
    if (!liveForm.title.trim() || !liveForm.specialty) {
      toast({
        title: t('common.required'),
        description: t('dashboard.startLive'),
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
        title: `🔴 ${t('dashboard.liveStarted')}`,
        description: t('dashboard.subscribersNotifiedSuccess'),
      });
      setIsLiveDialogOpen(false);
      setLiveForm({ title: '', description: '', specialty: '' });
      if (result.liveId) {
        navigate(`/live/${result.liveId}`);
      }
    } else {
      toast({
        title: t('common.error'),
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="font-heading text-xl sm:text-3xl font-bold text-foreground">
              {t('dashboard.title')}
            </h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-lg truncate">
              {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {isApproved && (
              <>
                <Button 
                  onClick={() => navigate('/doctor/go-live')} 
                  className="gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 h-9 sm:h-11 px-3 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline">{t('dashboard.startLive')}</span>
                  <span className="xs:hidden">Live</span>
                </Button>
                <Badge variant="verified" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{t('dashboard.verified')}</span>
                  <span className="sm:hidden">✓</span>
                </Badge>
                <DoctorBadge type={getDoctorBadgeType(doctorProfile?.totalConsultations || 0, doctorProfile?.rating || 0)} />
              </>
            )}
            {isPending && (
              <Badge variant="warning" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                {t('doctorStatus.pending')}
              </Badge>
            )}
            {isRejected && (
              <Badge variant="destructive" className="gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm">
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                {t('doctorStatus.rejected')}
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
                      ? 'Estamos revisando tu documentación. Este proceso puede tomar 24-48 horas. Mientras tanto, puedes explorar la plataforma pero no podrás crear contenido ni atender orientaciones.'
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

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="mb-6 sm:mb-8">
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="overview" className="px-3 sm:px-6 text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-6 lg:grid-cols-5">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-live/10 flex items-center justify-center flex-shrink-0">
                      <Radio className="w-5 h-5 sm:w-7 sm:h-7 text-live" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-3xl font-bold text-foreground">{myLives.filter(l => l.status === 'live').length}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Lives Activos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('/doctor/recordings')}
              >
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-premium/10 flex items-center justify-center flex-shrink-0">
                      <PlayCircle className="w-5 h-5 sm:w-7 sm:h-7 text-premium" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-3xl font-bold text-foreground">{recordingsCount}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Grabaciones</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Folder className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-3xl font-bold text-foreground">{accessibleVaultFiles.length}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Acceso Vault</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 sm:w-7 sm:h-7 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-3xl font-bold text-foreground">{doctorProfile?.rating || 0}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">Rating</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Consultation Fee Card - Editable */}
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-6">
                  <ConsultationFeeEditor variant="card" />
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className={!isApproved ? 'opacity-50 pointer-events-none' : 'hover:shadow-lg transition-all cursor-pointer border-2 hover:border-live/30'}>
                <CardContent className="p-4 sm:p-8">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-live/10 flex items-center justify-center flex-shrink-0">
                      <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-live" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Iniciar Live</h3>
                      <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2">
                        Comienza una transmisión en vivo
                      </p>
                      <Button 
                        disabled={!isApproved}
                        onClick={() => isApproved && navigate('/doctor/go-live')}
                        className="bg-red-600 hover:bg-red-700 h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                      >
                        {isApproved ? 'Iniciar' : 'No disponible'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={!isApproved ? 'opacity-50 pointer-events-none' : 'hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/30'}>
                <CardContent className="p-4 sm:p-8">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Subir Contenido</h3>
                      <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2">
                        Sube videos, PDFs o imágenes
                      </p>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <Button variant="outline" disabled={!isApproved} onClick={() => navigate('/doctor/upload')} className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4">
                          {isApproved ? 'Subir' : 'No disponible'}
                        </Button>
                        <Button variant="ghost" disabled={!isApproved} onClick={() => navigate('/doctor/content')} className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4">
                          Biblioteca
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Profile Card */}
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-accent/30" onClick={() => navigate(`/doctor/${user?.id}`)}>
                <CardContent className="p-4 sm:p-8">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Mi Perfil Profesional</h3>
                      <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2">
                        Edita tu educación, certificaciones y experiencia — tu CV profesional visible para pacientes
                      </p>
                      <Button variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                        Ver y editar perfil
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-info/30 md:col-span-2 lg:col-span-1" onClick={() => navigate('/chat')}>
                <CardContent className="p-4 sm:p-8">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-info/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Orientaciones</h3>
                      <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2">
                        Revisa tus chats con pacientes
                      </p>
                      <Button variant="outline" className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                        Ver Chats
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Earnings, Stats and Office Hours Grid */}
            <div className="grid gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Earnings Card */}
              <EarningsCard />

              {/* Email Stats */}
              <EmailStatsCard />

              {/* Email Trends Chart */}
              <EmailTrendsChart />
              
              {/* Office Hours Config */}
              <OfficeHoursConfig />
            </div>

            {/* Email History Section */}
            <div>
              <EmailHistoryCard />
            </div>

            {/* Fund Holds Section */}
            <FundHoldsCard />

        {/* Vault Access Section */}
        {accessibleVaultFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Folder className="w-5 h-5 text-primary" />
                  Expedientes de Pacientes con Acceso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accessibleVaultFiles.slice(0, 5).map(file => (
                    <div 
                      key={file.id} 
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                      onClick={() => navigate('/doctor/vault')}
                    >
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
          </TabsContent>

          <TabsContent value="analytics">
            <DoctorAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
