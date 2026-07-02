import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Presentation, ArrowRight, Star, Radio } from 'lucide-react';
import { Congress, congressPhase } from '@/lib/congresses';

// Congresos del doctor en su perfil público (cliente 2026-07-02): la reunión/live
// que dio dentro de un congreso lo registra como conferencista y el congreso
// queda guardado aquí — en vivo, próximo o archivado.

interface Props {
  doctorId: string;
}

interface CongressWithLead extends Congress {
  isLead: boolean;
}

export default function DoctorCongresses({ doctorId }: Props) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [congresses, setCongresses] = useState<CongressWithLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: speakerRows } = await (supabase as any)
        .from('congress_speakers')
        .select('congress_id, is_lead')
        .eq('user_id', doctorId);
      const rows = (speakerRows as { congress_id: string; is_lead: boolean }[]) || [];
      if (rows.length === 0) {
        if (!cancelled) { setCongresses([]); setLoading(false); }
        return;
      }
      const leadMap: Record<string, boolean> = {};
      rows.forEach(r => { leadMap[r.congress_id] = r.is_lead; });
      const { data: cRows } = await (supabase as any)
        .from('congresses')
        .select('id, organizer_id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at')
        .in('id', rows.map(r => r.congress_id))
        .order('starts_at', { ascending: false })
        .limit(8);
      if (cancelled) return;
      setCongresses(((cRows as Congress[]) || []).map(c => ({ ...c, isLead: !!leadMap[c.id] })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [doctorId]);

  if (loading || congresses.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Presentation className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          {t('congresses.profileBlock.title')}
          <Badge variant="outline" className="text-[10px] h-5 ml-1">{congresses.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {congresses.map(c => {
          const phase = congressPhase(c);
          const start = new Date(`${c.starts_at}T12:00:00`);
          const end = new Date(`${c.ends_at}T12:00:00`);
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/congreso/${c.id}`)}
              className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/25 flex flex-col items-center justify-center flex-shrink-0">
                <p className="text-[10px] uppercase text-primary font-semibold leading-none">{format(start, 'MMM', { locale })}</p>
                <p className="text-lg font-bold text-primary leading-none mt-0.5">{format(start, 'd')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm line-clamp-2 leading-snug">{c.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {phase === 'active' && (
                    <Badge className="text-[10px] h-5 bg-live text-white gap-1">
                      <Radio className="w-2.5 h-2.5" />
                      {t('congresses.statusActive')}
                    </Badge>
                  )}
                  {phase === 'upcoming' && <Badge variant="info" className="text-[10px] h-5">{t('congresses.statusUpcoming')}</Badge>}
                  {phase === 'archived' && <Badge variant="secondary" className="text-[10px] h-5">{t('congresses.statusArchived')}</Badge>}
                  {c.isLead && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-premium/15 text-premium border border-premium/30 gap-0.5">
                      <Star className="w-2.5 h-2.5" fill="currentColor" />
                      {t('congresses.lead')}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {c.starts_at === c.ends_at
                    ? format(start, 'd MMMM yyyy', { locale })
                    : `${format(start, 'd MMM', { locale })} – ${format(end, 'd MMM yyyy', { locale })}`}
                </p>
              </div>
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => navigate('/congresos')} className="w-full justify-center gap-1.5 text-xs">
          {t('congresses.profileBlock.seeAll')} <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
