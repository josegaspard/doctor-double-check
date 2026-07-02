import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CongressCreateDialog } from '@/components/congresses/CongressCreateDialog';
import { MeetingCreateDialog } from '@/components/meetings/MeetingCreateDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Loader2, Presentation, CalendarDays, Radio, Video,
  Star, Pencil, Archive, ArchiveRestore, Plus, PlayCircle, Clock, Film,
} from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { Congress, CongressSpeaker, congressPhase, hydrateSpeakers } from '@/lib/congresses';

// Detalle de congreso (cliente 2026-07-02): programa completo de conferencias
// (reuniones + lives de cualquier doctor), transmisiones en vivo ahora, archivo
// de grabaciones al terminar y conferencistas con link a su perfil.

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

      // Nombres de ponentes para la agenda (organizadores de reuniones + doctores de lives).
      const speakerIds = new Set<string>();
      ((sessionRows as any[]) || []).forEach(s => speakerIds.add(s.organizer_id));
      ((liveRows as any[]) || []).forEach(l => speakerIds.add(l.doctor_id));
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
      setRecordings((recRows as RecordingRow[]) || []);
    } catch (error) {
      console.error('Error fetching congress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  // Agrupar programa por día (las sin fecha van al final).
  const byDay: Record<string, AgendaItem[]> = {};
  const noDate: AgendaItem[] = [];
  agenda.forEach(i => {
    if (!i.at) { noDate.push(i); return; }
    const key = format(i.at, 'yyyy-MM-dd');
    (byDay[key] ||= []).push(i);
  });
  const dayKeys = Object.keys(byDay).sort();

  const phaseBadge = phase === 'active'
    ? <Badge className="bg-live text-white">{t('congresses.statusActive')}</Badge>
    : phase === 'upcoming'
      ? <Badge variant="info">{t('congresses.statusUpcoming')}</Badge>
      : <Badge variant="secondary">{t('congresses.statusArchived')}</Badge>;

  const AgendaRow = ({ item }: { item: AgendaItem }) => (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
      <div className="w-12 text-center flex-shrink-0">
        {item.at ? (
          <>
            <p className="text-sm font-bold leading-none">{format(item.at, 'HH:mm')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{format(item.at, 'd MMM', { locale })}</p>
          </>
        ) : (
          <Clock className="w-4 h-4 mx-auto text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <Badge variant="outline" className="text-[10px] h-5 gap-1">
            {item.kind === 'live' ? <Radio className="w-2.5 h-2.5" /> : <Video className="w-2.5 h-2.5" />}
            {item.kind === 'live' ? t('congresses.liveLabel') : t('congresses.meetingLabel')}
          </Badge>
          <span className="text-[11px] text-muted-foreground truncate">
            {t('congresses.by')}{' '}
            <Link to={`/doctor/${item.speakerId}`} className="hover:underline" onClick={e => e.stopPropagation()}>
              {item.speakerName}
            </Link>
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        {item.isLiveNow && !item.isDone ? (
          <Button size="sm" className="h-8 gap-1.5 bg-live hover:bg-live/90 text-white" onClick={() => joinItem(item)}>
            <Radio className="w-3.5 h-3.5" />
            {item.kind === 'live' ? t('congresses.watchLive') : t('congresses.join')}
          </Button>
        ) : item.isDone ? (
          <Badge variant="secondary" className="text-[10px]">{t('congresses.sessionDone')}</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">{t('congresses.sessionUpcoming')}</Badge>
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

        {/* Encabezado */}
        <Card className="overflow-hidden mb-4">
          <div
            className="h-28 sm:h-36 relative"
            style={congress.banner_url
              ? { backgroundImage: `url(${congress.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: 'linear-gradient(120deg, #163a83 0%, #227787 100%)' }}
          >
            <Presentation className="absolute right-4 bottom-3 w-12 h-12 text-white/20" />
            <div className="absolute top-3 left-3 flex items-center gap-2">{phaseBadge}</div>
          </div>
          <CardContent className="p-4 sm:p-5">
            <h1 className="font-heading text-lg sm:text-2xl font-bold leading-snug">{congress.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {congress.starts_at === congress.ends_at
                  ? format(startDate, 'd MMMM yyyy', { locale })
                  : `${format(startDate, 'd MMMM', { locale })} – ${format(endDate, 'd MMMM yyyy', { locale })}`}
              </span>
              {congress.specialty && <Badge variant="outline" className="text-xs">{congress.specialty}</Badge>}
            </div>
            {congress.description && (
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">{congress.description}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {canAddSession && phase !== 'archived' && (
                <>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowAddMeeting(true)}>
                    <Plus className="w-4 h-4" />
                    {t('congresses.addMeeting')}
                  </Button>
                  {(role === 'doctor' || role === 'resident') && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-live border-live/40 hover:bg-live/10" onClick={() => navigate(`/doctor/go-live?congress=${congress.id}`)}>
                      <Radio className="w-3.5 h-3.5" />
                      {t('congresses.goLiveHere')}
                    </Button>
                  )}
                </>
              )}
              {canManage && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowEdit(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                    {t('congresses.edit')}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleArchiveToggle}>
                    {congress.status === 'archived'
                      ? <><ArchiveRestore className="w-3.5 h-3.5" />{t('congresses.unarchive')}</>
                      : <><Archive className="w-3.5 h-3.5" />{t('congresses.archive')}</>}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* En vivo ahora */}
        {liveNowItems.length > 0 && (
          <Card className="mb-4 border-live/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-live" />
                </span>
                {t('congresses.liveNowSection')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {liveNowItems.map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
            </CardContent>
          </Card>
        )}

        {/* Conferencistas */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-premium" />
              {t('congresses.speakers')}
              <Badge variant="outline" className="text-[10px] h-5 ml-1">{speakers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('congresses.noSpeakers')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {speakers.map(s => (
                  <Link
                    key={s.user_id}
                    to={`/doctor/${s.user_id}`}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-7 h-7">
                      {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.name || ''} />}
                      <AvatarFallback className="text-[10px]">{(s.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{s.name || t('congresses.speakerFallback')}</span>
                    {s.is_lead && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-premium/15 text-premium border border-premium/30 gap-0.5">
                        <Star className="w-2.5 h-2.5" fill="currentColor" />
                        {t('congresses.lead')}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Programa */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {t('congresses.program')}
              <Badge variant="outline" className="text-[10px] h-5 ml-1">{agenda.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agenda.length === 0 ? (
              <div className="text-center py-6">
                <Video className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{t('congresses.noSessions')}</p>
                {canAddSession && phase !== 'archived' && (
                  <p className="text-xs text-muted-foreground mt-1">{t('congresses.addMeetingHint')}</p>
                )}
              </div>
            ) : (
              <>
                {dayKeys.map(day => (
                  <div key={day}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 capitalize">
                      {format(new Date(`${day}T12:00:00`), 'EEEE d MMMM', { locale })}
                    </p>
                    <div className="space-y-2">
                      {byDay[day].map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
                    </div>
                  </div>
                ))}
                {noDate.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t('congresses.noDateGroup')}</p>
                    <div className="space-y-2">
                      {noDate.map(item => <AgendaRow key={`${item.kind}-${item.id}`} item={item} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Grabaciones (archivo) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" />
              {t('congresses.recordings')}
              <Badge variant="outline" className="text-[10px] h-5 ml-1">{recordings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recordings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('congresses.noRecordings')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recordings.map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/recording/${r.id}`)}
                    className="text-left rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-video bg-muted relative">
                      {r.thumbnail_url ? (
                        <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(120deg, #163a83 0%, #227787 100%)' }}>
                          <PlayCircle className="w-8 h-8 text-white/60" />
                        </div>
                      )}
                      {r.duration > 0 && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">
                          {Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium p-2 line-clamp-2">{r.title}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </MainLayout>
  );
}
