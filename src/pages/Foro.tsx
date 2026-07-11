import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import {
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

// Paleta de marca Medical Masters (cliente 2026-06-16: "todo con la paleta de la web").
// Antes usaba emerald/amber/rose fuera de marca; ahora navy/teal/azul-claro/cyan.
const TONE_CLASSES: Record<ForoCard['tone'], string> = {
  doctor:   'from-[#163a83]/15 to-[#227787]/10 text-[#163a83]',
  resident: 'from-[#839ed5]/25 to-[#163a83]/10 text-[#163a83]',
  event:    'from-[#227787]/18 to-[#0b1d45]/10 text-[#227787]',
  live:     'from-[#aed3d9]/30 to-[#227787]/12 text-[#227787]',
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
  const { role } = useAuth();
  const locale = language === 'es' ? esLocale : enUS;

  const [livesNow, setLivesNow] = useState<LiveNow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMeeting[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [stats, setStats] = useState({ doctors: 0, liveNow: 0, upcoming: 0, events: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
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
      } catch (e) {
        console.error('Foro load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const eventTypeLabel = (type: string) => {
    const key = `eventos.types.${type}`;
    const tr = t(key);
    return tr && tr !== key ? tr : type;
  };

  const meetingTypeLabel = (type: string | null) => {
    switch (type) {
      case 'resident_class': return t('autoI18n.clForo1');
      case 'case_discussion': return t('autoI18n.clForo2');
      case 'open_zoom':
      case 'public': return t('autoI18n.clForo3');
      default: return t('autoI18n.clForo4');
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl">
        {/* Cabecera (título, subtítulo, botones y contadores) eliminada por petición del cliente 2026-06-17. */}

        {/* Lives en vivo ahora */}
        {livesNow.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {t('autoI18n.clForo6')}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lives')} className="text-xs gap-1 text-slate-700 dark:text-slate-200">
                {t('autoI18n.clForo8')} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {livesNow.map((live) => (
                <Card key={live.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/live/${live.id}`)}>
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/30 relative overflow-hidden">
                    {live.thumbnail_url ? (
                      <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-primary hover:bg-primary text-white gap-1">
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
                <Calendar className="w-4 h-4 text-secondary dark:text-secondary" />
                {t('autoI18n.clForo9')}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/meetings')} className="text-xs gap-1 text-slate-700 dark:text-slate-200">
                {t('autoI18n.clForo10')} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map((m) => (
                <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/meetings?id=${m.id}`)}>
                  <CardContent className="p-3 sm:p-4 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-secondary/15 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-[10px] uppercase text-secondary dark:text-secondary font-semibold leading-none">{format(new Date(m.scheduled_at), 'MMM', { locale })}</p>
                      <p className="text-base font-bold text-secondary dark:text-secondary leading-none mt-0.5">{format(new Date(m.scheduled_at), 'd')}</p>
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
                <Megaphone className="w-4 h-4 text-secondary dark:text-secondary" />
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
                    <div className="w-12 h-12 rounded-lg bg-secondary/15 border border-secondary/30 flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-[10px] uppercase text-secondary dark:text-secondary font-semibold leading-none">{format(new Date(e.event_date), 'MMM', { locale })}</p>
                      <p className="text-lg font-bold text-secondary dark:text-secondary leading-none mt-0.5">{format(new Date(e.event_date), 'd')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm line-clamp-2 leading-snug">{e.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5 capitalize">{eventTypeLabel(e.event_type)}</Badge>
                        {e.is_online && <span className="text-[10px] text-muted-foreground">{t('autoI18n.clForo11')}</span>}
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
          {t('autoI18n.clForo12')}
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

        {/* Aviso "Próximamente en el Foro" SOLO para residentes (cliente 2026-06-19):
            el resto de roles (doctor, paciente, admin, visitante) no debe verlo. */}
        {role === 'resident' && (
          <div className="mt-10 p-4 sm:p-6 rounded-xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg">
            <p className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">{t('foroPage.comingSoonTitle')}</p>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {t('foroPage.comingSoonBody')}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
