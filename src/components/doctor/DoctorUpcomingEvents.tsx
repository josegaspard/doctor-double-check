import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Megaphone, MapPin, Globe, ArrowRight, ExternalLink } from 'lucide-react';

interface DoctorEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_date: string;
  is_online: boolean;
  location: string | null;
  registration_url: string | null;
  organizer: string | null;
}

interface Props {
  doctorId: string;
}

export default function DoctorUpcomingEvents({ doctorId }: Props) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [events, setEvents] = useState<DoctorEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from('foro_events')
        .select('id,title,description,event_type,event_date,is_online,location,registration_url,organizer')
        .eq('created_by', doctorId)
        .eq('is_published', true)
        .gte('event_date', nowIso)
        .order('event_date', { ascending: true })
        .limit(6);
      if (cancelled) return;
      setEvents((data as DoctorEvent[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [doctorId]);

  if (loading || events.length === 0) return null;

  const typeLabel = (k: string) => {
    const key = `eventos.types.${k}`;
    const tr = t(key);
    return tr && tr !== key ? tr : k;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
          {t('eventos.profileBlock.title')}
          <Badge variant="outline" className="text-[10px] h-5 ml-1">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {events.map(e => {
          const start = new Date(e.event_date);
          return (
            <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-warning/15 border border-warning/30 flex flex-col items-center justify-center flex-shrink-0">
                <p className="text-[10px] uppercase text-warning font-semibold leading-none">{format(start, 'MMM', { locale })}</p>
                <p className="text-lg font-bold text-warning leading-none mt-0.5">{format(start, 'd')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm line-clamp-2 leading-snug">{e.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px] h-5 capitalize">{typeLabel(e.event_type)}</Badge>
                  {e.is_online ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Globe className="w-3 h-3" /> {t('eventos.online')}</span>
                  ) : e.location ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate"><MapPin className="w-3 h-3" /> {e.location}</span>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{format(start, 'EEEE d MMM · HH:mm', { locale })}</p>
              </div>
              {e.registration_url && (
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 flex-shrink-0" asChild>
                  <a href={e.registration_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                    {t('eventos.profileBlock.register')}
                  </a>
                </Button>
              )}
            </div>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => navigate('/eventos')} className="w-full justify-center gap-1.5 text-xs">
          {t('eventos.profileBlock.seeAll')} <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
