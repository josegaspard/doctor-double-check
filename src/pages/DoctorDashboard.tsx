import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, differenceInMinutes, eachDayOfInterval } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChat } from '@/contexts/ChatContext';
import { useVault } from '@/contexts/VaultContext';
import { useDoctorPatients } from '@/hooks/useDoctorPatients';
import { useDoctorAgenda, AgendaEvent } from '@/hooks/useDoctorAgenda';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Radio,
  Plus,
  Video,
  Calendar,
  MessageSquare,
  Users,
  BarChart3,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  MoreVertical,
  FileText,
  CheckSquare,
  Eye,
  EyeOff,
  BookOpen,
  Settings,
  Folder,
} from 'lucide-react';
import { fill, initialsOf, fmtTime, dayLabel, money, isSameDay, whenLabel } from '@/lib/proFormat';
import { EmailHistoryCard } from '@/components/doctor/EmailHistoryCard';
import { SignatureUpload } from '@/components/doctor/SignatureUpload';
import { EmailStatsCard } from '@/components/doctor/EmailStatsCard';
import { EmailTrendsChart } from '@/components/doctor/EmailTrendsChart';
import { EarningsCard } from '@/components/doctor/EarningsCard';
import { DoctorAnalytics } from '@/components/doctor/DoctorAnalytics';
import { FundHoldsCard } from '@/components/doctor/FundHoldsCard';
import { DoctorStatsGrid } from '@/components/doctor/DoctorStatsGrid';
import { DoctorStatusAlert } from '@/components/doctor/DoctorStatusAlert';
import { DoctorProfileCard } from '@/components/doctor/DoctorProfileCard';
import { DoctorPatientSearch } from '@/components/doctor/DoctorPatientSearch';
import { DoctorResidentRequests } from '@/components/doctor/DoctorResidentRequests';
import { MyNotesWidget } from '@/components/doctor/MyNotesWidget';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

const SHOW_INCOME_KEY = 'mm.pro.showIncome';

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  chevron,
  onClick,
  aside,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  aside?: React.ReactNode;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="pro-card pro-kpi bg-card">
      <span className="pro-icon-box"><Icon /></span>
      <div className="min-w-0 flex-1">
        <div className="pro-kpi-label truncate">{label}</div>
        <div className="pro-kpi-value truncate">{value}</div>
        {sub && <div className="pro-kpi-sub truncate">{sub}</div>}
      </div>
      {aside}
      {chevron && <ChevronRight className="pro-kpi-chev w-5 h-5" />}
    </Tag>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { getSessionsByUser } = useChat();
  const { getAccessibleFiles } = useVault();
  const { patients } = useDoctorPatients();
  const [now] = useState(() => new Date());
  const rangeStart = useMemo(() => startOfDay(now), [now]);
  const rangeEnd = useMemo(() => endOfDay(addDays(now, 60)), [now]);
  const { events, loading: agendaLoading } = useDoctorAgenda(rangeStart, rangeEnd);
  const [monthEarnings, setMonthEarnings] = useState<{ total: number; series: { d: number; v: number | null }[] } | null>(null);
  const [showAmount, setShowAmount] = useState<boolean>(() => {
    try { return localStorage.getItem(SHOW_INCOME_KEY) !== '0'; } catch { return true; }
  });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const [txRes, recRes] = await Promise.all([
          supabase
            .from('wallet_transactions')
            .select('amount, created_at')
            .eq('user_id', user.id)
            .eq('type', 'earning')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
            .order('created_at', { ascending: true }),
          supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('doctor_id', user.id),
        ]);
        if (!active) return;
        const byDay = new Map<string, number>();
        (txRes.data || []).forEach((tx: any) => {
          const k = new Date(tx.created_at).toDateString();
          byDay.set(k, (byDay.get(k) || 0) + Number(tx.amount || 0));
        });
        let acc = 0;
        const series = eachDayOfInterval({ start: monthStart, end: monthEnd }).map(d => {
          const isPast = d.getTime() <= now.getTime() || isSameDay(d, now);
          if (isPast) acc += byDay.get(d.toDateString()) || 0;
          return { d: d.getDate(), v: isPast ? acc : null };
        });
        setMonthEarnings({ total: acc, series });
        if (!recRes.error && recRes.count !== null) setRecordingsCount(recRes.count);
      } catch (e) {
        console.error('DoctorDashboard load error:', e);
        if (active) setMonthEarnings({ total: 0, series: [] });
      }
    })();
    return () => { active = false; };
  }, [user?.id, now]);

  const toggleAmount = () => {
    setShowAmount(v => {
      try { localStorage.setItem(SHOW_INCOME_KEY, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  };

  const chatUnread = useMemo(() => {
    const sessions = getSessionsByUser();
    return sessions.reduce((sum, s) => (s.status === 'active' ? sum + (s.unreadCount || 0) : sum), 0);
  }, [getSessionsByUser]);

  const vaultFiles = getAccessibleFiles(user?.id || '');

  const todayEvents = useMemo(() => events.filter(e => isSameDay(e.start, now)), [events, now]);
  const nextAppt = useMemo(
    () => events.find(e => e.kind === 'appointment' && (e.status === 'confirmed' || e.status === 'requested') && e.end.getTime() >= now.getTime()),
    [events, now],
  );
  const requestedCount = useMemo(
    () => events.filter(e => e.kind === 'appointment' && e.status === 'requested' && e.start.getTime() >= now.getTime()).length,
    [events, now],
  );
  const nextLive = useMemo(() => events.find(e => e.kind === 'live' && e.end.getTime() >= now.getTime()), [events, now]);
  const recentPatients = patients.slice(0, 3);
  const consultCountByPatient = useMemo(() => {
    const m = new Map<string, number>();
    patients.forEach(p => m.set(p.id, p.consultationsCount));
    return m;
  }, [patients]);

  if (role !== 'doctor') {
    return <Navigate to="/lives" replace />;
  }

  const doctorProfile = user?.doctorProfile;
  const isApproved = doctorProfile?.status === 'approved';
  const isPending = doctorProfile?.status === 'pending';

  const typeLabel = (e: AgendaEvent) => {
    if (e.kind === 'appointment') {
      const n = e.patientId ? consultCountByPatient.get(e.patientId) || 0 : 0;
      return n > 0 ? t('pro.dashboard.followUp') : t('pro.dashboard.firstVisit');
    }
    if (e.kind === 'live') return t('pro.dashboard.live');
    if (e.kind === 'consultation') return t('pro.dashboard.consultation');
    if (e.kind === 'blocked') return t('pro.dashboard.blocked');
    return t('pro.dashboard.available');
  };

  const statusPill = (e: AgendaEvent) => {
    if (e.kind === 'appointment') {
      if (e.status === 'confirmed') return <span className="pro-pill pro-pill-ok">{t('pro.dashboard.confirmed')}</span>;
      if (e.status === 'requested') return <span className="pro-pill pro-pill-warn">{t('pro.dashboard.pendingStatus')}</span>;
      if (e.status === 'cancelled') return <span className="pro-pill pro-pill-muted">{t('pro.dashboard.cancelled')}</span>;
      return <span className="pro-pill pro-pill-muted">{t('pro.dashboard.completed')}</span>;
    }
    if (e.kind === 'live') return <span className="pro-pill pro-pill-live">{t('pro.dashboard.live')}</span>;
    if (e.kind === 'blocked') return <span className="pro-pill pro-pill-muted">{t('pro.dashboard.blocked')}</span>;
    return <span className="pro-pill pro-pill-info">{t('pro.dashboard.available')}</span>;
  };

  const canStart = (e: AgendaEvent) =>
    e.kind === 'appointment' && !!e.roomUrl && e.status === 'confirmed' &&
    e.start.getTime() - now.getTime() < 30 * 60_000 && e.end.getTime() > now.getTime();

  const nextValue = nextAppt ? fmtTime(nextAppt.start, language) : '—';
  const nextSub = (() => {
    if (!nextAppt) return t('pro.dashboard.none');
    const mins = differenceInMinutes(nextAppt.start, now);
    if (mins <= 0) return t('pro.common.now');
    if (mins < 60) return fill(t('pro.dashboard.inMinutes'), { n: mins });
    if (isSameDay(nextAppt.start, now)) return fill(t('pro.dashboard.inHours'), { n: Math.round(mins / 60) });
    return dayLabel(nextAppt.start, language, t);
  })();

  const monthName = new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : language, { month: 'short' }).format(now).replace('.', '');
  const lastDay = endOfMonth(now).getDate();
  const ticks = [1, 8, 15, 22, lastDay].filter((v, i, a) => a.indexOf(v) === i);
  const chartData = monthEarnings?.series || [];
  const hasMovements = (monthEarnings?.total || 0) > 0;

  const pendingItems: { icon: React.ElementType; text: React.ReactNode; href: string }[] = [];
  if (requestedCount > 0) {
    pendingItems.push({
      icon: Calendar,
      text: <span dangerouslySetInnerHTML={{ __html: fill(requestedCount === 1 ? t('pro.dashboard.toConfirm') : t('pro.dashboard.toConfirmPlural'), { n: `<b>${requestedCount}</b>` }) }} />,
      href: '/my-appointments',
    });
  }
  if (chatUnread > 0) {
    pendingItems.push({
      icon: MessageSquare,
      text: <span dangerouslySetInnerHTML={{ __html: fill(chatUnread === 1 ? t('pro.dashboard.unread') : t('pro.dashboard.unreadPlural'), { n: `<b>${chatUnread}</b>` }) }} />,
      href: '/chat',
    });
  }
  if (vaultFiles.length > 0) {
    pendingItems.push({
      icon: FileText,
      text: <span dangerouslySetInnerHTML={{ __html: fill(vaultFiles.length === 1 ? t('pro.dashboard.docs') : t('pro.dashboard.docsPlural'), { n: `<b>${vaultFiles.length}</b>` }) }} />,
      href: '/doctor/vault',
    });
  }

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        {/* Cabecera */}
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <span className="pro-live-dot"><Radio className="w-5 h-5" style={{ color: 'var(--pro-live)' }} /></span>
              <span className="truncate">{t('pro.dashboard.title')}</span>
              <DoctorBadgeIcon userId={user?.id} size="md" className="flex-shrink-0" />
            </h1>
            <p className="pro-page-sub">{t('pro.dashboard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none" onClick={() => navigate('/doctor/availability?nueva=consulta')}>
              <Plus /> {t('pro.dashboard.newConsultation')}
            </button>
            <Link to="/doctor/go-live" className="pro-btn pro-btn-ghost flex-1 sm:flex-none">
              <Video /> {t('pro.dashboard.startLive')}
            </Link>
          </div>
        </div>

        {!isApproved && <div className="mb-4"><DoctorStatusAlert isPending={isPending} /></div>}

        {/* KPIs */}
        <div className="grid grid-cols-1 min-[440px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            icon={Calendar}
            label={t('pro.dashboard.nextConsultation')}
            value={nextValue}
            sub={nextSub}
            onClick={() => navigate('/doctor/agenda')}
          />
          <Kpi
            icon={MessageSquare}
            label={t('pro.dashboard.pendingMessages')}
            value={chatUnread}
            chevron
            onClick={() => navigate('/chat')}
          />
          <Kpi
            icon={Users}
            label={t('pro.dashboard.activePatients')}
            value={patients.length}
            chevron
            onClick={() => navigate('/doctor/patients')}
          />
          <Kpi
            icon={BarChart3}
            label={t('pro.dashboard.monthIncome')}
            value={monthEarnings ? (showAmount ? `${money(monthEarnings.total, language)} MXN` : '$ ••••') : '…'}
            chevron
            onClick={() => navigate('/doctor/earnings')}
            aside={
              <span
                role="button"
                tabIndex={0}
                aria-label={showAmount ? t('pro.dashboard.hideAmount') : t('pro.dashboard.showAmount')}
                onClick={(e) => { e.stopPropagation(); toggleAmount(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleAmount(); } }}
                className="pro-kebab self-center"
              >
                {showAmount ? <EyeOff /> : <Eye />}
              </span>
            }
          />
        </div>

        {/* Agenda de hoy + Pacientes recientes */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12 mt-3 sm:mt-4">
          <section className="pro-card pro-card-pad bg-card lg:col-span-7 min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Calendar /> <span className="truncate">{t('pro.dashboard.todayAgenda')}</span></h2>
              <Link to="/doctor/agenda" className="pro-link">{t('pro.dashboard.fullAgenda')} <ArrowRight /></Link>
            </div>
            {agendaLoading && todayEvents.length === 0 ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-[#eef3f6] animate-pulse" />)}
              </div>
            ) : todayEvents.length === 0 ? (
              <p className="pro-muted text-sm py-4">{t('pro.dashboard.emptyToday')}</p>
            ) : (
              <div>
                {todayEvents.map(e => (
                  <div key={e.id} className="pro-row">
                    <div className="pro-row-time">{fmtTime(e.start, language)}</div>
                    <span className="pro-initials w-9 h-9 text-[11px]">
                      {e.patientAvatar ? <img src={e.patientAvatar} alt="" /> : e.kind === 'appointment' ? initialsOf(e.patientName) : e.kind === 'live' ? <Radio className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="pro-row-name truncate">{e.title}</div>
                      <div className="pro-row-sub truncate">{typeLabel(e)}</div>
                      <div className="sm:hidden mt-1">{statusPill(e)}</div>
                    </div>
                    <span className="hidden sm:inline-flex">{statusPill(e)}</span>
                    {e.kind === 'appointment' ? (
                      canStart(e) ? (
                        <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => window.open(e.roomUrl!, '_blank')}>
                          <Video /> <span className="hidden sm:inline">{t('pro.dashboard.start')}</span>
                        </button>
                      ) : (
                        <Link to="/my-appointments" className="pro-btn pro-btn-outline pro-btn-sm">
                          <Video /> <span className="hidden sm:inline">{t('pro.dashboard.view')}</span>
                        </Link>
                      )
                    ) : (
                      <Link to="/doctor/availability" className="pro-btn pro-btn-outline pro-btn-sm">
                        <Calendar /> <span className="hidden sm:inline">{t('pro.dashboard.view')}</span>
                      </Link>
                    )}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="pro-kebab" aria-label={t('nav.more')}><MoreVertical /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {e.kind === 'appointment' && (
                          <DropdownMenuItem onClick={() => navigate('/my-appointments')}><Video className="w-4 h-4 mr-2" />{t('pro.dashboard.openInConsultations')}</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => navigate('/doctor/agenda')}><Calendar className="w-4 h-4 mr-2" />{t('pro.dashboard.openInAgenda')}</DropdownMenuItem>
                        {e.kind === 'appointment' && (
                          <DropdownMenuItem onClick={() => navigate('/chat')}><MessageSquare className="w-4 h-4 mr-2" />{t('pro.dashboard.openChat')}</DropdownMenuItem>
                        )}
                        {e.kind !== 'appointment' && (
                          <DropdownMenuItem onClick={() => navigate('/doctor/availability')}><Settings className="w-4 h-4 mr-2" />{t('pro.dashboard.manage')}</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="pro-card pro-card-pad bg-card lg:col-span-5 min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Users /> <span className="truncate">{t('pro.dashboard.recentPatients')}</span></h2>
              <Link to="/doctor/patients" className="pro-link">{t('pro.common.viewAll')} <ArrowRight /></Link>
            </div>
            {recentPatients.length === 0 ? (
              <p className="pro-muted text-sm py-4">{t('pro.dashboard.noPatients')}</p>
            ) : (
              <div>
                {recentPatients.map(p => (
                  <div key={p.id} className="pro-row">
                    <span className="pro-initials w-10 h-10">
                      {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initialsOf(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="pro-row-name truncate">{p.name}</div>
                      <div className="pro-row-sub truncate">
                        {p.lastInteraction
                          ? `${t('pro.dashboard.lastContact')}: ${whenLabel(new Date(p.lastInteraction), language, t)}`
                          : t('pro.dashboard.active')}
                      </div>
                    </div>
                    <span className="pro-pill pro-pill-ok hidden min-[380px]:inline-flex">{t('pro.dashboard.active')}</span>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="pro-kebab" aria-label={t('nav.more')}><MoreVertical /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => navigate('/doctor/patients')}><Users className="w-4 h-4 mr-2" />{t('pro.patients.viewRecord')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/chat')}><MessageSquare className="w-4 h-4 mr-2" />{t('pro.dashboard.openChat')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/doctor/vault')}><Folder className="w-4 h-4 mr-2" />{t('pro.patients.documents')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Próximo Live · Pendientes · Resumen del mes */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 mt-3 sm:mt-4">
          <section className="pro-card pro-card-pad bg-card min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Video /> <span className="truncate">{t('pro.dashboard.nextLive')}</span></h2>
              <Link to="/doctor/availability" className="pro-link">{t('pro.common.viewAll')} <ArrowRight /></Link>
            </div>
            {nextLive ? (
              <div className="flex items-center gap-3">
                <span className="w-[92px] h-[76px] rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f5b6c, #227787)' }}>
                  <Radio className="w-7 h-7" style={{ color: 'var(--pro-live)' }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="pro-row-name line-clamp-2">{nextLive.title}</div>
                  <div className="pro-row-sub mt-0.5">{whenLabel(nextLive.start, language, t)}</div>
                  <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                    <span className="pro-pill pro-pill-info pro-pill-plain">{t('roles.doctor')}</span>
                    <Link to="/doctor/availability" className="pro-btn pro-btn-outline pro-btn-sm">{t('pro.dashboard.manage')}</Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="pro-muted text-sm">{t('pro.dashboard.noLive')}</p>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-3" onClick={() => navigate('/doctor/availability?nueva=live')}>
                  <Plus /> {t('pro.dashboard.scheduleLive')}
                </button>
              </div>
            )}
          </section>

          <section className="pro-card pro-card-pad bg-card min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><CheckSquare /> <span className="truncate">{t('pro.dashboard.pending')}</span></h2>
              <Link to="/my-appointments" className="pro-kebab" aria-label={t('pro.common.viewAll')}><ChevronRight /></Link>
            </div>
            {pendingItems.length === 0 ? (
              <p className="pro-muted text-sm py-3">{t('pro.dashboard.nothingPending')}</p>
            ) : (
              <div>
                {pendingItems.map((item, i) => (
                  <Link key={i} to={item.href} className="pro-todo">
                    <item.icon />
                    <span className="min-w-0 truncate">{item.text}</span>
                    <ChevronRight className="chev w-4 h-4" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="pro-card pro-card-pad bg-card min-w-0 md:col-span-2 xl:col-span-1">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><BarChart3 /> <span className="truncate">{t('pro.dashboard.monthSummary')}</span></h2>
              <Link to="/doctor/earnings" className="pro-kebab" aria-label={t('pro.common.viewAll')}><ChevronRight /></Link>
            </div>
            <div className="h-[150px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="proIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#227787" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#227787" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" ticks={ticks} tickFormatter={(d) => `${d} ${monthName}`} tick={{ fontSize: 10, fill: '#8a99a8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1000)]} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : `${v}`)} tick={{ fontSize: 10, fill: '#8a99a8' }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: any) => [showAmount ? money(Number(v), language) : '$ ••••', t('pro.dashboard.earnings')]}
                    labelFormatter={(d) => `${d} ${monthName}`}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e3ecf0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="v" stroke="#227787" strokeWidth={2.5} fill="url(#proIncome)" dot={hasMovements ? { r: 3, fill: '#227787', strokeWidth: 0 } : false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="pro-muted text-xs mt-1">{hasMovements ? t('pro.dashboard.earnings') : t('pro.dashboard.noMovements')}</p>
          </section>
        </div>

        {/* Herramientas del panel anterior: todo sigue disponible, plegado */}
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen} className="mt-4 sm:mt-5">
          <CollapsibleTrigger asChild>
            <button type="button" className="pro-card pro-card-pad bg-card w-full text-left flex items-center gap-3">
              <span className="pro-icon-box"><Settings /></span>
              <span className="min-w-0 flex-1">
                <span className="pro-card-title block">{t('pro.dashboard.moreTools')}</span>
                <span className="pro-muted text-xs sm:text-sm block truncate">{t('pro.dashboard.moreToolsDesc')}</span>
              </span>
              <ChevronDown className={`w-5 h-5 pro-muted transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 sm:mt-4">
            <Tabs defaultValue="overview">
              <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto grid grid-cols-2 sm:flex">
                <TabsTrigger value="overview" className="px-3 sm:px-6 text-xs sm:text-sm">{t('pro.dashboard.overview')}</TabsTrigger>
                <TabsTrigger value="analytics" className="gap-1.5 px-3 sm:px-6 text-xs sm:text-sm">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t('pro.dashboard.analytics')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4 sm:space-y-5">
                <DoctorPatientSearch />
                <DoctorProfileCard />
                <DoctorStatsGrid recordingsCount={recordingsCount} vaultFilesCount={vaultFiles.length} rating={doctorProfile?.rating || 0} />
                <DoctorResidentRequests />
                <MyNotesWidget />
                <div className="grid gap-3 md:grid-cols-2">
                  <EarningsCard />
                  <FundHoldsCard />
                </div>
                <Card className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary/40" onClick={() => navigate('/doctor/books')}>
                  <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base text-foreground">{t('doctorBooks.dashboardCardTitle')}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t('doctorBooks.dashboardCardDesc')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
                <div className="grid gap-3 md:grid-cols-2">
                  <EmailStatsCard />
                  <EmailHistoryCard />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <SignatureUpload />
                </div>
                <EmailTrendsChart />
              </TabsContent>
              <TabsContent value="analytics">
                <DoctorAnalytics />
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </MainLayout>
  );
}
