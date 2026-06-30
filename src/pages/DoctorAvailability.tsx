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

export default function DoctorAvailabilityPage({ embedded = false }: { embedded?: boolean } = {}) {
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

  const Wrapper = embedded ? React.Fragment : MainLayout;

  if (isAuthLoading) {
    return (
      <Wrapper>
        <div className={embedded ? 'py-12' : 'container mx-auto px-4 py-12'}>
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            <span>{t('common.loading')}</span>
          </div>
        </div>
      </Wrapper>
    );
  }

  if (role !== 'doctor') {
    if (!embedded) navigate('/lives');
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
          toast({ title: t('common.error'), description: `${p}: ${t('availabilityPage.invalidEmail')}`, variant: 'destructive' });
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
      inviteesCount: target.extraInvitees?.length ?? 0,
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
        title: t('availabilityPage.changeNotified'),
        description: `${subs} ${t('availabilityPage.subscribers')}${invs ? ` · ${invs} ${t('availabilityPage.extraInvitees')}` : ''}`,
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
      toast({ title: t('common.error'), description: t('availabilityPage.titleRequired'), variant: 'destructive' });
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
      toast({ title: t('common.success'), description: t('availabilityPage.availabilityScheduled') });
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
      toast({ description: t('availabilityPage.availabilityConfirmed') });
      setSelectedEvent(null);
    }
  };
  const handleCancel = async (id: string) => {
    const result = await cancelAvailability(id);
    if (result.success) {
      toast({ description: t('availabilityPage.availabilityCancelled') });
      setSelectedEvent(null);
    }
  };
  const handleNotify = async (id: string) => {
    const result = await notifySubscribers(id);
    if (result.success) {
      toast({
        title: t('availabilityPage.notificationsSent'),
        description: t('availabilityPage.subscribersNotified').replace('{count}', String(result.notified)),
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
      toast({ description: t('availabilityPage.eventDeleted') });
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
    live: { color: 'bg-[#163a83] text-white', icon: Video, label: 'Live' },
    consultation: { color: 'bg-[#227787] text-white', icon: MessageSquare, label: t('availabilityPage.consultation') },
    office_hours: { color: 'bg-[#4f6dad] text-white', icon: Clock, label: t('availabilityPage.available') },
  };

  return (
    <Wrapper>
      <div className={embedded ? '' : 'container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {!embedded && (
              <Button variant="back" size="icon" onClick={() => navigate('/lives')} className="hidden sm:flex h-9 w-9 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t('availability.title')}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {subscriberCount} {t('availabilityPage.subscribers')}
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
            <Button onClick={() => { setSelectedEvent(null); setFormData(prev => ({ ...prev, date: currentDate, title: '', description: '' })); setIsDialogOpen(true); }} className={embedded ? 'bg-live hover:bg-live/90 text-white' : undefined}>
              <Plus className="h-4 w-4 mr-2" />
              {t('availability.schedule')}
            </Button>
          </div>
        </div>

        {/* Calendar toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>
              {t('availabilityPage.today')}
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
              <TabsTrigger value="month" className="text-xs px-3">{t('availabilityPage.month')}</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">{t('availabilityPage.week')}</TabsTrigger>
              <TabsTrigger value="day" className="text-xs px-3">{t('availabilityPage.day')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Legend — pills con fondo de marca sólido para que se distingan
            claramente (cliente 2026-06-19: "estos colores casi no se ven, ponle un
            fondo"). El accent original (azul claro 72%) era casi invisible. */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { color: 'bg-[#163a83]', label: 'Live' },
            { color: 'bg-[#227787]', label: t('availabilityPage.consultation') },
            { color: 'bg-[#4f6dad]', label: t('availabilityPage.available') },
          ].map(item => (
            <span key={item.label} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm', item.color)}>
              <span className="w-2 h-2 rounded-full bg-white/90" />
              {item.label}
            </span>
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
                        {t('availabilityPage.notificationsSentToSubscribers')}
                      </div>
                    )}
                    {selectedEvent.reminderSent && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 border border-secondary/25 rounded-full px-2.5 py-1 w-fit">
                        <Bell className="h-3 w-3" />
                        {t('availabilityPage.reminderSent')}
                      </div>
                    )}
                    {(selectedEvent.extraInvitees?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1.5 flex items-center gap-1.5">
                          <Send className="w-3 h-3" />
                          {t('availabilityPage.extraInvitees')} ({selectedEvent.extraInvitees!.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedEvent.extraInvitees!.map(email => (
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
                      <Trash2 className="h-4 w-4 mr-1" /> {t('availabilityPage.delete')}
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
                            <Bell className="h-4 w-4 mr-1" /> {t('availabilityPage.notify')}
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
              <DialogTitle className="text-base sm:text-lg">{t('availabilityPage.scheduleAvailability')}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {t('availabilityPage.scheduleAvailabilityDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">{t('availabilityPage.type')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'live' as AvailabilityType, icon: Video, label: 'Live', color: 'text-white border-[#163a83] bg-[#163a83]' },
                    { value: 'consultation' as AvailabilityType, icon: MessageSquare, label: t('availabilityPage.consultation'), color: 'text-white border-[#227787] bg-[#227787]' },
                    { value: 'office_hours' as AvailabilityType, icon: Clock, label: t('availabilityPage.available'), color: 'text-white border-[#4f6dad] bg-[#4f6dad]' },
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
                <Label htmlFor="title">{t('availabilityPage.titleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('availabilityPage.titlePlaceholder')}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('availabilityPage.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('availabilityPage.descriptionPlaceholder')}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">{t('availabilityPage.date')}</Label>
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
                  <Label htmlFor="time" className="text-xs sm:text-sm">{t('availabilityPage.time')}</Label>
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
                <Label className="text-xs sm:text-sm">{t('availabilityPage.duration')}</Label>
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
                  {t('availabilityPage.extraInviteesLabel')}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {t('availabilityPage.extraInviteesHint')}
                  </span>
                </Label>
                <Input
                  id="invitees"
                  type="email"
                  inputMode="email"
                  placeholder={t('availabilityPage.inviteePlaceholder')}
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
                          aria-label={t('availabilityPage.removeInvitee').replace('{email}', email)}
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('availabilityPage.creating')}</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />{t('availabilityPage.create')}</>
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
                {t('availabilityPage.deleteEventQuestion')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('availabilityPage.deleteEventDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDeleteSingle && handleDeleteSingle(confirmDeleteSingle)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('availabilityPage.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Move → notify confirmation */}
        <AlertDialog open={!!pendingMove} onOpenChange={(o) => !o && !isNotifyingMove && setPendingMove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('availabilityPage.dateUpdated')}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    {t('availabilityPage.youMoved')}{' '}
                    <span className="font-semibold text-foreground">"{pendingMove?.title}"</span>
                  </p>
                  {pendingMove && (
                    <div className="rounded-lg bg-muted/60 border border-border p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t('availabilityPage.before')}</span>
                        <span className="font-medium text-foreground line-through">
                          {format(pendingMove.oldDate, language === 'es' ? "EEE d MMM, HH:mm" : 'EEE MMM d, HH:mm', { locale: language === 'es' ? es : enUS })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t('availabilityPage.now')}</span>
                        <span className="font-semibold text-primary">
                          {format(pendingMove.newDate, language === 'es' ? "EEE d MMM, HH:mm" : 'EEE MMM d, HH:mm', { locale: language === 'es' ? es : enUS })}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-muted-foreground">
                    {t('availabilityPage.notifyChangeQuestion')
                      .replace('{subs}', String(subscriberCount))
                      .replace('{subscribers}', t('availabilityPage.subscribers'))
                      .replace('{invitees}', pendingMove?.inviteesCount ? ` + ${pendingMove.inviteesCount} ${t('availabilityPage.extraInvitees')}` : '')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isNotifyingMove}>
                {t('availabilityPage.justSave')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirmNotifyMove(); }}
                disabled={isNotifyingMove}
                className="gap-1.5"
              >
                {isNotifyingMove ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('availabilityPage.yesNotify')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Wrapper>
  );
}
