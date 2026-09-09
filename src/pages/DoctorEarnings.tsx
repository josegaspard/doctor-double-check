import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, Clock, Percent, Banknote, CalendarDays, ChevronDown,
  ChevronLeft, ChevronRight, Download, FileText, Loader2, CheckCircle2, Building2,
  Info, ArrowRight, Lock, Receipt,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fill, money, money2, fmtDate, fmtDayShort, norm } from '@/lib/proFormat';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  metadata: any;
}
interface PayoutRecord {
  id: string; amount: number; status: string; created_at: string;
  paid_at: string | null; stripe_transfer_id: string | null; error_message: string | null;
}
interface Hold {
  id: string; amount: number; reason: string; status: string;
  held_at: string; release_at: string | null; released_at: string | null;
}
interface Invoice {
  id: string; invoice_number: string; period_start: string; period_end: string;
  file_url: string | null; status: string | null;
}
interface BankAccount {
  bank_name: string | null; clabe_last4: string | null; account_holder_name: string | null;
  is_verified: boolean | null; payment_method: string | null; payouts_enabled: boolean | null;
}

type Range = 'last30' | 'thisMonth' | 'prevMonth' | 'last90' | 'year' | 'all';
type SourceKey = 'consultations' | 'subscriptions' | 'content' | 'lives' | 'other';
type Bucket = 'day' | 'week' | 'month';

const SOURCE_COLORS: Record<SourceKey, string> = {
  consultations: '#227787',
  subscriptions: '#1c8a9c',
  content: '#4fb3c4',
  lives: '#9ad9e5',
  other: '#c7d7de',
};

/** `metadata.source` de la base → la fuente que enseña la pantalla */
const sourceOf = (raw?: string): SourceKey => {
  switch (raw) {
    case 'consultation': case 'chat': return 'consultations';
    case 'subscription': case 'subscription_renewal': return 'subscriptions';
    case 'recording': case 'content': return 'content';
    case 'live': case 'live_chat_highlight': return 'lives';
    default: return 'other';
  }
};

const PAGE_SIZE = 8;

export default function DoctorEarnings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [commissionRate, setCommissionRate] = useState(20);
  const [payoutFrequency, setPayoutFrequency] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  const [range, setRange] = useState<Range>('thisMonth');
  const [bucket, setBucket] = useState<Bucket>('day');
  const [sourceTab, setSourceTab] = useState<SourceKey | 'total'>('total');
  const [tab, setTab] = useState<'movements' | 'payouts' | 'holds'>('movements');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (role && role !== 'doctor') { navigate('/'); return; }
    if (role === 'doctor') loadEarningsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const loadEarningsData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      const [txRes, payoutRes, holdRes, bankRes, invRes, settingsRes, walletRes, profileRes] = await Promise.all([
        supabase.from('wallet_transactions').select('*').eq('user_id', user.id).eq('type', 'earning').order('created_at', { ascending: false }),
        supabase.from('doctor_payouts').select('*').eq('doctor_id', user.id).order('created_at', { ascending: false }),
        supabase.from('fund_holds').select('*').eq('doctor_id', user.id).order('created_at', { ascending: false }),
        supabase.from('doctor_bank_accounts').select('bank_name, clabe_last4, account_holder_name, is_verified, payment_method, payouts_enabled').eq('doctor_id', user.id).maybeSingle(),
        supabase.from('doctor_invoices').select('id, invoice_number, period_start, period_end, file_url, status').eq('doctor_id', user.id).order('period_start', { ascending: false }),
        supabase.from('payout_settings_public').select('commission_percentage, payout_frequency').limit(1).maybeSingle(),
        supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('doctor_profiles').select('pending_earnings, total_earnings').eq('user_id', user.id).maybeSingle(),
      ]);

      setTransactions((txRes.data as any[]) || []);
      setPayouts((payoutRes.data as any[]) || []);
      setHolds((holdRes.data as any[]) || []);
      setBank((bankRes.data as any) || null);
      const invRows = ((invRes.data as any[]) || []) as Invoice[];
      setInvoices(invRows);
      setInvoicesCount(invRows.length);
      if ((settingsRes.data as any)?.commission_percentage != null) setCommissionRate(Number((settingsRes.data as any).commission_percentage));
      setPayoutFrequency((settingsRes.data as any)?.payout_frequency || null);
      setWalletBalance(Number((walletRes.data as any)?.balance) || 0);
      setPendingEarnings(Number((profileRes.data as any)?.pending_earnings) || 0);
      setTotalPaid(Number((profileRes.data as any)?.total_earnings) || 0);

      // Nombre real del paciente/cliente cuando el movimiento lo trae en metadata.
      const ids = [...new Set((((txRes.data as any[]) || [])
        .map(tx => (tx.metadata as any)?.patient_id || (tx.metadata as any)?.user_id || (tx.metadata as any)?.buyer_id)
        .filter(Boolean)))] as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.name; });
        setClientNames(map);
      }
    } catch (e) {
      console.error('Error loading earnings:', e);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------ rangos
  const rangeBounds = (r: Range): { from: Date; to: Date } => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    switch (r) {
      case 'thisMonth': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
      case 'prevMonth': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
      case 'last90': return { from: new Date(end.getTime() - 90 * 86_400_000), to: end };
      case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: end };
      case 'all': return { from: new Date(2000, 0, 1), to: end };
      default: return { from: new Date(end.getTime() - 30 * 86_400_000), to: end };
    }
  };
  const rangeLabel = (r: Range) => ({
    last30: t('pro.earnings.rangeLast30'),
    thisMonth: t('pro.earnings.rangeThisMonth'),
    prevMonth: t('pro.earnings.rangePrevMonth'),
    last90: t('pro.earnings.range90'),
    year: t('pro.earnings.rangeYear'),
    all: t('pro.earnings.rangeAll'),
  }[r]);

  const { from, to } = rangeBounds(range);
  /** «1 sep 2026 – 30 sep 2026», como la maqueta, en vez del nombre del preset */
  const rangeDates = `${fmtDate(from, language)} – ${fmtDate(new Date(to.getTime() - 86_400_000), language)}`;

  const inRange = (iso: string, a: Date, b: Date) => {
    const d = new Date(iso).getTime();
    return d >= a.getTime() && d < b.getTime();
  };

  const periodTx = useMemo(() => {
    // Los límites se recalculan aquí dentro: dependen sólo de `range`, y así
    // el linter ve todas las dependencias de verdad.
    const { from: f, to: tt } = rangeBounds(range);
    return transactions.filter(tx => inRange(tx.created_at, f, tt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, range]);

  const filteredTx = useMemo(
    () => (sourceTab === 'total' ? periodTx : periodTx.filter(tx => sourceOf((tx.metadata as any)?.source) === sourceTab)),
    [periodTx, sourceTab],
  );

  // --------------------------------------------------------------- agregados
  const rate = commissionRate / 100;
  /** 🚨 `wallet_transactions.amount` de una ganancia es el importe BRUTO que pagó
   *  el comprador (`purchaseResult.amount_charged`): la comisión la aplica aparte
   *  `credit_doctor_earnings` sobre `pending_earnings`. Comprobado en
   *  supabase/functions/purchase-content-wallet y purchase-recording-wallet.
   *  Por eso el BRUTO es el dato y la comisión y el neto son CÁLCULO. */
  const grossOf = (tx: Transaction) => Number(tx.amount) || 0;
  const commissionOf = (tx: Transaction) => grossOf(tx) * rate;
  const netOf = (tx: Transaction) => grossOf(tx) - commissionOf(tx);

  /** Del PERIODO completo: el KPI de comisiones y el desglose no dependen de la
   *  pestaña de fuente que esté abierta (antes cambiaban al pulsar «Consultas»). */
  const totals = useMemo(() => {
    const gross = periodTx.reduce((s, tx) => s + grossOf(tx), 0);
    const commission = gross * rate;
    return { gross, commission, net: gross - commission };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, commissionRate]);

  /** De lo que se ve en la tabla (sí depende de la pestaña) */
  const tableTotals = useMemo(() => {
    const gross = filteredTx.reduce((s, tx) => s + grossOf(tx), 0);
    return { gross, commission: gross * rate, net: gross - gross * rate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTx, commissionRate]);

  /** La factura cuyo periodo cubre la fecha del movimiento */
  const invoiceFor = (iso: string) => {
    const t0 = new Date(iso).getTime();
    return invoices.find(inv => {
      const a = new Date(inv.period_start).getTime();
      const b = new Date(inv.period_end).getTime() + 86_399_000;
      return t0 >= a && t0 <= b;
    }) || null;
  };

  const bySource = useMemo(() => {
    const acc: Record<SourceKey, number> = { consultations: 0, subscriptions: 0, content: 0, lives: 0, other: 0 };
    periodTx.forEach(tx => { acc[sourceOf((tx.metadata as any)?.source)] += grossOf(tx); });
    return acc;
  }, [periodTx]);

  const periodNet = Object.values(bySource).reduce((a, b) => a + b, 0);

  // Mismo periodo, un mes antes → la variación del KPI del mes
  const monthDelta = useMemo(() => {
    const now = new Date();
    const thisFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cur = transactions.filter(tx => inRange(tx.created_at, thisFrom, thisTo)).reduce((s, tx) => s + grossOf(tx), 0);
    const prev = transactions.filter(tx => inRange(tx.created_at, prevFrom, thisFrom)).reduce((s, tx) => s + grossOf(tx), 0);
    const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
    return { cur, prev, pct };
  }, [transactions]);

  const chartData = useMemo(() => {
    const keyOf = (d: Date) => {
      if (bucket === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (bucket === 'week') {
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      }
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const map = new Map<string, any>();
    periodTx.forEach(tx => {
      const d = new Date(tx.created_at);
      const k = keyOf(d);
      if (!map.has(k)) map.set(k, { k, date: d, consultations: 0, subscriptions: 0, content: 0, lives: 0, other: 0 });
      map.get(k)[sourceOf((tx.metadata as any)?.source)] += grossOf(tx);
    });
    return [...map.values()]
      .sort((a, b) => a.k.localeCompare(b.k))
      .map(r => ({
        ...r,
        label: bucket === 'month'
          ? new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', { month: 'short', year: '2-digit' }).format(r.date)
          : fmtDayShort(r.date, language),
      }));
  }, [periodTx, bucket, language]);

  const activeHolds = holds.filter(h => h.status === 'held');
  const heldTotal = activeHolds.reduce((s, h) => s + Number(h.amount), 0);
  const nextRelease = activeHolds
    .map(h => h.release_at)
    .filter(Boolean)
    .sort()[0] as string | undefined;

  const pages = Math.max(1, Math.ceil(filteredTx.length / PAGE_SIZE));
  const pageRows = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [range, sourceTab, tab]);

  // ----------------------------------------------------------------- acciones
  const sourceLabel = (k: SourceKey) => ({
    consultations: t('pro.earnings.srcConsultations'),
    subscriptions: t('pro.earnings.srcSubscriptions'),
    content: t('pro.earnings.srcContent'),
    lives: t('pro.earnings.srcLives'),
    other: t('pro.earnings.srcOther'),
  }[k]);

  const statusLabel = (s: string) => (s === 'paid' ? t('pro.earnings.statusPaid')
    : s === 'failed' ? t('pro.earnings.statusFailed')
    : s === 'initiated' ? t('pro.earnings.statusProcessing')
    : t('pro.earnings.statusPaid'));
  const statusClass = (s: string) => (s === 'failed' ? 'pro-pill-live' : s === 'initiated' ? 'pro-pill-warn' : 'pro-pill-ok');

  const clientOf = (tx: Transaction) => {
    const m = (tx.metadata as any) || {};
    const id = m.patient_id || m.user_id || m.buyer_id;
    return (id && clientNames[id]) || m.patient_name || m.buyer_name || '—';
  };

  const handleExportCSV = () => {
    if (filteredTx.length === 0) { toast.info(t('pro.earnings.nothingToExport')); return; }
    const headers = [
      t('pro.earnings.thDate'), t('pro.earnings.thClient'), t('pro.earnings.thConcept'), t('pro.earnings.thSource'),
      t('pro.earnings.thGross'), fill(t('pro.earnings.thCommission'), { p: commissionRate }), t('pro.earnings.thNet'), t('pro.earnings.thStatus'),
    ];
    const rows = filteredTx.map(tx => [
      new Date(tx.created_at).toISOString().slice(0, 16).replace('T', ' '),
      clientOf(tx),
      tx.description,
      sourceLabel(sourceOf((tx.metadata as any)?.source)),
      grossOf(tx).toFixed(2),
      commissionOf(tx).toFixed(2),
      netOf(tx).toFixed(2),
      statusLabel(tx.status),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    a.download = `ingresos_${slug(rangeLabel(range))}_${slug(sourceTab === 'total' ? t('pro.earnings.srcTotal') : sourceLabel(sourceTab))}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('pro.earnings.exported'));
  };

  if (role && role !== 'doctor') return null;

  const kpis = [
    {
      // `pending_earnings` es lo acumulado a favor del médico y todavía sin pagar.
      // NO se mezcla con el saldo del monedero (`wallets.balance`), que es otra cosa.
      label: t('pro.earnings.kpiBalance'), value: money2(pendingEarnings, language),
      sub: t('pro.earnings.kpiBalanceSub'), Icon: Wallet,
    },
    {
      label: t('pro.earnings.kpiMonth'), value: money2(monthDelta.cur, language),
      sub: monthDelta.pct != null
        ? `${monthDelta.pct >= 0 ? '+' : ''}${monthDelta.pct}% ${t('pro.earnings.vsPrevMonth')}`
        : t('pro.earnings.vsPrevMonth'),
      delta: monthDelta.pct, Icon: TrendingUp,
    },
    {
      // Esta tarjeta habla SOLO de cobros retenidos (`fund_holds`), que es lo
      // único que mide. Antes se llamaba «Pendiente» y se leía como el saldo
      // pendiente, contradiciendo a «Próximo pago».
      label: t('pro.earnings.kpiHeld'), value: money2(heldTotal, language),
      sub: activeHolds.length === 0 ? t('pro.earnings.kpiPendingNone')
        : activeHolds.length === 1 ? t('pro.earnings.kpiPendingOne')
        : fill(t('pro.earnings.kpiPendingSub'), { n: activeHolds.length }),
      Icon: Clock,
    },
    {
      label: t('pro.earnings.kpiCommission'), value: money2(totals.commission, language),
      sub: fill(t('pro.earnings.kpiCommissionSub'), { p: commissionRate }), Icon: Percent,
    },
  ];

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><Banknote className="w-7 h-7" /> <span className="truncate">{t('pro.earnings.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.earnings.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none">
                  <CalendarDays />
                  <span className="hidden sm:inline">{rangeDates}</span>
                  <span className="sm:hidden">{rangeLabel(range)}</span>
                  <ChevronDown />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['last30', 'thisMonth', 'prevMonth', 'last90', 'year', 'all'] as Range[]).map(r => (
                  <DropdownMenuItem key={r} onClick={() => setRange(r)}>{rangeLabel(r)}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/doctor/bank-account" className="pro-btn pro-btn-live flex-1 sm:flex-none">
              <Banknote /> {t('pro.earnings.withdraw')}
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
        ) : loadError ? (
          <div className="pro-card pro-card-pad text-center py-10">
            <p className="pro-muted text-sm mb-3">{t('pro.common.error')}</p>
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={loadEarningsData}>{t('pro.common.retry')}</button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {kpis.map(k => (
                <div key={k.label} className="pro-card pro-kpi">
                  <span className="pro-icon-box"><k.Icon /></span>
                  <span className="min-w-0">
                    <span className="pro-kpi-label block">{k.label}</span>
                    <span className="pro-kpi-value block">{k.value}</span>
                    <span className="pro-kpi-sub block">
                      {k.delta != null && (
                        <span className={`pro-delta ${k.delta >= 0 ? 'pro-delta-up' : 'pro-delta-down'} mr-1`}>
                          {k.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        </span>
                      )}
                      {k.sub}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="pro-work pro-work-2">
              <div className="min-w-0 space-y-4">
                {/* Gráfico por fuente */}
                <section className="pro-card pro-card-pad min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="pro-seg">
                      {(['total', 'consultations', 'subscriptions', 'content', 'lives'] as const).map(s => (
                        <button key={s} type="button" className={sourceTab === s ? 'is-active' : ''} aria-pressed={sourceTab === s} onClick={() => setSourceTab(s)}>
                          {s === 'total' ? t('pro.earnings.srcTotal') : sourceLabel(s)}
                        </button>
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm ml-auto">
                          {bucket === 'day' ? t('pro.earnings.byDay') : bucket === 'week' ? t('pro.earnings.byWeek') : t('pro.earnings.byMonth')} <ChevronDown />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setBucket('day')}>{t('pro.earnings.byDay')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBucket('week')}>{t('pro.earnings.byWeek')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBucket('month')}>{t('pro.earnings.byMonth')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h2 className="pro-card-title mb-0.5">{t('pro.earnings.bySource')}</h2>
                  <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                    <span className="pro-kpi-value">{money2(periodNet, language)}</span>
                    {range === 'thisMonth' && monthDelta.pct != null && (
                      <span className={`pro-delta ${monthDelta.pct >= 0 ? 'pro-delta-up' : 'pro-delta-down'}`}>
                        {monthDelta.pct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {monthDelta.pct >= 0 ? '+' : ''}{monthDelta.pct}% {t('pro.earnings.vsPrevMonth')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_210px] gap-4 items-start">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={210}>
                        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eaf1f4" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7a89' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7a89' }} axisLine={false} tickLine={false} width={54} />
                          <Tooltip
                            formatter={(v: number, name: string) => [money(Number(v), language), sourceLabel(name as SourceKey)]}
                            contentStyle={{ background: '#fff', border: '1px solid #e3ecf0', borderRadius: 12, fontSize: 12 }}
                          />
                          {(['consultations', 'subscriptions', 'content', 'lives', 'other'] as SourceKey[])
                            .filter(k => sourceTab === 'total' || sourceTab === k)
                            .map((k, i, arr) => (
                              <Bar key={k} dataKey={k} stackId="a" fill={SOURCE_COLORS[k]} radius={i === arr.length - 1 ? [5, 5, 0, 0] : undefined} />
                            ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[210px] pro-muted text-sm">{t('pro.earnings.noChartData')}</div>
                    )}

                    <div className="pro-srcleg">
                      {(['consultations', 'subscriptions', 'content', 'lives', 'other'] as SourceKey[]).map(k => {
                        const v = bySource[k];
                        if (k === 'other' && v === 0) return null;
                        const pct = periodNet > 0 ? Math.round((v / periodNet) * 100) : 0;
                        return (
                          <div key={k} className="pro-srcleg-row">
                            <span className="swatch" style={{ background: SOURCE_COLORS[k] }} />
                            <span className="lbl">{sourceLabel(k)}</span>
                            <span className="amt">{money2(v, language)}</span>
                            <span className="pct">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Movimientos / pagos / retenciones */}
                <section className="pro-card pro-card-pad min-w-0">
                  <div className="pro-card-head flex-wrap">
                    <div className="pro-seg">
                      <button type="button" className={tab === 'movements' ? 'is-active' : ''} aria-pressed={tab === 'movements'} onClick={() => setTab('movements')}>{t('pro.earnings.movements')}</button>
                      <button type="button" className={tab === 'payouts' ? 'is-active' : ''} aria-pressed={tab === 'payouts'} onClick={() => setTab('payouts')}>{t('pro.earnings.payouts')}</button>
                      {holds.length > 0 && (
                        <button type="button" className={tab === 'holds' ? 'is-active' : ''} aria-pressed={tab === 'holds'} onClick={() => setTab('holds')}>{t('pro.earnings.holds')}</button>
                      )}
                    </div>
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={handleExportCSV}>
                      <Download /> CSV
                    </button>
                  </div>

                  {tab === 'movements' && (
                    filteredTx.length === 0 ? (
                      <p className="pro-muted text-sm py-8 text-center">{t('pro.earnings.noMovements')}</p>
                    ) : (
                      <>
                        <div className="pro-tablewrap">
                          <table className="pro-table">
                            <thead>
                              <tr>
                                <th>{t('pro.earnings.thDate')}</th>
                                <th>{t('pro.earnings.thClient')}</th>
                                <th>{t('pro.earnings.thConcept')}</th>
                                <th>{t('pro.earnings.thSource')}</th>
                                <th className="text-right">{t('pro.earnings.thGross')}</th>
                                <th className="text-right">{fill(t('pro.earnings.thCommission'), { p: commissionRate })}</th>
                                <th className="text-right">{t('pro.earnings.thNet')}</th>
                                <th>{t('pro.earnings.thStatus')}</th>
                                <th>{t('pro.earnings.thInvoice')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map(tx => {
                                const k = sourceOf((tx.metadata as any)?.source);
                                const gross = grossOf(tx);
                                return (
                                  <tr key={tx.id}>
                                    <td>{fmtDate(new Date(tx.created_at), language)}</td>
                                    <td className="strong">{clientOf(tx)}</td>
                                    <td>{tx.description}</td>
                                    <td>
                                      <span className="pro-mini" style={{ color: SOURCE_COLORS[k] }}>{sourceLabel(k)}</span>
                                    </td>
                                    <td className="num">{money2(gross, language)}</td>
                                    <td className="num">{money2(commissionOf(tx), language)}</td>
                                    <td className="num strong">{money2(netOf(tx), language)}</td>
                                    <td><span className={`pro-pill ${statusClass(tx.status)}`}>{statusLabel(tx.status)}</span></td>
                                    <td>
                                      {/* La factura del periodo que cubre este movimiento
                                          (`doctor_invoices` guarda periodo y número). */}
                                      {(() => {
                                        const inv = invoiceFor(tx.created_at);
                                        if (!inv) return <span className="pro-muted">—</span>;
                                        return inv.file_url
                                          ? <a href={inv.file_url} target="_blank" rel="noreferrer" className="pro-link">{inv.invoice_number}</a>
                                          : <Link to="/doctor/invoices" className="pro-link">{inv.invoice_number}</Link>;
                                      })()}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[11.5px] pro-muted mt-2">
                          {fill(t('pro.earnings.showing'), { a: pageRows.length, b: filteredTx.length })}
                          {sourceTab !== 'total' && ` · ${sourceLabel(sourceTab)}: ${money2(tableTotals.net, language)} ${t('pro.earnings.net').toLowerCase()}`}
                        </p>
                        {/* Descargo: el importe abonado es el neto; bruto y comisión son cálculo */}
                        <div className="pro-note mt-2">
                          <Info />
                          <span>{fill(t('pro.earnings.commissionNote'), { p: commissionRate })}</span>
                        </div>
                        {pages > 1 && (
                          <div className="pro-pager">
                            {/* La ventana SIGUE a la página actual: antes se quedaba
                                fija en 1-5 y a la página 6 no se podía llegar. */}
                            <button type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4 mx-auto" /></button>
                            {(() => {
                              const win = 5;
                              let ini = Math.max(1, page - Math.floor(win / 2));
                              const fin = Math.min(pages, ini + win - 1);
                              ini = Math.max(1, fin - win + 1);
                              const nums = Array.from({ length: fin - ini + 1 }, (_, i) => ini + i);
                              return (
                                <>
                                  {ini > 1 && <><button type="button" onClick={() => setPage(1)}>1</button>{ini > 2 && <span className="pro-muted px-1">…</span>}</>}
                                  {nums.map(n => (
                                    <button key={n} type="button" className={page === n ? 'is-active' : ''} onClick={() => setPage(n)}>{n}</button>
                                  ))}
                                  {fin < pages && <>{fin < pages - 1 && <span className="pro-muted px-1">…</span>}<button type="button" onClick={() => setPage(pages)}>{pages}</button></>}
                                </>
                              );
                            })()}
                            <button type="button" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><ChevronRight className="w-4 h-4 mx-auto" /></button>
                          </div>
                        )}
                      </>
                    )
                  )}

                  {tab === 'payouts' && (
                    payouts.length === 0 ? (
                      <p className="pro-muted text-sm py-8 text-center">{t('pro.earnings.nextPayoutNone')}</p>
                    ) : (
                      <div>
                        {payouts.map(p => (
                          <div key={p.id} className="pro-row">
                            <span className="pro-icon-box" style={{ width: 34, height: 34 }}><Banknote /></span>
                            <span className="min-w-0 flex-1">
                              <span className="pro-row-name block">{money2(Number(p.amount), language)}</span>
                              <span className="pro-row-sub block">
                                {fmtDate(new Date(p.created_at), language)}
                                {' · '}{p.stripe_transfer_id?.startsWith('manual_') ? t('pro.earnings.methodManual') : p.stripe_transfer_id ? 'Stripe' : t('pro.earnings.methodManual')}
                              </span>
                              {p.error_message && <span className="pro-row-sub block" style={{ color: 'var(--pro-live)' }}>{p.error_message}</span>}
                            </span>
                            <span className={`pro-pill ${p.status === 'paid' ? 'pro-pill-ok' : p.status === 'failed' ? 'pro-pill-live' : 'pro-pill-warn'}`}>
                              {p.status === 'paid' ? t('pro.earnings.statusPaid')
                                : p.status === 'failed' ? t('pro.earnings.statusFailed')
                                : p.status === 'processing' ? t('pro.earnings.statusProcessing')
                                : t('pro.earnings.statusPendingPayout')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {tab === 'holds' && (
                    <div>
                      {holds.map(h => (
                        <div key={h.id} className="pro-row">
                          <span className="pro-icon-box" style={{ width: 34, height: 34 }}><Lock /></span>
                          <span className="min-w-0 flex-1">
                            <span className="pro-row-name block">{money2(Number(h.amount), language)}</span>
                            <span className="pro-row-sub block">
                              {h.release_at ? fill(t('pro.earnings.holdUntil'), { d: fmtDate(new Date(h.release_at), language) }) : t('pro.earnings.holdNoDate')}
                              {h.reason ? ` · ${h.reason}` : ''}
                            </span>
                          </span>
                          <span className={`pro-pill ${h.status === 'held' ? 'pro-pill-warn' : 'pro-pill-ok'}`}>
                            {h.status === 'held' ? t('pro.earnings.statusHeld') : t('pro.earnings.statusPaid')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ------------------------------------------- columna derecha */}
              <aside className="space-y-4 min-w-0">
                <section className="pro-card pro-card-pad">
                  <div className="pro-card-head">
                    <h2 className="pro-card-title"><Building2 /> {t('pro.earnings.account')}</h2>
                    <Link to="/doctor/bank-account" className="pro-link">{bank ? t('pro.earnings.editAccount') : t('pro.earnings.addAccount')}</Link>
                  </div>
                  {bank ? (
                    <div className="pro-bank">
                      <span className="pro-icon-box"><Building2 /></span>
                      <span className="min-w-0 flex-1">
                        <span className="pro-row-name block truncate">{bank.bank_name || bank.payment_method || '—'}</span>
                        <span className="pro-row-sub block truncate">
                          {bank.clabe_last4 ? `${t('pro.earnings.accountOf')} **** ${bank.clabe_last4}` : ''}
                        </span>
                        {bank.account_holder_name && <span className="pro-row-sub block truncate">{bank.account_holder_name}</span>}
                      </span>
                      <span className={`pro-pill ${bank.is_verified ? 'pro-pill-ok' : 'pro-pill-warn'}`}>
                        {bank.is_verified ? t('pro.earnings.verified') : t('pro.earnings.unverified')}
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className="pro-muted text-[12.5px]">{t('pro.earnings.noAccount')}</p>
                      <Link to="/doctor/bank-account" className="pro-btn pro-btn-teal pro-btn-sm w-full mt-2"><Building2 /> {t('pro.earnings.addAccount')}</Link>
                    </>
                  )}
                </section>

                <section className="pro-card pro-card-pad">
                  <h2 className="pro-card-title mb-2"><CalendarDays /> {t('pro.earnings.nextPayout')}</h2>
                  <div className="pro-kpi-value">{money2(pendingEarnings, language)}</div>
                  <p className="pro-kpi-sub">
                    {/* Sin importe no hay pago: anunciar una fecha sería contradecirse. */}
                    {pendingEarnings <= 0
                      ? t('pro.earnings.nextPayoutNone')
                      : nextRelease
                        ? fill(t('pro.earnings.nextPayoutOn'), { d: fmtDate(new Date(nextRelease), language) })
                        : payoutFrequency || t('pro.earnings.nextPayoutNone')}
                  </p>
                  {activeHolds.length > 0 && pendingEarnings > 0 && (
                    <div className="pro-note mt-2">
                      <Info /><span>{fill(t('pro.earnings.nextPayoutNote'), { n: activeHolds.length })}</span>
                    </div>
                  )}
                  {/* El histórico ya cobrado: el panel anterior lo enseñaba y se
                      había perdido (`total_earnings` se pedía y se tiraba). */}
                  <div className="pro-ctx-line mt-2" style={{ borderTop: '1px solid var(--pro-line)', paddingTop: 8 }}>
                    <span className="k">{t('pro.earnings.alreadyPaid')}</span>
                    <span className="v">{money2(totalPaid, language)}</span>
                  </div>
                </section>

                <section className="pro-card pro-card-pad">
                  <h2 className="pro-card-title mb-2"><Receipt /> {fill(t('pro.earnings.breakdown'), { r: rangeLabel(range) })}</h2>
                  <div className="pro-ctx-line"><span className="k">{t('pro.earnings.gross')}</span><span className="v">{money2(totals.gross, language)}</span></div>
                  <div className="pro-ctx-line"><span className="k">{fill(t('pro.earnings.commission'), { p: commissionRate })}</span><span className="v">− {money2(totals.commission, language)}</span></div>
                  <div className="pro-ctx-line" style={{ borderTop: '1px solid var(--pro-line)', marginTop: 6, paddingTop: 8 }}>
                    <span className="k" style={{ fontWeight: 700 }}>{t('pro.earnings.net')}</span>
                    <span className="v" style={{ fontSize: 15 }}>{money2(totals.net, language)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Link to="/doctor/invoices" className="pro-btn pro-btn-outline pro-btn-sm">
                      <FileText /> {t('pro.earnings.invoices')}{invoicesCount > 0 ? ` (${invoicesCount})` : ''}
                    </Link>
                    <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleExportCSV}>
                      <Download /> {t('pro.earnings.downloadReport')}
                    </button>
                  </div>
                  <p className="text-[11.5px] pro-muted mt-2">{fill(t('pro.earnings.commissionNote'), { p: commissionRate })}</p>
                  <p className="text-[11.5px] pro-muted mt-1">{t('pro.earnings.withdrawInfo')}</p>
                  <Link to="/wallet" className="pro-link mt-1"><ArrowRight /> {t('nav.wallet') || 'Wallet'}</Link>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
