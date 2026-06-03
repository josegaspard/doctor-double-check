import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import {
  MessageSquare,
  Video,
  Users,
  Calendar,
  Megaphone,
  Radio,
  Stethoscope,
  GraduationCap,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface ForoCard {
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  icon: React.ElementType;
  to: string;
  tone: 'doctor' | 'resident' | 'event' | 'live';
}

const cards: ForoCard[] = [
  {
    titleKey: 'foroPage.cards.residentMentoring.title',
    descriptionKey: 'foroPage.cards.residentMentoring.description',
    ctaKey: 'foroPage.cards.residentMentoring.cta',
    icon: GraduationCap,
    to: '/meetings?type=resident_class',
    tone: 'resident',
  },
  {
    titleKey: 'foroPage.cards.doctorToDoctor.title',
    descriptionKey: 'foroPage.cards.doctorToDoctor.description',
    ctaKey: 'foroPage.cards.doctorToDoctor.cta',
    icon: Stethoscope,
    to: '/meetings?type=case_discussion',
    tone: 'doctor',
  },
  {
    titleKey: 'foroPage.cards.events.title',
    descriptionKey: 'foroPage.cards.events.description',
    ctaKey: 'foroPage.cards.events.cta',
    icon: Megaphone,
    to: '/eventos',
    tone: 'event',
  },
  {
    titleKey: 'foroPage.cards.clinicalLives.title',
    descriptionKey: 'foroPage.cards.clinicalLives.description',
    ctaKey: 'foroPage.cards.clinicalLives.cta',
    icon: Radio,
    to: '/lives',
    tone: 'live',
  },
  {
    titleKey: 'foroPage.cards.openZooms.title',
    descriptionKey: 'foroPage.cards.openZooms.description',
    ctaKey: 'foroPage.cards.openZooms.cta',
    icon: Video,
    to: '/meetings?visibility=public',
    tone: 'doctor',
  },
  {
    titleKey: 'foroPage.cards.residentNetwork.title',
    descriptionKey: 'foroPage.cards.residentNetwork.description',
    ctaKey: 'foroPage.cards.residentNetwork.cta',
    icon: Users,
    to: '/doctors?role=resident',
    tone: 'resident',
  },
];

const TONE_CLASSES: Record<ForoCard['tone'], string> = {
  doctor:   'from-[#163a83]/15 to-[#227787]/10 text-[#163a83]',
  resident: 'from-emerald-500/15 to-emerald-700/10 text-emerald-700',
  event:    'from-amber-500/15 to-amber-700/10 text-amber-700',
  live:     'from-rose-500/15 to-rose-700/10 text-rose-700',
};

interface LiveNow {
  id: string;
  title: string;
  specialty: string | null;
  viewer_count: number;
  thumbnail_url: string | null;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  specialty: string | null;
  meeting_type: string | null;
  scheduled_at: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  is_online: boolean;
  location: string | null;
  organizer: string | null;
}

export default function Foro() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;

  const [livesNow, setLivesNow] = useState<LiveNow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMeeting[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [stats, setStats] = useState({ doctors: 0, liveNow: 0, upcoming: 0, events: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const client = supabase as any;
      const [livesRes, meetingsRes, doctorsRes, liveCountRes, upcomingRes, eventsRes, eventsCountRes] = await Promise.all([
        client.from('lives').select('id,title,specialty,viewer_count,thumbnail_url').eq('status', 'live').eq('is_broadcasting', true).order('viewer_count', { ascending: false }).limit(3),
        client.from('clinical_sessions').select('id,title,specialty,meeting_type,scheduled_at').eq('is_public', true).gt('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(4),
        client.from('doctor_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'approved'),
        client.from('lives').select('id', { count: 'exact', head: true }).eq('status', 'live').eq('is_broadcasting', true),
        client.from('clinical_sessions').select('id', { count: 'exact', head: true }).eq('is_public', true).gt('scheduled_at', nowIso),
        client.from('foro_events').select('id,title,event_type,event_date,is_online,location,organizer').eq('is_published', true).gte('event_date', nowIso).order('event_date', { ascending: true }).limit(3),
        client.from('foro_events').select('id', { count: 'exact', head: true }).eq('is_published', true).gte('event_date', nowIso),
      ]);
      setLivesNow((livesRes.data || []) as LiveNow[]);
      setUpcoming((meetingsRes.data || []) as UpcomingMeeting[]);
      setUpcomingEvents((eventsRes.data || []) as UpcomingEvent[]);
      setStats({
        doctors: doctorsRes.count || 0,
        liveNow: liveCountRes.count || 0,
        upcoming: upcomingRes.count || 0,
        events: eventsCountRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const eventTypeLabel = (type: string) => {
    const key = `eventos.types.${type}`;
    const tr = t(key);
    return tr && tr !== key ? tr : type;
  };

  const meetingTypeLabel = (type: string | null) => {
    switch (type) {
      case 'resident_class': return language === 'es' ? 'Clase para residentes' : 'Resident class';
      case 'case_discussion': return language === 'es' ? 'Discusión de caso' : 'Case discussion';
      case 'open_zoom':
      case 'public': return language === 'es' ? 'Reunión abierta' : 'Open meeting';
      default: return language === 'es' ? 'Reunión' : 'Meeting';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl">
        <header className="mb-6 sm:mb-10 text-center sm:text-left rounded-2xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#163a83]/12 text-[#163a83] dark:bg-cyan-400/15 dark:text-cyan-200 text-xs font-semibold mb-3">
            <MessageSquare className="w-3.5 h-3.5" /> {t('foroPage.badge')}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('foroPage.heroTitle')}
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 mt-2 max-w-2xl">
            {t('foroPage.heroSubtitle')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button onClick={() => navigate('/meetings?new=1')} className="gap-1.5">
              <Calendar className="w-4 h-4" /> {t('foroPage.createMeeting')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/lives?new=1')} className="gap-1.5 bg-white/90 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20">
              <Radio className="w-4 h-4" /> {t('foroPage.startLive')}
            </Button>
          </div>

          {/* Stats reales del foro */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-lg bg-white/80 dark:bg-white/10 backdrop-blur p-2 sm:p-3 text-center">
              <p className="text-lg sm:text-2xl font-bold text-[#163a83] dark:text-cyan-200">{loading ? '…' : stats.doctors}</p>
              <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{language === 'es' ? 'Doctores activos' : 'Active doctors'}</p>
            </div>
            <div className="rounded-lg bg-rose-500/10 backdrop-blur p-2 sm:p-3 text-center border border-rose-500/30">
              <p className="text-lg sm:text-2xl font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1">
                {stats.liveNow > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                {loading ? '…' : stats.liveNow}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{language === 'es' ? 'En vivo ahora' : 'Live now'}</p>
            </div>
            <div className="rounded-lg bg-white/80 dark:bg-white/10 backdrop-blur p-2 sm:p-3 text-center">
              <p className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300">{loading ? '…' : stats.upcoming}</p>
              <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{language === 'es' ? 'Próximas sesiones' : 'Upcoming'}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 backdrop-blur p-2 sm:p-3 text-center border border-amber-500/30">
              <p className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-300">{loading ? '…' : stats.events}</p>
              <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{t('eventos.foroBlock.statLabel')}</p>
            </div>
          </div>
        </header>

        {/* Lives en vivo ahora */}
        {livesNow.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {language === 'es' ? 'En vivo ahora' : 'Live now'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lives')} className="text-xs gap-1 text-slate-700 dark:text-slate-200">
                {language === 'es' ? 'Ver todos' : 'See all'} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {livesNow.map((live) => (
                <Card key={live.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/lives/${live.id}`)}>
                  <div className="aspect-video bg-gradient-to-br from-rose-500/20 to-rose-700/30 relative overflow-hidden">
                    {live.thumbnail_url ? (
                      <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-10 h-10 text-rose-700/40" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-rose-500 hover:bg-rose-500 text-white gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </Badge>
                    {live.viewer_count > 0 && (
                      <Badge variant="secondary" className="absolute top-2 right-2 gap-1 bg-black/50 text-white border-0">
                        <Eye className="w-3 h-3" /> {live.viewer_count}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm line-clamp-1">{live.title}</p>
                    {live.specialty && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{live.specialty}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Próximas sesiones públicas */}
        {upcoming.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                {language === 'es' ? 'Próximas sesiones públicas' : 'Upcoming public sessions'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/meetings')} className="text-xs gap-1 text-slate-700 dark:text-slate-200">
                {language === 'es' ? 'Ver todas' : 'See all'} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map((m) => (
                <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/meetings/${m.id}`)}>
                  <CardContent className="p-3 sm:p-4 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-emerald-500/15 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300 font-semibold leading-none">{format(new Date(m.scheduled_at), 'MMM', { locale })}</p>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">{format(new Date(m.scheduled_at), 'd')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm line-clamp-1">{m.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5">{meetingTypeLabel(m.meeting_type)}</Badge>
                        {m.specialty && <span className="text-[10px] text-muted-foreground">{m.specialty}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(m.scheduled_at), 'EEEE d MMM · HH:mm', { locale })}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Próximos eventos publicados por doctores verificados */}
        {upcomingEvents.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                {t('eventos.foroBlock.title')}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/eventos')} className="text-xs gap-1 text-slate-700 dark:text-slate-200">
                {t('eventos.foroBlock.seeAll')} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {upcomingEvents.map((e) => (
                <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eventos')}>
                  <CardContent className="p-3 sm:p-4 flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-amber-500/15 border border-amber-500/30 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-[10px] uppercase text-amber-700 dark:text-amber-300 font-semibold leading-none">{format(new Date(e.event_date), 'MMM', { locale })}</p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none mt-0.5">{format(new Date(e.event_date), 'd')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm line-clamp-2 leading-snug">{e.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5 capitalize">{eventTypeLabel(e.event_type)}</Badge>
                        {e.is_online && <span className="text-[10px] text-muted-foreground">{language === 'es' ? 'Online' : 'Online'}</span>}
                        {!e.is_online && e.location && <span className="text-[10px] text-muted-foreground truncate">{e.location}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(e.event_date), 'EEEE d MMM · HH:mm', { locale })}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Section header para las cards estáticas */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3 sm:mb-4">
          {language === 'es' ? 'Explora el foro' : 'Explore the forum'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.titleKey} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${TONE_CLASSES[c.tone]}`} />
                <CardHeader className="pb-2">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TONE_CLASSES[c.tone]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base mt-2">{t(c.titleKey)}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{t(c.descriptionKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="px-0 gap-1" onClick={() => navigate(c.to)}>
                    {t(c.ctaKey)} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 p-4 sm:p-6 rounded-xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg">
          <p className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">{t('foroPage.comingSoonTitle')}</p>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {t('foroPage.comingSoonBody')}
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
