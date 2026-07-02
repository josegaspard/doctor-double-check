import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CongressCreateDialog } from '@/components/congresses/CongressCreateDialog';
import { AttachRecordingsDialog } from '@/components/congresses/AttachRecordingsDialog';
import { MeetingCreateDialog } from '@/components/meetings/MeetingCreateDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Loader2, Presentation, CalendarDays, Radio, Video,
  Star, Pencil, Archive, ArchiveRestore, PlayCircle, Clock, Film, Trash2, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Congress, CongressSpeaker, congressPhase, congressPosterStyle,
  avatarTint, initialsOf, hydrateSpeakers,
} from '@/lib/congresses';

// Detalle de congreso (cliente 2026-07-02, rediseño mismo día): póster con la
// identidad del congreso, panel claro de "agrega tu conferencia / live / video",
// programa tipo agenda por día, ponentes con avatar y grabaciones tipo videoteca.

interface AgendaItem {
  kind: 'meeting' | 'live';
  id: string;
  title: string;
  specialty: string;
  speakerId: string;
  speakerName: string;
  at: Date | null;
  isLiveNow: boolean;
  isDone: boolean;
  roomUrl?: string | null;
  roomName?: string | null;
  isPublic?: boolean;
}

interface RecordingRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number;
  doctor_id: string;
  doctorName?: string;
}

export default function CongressDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;

  const [congress, setCongress] = useState<Congress | null>(null);
  const [speakers, setSpeakers] = useState<CongressSpeaker[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [showAttachVideos, setShowAttachVideos] = useState(false);

  const isAdmin = role === 'admin';
  const isLead = speakers.some(s => s.user_id === user?.id && s.is_lead);
  const canManage = !!user && !!congress && (congress.organizer_id === user.id || isLead || isAdmin);
  const canAddSession = isAuthenticated && ['doctor', 'resident', 'admin'].includes(role || '');

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const { data: cRow } = await (supabase as any)
        .from('congresses')
        .select('id, organizer_id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at')
        .eq('id', id)
        .maybeSingle();
      if (!cRow) { setCongress(null); return; }
      setCongress(cRow as Congress);

      const [{ data: speakerRows }, { data: sessionRows }, { data: liveRows }, { data: recRows }] = await Promise.all([
        (supabase as any).from('congress_speakers').select('id, congress_id, user_id, is_lead').eq('congress_id', id),
        (supabase as any).from('clinical_sessions')
          .select('id, title, specialty, organizer_id, scheduled_at, status, daily_room_url, daily_room_name, is_public')
          .eq('congress_id', id),
        (supabase as any).from('lives')
          .select('id, title, specialty, doctor_id, status, started_at, ended_at')
          .eq('congress_id', id),
        (supabase as any).from('recordings')
          .select('id, title, thumbnail_url, duration, doctor_id')
          .eq('congress_id', id)
          .order('created_at', { ascending: false }),
      ]);

      setSpeakers((await hydrateSpeakers((speakerRows as CongressSpeaker[]) || []))
        .sort((a, b) => Number(b.is_lead) - Number(a.is_lead)));

      const speakerIds = new Set<string>();
      ((sessionRows as any[]) || []).forEach(s => speakerIds.add(s.organizer_id));
      ((liveRows as any[]) || []).forEach(l => speakerIds.add(l.doctor_id));
      ((recRows as any[]) || []).forEach(r => speakerIds.add(r.doctor_id));
      let nameMap: Record<string, string> = {};
      if (speakerIds.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(speakerIds));
        (profs || []).forEach(p => { nameMap[p.id] = p.name; });
      }

      const items: AgendaItem[] = [];
      ((sessionRows as any[]) || []).forEach(s => {
        items.push({
          kind: 'meeting',
          id: s.id,
          title: s.title,
          specialty: s.specialty,
          speakerId: s.organizer_id,
          speakerName: nameMap[s.organizer_id] || t('congresses.speakerFallback'),
          at: s.scheduled_at ? new Date(s.scheduled_at) : null,
          isLiveNow: s.status === 'accepted' && !!s.daily_room_url,
          isDone: s.status === 'completed' || s.status === 'cancelled',
          roomUrl: s.daily_room_url,
          roomName: s.daily_room_name,
          isPublic: s.is_public,
        });
      });
      ((liveRows as any[]) || []).forEach(l => {
        items.push({
          kind: 'live',
          id: l.id,
          title: l.title,
          specialty: l.specialty,
          speakerId: l.doctor_id,
          speakerName: nameMap[l.doctor_id] || t('congresses.speakerFallback'),
          at: l.started_at ? new Date(l.started_at) : null,
          isLiveNow: l.status === 'live',
          isDone: l.status === 'ended',
        });
      });
      items.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
      setAgenda(items);
      setRecordings(((recRows as RecordingRow[]) || []).map(r => ({ ...r, doctorName: nameMap[r.doctor_id] })));
    } catch (error) {
      console.error('Error fetching congress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Eliminar: solo organizador o admin (política RLS de DELETE). Las reuniones y
  // grabaciones NO se borran, solo dejan de estar agrupadas (FK ON DELETE SET NULL).
  const canDelete = !!user && !!congress && (congress.organizer_id === user.id || isAdmin);
  const handleDelete = async () => {
    if (!congress || !window.confirm(t('congresses.confirmDelete'))) return;
    const { error } = await (supabase as any).from('congresses').delete().eq('id', congress.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('congresses.deletedToast'));
    navigate('/congresos');
  };

  const handleArchiveToggle = async () => {
    if (!congress) return;
    const toArchived = congress.status !== 'archived';
    if (toArchived && !window.confirm(t('congresses.confirmArchive'))) return;
    const { error } = await (supabase as any)
      .from('congresses')
      .update({ status: toArchived ? 'archived' : 'published' })
      .eq('id', congress.id);
    if (error) { toast.error(error.message); return; }
    toast.success(toArchived ? t('congresses.archivedToast') : t('congresses.unarchivedToast'));
    fetchAll();
  };

  const joinItem = (item: AgendaItem) => {
    if (item.kind === 'live') {
      navigate(`/live/${item.id}`);
      return;
    }
    if (item.roomUrl && item.roomName) {
      navigate(`/video-call?room=${item.roomName}&url=${encodeURIComponent(item.roomUrl)}&meetingId=${item.id}`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!congress) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Presentation className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('congresses.notFound')}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/congresos')}>
            <ArrowLeft className="w-4 h-4" />
            {t('congresses.back')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const phase = congressPhase(congress);
  const liveNowItems = agenda.filter(i => i.isLiveNow && !i.isDone);
  const startDate = new Date(`${congress.starts_at}T12:00:00`);
  const endDate = new Date(`${congress.ends_at}T12:00:00`);

  const byDay: Record<string, AgendaItem[]> = {};
  const noDate: AgendaItem[] = [];
  agenda.forEach(i => {
    if (!i.at) { noDate.push(i); return; }
    const key = format(i.at, 'yyyy-MM-dd');
    (byDay[key] ||= []).push(i);
  });
  const dayKeys = Object.keys(byDay).sort();

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // El fondo global de la app es una imagen oscura: todo el contenido va sobre
  // paneles sólidos bg-card (título incluido) para garantizar contraste.
  const Panel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl bg-card border border-border p-4 sm:p-5 ${className}`}>{children}</div>
  );

  const SectionTitle = ({ icon: Icon, children, count, action }: { icon: React.ElementType; children: React.ReactNode; count?: number; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-heading text-base sm:text-lg font-bold flex items-center gap-2 text-card-foreground">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        {children}
        {typeof count === 'number' && (
          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );

  const AgendaRow = ({ item }: { item: AgendaItem }) => (
    <div className={`flex items-center gap-3 sm:gap-4 py-3 ${item.isLiveNow && !item.isDone ? 'rounded-xl bg-live/5 border border-live/25 px-3' : 'border-b border-border/70 last:border-b-0'}`}>
      <div className="w-12 text-center flex-shrink-0">
        {item.at ? (
          <p className="text-sm font-bold tabular-nums leading-none">{format(item.at, 'HH:mm')}</p>
        ) : (
          <Clock className="w-4 h-4 mx-auto text-muted-foreground/50" />
        )}
        <p className="text-[10px] uppercase text-muted-foreground mt-1">
          {item.kind === 'live' ? t('congresses.liveLabel') : t('congresses.meetingLabel')}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <Link to={`/doctor/${item.speakerId}`} className="hover:underline" onClick={e => e.stopPropagation()}>
            {item.speakerName}
          </Link>
          {item.specialty && <span> · {item.specialty}</span>}
        </p>
      </div>
      <div className="flex-shrink-0">
        {item.isLiveNow && !item.isDone ? (
          <Button size="sm" className="h-8 gap-1.5 bg-live hover:bg-live/90 text-white" onClick={() => joinItem(item)}>
            <Radio className="w-3.5 h-3.5" />
            {item.kind === 'live' ? t('congresses.watchLive') : t('congresses.join')}
          </Button>
        ) : item.isDone ? (
          <span className="text-[11px] font-medium text-muted-foreground">{t('congresses.sessionDone')}</span>
        ) : (
          <span className="text-[11px] font-medium text-primary">{t('congresses.sessionUpcoming')}</span>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2" onClick={() => navigate('/congresos')}>
          <ArrowLeft className="w-4 h-4" />
          {t('congresses.back')}
        </Button>

        {/* Póster del congreso: título y fechas DENTRO del banner */}
        <div className="relative rounded-2xl overflow-hidden" style={congressPosterStyle(congress)}>
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(110% 80% at 88% -8%, rgba(255,255,255,0.16) 0%, transparent 55%), linear-gradient(to top, rgba(7,18,42,0.78) 0%, rgba(7,18,42,0.25) 55%, rgba(7,18,42,0.08) 100%)' }}
          />
          <div className="relative p-5 sm:p-8 pt-14 sm:pt-20">
            <div className="flex items-center gap-2 flex-wrap">
              {liveNowItems.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-live text-white text-[11px] font-semibold px-2.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  {t('congresses.liveNow')}
                </span>
              ) : (
                <span className="rounded-full bg-white/15 text-white text-[11px] font-medium px-2.5 py-1 backdrop-blur-sm">
                  {phase === 'active' ? t('congresses.statusActive') : phase === 'upcoming' ? t('congresses.statusUpcoming') : t('congresses.statusArchived')}
                </span>
              )}
              {congress.specialty && (
                <span className="rounded-full bg-white/15 text-white text-[11px] font-medium px-2.5 py-1 backdrop-blur-sm">{congress.specialty}</span>
              )}
            </div>
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-white leading-tight mt-3 max-w-2xl">
              {congress.title}
            </h1>
            <p className="text-white/85 text-sm sm:text-base font-medium mt-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {congress.starts_at === congress.ends_at
                ? format(startDate, "d 'de' MMMM yyyy", { locale })
                : `${format(startDate, "d 'de' MMMM", { locale })} – ${format(endDate, "d 'de' MMMM yyyy", { locale })}`}
            </p>
            <p className="text-white/70 text-xs sm:text-sm mt-3">
              {t('congresses.sessionsCount').replace('{n}', String(agenda.length))}
              {' · '}
              {t('congresses.speakersCount').replace('{n}', String(speakers.length))}
              {' · '}
              {t('congresses.videosCount').replace('{n}', String(recordings.length))}
            </p>
          </div>
        </div>

        {/* Gestión (organizador / líder / admin) */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowEdit(true)}>
              <Pencil className="w-3.5 h-3.5" />
              {t('congresses.edit')}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleArchiveToggle}>
              {congress.status === 'archived'
                ? <><ArchiveRestore className="w-3.5 h-3.5" />{t('congresses.unarchive')}</>
                : <><Archive className="w-3.5 h-3.5" />{t('congresses.archive')}</>}
            </Button>
            {canDelete && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" />
                {t('congresses.delete')}
              </Button>
            )}
          </div>
        )}

        {congress.description && (
          <Panel className="mt-4">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line max-w-[70ch]">
              {congress.description}
            </p>
          </Panel>
        )}

        {/* Agrega contenido — responde "¿cómo agrego reuniones, lives, videos?" */}
        {canAddSession && phase !== 'archived' && (
          <div className="mt-4 rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 sm:px-5 py-3 bg-muted/50 border-b border-border">
              <p className="text-sm font-semibold">{t('congresses.addContentTitle')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('congresses.addContentSubtitle')}</p>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Video className="w-4 h-4 text-primary" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t('congresses.addMeeting')}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t('congresses.addMeetingDesc')}</p>
                </div>
                <Button size="sm" className="h-8 gap-1.5 flex-shrink-0" onClick={() => setShowAddMeeting(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  {t('congresses.addAction')}
                </Button>
              </div>
              {(role === 'doctor' || role === 'resident') && (
                <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <span className="w-9 h-9 rounded-full bg-live/10 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-4 h-4 text-live" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t('congresses.goLiveHere')}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{t('congresses.addLiveDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 flex-shrink-0 text-live border-live/40 hover:bg-live/10" onClick={() => navigate(`/doctor/go-live?congress=${congress.id}`)}>
                    <Radio className="w-3.5 h-3.5" />
                    {t('congresses.addAction')}
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                <span className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Film className="w-4 h-4 text-secondary" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t('congresses.addVideoTitle')}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t('congresses.addVideoDesc')}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 flex-shrink-0" onClick={() => setShowAttachVideos(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  {t('congresses.addAction')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* En vivo ahora */}
        {liveNowItems.length > 0 && (
          <Panel className="mt-4 border-live/40">
            <SectionTitle icon={Radio} count={liveNowItems.length}>{t('congresses.liveNowSection')}</SectionTitle>
            <div className="space-y-2">
              {liveNowItems.map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
            </div>
          </Panel>
        )}

        {/* Programa */}
        <Panel className="mt-4">
          <SectionTitle icon={CalendarDays} count={agenda.length}>{t('congresses.program')}</SectionTitle>
          {agenda.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-dashed border-border">
              <Video className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t('congresses.noSessions')}</p>
              {canAddSession && phase !== 'archived' && (
                <p className="text-xs text-muted-foreground mt-1">{t('congresses.addMeetingHint')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {dayKeys.map(day => (
                <div key={day}>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5 capitalize">
                    {format(new Date(`${day}T12:00:00`), 'EEEE d MMMM', { locale })}
                  </p>
                  <div>
                    {byDay[day].map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
                  </div>
                </div>
              ))}
              {noDate.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{t('congresses.noDateGroup')}</p>
                  <div>
                    {noDate.map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Conferencistas */}
        <Panel className="mt-4">
          <SectionTitle icon={Star} count={speakers.length}>{t('congresses.speakers')}</SectionTitle>
          {speakers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('congresses.noSpeakers')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {speakers.map(s => (
                <Link
                  key={s.user_id}
                  to={`/doctor/${s.user_id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.name || ''} />}
                    <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: avatarTint(s.name || s.user_id) }}>
                      {initialsOf(s.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {s.name || t('congresses.speakerFallback')}
                      {s.is_lead && <Star className="w-3.5 h-3.5 text-premium flex-shrink-0" fill="currentColor" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.is_lead ? `${t('congresses.lead')}${s.specialty ? ' · ' + s.specialty : ''}` : (s.specialty || t('congresses.speakerRole'))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Grabaciones (archivo del congreso) */}
        <Panel className="mt-4 mb-4">
          <SectionTitle
            icon={Film}
            count={recordings.length}
            action={canAddSession && phase !== 'archived' ? (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowAttachVideos(true)}>
                <Plus className="w-3.5 h-3.5" />
                {t('congresses.attachVideo')}
              </Button>
            ) : undefined}
          >
            {t('congresses.recordings')}
          </SectionTitle>
          {recordings.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-dashed border-border">
              <Film className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t('congresses.noRecordings')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {recordings.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/recording/${r.id}`)}
                  className="group text-left rounded-xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="aspect-video relative overflow-hidden">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    ) : (
                      <div className="w-full h-full" style={congressPosterStyle({ id: r.id, banner_url: null })} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <PlayCircle className="absolute inset-0 m-auto w-10 h-10 text-white/0 group-hover:text-white/90 transition-colors duration-200 drop-shadow" />
                    {r.duration > 0 && (
                      <span className="absolute top-2 right-2 text-[10px] font-medium bg-black/75 text-white px-1.5 py-0.5 rounded">
                        {fmtDuration(r.duration)}
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="text-white text-xs sm:text-sm font-semibold leading-snug line-clamp-2">{r.title}</p>
                      {r.doctorName && <p className="text-white/75 text-[10px] mt-0.5 truncate">{r.doctorName}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <CongressCreateDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          onSaved={fetchAll}
          editing={{ congress, speakers }}
        />
        <MeetingCreateDialog
          open={showAddMeeting}
          onOpenChange={setShowAddMeeting}
          onCreated={fetchAll}
          defaultCongressId={congress.id}
        />
        <AttachRecordingsDialog
          open={showAttachVideos}
          onOpenChange={setShowAttachVideos}
          congressId={congress.id}
          canManage={canManage}
          onChanged={fetchAll}
        />
      </div>
    </MainLayout>
  );
}
