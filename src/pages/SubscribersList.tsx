import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import MainLayout from '@/components/layout/MainLayout';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Users, Search, Crown, Star, BarChart3, CalendarDays, XCircle, Check, MoreVertical,
  MessageSquare, ExternalLink, Heart, Loader2, Info, ChevronRight, Bell, Clock,
  CircleUser, CreditCard, Filter,
} from 'lucide-react';
import { initialsOf, norm, fmtDate, money } from '@/lib/proFormat';

// ---------------------------------------------------------------------------
// Suscripciones — maqueta del cliente (10-sep-2026), diseño PRO.
// Solo diseño: TODO lo que se pinta sale de datos que ya existen.
//   · `subscriptions` (RPC get_my_subscribers) → suscriptores, tier, importe,
//     alta, renovación y estado.
//   · `site_settings.subscription_pricing` (useSubscriptionPricing) → el precio
//     de cada plan, que lo fija la plataforma, no el médico.
// Lo que la maqueta enseña y la base NO guarda queda fuera a propósito:
// «Crear suscripción» (los planes son de la plataforma, el médico no los crea),
// sexo/edad e «ID: MM-…» del suscriptor, y el «Uso este mes» por suscripción.
// En su lugar el detalle enseña los avisos que esa suscripción sí tiene
// guardados (notify_on_* y early_access_minutes, columnas reales).
// ---------------------------------------------------------------------------

type Tier = 'free' | 'basic' | 'premium';
type Tab = 'plans' | 'subscribers' | 'renewals' | 'cancellations';

interface Subscriber {
  subscriber_id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  tier: Tier;
  price_paid: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface SubPrefs {
  notify_on_live: boolean;
  notify_on_content: boolean;
  notify_on_availability: boolean;
  early_access_minutes: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

export default function SubscribersList() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { pricing } = useSubscriptionPricing();
  const { toggles } = useSiteToggles();

  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [prefs, setPrefs] = useState<Record<string, SubPrefs>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('plans');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | Tier>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  const chatEnabled = !!toggles.enable_patient_chat;

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      // La lista (con nombre y correo) viene del RPC; las preferencias de aviso
      // se leen de la propia tabla — la política «Users can view own
      // subscriptions» deja al creador ver sus filas.
      const [listRes, prefsRes] = await Promise.all([
        supabase.rpc('get_my_subscribers' as any),
        supabase
          .from('subscriptions')
          .select('subscriber_id, notify_on_live, notify_on_content, notify_on_availability, early_access_minutes')
          .eq('creator_id', user.id),
      ]);
      if (!alive) return;
      if (listRes.error) console.error('[Subscriptions] subscribers', listRes.error);
      setSubs((listRes.data || []) as Subscriber[]);
      const map: Record<string, SubPrefs> = {};
      for (const r of (prefsRes.data || []) as any[]) {
        map[r.subscriber_id] = {
          notify_on_live: !!r.notify_on_live,
          notify_on_content: !!r.notify_on_content,
          notify_on_availability: !!r.notify_on_availability,
          early_access_minutes: r.early_access_minutes ?? null,
        };
      }
      setPrefs(map);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // ------------------------------------------------------------- etiquetas
  const tierName = (tier: Tier) =>
    tier === 'premium' ? t('subscriptions.premiumTierName')
      : tier === 'basic' ? t('subscriptions.basicTierName')
        : t('pro.subs.tierFree');

  const tierDesc = (tier: Tier) =>
    tier === 'premium' ? t('subscriptions.premiumTierDescription')
      : tier === 'basic' ? t('subscriptions.basicTierDescription')
        : t('pro.subs.freeDescription');

  const tierBenefits = (tier: Tier): string[] =>
    tier === 'premium'
      ? [
        t('subscriptions.allBasicFeatures'),
        t('subscriptions.recordingDiscount'),
        t('subscriptions.priorityChat'),
        t('subscriptions.earlyAccess'),
      ]
      : tier === 'basic'
        ? [
          t('subscriptions.exclusiveContent'),
          t('subscriptions.priorityNotifications'),
          t('subscriptions.subscriberBadge'),
        ]
        : [
          t('subscriptions.notifyLive'),
          t('subscriptions.notifyContent'),
          t('subscriptions.notifyAvailability'),
        ];

  const tierPrice = (tier: Tier) =>
    tier === 'premium' ? pricing.premium_cents / 100
      : tier === 'basic' ? pricing.basic_cents / 100
        : 0;

  const TierIcon = (tier: Tier) => (tier === 'premium' ? Crown : tier === 'basic' ? Star : Heart);

  // ---------------------------------------------------------------- cifras
  const stats = useMemo(() => {
    const now = Date.now();
    const active = subs.filter(s => s.is_active);
    const paidActive = active.filter(s => s.tier !== 'free');
    const monthly = paidActive.reduce((sum, s) => sum + Number(s.price_paid || 0), 0);
    const renewals = active.filter(s => {
      if (!s.expires_at) return false;
      const ts = new Date(s.expires_at).getTime();
      return ts >= now && ts <= now + 30 * DAY;
    });
    const cancelled = subs.filter(s => !s.is_active);
    return {
      activeCount: active.length,
      paidActiveCount: paidActive.length,
      monthly,
      renewals: renewals.sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime()),
      cancelled,
      byTier: {
        free: active.filter(s => s.tier === 'free').length,
        basic: active.filter(s => s.tier === 'basic').length,
        premium: active.filter(s => s.tier === 'premium').length,
      } as Record<Tier, number>,
    };
  }, [subs]);

  // La lista que se pinta y la que se puede seleccionar son la MISMA.
  const visible = useMemo(() => {
    const base =
      tab === 'renewals' ? stats.renewals
        : tab === 'cancellations' ? stats.cancelled
          : subs;
    const q = norm(query.trim());
    return base.filter(s => {
      if (tab === 'subscribers') {
        if (planFilter !== 'all' && s.tier !== planFilter) return false;
        if (stateFilter === 'active' && !s.is_active) return false;
        if (stateFilter === 'cancelled' && s.is_active) return false;
      }
      if (!q) return true;
      return norm(s.name).includes(q) || norm(s.email).includes(q) || norm(tierName(s.tier)).includes(q);
    });
  }, [tab, subs, stats.renewals, stats.cancelled, query, planFilter, stateFilter, language]);

  const selected = useMemo(
    () => visible.find(s => s.subscriber_id === selectedId) || null,
    [visible, selectedId]
  );

  const openDetail = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1099px)').matches) setDetailOpen(true);
  };

  const openChatWith = async (s: Subscriber) => {
    if (!user?.id) return;
    setOpeningChat(s.subscriber_id);
    try {
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${s.subscriber_id}),and(participant1_id.eq.${s.subscriber_id},participant2_id.eq.${user.id})`)
        .eq('status', 'active')
        .maybeSingle();
      let sessionId = existing?.id;
      if (!sessionId) {
        const { data: created, error } = await supabase
          .from('chat_sessions')
          .insert({
            participant1_id: user.id,
            participant1_type: role === 'resident' ? 'resident' : 'doctor',
            participant2_id: s.subscriber_id,
            participant2_type: 'patient',
            status: 'active',
            is_double_check: false,
          })
          .select('id')
          .single();
        if (error) throw error;
        sessionId = created.id;
      }
      navigate(`/chat?session=${sessionId}`);
    } catch (e) {
      console.error('[Subscriptions] chat', e);
      toast.error(t('pro.subs.chatError'));
    } finally {
      setOpeningChat(null);
    }
  };

  // ------------------------------------------------------------ fragmentos
  const statePill = (s: Subscriber) =>
    s.is_active
      ? <span className="pro-pill pro-pill-ok">{t('pro.subs.stateActive')}</span>
      : <span className="pro-pill pro-pill-muted">{t('pro.subs.stateCancelled')}</span>;

  const avatarOf = (s: Subscriber) => (
    <span className="pro-initials w-9 h-9 text-[12px]">
      {s.avatar_url ? <img src={s.avatar_url} alt="" loading="lazy" /> : initialsOf(s.name)}
    </span>
  );

  const planCard = (tier: Tier) => {
    const Icon = TierIcon(tier);
    const price = tierPrice(tier);
    const count = stats.byTier[tier];
    return (
      <div key={tier} className="pro-plan">
        <div className="pro-plan-id">
          <span className="pro-icon-box"><Icon /></span>
          <span className="min-w-0">
            <b>{tierName(tier)}</b>
            <span>{tierDesc(tier)}</span>
          </span>
        </div>
        <div className="pro-plan-price">
          <b>{tier === 'free' ? t('subscriptions.free') : money(price, language)}</b>
          <span>{tier === 'free' ? t('pro.subs.freeBilling') : t('pro.subs.monthlyBilling')}</span>
        </div>
        <ul className="pro-plan-feats">
          {tierBenefits(tier).map(b => (
            <li key={b}><Check /> <span>{b}</span></li>
          ))}
        </ul>
        <div className="pro-plan-side">
          <b>{count}</b>
          <span>{count === 1 ? t('pro.subs.subscriberOne') : t('pro.subs.subscriberMany')}</span>
          <button
            type="button"
            className="pro-btn pro-btn-outline pro-btn-xs mt-2"
            onClick={() => { setTab('subscribers'); setPlanFilter(tier); setStateFilter('active'); }}
          >
            {t('pro.subs.seeSubscribers')} <ChevronRight />
          </button>
        </div>
      </div>
    );
  };

  const rowsTable = (list: Subscriber[], showRenewal: boolean) => (
    <div className="pro-tablewrap">
      <table className="pro-table">
        <thead>
          <tr>
            <th>{t('pro.subs.colPerson')}</th>
            <th>{t('pro.subs.colPlan')}</th>
            <th>{t('pro.subs.colSince')}</th>
            <th>{showRenewal ? t('pro.subs.colRenewal') : t('pro.subs.colEnds')}</th>
            <th>{t('pro.subs.colState')}</th>
            <th className="num">{t('pro.subs.colAmount')}</th>
            <th aria-label={t('pro.subs.colActions')} />
          </tr>
        </thead>
        <tbody>
          {list.map(s => (
            <tr
              key={s.subscriber_id}
              className={selectedId === s.subscriber_id ? 'is-active' : ''}
              onClick={() => openDetail(s.subscriber_id)}
            >
              <td className="strong">
                <span className="flex items-center gap-2 min-w-0">
                  {avatarOf(s)}
                  <span className="min-w-0">
                    <span className="block truncate">{s.name || t('pro.subs.noName')}</span>
                    {s.email && <span className="block pro-muted text-[11px] truncate">{s.email}</span>}
                  </span>
                </span>
              </td>
              <td>{tierName(s.tier)}</td>
              <td>{fmtDate(new Date(s.created_at), language)}</td>
              <td>{s.expires_at ? fmtDate(new Date(s.expires_at), language) : '—'}</td>
              <td>{statePill(s)}</td>
              <td className="num strong">{s.tier === 'free' ? '—' : money(Number(s.price_paid || 0), language)}</td>
              <td className="num" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="pro-kebab" aria-label={t('pro.subs.colActions')}>
                    <MoreVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetail(s.subscriber_id)}>
                      <CircleUser className="w-4 h-4 mr-2" />{t('pro.subs.seeDetail')}
                    </DropdownMenuItem>
                    {chatEnabled && (
                      <DropdownMenuItem onClick={() => openChatWith(s)}>
                        <MessageSquare className="w-4 h-4 mr-2" />{t('pro.subs.sendMessage')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const detailBody = (s: Subscriber) => {
    const p = prefs[s.subscriber_id];
    const notices = p
      ? [
        { on: p.notify_on_live, label: t('subscriptions.notifyLive') },
        { on: p.notify_on_content, label: t('subscriptions.notifyContent') },
        { on: p.notify_on_availability, label: t('subscriptions.notifyAvailability') },
      ]
      : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="pro-initials w-14 h-14 text-[16px]">
            {s.avatar_url ? <img src={s.avatar_url} alt="" /> : initialsOf(s.name)}
          </span>
          <div className="min-w-0">
            <p className="pro-row-name truncate">{s.name || t('pro.subs.noName')}</p>
            {s.email && <p className="pro-row-sub truncate">{s.email}</p>}
          </div>
        </div>

        <div>
          <div className="pro-ctx-line"><span className="k">{t('pro.subs.colPlan')}</span><span className="v">{tierName(s.tier)}</span></div>
          <div className="pro-ctx-line">
            <span className="k">{t('pro.subs.monthlyPrice')}</span>
            <span className="v">{s.tier === 'free' ? t('subscriptions.free') : money(Number(s.price_paid || 0), language)}</span>
          </div>
          <div className="pro-ctx-line"><span className="k">{t('pro.subs.colSince')}</span><span className="v">{fmtDate(new Date(s.created_at), language)}</span></div>
          <div className="pro-ctx-line">
            <span className="k">{t('pro.subs.colRenewal')}</span>
            <span className="v">{s.expires_at ? fmtDate(new Date(s.expires_at), language) : '—'}</span>
          </div>
          <div className="pro-ctx-line"><span className="k">{t('pro.subs.colState')}</span><span className="v">{statePill(s)}</span></div>
        </div>

        <div className="pro-ctx-block">
          <div className="pro-ctx-h"><Check />{t('pro.subs.benefits')}</div>
          <ul className="space-y-1.5">
            {tierBenefits(s.tier).map(b => (
              <li key={b} className="pro-check is-done"><Check /> <span>{b}</span></li>
            ))}
          </ul>
        </div>

        {p && (
          <div className="pro-ctx-block">
            <div className="pro-ctx-h"><Bell />{t('pro.subs.notices')}</div>
            <ul className="space-y-1.5">
              {notices.map(n => (
                <li key={n.label} className={n.on ? 'pro-check is-done' : 'pro-check is-todo'}>
                  <Check /> <span>{n.label}</span>
                </li>
              ))}
            </ul>
            {!!p.early_access_minutes && (
              <p className="pro-row-sub mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t('pro.subs.earlyAccess').replace('{n}', String(p.early_access_minutes))}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {chatEnabled && (
            <button
              type="button"
              className="pro-btn pro-btn-outline flex-1"
              disabled={openingChat === s.subscriber_id}
              onClick={() => openChatWith(s)}
            >
              {openingChat === s.subscriber_id ? <Loader2 className="animate-spin" /> : <MessageSquare />}
              {t('pro.subs.sendMessage')}
            </button>
          )}
          <Link to={`/doctor/${user?.id}`} className="pro-btn pro-btn-teal flex-1">
            <ExternalLink /> {t('pro.subs.publicProfile')}
          </Link>
        </div>
      </div>
    );
  };

  const emptyBlock = (msg: string) => (
    <div className="text-center py-10">
      <span className="pro-icon-box mx-auto mb-3"><Users /></span>
      <p className="pro-row-name">{msg}</p>
      <p className="pro-row-sub mt-1">{t('pro.subs.emptyHint')}</p>
    </div>
  );

  // 🚨 El guard de rol va DESPUÉS de todos los hooks (si no, React cambia el
  // número de hooks entre renders y revienta).
  if (role && role !== 'doctor' && role !== 'resident') return <Navigate to="/" replace />;

  const kpis = [
    { key: 'subscribers' as Tab, Icon: Users, label: t('pro.subs.kpiActive'), value: String(stats.activeCount), sub: t('pro.subs.kpiActiveSub').replace('{n}', String(stats.paidActiveCount)) },
    { key: 'plans' as Tab, Icon: BarChart3, label: t('pro.subs.kpiMonthly'), value: money(stats.monthly, language), sub: t('pro.subs.kpiMonthlySub') },
    { key: 'renewals' as Tab, Icon: CalendarDays, label: t('pro.subs.kpiRenewals'), value: String(stats.renewals.length), sub: t('pro.subs.kpiRenewalsSub') },
    { key: 'cancellations' as Tab, Icon: XCircle, label: t('pro.subs.kpiCancelled'), value: String(stats.cancelled.length), sub: t('pro.subs.kpiCancelledSub') },
  ];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'plans', label: t('pro.subs.tabPlans') },
    { key: 'subscribers', label: t('pro.subs.tabSubscribers'), count: subs.length },
    { key: 'renewals', label: t('pro.subs.tabRenewals'), count: stats.renewals.length },
    { key: 'cancellations', label: t('pro.subs.tabCancellations'), count: stats.cancelled.length },
  ];

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><Users className="w-7 h-7" /> <span className="truncate">{t('pro.subs.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.subs.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link to="/doctor/earnings" className="pro-btn pro-btn-ghost flex-1 sm:flex-none">
              <CreditCard /> {t('pro.subs.goEarnings')}
            </Link>
            <Link to={`/doctor/${user?.id}`} className="pro-btn pro-btn-white flex-1 sm:flex-none">
              <ExternalLink /> {t('pro.subs.publicProfile')}
            </Link>
          </div>
        </div>

        {/* KPIs — cada una abre su pestaña */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map(k => (
            <button key={k.label} type="button" className="pro-card pro-kpi" onClick={() => setTab(k.key)}>
              <span className="pro-icon-box"><k.Icon /></span>
              <span className="min-w-0">
                <span className="pro-kpi-label block">{k.label}</span>
                <span className="pro-kpi-value block">{k.value}</span>
                <span className="pro-kpi-sub block">{k.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="pro-work pro-work-2">
          <section className="pro-card pro-card-pad min-w-0">
            <div className="pro-seg mb-3">
              {tabs.map(tt => (
                <button
                  key={tt.key}
                  type="button"
                  className={tab === tt.key ? 'is-active' : ''}
                  aria-pressed={tab === tt.key}
                  onClick={() => { setTab(tt.key); setQuery(''); }}
                >
                  {tt.label}{typeof tt.count === 'number' && tt.count > 0 && <span className="ml-1 opacity-70">{tt.count}</span>}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-10 text-center pro-muted text-sm">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />{t('pro.subs.loading')}
              </div>
            ) : tab === 'plans' ? (
              <>
                <div className="pro-card-head">
                  <h2 className="pro-card-title"><Crown /> {t('pro.subs.myPlans')}</h2>
                </div>
                <div className="space-y-3">
                  {(['basic', 'premium', 'free'] as Tier[]).map(planCard)}
                </div>
                <div className="pro-note mt-3">
                  <Info />
                  <span>{t('pro.subs.pricingNote')}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col lg:flex-row gap-2 mb-3">
                  <label className="pro-search flex-1">
                    <Search />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={t('pro.subs.searchPlaceholder')}
                      aria-label={t('pro.subs.searchPlaceholder')}
                    />
                  </label>
                  {tab === 'subscribers' && (
                    <div className="flex gap-2 flex-wrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="pro-btn pro-btn-outline pro-btn-sm">
                          <Filter /> {planFilter === 'all' ? t('pro.subs.filterPlan') : tierName(planFilter)}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPlanFilter('all')}>{t('pro.subs.filterAll')}</DropdownMenuItem>
                          {(['basic', 'premium', 'free'] as Tier[]).map(x => (
                            <DropdownMenuItem key={x} onClick={() => setPlanFilter(x)}>{tierName(x)}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="pro-btn pro-btn-outline pro-btn-sm">
                          <Filter /> {stateFilter === 'all' ? t('pro.subs.filterState') : stateFilter === 'active' ? t('pro.subs.stateActive') : t('pro.subs.stateCancelled')}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setStateFilter('all')}>{t('pro.subs.filterAll')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStateFilter('active')}>{t('pro.subs.stateActive')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStateFilter('cancelled')}>{t('pro.subs.stateCancelled')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {(planFilter !== 'all' || stateFilter !== 'all') && (
                        <button
                          type="button"
                          className="pro-btn pro-btn-outline pro-btn-sm"
                          onClick={() => { setPlanFilter('all'); setStateFilter('all'); }}
                        >
                          {t('pro.subs.clearFilters')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {visible.length === 0
                  ? emptyBlock(
                    query ? t('pro.subs.noMatch')
                      : tab === 'renewals' ? t('pro.subs.emptyRenewals')
                        : tab === 'cancellations' ? t('pro.subs.emptyCancellations')
                          : t('pro.subs.emptySubscribers')
                  )
                  : rowsTable(visible, tab !== 'cancellations')}

                <p className="pro-row-sub mt-3">
                  {t('pro.subs.showing').replace('{n}', String(visible.length)).replace('{total}', String(subs.length))}
                </p>
              </>
            )}
          </section>

          {/* ------------------------------------------- detalle (escritorio) */}
          <aside className="pro-card pro-card-pad min-w-0 hidden lg:block self-start">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><CircleUser /> {t('pro.subs.detailTitle')}</h2>
            </div>
            {selected ? detailBody(selected) : (
              <div className="text-center py-10">
                <span className="pro-icon-box mx-auto mb-3"><CircleUser /></span>
                <p className="pro-row-name">{t('pro.subs.pick')}</p>
                <p className="pro-row-sub mt-1">{t('pro.subs.pickHint')}</p>
              </div>
            )}
          </aside>
        </div>

        {/* ------------------------------------------------ detalle (móvil) */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('pro.subs.detailTitle')}</SheetTitle>
            </SheetHeader>
            <div className="mt-3">{selected && detailBody(selected)}</div>
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
