// «Próximo Live» del perfil público (diseño de Marta, 12-sep-2026).
// Lee el siguiente `doctor_availability` de tipo 'live' de ESTE médico con la
// misma lectura pública que ya hace useDoctorAvailability (futuros, en estado
// scheduled/confirmed), acotada por doctor_id. Si la fila no llega (RLS sin
// sesión, error), estado vacío honesto: nunca un dato de ejemplo.
// Si el médico está en directo AHORA (`activeLive`, que la página ya conoce),
// la tarjeta enseña ese directo con su enlace.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, CalendarDays, Clock, ChevronRight, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { fill, fmtDayShort, fmtTime } from '@/lib/proFormat';

interface NextLive {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  durationMinutes: number;
}

interface NextLiveCardProps {
  doctorId: string;
  activeLive: { id: string; title: string; viewerCount: number } | null;
  /** Adónde lleva «Ver todos sus Lives» (el mismo destino que el botón de siempre). */
  allHref: string;
  /** Cuántos Lives futuros tiene programados (para el «Ver sus Lives · N» del hero). */
  onUpcomingCount?: (n: number) => void;
}

export function NextLiveCard({ doctorId, activeLive, allHref, onUpcomingCount }: NextLiveCardProps) {
  const { t, language } = useLanguage();
  const [next, setNext] = useState<NextLive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctor_availability')
        .select('id, title, description, scheduled_at, duration_minutes')
        .eq('doctor_id', doctorId)
        .eq('type', 'live')
        .in('status', ['scheduled', 'confirmed'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });
      if (!alive) return;
      const rows = !error && Array.isArray(data) ? data : [];
      const first = rows[0];
      setNext(first ? {
        id: first.id,
        title: first.title,
        description: first.description,
        scheduledAt: new Date(first.scheduled_at),
        durationMinutes: first.duration_minutes || 60,
      } : null);
      onUpcomingCount?.(rows.length);
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0" id="pp-lives" aria-labelledby="pp-lives-title">
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-lives-title"><Radio /> {t('mm2.publicProfile.nextLiveTitle')}</h2>
        {activeLive ? (
          <span className="pro-pill pro-pill-live">{t('mm2.publicProfile.nextLiveNow')}</span>
        ) : next ? (
          <span className="pro-pill pro-pill-live">{t('mm2.publicProfile.nextLiveSoon')}</span>
        ) : null}
      </div>

      {activeLive ? (
        <Link to={`/live/${activeLive.id}`} className="pp-live">
          <div className="pp-live-thumb"><Radio /><span className="dot"><Radio /></span></div>
          <div className="min-w-0">
            <div className="pp-live-title">{activeLive.title}</div>
            <div className="pp-live-meta">
              <span><Users /> {activeLive.viewerCount} {t('doctorProfile.watching')}</span>
            </div>
          </div>
        </Link>
      ) : loading ? (
        <p className="pp-empty"><Loader2 className="animate-spin" /> {t('pro.common.loading')}</p>
      ) : next ? (
        <div className="pp-live">
          <div className="pp-live-thumb"><Radio /></div>
          <div className="min-w-0">
            <div className="pp-live-title">{next.title}</div>
            <div className="pp-live-meta">
              <span><CalendarDays /> {fmtDayShort(next.scheduledAt, language)} · {fmtTime(next.scheduledAt, language)}</span>
              <span><Clock /> {fill(t('mm2.publicProfile.minutes'), { n: next.durationMinutes })}</span>
            </div>
            {next.description && <p className="pp-live-desc">{next.description}</p>}
          </div>
        </div>
      ) : (
        <p className="pp-empty">{t('mm2.publicProfile.nextLiveEmpty')}</p>
      )}

      <Link to={allHref} className="pro-btn pro-btn-outline pro-btn-sm pp-live-all">
        {t('mm2.publicProfile.nextLiveAll')} <ChevronRight />
      </Link>
    </section>
  );
}

export default NextLiveCard;
