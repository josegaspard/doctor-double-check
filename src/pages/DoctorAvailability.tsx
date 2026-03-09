import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Trash2,
  Settings2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorAvailability, AvailabilityType, DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function AvailabilityCard({
  availability,
  onConfirm,
  onCancel,
  onNotify,
  language,
  t,
  isManaging,
  isSelected,
  onToggleSelect,
}: {
  availability: DoctorAvailability;
  onConfirm: () => void;
  onCancel: () => void;
  onNotify: () => void;
  language: 'es' | 'en';
  t: (key: string) => string;
  isManaging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const availabilityTypes = [
    { value: 'live', icon: Video },
    { value: 'consultation', icon: MessageSquare },
    { value: 'office_hours', icon: Clock },
  ];
  const typeConfig = availabilityTypes.find(t => t.value === availability.type);
  const Icon = typeConfig?.icon || Clock;
  const isPast = availability.scheduledAt < new Date();

  const getStatusBadge = () => {
    switch (availability.status) {
      case 'confirmed':
        return <Badge variant="verified">{t('availability.confirmed')}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t('availability.cancelled')}</Badge>;
      case 'completed':
        return <Badge variant="secondary">{t('availability.completed')}</Badge>;
      default:
        return <Badge variant="warning">{t('availability.scheduled')}</Badge>;
    }
  };

  return (
    <Card className={cn(
      'transition-all',
      isPast && 'opacity-60',
      availability.status === 'cancelled' && 'border-destructive/50',
      isManaging && isSelected && 'ring-2 ring-primary',
    )}
      onClick={isManaging ? onToggleSelect : undefined}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {isManaging && (
            <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.()} />
            </div>
          )}
          <div className={cn(
            'p-2 sm:p-3 rounded-lg flex-shrink-0',
            availability.type === 'live' ? 'bg-red-500/10 text-red-500' :
            availability.type === 'consultation' ? 'bg-blue-500/10 text-blue-500' :
            'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate text-sm sm:text-base">{availability.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {format(availability.scheduledAt, language === 'es' ? "EEEE d 'de' MMMM, HH:mm" : "EEEE MMMM d, HH:mm", {
                    locale: language === 'es' ? es : enUS,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'es' ? 'Duración' : 'Duration'}: {availability.durationMinutes} min
                </p>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge()}
              </div>
            </div>
            
            {availability.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">
                {availability.description}
              </p>
            )}

            {!isManaging && availability.status === 'scheduled' && !isPast && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="default" onClick={onConfirm} className="h-8 text-xs sm:text-sm">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  {t('common.confirm')}
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs sm:text-sm">
                  <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  {t('common.cancel')}
                </Button>
                {!availability.notificationsSent && (
                  <Button size="sm" variant="secondary" onClick={onNotify} className="h-8 text-xs sm:text-sm">
                    <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    {language === 'es' ? 'Notificar' : 'Notify'}
                  </Button>
                )}
              </div>
            )}

            {!isManaging && availability.status === 'confirmed' && !isPast && !availability.notificationsSent && (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={onNotify} className="h-8 text-xs sm:text-sm">
                  <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  {t('availability.notifySubscribers')}
                </Button>
              </div>
            )}

            {availability.notificationsSent && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <Send className="h-3 w-3" />
                {language === 'es' ? 'Notificaciones enviadas' : 'Notifications sent'}
              </div>
            )}

            {availability.reminderSent && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                <Bell className="h-3 w-3" />
                {language === 'es' ? 'Recordatorio automático enviado' : 'Auto reminder sent'}
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
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const {
    myAvailabilities,
    isLoading,
    createAvailability,
    confirmAvailability,
    cancelAvailability,
    notifySubscribers,
    deleteAvailabilities,
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
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  if (isAuthLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            <span>{t('common.loading')}</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const availabilityTypeOptions = [
    { value: 'live', label: 'Live' },
    { value: 'consultation', label: language === 'es' ? 'Consulta' : 'Consultation' },
    { value: 'office_hours', label: language === 'es' ? 'Horario de oficina' : 'Office hours' },
  ];

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast({ title: t('common.error'), description: language === 'es' ? 'El título es requerido' : 'Title is required', variant: 'destructive' });
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
      toast({ title: t('common.success'), description: language === 'es' ? 'Disponibilidad programada correctamente' : 'Availability scheduled successfully' });
      setIsDialogOpen(false);
      setFormData({ title: '', description: '', type: 'live', date: new Date(), time: '10:00', duration: 60 });
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
    }
  };

  const handleConfirm = async (id: string) => {
    const result = await confirmAvailability(id);
    if (result.success) toast({ description: language === 'es' ? 'Disponibilidad confirmada' : 'Availability confirmed' });
  };

  const handleCancel = async (id: string) => {
    const result = await cancelAvailability(id);
    if (result.success) toast({ description: language === 'es' ? 'Disponibilidad cancelada' : 'Availability cancelled' });
  };

  const handleNotify = async (id: string) => {
    const result = await notifySubscribers(id);
    if (result.success) {
      toast({
        title: language === 'es' ? 'Notificaciones enviadas' : 'Notifications sent',
        description: language === 'es' ? `Se notificó a ${result.notified} suscriptores` : `${result.notified} subscribers notified`,
      });
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: DoctorAvailability[]) => {
    const allIds = items.map(a => a.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach(id => next.delete(id));
      else allIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeletingBulk(true);
    const result = await deleteAvailabilities(Array.from(selectedIds));
    setIsDeletingBulk(false);
    setShowDeleteDialog(false);
    if (result.success) {
      setSelectedIds(new Set());
      setIsManaging(false);
      toast({ description: t('manage.deleted') });
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
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
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lives')} className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{t('availability.title')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">{subscriberCount} {language === 'es' ? 'suscriptores' : 'subscribers'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {myAvailabilities.length > 0 && (
              <Button
                variant={isManaging ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setIsManaging(!isManaging); setSelectedIds(new Set()); }}
                className="gap-1.5"
              >
                <Settings2 className="w-4 h-4" />
                {isManaging ? t('manage.done') : t('manage.manage')}
              </Button>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('availability.schedule')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto mx-0 sm:mx-auto rounded-none sm:rounded-lg h-full sm:h-auto">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-base sm:text-lg">{language === 'es' ? 'Programar disponibilidad' : 'Schedule availability'}</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    {language === 'es' ? 'Crea un horario de live, consulta u horario de oficina' : 'Create a live, consultation, or office hours schedule'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
                  {/* Visual type selector */}
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">{language === 'es' ? 'Tipo' : 'Type'}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'live' as AvailabilityType, icon: Video, label: 'Live', color: 'text-red-500 border-red-500 bg-red-500/10' },
                        { value: 'consultation' as AvailabilityType, icon: MessageSquare, label: language === 'es' ? 'Consulta' : 'Consultation', color: 'text-blue-500 border-blue-500 bg-blue-500/10' },
                        { value: 'office_hours' as AvailabilityType, icon: Clock, label: language === 'es' ? 'Oficina' : 'Office', color: 'text-muted-foreground border-border bg-muted/50' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: opt.value }))}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-xs font-medium',
                            formData.type === opt.value
                              ? opt.color
                              : 'border-border text-muted-foreground hover:border-primary/30'
                          )}
                        >
                          <opt.icon className="w-5 h-5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">{language === 'es' ? 'Título' : 'Title'}</Label>
                    <Input
                      id="title"
                      placeholder={language === 'es' ? 'Ej: Live sobre cardiología preventiva' : 'E.g.: Preventive cardiology live'}
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{language === 'es' ? 'Descripción (opcional)' : 'Description (optional)'}</Label>
                    <Textarea
                      id="description"
                      placeholder={language === 'es' ? 'Describe brevemente el contenido...' : 'Briefly describe the content...'}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === 'es' ? 'Fecha' : 'Date'}</Label>
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
                      <Label htmlFor="time">{language === 'es' ? 'Hora' : 'Time'}</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">{language === 'es' ? 'Duración (minutos)' : 'Duration (minutes)'}</Label>
                    <select
                      id="duration"
                      value={String(formData.duration)}
                      onChange={(e) => setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value, 10) }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">{language === 'es' ? '1 hora' : '1 hour'}</option>
                      <option value="90">{language === 'es' ? '1.5 horas' : '1.5 hours'}</option>
                      <option value="120">{language === 'es' ? '2 horas' : '2 hours'}</option>
                    </select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleCreate} disabled={isSubmitting}>
                    {isSubmitting ? (language === 'es' ? 'Creando...' : 'Creating...') : (language === 'es' ? 'Crear' : 'Create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isManaging && (
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-xs text-muted-foreground">{t('manage.selectHint')}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggleSelectAll(myAvailabilities)}>
                {myAvailabilities.every(a => selectedIds.has(a.id)) ? t('manage.deselectAll') : t('manage.selectAll')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShowDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')} ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

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
                {language === 'es' ? 'Próximos' : 'Upcoming'} ({upcomingAvailabilities.length})
              </h2>
              {upcomingAvailabilities.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    {language === 'es' ? 'No tienes disponibilidades programadas' : 'No scheduled availabilities'}
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
                      t={t}
                      isManaging={isManaging}
                      isSelected={selectedIds.has(availability.id)}
                      onToggleSelect={() => toggleSelect(availability.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            {pastAvailabilities.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                  {language === 'es' ? 'Historial' : 'History'} ({pastAvailabilities.length})
                </h2>
                <div className="space-y-3">
                  {pastAvailabilities.map(availability => (
                    <AvailabilityCard
                      key={availability.id}
                      availability={availability}
                      onConfirm={() => {}}
                      onCancel={() => {}}
                      onNotify={() => {}}
                      language={language}
                      t={t}
                      isManaging={isManaging}
                      isSelected={selectedIds.has(availability.id)}
                      onToggleSelect={() => toggleSelect(availability.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sticky mobile bottom bar */}
        {isManaging && selectedIds.size > 0 && (
          <div className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-50 px-3 pb-safe">
            <div className="max-w-4xl mx-auto bg-destructive text-destructive-foreground rounded-lg p-3 flex items-center justify-between shadow-lg">
              <span className="text-sm font-medium">
                {selectedIds.size} {t('manage.selected')}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')}
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('manage.confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('manage.confirmDeleteDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingBulk}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingBulk ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('manage.deleting')}</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-2" />{t('common.delete')} ({selectedIds.size})</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
