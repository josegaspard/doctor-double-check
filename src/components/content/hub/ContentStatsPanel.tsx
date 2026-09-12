// Contenido › Estadísticas (ContentHub), 11-sep-2026.
// Métricas REALES que ya existen en la base — nada inventado. Lo que todavía
// no se mide (p. ej. vistas de una colección) se dice honesto, no se rellena.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useContentCollections } from '@/hooks/useContentCollections';
import { doctorHref } from '@/lib/doctorSections';
import {
  BarChart3, FileText, Video, Radio, Library, Eye, Users, Loader2, ArrowRight,
} from 'lucide-react';

interface Counts {
  published: number; draft: number; review: number; paid: number;
  recordings: number; recordingViewers: number; recordingAvgPct: number;
  livesPast: number; livesPeakSum: number;
}

const EMPTY: Counts = {
  published: 0, draft: 0, review: 0, paid: 0,
  recordings: 0, recordingViewers: 0, recordingAvgPct: 0,
  livesPast: 0, livesPeakSum: 0,
};

export default function ContentStatsPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { collections, loading: loadingCollections } = useContentCollections('mine');
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const [contentRes, recRes, liveRes] = await Promise.all([
          (supabase as any).from('doctor_content').select('is_public, moderation_status, price').eq('creator_id', user.id),
          supabase.from('recordings').select('id').eq('doctor_id', user.id),
          supabase.from('lives').select('peak_viewers').eq('doctor_id', user.id).eq('status', 'ended'),
        ]);
        if (contentRes.error) throw contentRes.error;
        if (recRes.error) throw recRes.error;
        if (liveRes.error) throw liveRes.error;

        let published = 0, draft = 0, review = 0, paid = 0;
        ((contentRes.data as any[]) || []).forEach(c => {
          if (c.moderation_status === 'pending') review += 1;
          else if (c.is_public) published += 1;
          else draft += 1;
          if (Number(c.price || 0) > 0) paid += 1;
        });

        const recIds = ((recRes.data as any[]) || []).map(r => r.id);
        let recordingViewers = 0, recordingAvgPct = 0;
        if (recIds.length) {
          const { data: views } = await (supabase as any)
            .from('recording_views')
            .select('recording_id, max_position, duration')
            .in('recording_id', recIds);
          const rows = (views as any[]) || [];
          recordingViewers = rows.length;
          const pcts = rows
            .filter(v => v.duration && v.duration > 0)
            .map(v => Math.min(100, (v.max_position / v.duration) * 100));
          recordingAvgPct = pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : 0;
        }

        const livesRows = (liveRes.data as any[]) || [];
        const livesPeakSum = livesRows.reduce((s, l) => s + (Number(l.peak_viewers) || 0), 0);

        if (!cancelled) {
          setCounts({
            published, draft, review, paid,
            recordings: recIds.length, recordingViewers, recordingAvgPct,
            livesPast: livesRows.length, livesPeakSum,
          });
        }
      } catch (e) {
        console.error('[ContentStatsPanel]', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const collectionsPublic = useMemo(() => collections.filter(c => c.is_public).length, [collections]);

  if (loading || loadingCollections) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>;
  }
  if (error) {
    return (
      <section className="pro-card pro-card-pad bg-card text-center py-10">
        <p className="text-sm text-slate-600">{t('mm2.content.hub.stats.loadError')}</p>
      </section>
    );
  }

  const tile = (Icon: React.ElementType, label: string, value: React.ReactNode, sub?: string) => (
    <div className="pro-stat">
      <span className="pro-icon-box"><Icon /></span>
      <span className="min-w-0">
        <span className="k block">{label}</span>
        <span className="v block">{value}</span>
        {sub && <span className="block text-[11px] pro-muted mt-0.5">{sub}</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="pro-card pro-card-pad bg-card">
        <h2 className="pro-card-title text-secondary mb-3"><FileText /> {t('mm2.content.hub.stats.publicationsTitle')}</h2>
        <div className="pro-statbar">
          {tile(Eye, t('mm2.content.hub.stats.published'), counts.published)}
          {tile(FileText, t('mm2.content.hub.stats.drafts'), counts.draft)}
          {tile(BarChart3, t('mm2.content.hub.stats.review'), counts.review)}
          {tile(FileText, t('mm2.content.hub.stats.paid'), counts.paid)}
        </div>
      </section>

      <section className="pro-card pro-card-pad bg-card">
        <h2 className="pro-card-title text-secondary mb-3"><Video /> {t('mm2.content.hub.stats.recordingsTitle')}</h2>
        <div className="pro-statbar">
          {tile(Video, t('mm2.content.hub.stats.recordingsCount'), counts.recordings)}
          {tile(Users, t('mm2.content.hub.stats.recordingViewers'), counts.recordingViewers)}
          {tile(BarChart3, t('mm2.content.hub.stats.recordingAvgPct'), `${counts.recordingAvgPct}%`, counts.recordings === 0 ? t('mm2.content.hub.stats.noData') : undefined)}
        </div>
      </section>

      <section className="pro-card pro-card-pad bg-card">
        <h2 className="pro-card-title text-secondary mb-3"><Radio /> {t('mm2.content.hub.stats.livesTitle')}</h2>
        <div className="pro-statbar">
          {tile(Radio, t('mm2.content.hub.stats.livesPast'), counts.livesPast)}
          {tile(Users, t('mm2.content.hub.stats.livesPeak'), counts.livesPeakSum, counts.livesPast === 0 ? t('mm2.content.hub.stats.noData') : undefined)}
        </div>
      </section>

      <section className="pro-card pro-card-pad bg-card">
        <div className="pro-card-head">
          <h2 className="pro-card-title text-secondary"><Library /> {t('mm2.content.hub.stats.collectionsTitle')}</h2>
        </div>
        <div className="pro-statbar">
          {tile(Library, t('mm2.content.hub.stats.collectionsCount'), collections.length)}
          {tile(Eye, t('mm2.content.hub.stats.collectionsPublic'), collectionsPublic)}
        </div>
      </section>

      <Link to={doctorHref('contenido', { tab: 'ventas' })} className="pro-btn pro-btn-outline w-full sm:w-auto">
        {t('mm2.content.hub.stats.viewSales')} <ArrowRight />
      </Link>
    </div>
  );
}
