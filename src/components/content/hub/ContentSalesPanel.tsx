// Contenido › Ventas (ContentHub), 11-sep-2026.
// Ventas REALES del médico originadas por su contenido y sus Lives: mismo
// criterio bruto/neto y mismo descargo que Cuenta > Finanzas > Ingresos
// (DoctorEarnings) — wallet_transactions.amount es el BRUTO que pagó el
// comprador; la comisión y el neto son cálculo con la tasa publicada.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { doctorHref } from '@/lib/doctorSections';
import { ShoppingBag, Loader2, ArrowRight, Info, Radio, FileText } from 'lucide-react';
import { money2, fmtDate, fill } from '@/lib/proFormat';

interface Tx { id: string; amount: number; description: string; created_at: string; metadata: any }

type Bucket = 'content' | 'lives';

const bucketOf = (raw?: string): Bucket | null => {
  switch (raw) {
    case 'recording': case 'content': return 'content';
    case 'live': case 'live_chat_highlight': return 'lives';
    default: return null;
  }
};

export default function ContentSalesPanel() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [commissionRate, setCommissionRate] = useState(20);
  const [rateContent, setRateContent] = useState<number | null>(null);
  const [rateLive, setRateLive] = useState<number | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(false);
    try {
      const [txRes, settingsRes] = await Promise.all([
        supabase.from('wallet_transactions').select('id, amount, description, created_at, metadata').eq('user_id', user.id).eq('type', 'earning').order('created_at', { ascending: false }),
        supabase.from('payout_settings_public').select('*').limit(1).maybeSingle(),
      ]);
      if (txRes.error) throw txRes.error;
      setTxs((txRes.data as any[]) || []);
      const st = (settingsRes.data as any) || {};
      if (st.commission_percentage != null) setCommissionRate(Number(st.commission_percentage));
      setRateContent(st.commission_recording ?? st.commission_content ?? null);
      setRateLive(st.commission_live ?? null);
    } catch (e) {
      console.error('[ContentSalesPanel]', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const contentTxs = useMemo(() => txs.filter(tx => bucketOf((tx.metadata as any)?.source) !== null), [txs]);

  const rateOf = (b: Bucket) => {
    const own = b === 'content' ? rateContent : rateLive;
    return (own != null ? Number(own) : commissionRate) / 100;
  };
  const grossOf = (tx: Tx) => Number(tx.amount) || 0;
  const netOf = (tx: Tx) => {
    const b = bucketOf((tx.metadata as any)?.source) as Bucket;
    return grossOf(tx) * (1 - rateOf(b));
  };

  const totals = useMemo(() => {
    let gross = 0, net = 0;
    const byBucket: Record<Bucket, { gross: number; count: number }> = { content: { gross: 0, count: 0 }, lives: { gross: 0, count: 0 } };
    contentTxs.forEach(tx => {
      const b = bucketOf((tx.metadata as any)?.source) as Bucket;
      const g = grossOf(tx);
      gross += g;
      net += netOf(tx);
      byBucket[b].gross += g;
      byBucket[b].count += 1;
    });
    return { gross, net, commission: gross - net, byBucket };
  }, [contentTxs]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPerTypeRate = rateContent != null || rateLive != null;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>;
  }
  if (error) {
    return (
      <section className="pro-card pro-card-pad bg-card text-center py-10">
        <p className="text-sm text-slate-600">{t('mm2.content.hub.sales.loadError')}</p>
        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-3" onClick={load}>{t('pro.common.retry')}</button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="pro-statbar">
        <div className="pro-stat">
          <span className="pro-icon-box"><ShoppingBag /></span>
          <span className="min-w-0"><span className="k block">{t('mm2.content.hub.sales.kpiGross')}</span><span className="v block">{money2(totals.gross, language)}</span></span>
        </div>
        <div className="pro-stat">
          <span className="pro-icon-box"><FileText /></span>
          <span className="min-w-0"><span className="k block">{t('mm2.content.hub.sales.kpiContent')}</span><span className="v block">{money2(totals.byBucket.content.gross, language)}</span></span>
        </div>
        <div className="pro-stat">
          <span className="pro-icon-box"><Radio /></span>
          <span className="min-w-0"><span className="k block">{t('mm2.content.hub.sales.kpiLives')}</span><span className="v block">{money2(totals.byBucket.lives.gross, language)}</span></span>
        </div>
        <div className="pro-stat">
          <span className="pro-icon-box"><ShoppingBag /></span>
          <span className="min-w-0"><span className="k block">{t('mm2.content.hub.sales.kpiCount')}</span><span className="v block">{contentTxs.length}</span></span>
        </div>
      </div>

      <section className="pro-card pro-card-pad bg-card">
        <div className="pro-card-head">
          <h2 className="pro-card-title text-secondary"><ShoppingBag /> {t('mm2.content.hub.sales.title')}</h2>
          <Link to={doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' })} className="pro-link">{t('mm2.content.hub.sales.viewFinances')} <ArrowRight /></Link>
        </div>
        {contentTxs.length === 0 ? (
          <p className="pro-muted text-sm py-8 text-center">{t('mm2.content.hub.sales.empty')}</p>
        ) : (
          <div>
            {contentTxs.slice(0, 20).map(tx => (
              <div key={tx.id} className="pro-row">
                <span className="pro-icon-box" style={{ width: 34, height: 34 }}>
                  {bucketOf((tx.metadata as any)?.source) === 'lives' ? <Radio /> : <FileText />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="pro-row-name block truncate">{tx.description || t('mm2.content.hub.sales.saleFallback')}</span>
                  <span className="pro-row-sub block">{fmtDate(new Date(tx.created_at), language)}</span>
                </span>
                <span className="pro-row-name">{money2(grossOf(tx), language)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pro-note mt-3">
          <Info />
          <span>
            {hasPerTypeRate
              ? fill(t('mm2.content.hub.sales.commissionNotePerType'), { p: commissionRate })
              : fill(t('mm2.content.hub.sales.commissionNoteFlat'), { p: commissionRate })}
          </span>
        </div>
      </section>
    </div>
  );
}
