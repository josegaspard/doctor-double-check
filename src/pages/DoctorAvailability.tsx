import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Video,
  MessageSquare,
  Users,
  Bell,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorAvailability, AvailabilityType, DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const availabilityTypes: { value: AvailabilityType; label: string; icon: React.ElementType }[] = [
  { value: 'live', label: 'Live', icon: Video },
  { value: 'consultation', label: 'Consulta', icon: MessageSquare },
  { value: 'office_hours', label: 'Horario de oficina', icon: Clock },
];

function AvailabilityCard({
  availability,
  onConfirm,
  onCancel,
  onNotify,
  language,
}: {
  availability: DoctorAvailability;
  onConfirm: () => void;
  onCancel: () => void;
  onNotify: () => void;
  language: 'es' | 'en';
}) {
  const typeConfig = availabilityTypes.find(t => t.value === availability.type);
  const Icon = typeConfig?.icon || Clock;
  const isPast = availability.scheduledAt < new Date();

  const getStatusBadge = () => {
    switch (availability.status) {
      case 'confirmed':
        return <Badge variant="verified">Confirmado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completado</Badge>;
      default:
        return <Badge variant="warning">Programado</Badge>;
    }
  };

  return (
    <Card className={cn(
      'transition-all',
      isPast && 'opacity-60',
      availability.status === 'cancelled' && 'border-destructive/50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-3 rounded-lg',
            availability.type === 'live' ? 'bg-red-500/10 text-red-500' :
            availability.type === 'consultation' ? 'bg-blue-500/10 text-blue-500' :
            'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold truncate">{availability.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(availability.scheduledAt, "EEEE d 'de' MMMM, HH:mm", {
                    locale: language === 'es' ? es : enUS,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Duración: {availability.durationMinutes} min
                </p>
              </div>
              {getStatusBadge()}
            </div>
            
            {availability.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {availability.description}
              </p>
            )}

            {availability.status === 'scheduled' && !isPast && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="default" onClick={onConfirm}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirmar
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                {!availability.notificationsSent && (
                  <Button size="sm" variant="secondary" onClick={onNotify}>
                    <Bell className="h-4 w-4 mr-1" />
                    Notificar
                  </Button>
                )}
              </div>
            )}

            {availability.status === 'confirmed' && !isPast && !availability.notificationsSent && (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={onNotify}>
                  <Bell className="h-4 w-4 mr-1" />
                  Notificar suscriptores
                </Button>
              </div>
            )}

            {availability.notificationsSent && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <Send className="h-3 w-3" />
                Notificaciones enviadas
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoctorAvailabilityPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const {
    myAvailabilities,
    isLoading,
    createAvailability,
    confirmAvailability,
    cancelAvailability,
    notifySubscribers,
  } = useDoctorAvailability();
  const { subscriberCount } = useSubscriptions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'live' as AvailabilityType,
    date: new Date(),
    time: '10:00',
    duration: 60,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect non-doctors
  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'El título es requerido', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const [hours, minutes] = formData.time.split(':').map(Number);
    const scheduledAt = new Date(formData.date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const result = await createAvailability({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      type: formData.type,
      scheduledAt,
      durationMinutes: formData.duration,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast({ title: 'Éxito', description: 'Disponibilidad programada correctamente' });
      setIsDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'live',
        date: new Date(),
        time: '10:00',
        duration: 60,
      });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleConfirm = async (id: string) => {
    const result = await confirmAvailability(id);
    if (result.success) {
      toast({ description: 'Disponibilidad confirmada' });
    }
  };

  const handleCancel = async (id: string) => {
    const result = await cancelAvailability(id);
    if (result.success) {
      toast({ description: 'Disponibilidad cancelada' });
    }
  };

  const handleNotify = async (id: string) => {
    const result = await notifySubscribers(id);
    if (result.success) {
      toast({
        title: 'Notificaciones enviadas',
        description: `Se notificó a ${result.notified} suscriptores`,
      });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const upcomingAvailabilities = myAvailabilities.filter(
    a => a.scheduledAt >= new Date() && a.status !== 'cancelled'
  );
  const pastAvailabilities = myAvailabilities.filter(
    a => a.scheduledAt < new Date() || a.status === 'cancelled'
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t('availability.title')}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                {subscriberCount} suscriptores recibirán tus notificaciones
              </p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Programar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Programar disponibilidad</DialogTitle>
                <DialogDescription>
                  Crea un horario de live, consulta u horario de oficina
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as AvailabilityType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availabilityTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Ej: Live sobre cardiología preventiva"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe brevemente el contenido..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.date, 'PPP', { locale: language === 'es' ? es : enUS })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.date}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Hora</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (minutos)</Label>
                  <Select
                    value={formData.duration.toString()}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, duration: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1.5 horas</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Próximos ({upcomingAvailabilities.length})
              </h2>
              {upcomingAvailabilities.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No tienes disponibilidades programadas
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcomingAvailabilities.map(availability => (
                    <AvailabilityCard
                      key={availability.id}
                      availability={availability}
                      onConfirm={() => handleConfirm(availability.id)}
                      onCancel={() => handleCancel(availability.id)}
                      onNotify={() => handleNotify(availability.id)}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            {pastAvailabilities.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                  Historial ({pastAvailabilities.length})
                </h2>
                <div className="space-y-3">
                  {pastAvailabilities.slice(0, 5).map(availability => (
                    <AvailabilityCard
                      key={availability.id}
                      availability={availability}
                      onConfirm={() => {}}
                      onCancel={() => {}}
                      onNotify={() => {}}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}