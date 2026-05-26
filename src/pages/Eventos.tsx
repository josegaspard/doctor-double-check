import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  Globe,
  ExternalLink,
  Plus,
  Megaphone,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';

type EventType = 'congress' | 'symposium' | 'fellowship' | 'call' | 'workshop' | 'course' | 'webinar';

interface ForoEvent {
  id: string;
  title: string;
  description: string;
  event_type: EventType;
  event_date: string;
  end_date: string | null;
  location: string | null;
  is_online: boolean;
  registration_url: string | null;
  image_url: string | null;
  organizer: string | null;
  created_by: string;
  is_published: boolean;
  created_at: string;
}

const EVENT_TYPE_KEY: Record<EventType, string> = {
  congress: 'eventos.types.congress',
  symposium: 'eventos.types.symposium',
  fellowship: 'eventos.types.fellowship',
  call: 'eventos.types.call',
  workshop: 'eventos.types.workshop',
  course: 'eventos.types.course',
  webinar: 'eventos.types.webinar',
};

const EVENT_TYPE_TONE: Record<EventType, string> = {
  congress: 'bg-primary/15 text-primary border-primary/30',
  symposium: 'bg-secondary/15 text-secondary border-secondary/30',
  fellowship: 'bg-warning/15 text-warning border-warning/30',
  call: 'bg-destructive/15 text-destructive border-destructive/30',
  workshop: 'bg-success/15 text-success border-success/30',
  course: 'bg-accent/15 text-accent border-accent/30',
  webinar: 'bg-info/15 text-info border-info/30',
};

const DEFAULT_FORM = {
  title: '',
  description: '',
  event_type: 'congress' as EventType,
  event_date: '',
  end_date: '',
  location: '',
  is_online: false,
  registration_url: '',
  image_url: '',
  organizer: '',
};

export default function Eventos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, supabaseUser, role } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;

  const [events, setEvents] = useState<ForoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'mine'>('upcoming');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [canPublish, setCanPublish] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!supabaseUser?.id || role !== 'doctor') { setCanPublish(false); return; }
      const { data } = await supabase
        .from('doctor_profiles')
        .select('status')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();
      setCanPublish(data?.status === 'approved');
    };
    check();
  }, [supabaseUser?.id, role]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('foro_events')
      .select('*')
      .order('event_date', { ascending: true });
    if (error) console.error('Foro events load error:', error);
    setEvents((data as ForoEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  // Auto-open create dialog when navigated with ?new=1 (and user can publish)
  useEffect(() => {
    if (searchParams.get('new') === '1' && canPublish) {
      setEditingId(null);
      setForm({ ...DEFAULT_FORM });
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, canPublish, setSearchParams]);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (tab === 'upcoming') {
      return events.filter(e => new Date(e.event_date).getTime() >= now);
    }
    if (tab === 'past') {
      return events
        .filter(e => new Date(e.event_date).getTime() < now)
        .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    }
    return events.filter(e => e.created_by === supabaseUser?.id);
  }, [events, tab, supabaseUser?.id]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setCreateOpen(true);
  };

  const openEdit = (e: ForoEvent) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description,
      event_type: e.event_type,
      event_date: e.event_date.slice(0, 16),
      end_date: e.end_date ? e.end_date.slice(0, 16) : '',
      location: e.location || '',
      is_online: e.is_online,
      registration_url: e.registration_url || '',
      image_url: e.image_url || '',
      organizer: e.organizer || '',
    });
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!supabaseUser?.id) return;
    if (!form.title.trim() || !form.description.trim() || !form.event_date) {
      toast.error(t('eventos.form.requiredFields'));
      return;
    }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim(),
      event_type: form.event_type,
      event_date: new Date(form.event_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      location: form.is_online ? null : (form.location.trim() || null),
      is_online: form.is_online,
      registration_url: form.registration_url.trim() || null,
      image_url: form.image_url.trim() || null,
      organizer: form.organizer.trim() || null,
      created_by: supabaseUser.id,
      is_published: true,
    };
    const res = editingId
      ? await (supabase as any).from('foro_events').update(payload).eq('id', editingId).select('id').maybeSingle()
      : await (supabase as any).from('foro_events').insert(payload).select('id').maybeSingle();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message || t('eventos.form.saveError'));
      return;
    }

    // Cuando se publica un evento nuevo (no edición), notificamos a los
    // suscriptores del doctor. Falla silenciosa: el evento ya quedó publicado.
    if (!editingId) {
      try {
        const typeLabel = t(EVENT_TYPE_KEY[form.event_type]) || form.event_type;
        await (supabase as any).rpc('notify_subscribers', {
          p_doctor_id: supabaseUser.id,
          p_notification_type: 'new_content',
          p_title: `📣 ${typeLabel}: ${form.title.trim()}`,
          p_message: `${format(new Date(form.event_date), language === 'es' ? "d 'de' MMM 'a las' HH:mm" : "MMM d 'at' HH:mm", { locale })}${form.is_online ? ' · Online' : (form.location.trim() ? ` · ${form.location.trim()}` : '')}`,
          p_data: { event_id: (res.data as any)?.id, event_type: form.event_type, deeplink: '/eventos' },
        });
      } catch (e) {
        console.warn('notify_subscribers failed (event published OK)', e);
      }
    }

    toast.success(editingId ? t('eventos.form.updated') : t('eventos.form.created'));
    setCreateOpen(false);
    setForm({ ...DEFAULT_FORM });
    setEditingId(null);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('eventos.confirmDelete'))) return;
    const { error } = await (supabase as any).from('foro_events').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('eventos.deleted'));
    fetchEvents();
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button variant="back" size="sm" onClick={() => navigate('/foro')} className="mb-3 -ml-2 gap-1.5 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4" /> {t('eventos.backToForo')}
        </Button>

        {/* Hero */}
        <div className="mb-6 rounded-2xl bg-card border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-card-foreground">{t('eventos.heroTitle')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t('eventos.heroSubtitle')}</p>
            </div>
            {canPublish && (
              <Button onClick={openCreate} size="sm" className="gap-1.5 flex-shrink-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('eventos.create')}</span>
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {(['upcoming','past','mine'] as const).map(k => {
              const active = tab === k;
              if (k === 'mine' && !canPublish) return null;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  {t(`eventos.tabs.${k}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('eventos.empty')}</p>
              {canPublish && tab !== 'past' && (
                <Button onClick={openCreate} size="sm" className="mt-4 gap-1.5">
                  <Plus className="w-4 h-4" /> {t('eventos.createFirst')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filtered.map(e => {
              const start = new Date(e.event_date);
              const end = e.end_date ? new Date(e.end_date) : null;
              const isMine = e.created_by === supabaseUser?.id;
              const typeKey = EVENT_TYPE_KEY[e.event_type];
              const typeTone = EVENT_TYPE_TONE[e.event_type];
              return (
                <Card key={e.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Date block — prominent */}
                      <div className="bg-muted/50 border-b sm:border-b-0 sm:border-r border-border flex sm:flex-col items-center justify-center p-3 sm:p-4 sm:w-24 flex-shrink-0 gap-1.5 sm:gap-0">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                          {format(start, 'MMM', { locale })}
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none">
                          {format(start, 'd')}
                        </p>
                        <p className="text-[10px] text-muted-foreground sm:mt-0.5">
                          {format(start, 'HH:mm')}
                        </p>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 p-3 sm:p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeTone}`}>
                            {t(typeKey)}
                          </span>
                          {isMine && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              {t('eventos.mine')}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug mb-1">
                          {e.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mb-3">
                          {e.description}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-muted-foreground mb-2">
                          <span className="inline-flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {format(start, language === 'es' ? "d MMM yyyy, HH:mm" : 'MMM d, yyyy HH:mm', { locale })}
                            {end && ` → ${format(end, language === 'es' ? "d MMM, HH:mm" : 'MMM d, HH:mm', { locale })}`}
                          </span>
                          {e.is_online ? (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {t('eventos.online')}
                            </span>
                          ) : e.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {e.location}
                            </span>
                          ) : null}
                          {e.organizer && <span>· {e.organizer}</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2">
                          {e.registration_url && (
                            <Button size="sm" variant="default" className="h-8 text-xs gap-1.5" asChild>
                              <a href={e.registration_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" />
                                {t('eventos.register')}
                              </a>
                            </Button>
                          )}
                          {isMine && (
                            <>
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => openEdit(e)}>
                                <Pencil className="w-3 h-3" /> {t('eventos.edit')}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => handleDelete(e.id)}>
                                <Trash2 className="w-3 h-3" /> {t('eventos.delete')}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Image (if any) */}
                      {e.image_url && (
                        <div className="sm:w-40 sm:h-auto h-32 flex-shrink-0 order-first sm:order-last">
                          <img src={e.image_url} alt={e.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / edit dialog */}
        <Dialog open={createOpen} onOpenChange={(o) => { if (!saving) setCreateOpen(o); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t('eventos.form.editTitle') : t('eventos.form.createTitle')}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('eventos.form.helperText')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-title">{t('eventos.form.title')} *</Label>
                <Input id="event-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('eventos.form.titlePlaceholder')} />
              </div>

              <div className="space-y-1.5">
                <Label>{t('eventos.form.type')}</Label>
                <Select value={form.event_type} onValueChange={(v: EventType) => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_TYPE_KEY) as EventType[]).map(k => (
                      <SelectItem key={k} value={k}>{t(EVENT_TYPE_KEY[k])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-description">{t('eventos.form.description')} *</Label>
                <Textarea
                  id="event-description"
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('eventos.form.descriptionPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-date">{t('eventos.form.startDate')} *</Label>
                  <Input id="event-date" type="datetime-local" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-end">{t('eventos.form.endDate')}</Label>
                  <Input id="event-end" type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Switch id="is-online" checked={form.is_online} onCheckedChange={(v) => setForm(f => ({ ...f, is_online: v }))} />
                <Label htmlFor="is-online" className="text-sm cursor-pointer">{t('eventos.form.online')}</Label>
              </div>

              {!form.is_online && (
                <div className="space-y-1.5">
                  <Label htmlFor="event-location">{t('eventos.form.location')}</Label>
                  <Input id="event-location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={t('eventos.form.locationPlaceholder')} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="event-organizer">{t('eventos.form.organizer')}</Label>
                <Input id="event-organizer" value={form.organizer} onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))} placeholder={t('eventos.form.organizerPlaceholder')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-url">{t('eventos.form.registrationUrl')}</Label>
                <Input id="event-url" type="url" value={form.registration_url} onChange={e => setForm(f => ({ ...f, registration_url: e.target.value }))} placeholder="https://..." />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-image">{t('eventos.form.imageUrl')}</Label>
                <Input id="event-image" type="url" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? t('eventos.form.saveChanges') : t('eventos.form.publish')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
