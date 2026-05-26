import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorAvailability, AvailabilityType, DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CalendarGrid } from '@/components/availability/CalendarGrid';

type ViewMode = 'month' | 'week' | 'day';

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
    moveAvailability,
    notifyDateChange,
  } = useDoctorAvailability();
  const { subscriberCount } = useSubscriptions();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DoctorAvailability | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'live' as AvailabilityType,
    date: new Date(),
    time: '10:00',
    duration: 60,
    invitees: [] as string[],
  });
  const [inviteeInput, setInviteeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    title: string;
    oldDate: Date;
    newDate: Date;
    inviteesCount: number;
  } | null>(null);
  const [isNotifyingMove, setIsNotifyingMove] = useState(false);

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

  // Navigation
  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(prev => subMonths(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else setCurrentDate(prev => subDays(prev, 1));
  };
  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else setCurrentDate(prev => addDays(prev, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const getHeaderLabel = () => {
    const locale = language === 'es' ? es : enUS;
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale });
    if (viewMode === 'week') {
      const start = format(currentDate, 'd MMM', { locale });
      const end = format(addDays(currentDate, 6), 'd MMM yyyy', { locale });
      return `${start} – ${end}`;
    }
    return format(currentDate, language === 'es' ? "EEEE d 'de' MMMM yyyy" : 'EEEE, MMMM d, yyyy', { locale });
  };

  // Day click → open create dialog with that date
  const handleDayClick = (date: Date) => {
    setFormData(prev => ({ ...prev, date, title: '', description: '', type: 'live', time: '10:00', duration: 60, invitees: [] }));
    setInviteeInput('');
    setSelectedEvent(null);
    setIsDialogOpen(true);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const commitInviteeInput = () => {
    const raw = inviteeInput.trim().replace(/[;,]+$/, '');
    if (!raw) return;
    const parts = raw.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    setFormData(prev => {
      const next = new Set(prev.invitees);
      let added = false;
      for (const p of parts) {
        if (!EMAIL_RE.test(p)) {
          toast({ title: t('common.error'), description: `${p}: ${language === 'es' ? 'no es un correo válido' : 'is not a valid email'}`, variant: 'destructive' });
          continue;
        }
        if (!next.has(p)) { next.add(p); added = true; }
      }
      return added ? { ...prev, invitees: Array.from(next) } : prev;
    });
    setInviteeInput('');
  };

  const removeInvitee = (email: string) => {
    setFormData(prev => ({ ...prev, invitees: prev.invitees.filter(e => e !== email) }));
  };

  const handleMoveEvent = async (id: string, newDate: Date) => {
    const target = myAvailabilities.find(a => a.id === id);
    if (!target) return;
    const result = await moveAvailability(id, newDate);
    if (!result.success) {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
      return;
    }
    setPendingMove({
      id,
      title: target.title,
      oldDate: result.oldDate ?? target.scheduledAt,
      newDate: result.newDate ?? newDate,
      inviteesCount: target.extraInvitees.length,
    });
  };

  const handleConfirmNotifyMove = async () => {
    if (!pendingMove) return;
    setIsNotifyingMove(true);
    const result = await notifyDateChange(pendingMove.id, pendingMove.oldDate, pendingMove.newDate);
    setIsNotifyingMove(false);
    if (result.success) {
      const subs = result.notified ?? 0;
      const invs = result.invitees ?? 0;
      toast({
        title: language === 'es' ? 'Cambio notificado' : 'Change notified',
        description: language === 'es'
          ? `${subs} suscriptor${subs === 1 ? '' : 'es'}${invs ? ` · ${invs} invitado${invs === 1 ? '' : 's'}` : ''}`
          : `${subs} subscriber${subs === 1 ? '' : 's'}${invs ? ` · ${invs} invitee${invs === 1 ? '' : 's'}` : ''}`,
      });
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
    }
    setPendingMove(null);
  };

  // Event click → show detail dialog
  const handleEventClick = (availability: DoctorAvailability) => {
    setSelectedEvent(availability);
  };

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
      extraInvitees: formData.invitees,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: t('common.success'), description: language === 'es' ? 'Disponibilidad programada' : 'Availability scheduled' });
      setIsDialogOpen(false);
      setFormData({ title: '', description: '', type: 'live', date: new Date(), time: '10:00', duration: 60, invitees: [] });
      setInviteeInput('');
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
    }
  };

  const handleConfirm = async (id: string) => {
    const result = await confirmAvailability(id);
    if (result.success) {
      toast({ description: language === 'es' ? 'Disponibilidad confirmada' : 'Availability confirmed' });
      setSelectedEvent(null);
    }
  };
  const handleCancel = async (id: string) => {
    const result = await cancelAvailability(id);
    if (result.success) {
      toast({ description: language === 'es' ? 'Disponibilidad cancelada' : 'Availability cancelled' });
      setSelectedEvent(null);
    }
  };
  const handleNotify = async (id: string) => {
    const result = await notifySubscribers(id);
    if (result.success) {
      toast({
        title: language === 'es' ? 'Notificaciones enviadas' : 'Notifications sent',
        description: language === 'es' ? `Se notificó a ${result.notified} suscriptores` : `${result.notified} subscribers notified`,
      });
      setSelectedEvent(null);
    } else {
      toast({ title: t('common.error'), description: result.error, variant: 'destructive' });
    }
  };

  // Eliminar un solo evento desde el dialog de detalle. Reutiliza
  // deleteAvailabilities pasando un array de 1 id.
  const [confirmDeleteSingle, setConfirmDeleteSingle] = useState<string | null>(null);
  const handleDeleteSingle = async (id: string) => {
    const result = await deleteAvailabilities([id]);
    if (result.success) {
      toast({ description: language === 'es' ? 'Evento eliminado' : 'Event deleted' });
      setSelectedEvent(null);
      setConfirmDeleteSingle(null);
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

  const isPast = selectedEvent ? selectedEvent.scheduledAt < new Date() : false;
  const eventTypeConfig: Record<string, { color: string; icon: typeof Video; label: string }> = {
    // 3 tipos de evento en paleta brandbook (distintos entre sí):
    //   live → Metallic Blue (--secondary) — el más prominente
    //   consultation → Blue Lagoon (--primary)
    //   office_hours → Comfort Blue (--accent)
    live: { color: 'bg-secondary/15 text-secondary', icon: Video, label: 'Live' },
    consultation: { color: 'bg-primary/10 text-primary', icon: MessageSquare, label: language === 'es' ? 'Orientación' : 'Consultation' },
    office_hours: { color: 'bg-accent/15 text-accent', icon: Clock, label: language === 'es' ? 'Disponible' : 'Available' },
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="back" size="icon" onClick={() => navigate('/lives')} className="hidden sm:flex h-9 w-9 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t('availability.title')}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {subscriberCount} {language === 'es' ? 'suscriptores' : 'subscribers'}
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
            <Button onClick={() => { setSelectedEvent(null); setFormData(prev => ({ ...prev, date: currentDate, title: '', description: '' })); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('availability.schedule')}
            </Button>
          </div>
        </div>

        {/* Calendar toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>
              {language === 'es' ? 'Hoy' : 'Today'}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-base sm:text-lg font-semibold capitalize">{getHeaderLabel()}</h2>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="month" className="text-xs px-3">{language === 'es' ? 'Mes' : 'Month'}</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">{language === 'es' ? 'Semana' : 'Week'}</TabsTrigger>
              <TabsTrigger value="day" className="text-xs px-3">{language === 'es' ? 'Día' : 'Day'}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { color: 'bg-secondary', label: 'Live' },
            { color: 'bg-primary', label: language === 'es' ? 'Orientación' : 'Consultation' },
            { color: 'bg-accent', label: language === 'es' ? 'Disponible' : 'Available' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn('w-3 h-3 rounded-sm', item.color)} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Manage bar */}
        {isManaging && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 sm:p-4 rounded-xl bg-card border border-primary/30 shadow-md ring-1 ring-primary/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-card-foreground">{t('manage.selectHint')}</p>
            </div>
            <div className="flex items-center gap-2">
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

        {/* Calendar */}
        {isLoading ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground mx-auto mb-3" />
            {t('common.loading')}
          </CardContent></Card>
        ) : (
          <CalendarGrid
            currentDate={currentDate}
            viewMode={viewMode}
            availabilities={myAvailabilities}
            language={language}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
            isManaging={isManaging}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onMoveEvent={handleMoveEvent}
          />
        )}

        {/* Event detail dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
          <DialogContent className="sm:max-w-md">
            {selectedEvent && (() => {
              const cfg = eventTypeConfig[selectedEvent.type] || eventTypeConfig.office_hours;
              const Icon = cfg.icon;
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', cfg.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <DialogTitle>{selectedEvent.title}</DialogTitle>
                        <DialogDescription>
                          {format(selectedEvent.scheduledAt, language === 'es' ? "EEEE d 'de' MMMM, HH:mm" : 'EEEE MMMM d, HH:mm', {
                            locale: language === 'es' ? es : enUS,
                          })} · {selectedEvent.durationMinutes} min
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedEvent.status === 'confirmed' ? 'verified' : selectedEvent.status === 'cancelled' ? 'destructive' : 'warning'}>
                        {t(`availability.${selectedEvent.status}`)}
                      </Badge>
                      <Badge variant="secondary">{cfg.label}</Badge>
                    </div>
                    {selectedEvent.description && (
                      <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                    )}
                    {selectedEvent.notificationsSent && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1 w-fit">
                        <Send className="h-3 w-3" />
                        {language === 'es' ? 'Notificaciones enviadas a suscriptores' : 'Notifications sent to subscribers'}
                      </div>
                    )}
                    {selectedEvent.reminderSent && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 border border-secondary/25 rounded-full px-2.5 py-1 w-fit">
                        <Bell className="h-3 w-3" />
                        {language === 'es' ? 'Recordatorio enviado' : 'Reminder sent'}
                      </div>
                    )}
                    {selectedEvent.extraInvitees.length > 0 && (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1.5 flex items-center gap-1.5">
                          <Send className="w-3 h-3" />
                          {language === 'es' ? 'Invitados extra' : 'Extra invitees'} ({selectedEvent.extraInvitees.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedEvent.extraInvitees.map(email => (
                            <span key={email} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{email}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteSingle(selectedEvent.id)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> {language === 'es' ? 'Eliminar' : 'Delete'}
                    </Button>
                    {!isPast && selectedEvent.status !== 'cancelled' && selectedEvent.status !== 'completed' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {selectedEvent.status === 'scheduled' && (
                          <Button size="sm" onClick={() => handleConfirm(selectedEvent.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> {t('common.confirm')}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleCancel(selectedEvent.id)}>
                          <XCircle className="h-4 w-4 mr-1" /> {t('common.cancel')}
                        </Button>
                        {!selectedEvent.notificationsSent && (
                          <Button size="sm" variant="secondary" onClick={() => handleNotify(selectedEvent.id)}>
                            <Bell className="h-4 w-4 mr-1" /> {language === 'es' ? 'Notificar' : 'Notify'}
                          </Button>
                        )}
                      </div>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Create dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto mx-0 sm:mx-auto rounded-none sm:rounded-lg h-full sm:h-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg">{language === 'es' ? 'Programar disponibilidad' : 'Schedule availability'}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {language === 'es' ? 'Crea un horario de live, orientación o disponibilidad' : 'Create a live, consultation, or availability schedule'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">{language === 'es' ? 'Tipo' : 'Type'}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'live' as AvailabilityType, icon: Video, label: 'Live', color: 'text-secondary border-secondary bg-secondary/15' },
                    { value: 'consultation' as AvailabilityType, icon: MessageSquare, label: language === 'es' ? 'Orientación' : 'Consultation', color: 'text-primary border-primary bg-primary/10' },
                    { value: 'office_hours' as AvailabilityType, icon: Clock, label: language === 'es' ? 'Disponible' : 'Available', color: 'text-accent border-accent bg-accent/15' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: opt.value }))}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-xs font-medium',
                        formData.type === opt.value ? opt.color : 'border-border text-muted-foreground hover:border-primary/30'
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
                  placeholder={language === 'es' ? 'Describe brevemente...' : 'Briefly describe...'}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{language === 'es' ? 'Fecha' : 'Date'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-9 sm:h-10 text-xs sm:text-sm">
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{format(formData.date, 'd MMM yyyy', { locale: language === 'es' ? es : enUS })}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="time" className="text-xs sm:text-sm">{language === 'es' ? 'Hora' : 'Time'}</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="h-9 sm:h-10 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{language === 'es' ? 'Duración' : 'Duration'}</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { value: 15, label: '15m' },
                    { value: 30, label: '30m' },
                    { value: 45, label: '45m' },
                    { value: 60, label: '1h' },
                    { value: 90, label: '1.5h' },
                    { value: 120, label: '2h' },
                  ].map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, duration: d.value }))}
                      className={cn(
                        'h-9 rounded-md border text-xs font-medium transition-colors',
                        formData.duration === d.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary/40'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra invitees (emails) */}
              <div className="space-y-1.5">
                <Label htmlFor="invitees" className="text-xs sm:text-sm flex items-center gap-1.5">
                  {language === 'es' ? 'Invitados extra (opcional)' : 'Extra invitees (optional)'}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {language === 'es' ? '— se suman a tus suscriptores' : '— added to your subscribers'}
                  </span>
                </Label>
                <Input
                  id="invitees"
                  type="email"
                  inputMode="email"
                  placeholder={language === 'es' ? 'correo@ejemplo.com (Enter o coma)' : 'email@example.com (Enter or comma)'}
                  value={inviteeInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/[,;\s]$/.test(v)) { setInviteeInput(v); setTimeout(commitInviteeInput, 0); }
                    else setInviteeInput(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                      e.preventDefault();
                      commitInviteeInput();
                    } else if (e.key === 'Backspace' && !inviteeInput && formData.invitees.length > 0) {
                      removeInvitee(formData.invitees[formData.invitees.length - 1]);
                    }
                  }}
                  onBlur={commitInviteeInput}
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                />
                {formData.invitees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formData.invitees.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeInvitee(email)}
                          className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                          aria-label={language === 'es' ? `Quitar ${email}` : `Remove ${email}`}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Creando...' : 'Creating...'}</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />{language === 'es' ? 'Crear' : 'Create'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage sticky bar */}
        {isManaging && selectedIds.size > 0 && (
          <div className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-50 px-3 pb-safe">
            <div className="max-w-6xl mx-auto bg-destructive text-destructive-foreground rounded-lg p-3 flex items-center justify-between shadow-lg">
              <span className="text-sm font-medium">{selectedIds.size} {t('manage.selected')}</span>
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteDialog(true)} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')}
              </Button>
            </div>
          </div>
        )}

        {/* Delete confirmation — bulk */}
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

        {/* Delete confirmation — single event */}
        <AlertDialog open={!!confirmDeleteSingle} onOpenChange={(o) => !o && setConfirmDeleteSingle(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'es' ? '¿Eliminar este evento?' : 'Delete this event?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === 'es'
                  ? 'Esta acción no se puede deshacer. Si ya enviaste notificaciones, los suscriptores ya recibieron el aviso.'
                  : 'This action cannot be undone. If you already notified subscribers, they have already received the alert.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDeleteSingle && handleDeleteSingle(confirmDeleteSingle)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Eliminar' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Move → notify confirmation */}
        <AlertDialog open={!!pendingMove} onOpenChange={(o) => !o && !isNotifyingMove && setPendingMove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'es' ? 'Fecha actualizada' : 'Date updated'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    {language === 'es' ? 'Moviste' : 'You moved'}{' '}
                    <span className="font-semibold text-foreground">"{pendingMove?.title}"</span>
                  </p>
                  {pendingMove && (
                    <div className="rounded-lg bg-muted/60 border border-border p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{language === 'es' ? 'Antes' : 'Before'}</span>
                        <span className="font-medium text-foreground line-through">
                          {format(pendingMove.oldDate, language === 'es' ? "EEE d MMM, HH:mm" : 'EEE MMM d, HH:mm', { locale: language === 'es' ? es : enUS })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{language === 'es' ? 'Ahora' : 'Now'}</span>
                        <span className="font-semibold text-primary">
                          {format(pendingMove.newDate, language === 'es' ? "EEE d MMM, HH:mm" : 'EEE MMM d, HH:mm', { locale: language === 'es' ? es : enUS })}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-muted-foreground">
                    {language === 'es'
                      ? `¿Avisar a tus ${subscriberCount} suscriptor${subscriberCount === 1 ? '' : 'es'}${pendingMove?.inviteesCount ? ` y ${pendingMove.inviteesCount} invitado${pendingMove.inviteesCount === 1 ? '' : 's'} extra` : ''} del cambio?`
                      : `Notify your ${subscriberCount} subscriber${subscriberCount === 1 ? '' : 's'}${pendingMove?.inviteesCount ? ` and ${pendingMove.inviteesCount} extra invitee${pendingMove.inviteesCount === 1 ? '' : 's'}` : ''} of the change?`}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isNotifyingMove}>
                {language === 'es' ? 'Solo guardar' : 'Just save'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirmNotifyMove(); }}
                disabled={isNotifyingMove}
                className="gap-1.5"
              >
                {isNotifyingMove ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {language === 'es' ? 'Sí, notificar' : 'Yes, notify'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
