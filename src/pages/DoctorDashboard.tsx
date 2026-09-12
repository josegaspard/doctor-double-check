// Inicio del médico (/doctor/dashboard) — 2.ª reorganización, 11-sep-2026.
//
// Requisito 9 del encargo: el Inicio SOLO trae lo del día — lo próximo (consulta
// o Live), la agenda de hoy, las tareas pendientes, los mensajes sin leer, los
// pacientes recientes, la actividad reciente y un resumen financiero opcional.
//
// Sale de aquí el inventario «Herramientas del panel» (14 módulos: correos,
// libros, archivos, configuración, analítica sin datos, buscador de pacientes,
// notas, finanzas…). Nada se pierde: cada módulo tiene destino en la nueva
// arquitectura (Contenido, Cuenta > Finanzas, ficha del paciente, Comunidad) y
// se llega por el menú, no por una lista escondida al final del Inicio.
//
// «Nueva consulta» abre el flujo propio (NewConsultationDialog) SIN salir de la
// pantalla: ya no lleva a Disponibilidad, donde el primer clic sobrescribía el
// horario semanal. La consulta nace pendiente de que el paciente la acepte (D1).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, differenceInMinutes, eachDayOfInterval } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChat } from '@/contexts/ChatContext';
import { useDoctorPatients } from '@/hooks/useDoctorPatients';
import { useDoctorAgenda, AgendaEvent } from '@/hooks/useDoctorAgenda';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
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
  CalendarClock,
  MessageSquare,
  Users,
  BarChart3,
  ChevronRight,
  ArrowRight,
  MoreVertical,
  FileText,
  CheckSquare,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  PlayCircle,
  Stethoscope,
  UserPlus,
  Lock,
} from 'lucide-react';
import { fill, initialsOf, money, isSameDay } from '@/lib/proFormat';
import { useAppDateFormat } from '@/lib/dateFormat';
import { doctorHref, doctorPatientHref } from '@/lib/doctorSections';
import { NewConsultationDialog } from '@/components/doctor/NewConsultationDialog';
import { DashboardRecentActivity } from '@/components/doctor/DashboardRecentActivity';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';

/** Preferencia nueva: enseñar o no TODO el resumen financiero (KPI + gráfico). */
const SHOW_FINANCE_KEY = 'mm.pro.showFinance';
/** Preferencia anterior: solo tapaba el importe. Se respeta si ya existía. */
const LEGACY_INCOME_KEY = 'mm.pro.showIncome';
/** Una consulta confirmada que pasó hace más de una hora está «por cerrar». */
const TO_CLOSE_MARGIN_MS = 60 * 60 * 1000;

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
  const fmt = useAppDateFormat();
  const { getSessionsByUser } = useChat();
  const { patients } = useDoctorPatients();
  const [now] = useState(() => new Date());
  const rangeStart = useMemo(() => startOfDay(now), [now]);
  const rangeEnd = useMemo(() => endOfDay(addDays(now, 60)), [now]);
  const { events, loading: agendaLoading } = useDoctorAgenda(rangeStart, rangeEnd);
  const [monthEarnings, setMonthEarnings] = useState<{ total: number; series: { d: number; v: number | null }[] } | null>(null);
  const [showFinance, setShowFinance] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SHOW_FINANCE_KEY);
      if (saved !== null) return saved !== '0';
      return localStorage.getItem(LEGACY_INCOME_KEY) !== '0';
    } catch { return true; }
  });
  const [showAmount, setShowAmount] = useState<boolean>(() => {
    try { return localStorage.getItem(LEGACY_INCOME_KEY) !== '0'; } catch { return true; }
  });
  const [contentPending, setContentPending] = useState(0);
  const [residentPending, setResidentPending] = useState(0);
  const [toCloseCount, setToCloseCount] = useState(0);
  const [newConsultOpen, setNewConsultOpen] = useState(false);
  const [newConsultPatient, setNewConsultPatient] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      try {
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const [txRes, contentRes, residentRes, toCloseRes] = await Promise.all([
          supabase
            .from('wallet_transactions')
            .select('amount, created_at')
            .eq('user_id', user.id)
            .eq('type', 'earning')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
            .order('created_at', { ascending: true }),
          supabase.from('doctor_content').select('*', { count: 'exact', head: true }).eq('creator_id', user.id).eq('moderation_status', 'pending'),
          supabase.from('doctor_resident_connections').select('*', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'pending'),
          supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id)
            .eq('status', 'confirmed')
            .lt('scheduled_at', new Date(now.getTime() - TO_CLOSE_MARGIN_MS).toISOString()),
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
        if (!contentRes.error && contentRes.count !== null) setContentPending(contentRes.count);
        if (!residentRes.error && residentRes.count !== null) setResidentPending(residentRes.count);
        if (!toCloseRes.error && toCloseRes.count !== null) setToCloseCount(toCloseRes.count);
      } catch (e) {
        console.error('DoctorDashboard load error:', e);
        if (active) setMonthEarnings({ total: 0, series: [] });
      }
    })();
    return () => { active = false; };
  }, [user?.id, now]);

  const toggleFinance = () => {
    setShowFinance(v => {
      try { localStorage.setItem(SHOW_FINANCE_KEY, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  };

  const toggleAmount = () => {
    setShowAmount(v => {
      try { localStorage.setItem(LEGACY_INCOME_KEY, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  };

  const sessions = useMemo(() => getSessionsByUser(), [getSessionsByUser]);
  const chatUnread = useMemo(
    () => sessions.reduce((sum, s) => (s.status === 'active' ? sum + (s.unreadCount || 0) : sum), 0),
    [sessions],
  );
  /** Conversación ya existente con un paciente: abrir el chat NO crea nada. */
  const sessionIdFor = useCallback((patientId?: string | null) => {
    if (!patientId) return null;
    const found = sessions.find(s =>
      (s.participant1Id === patientId || s.participant2Id === patientId) && s.status === 'active');
    return found?.id || null;
  }, [sessions]);

  const patientName = useCallback(
    (id: string) => patients.find(p => p.id === id)?.name || null,
    [patients],
  );

  const todayEvents = useMemo(() => events.filter(e => isSameDay(e.start, now)), [events, now]);
  /** Los tramos de horario no son citas: se resumen en una línea, no en filas. */
  const todayScheduled = useMemo(
    () => todayEvents.filter(e => e.kind !== 'office_hours' && e.kind !== 'consultation'),
    [todayEvents],
  );
  const todayHours = useMemo(() => {
    const ranges = todayEvents.filter(e => e.kind === 'office_hours' || e.kind === 'consultation');
    if (ranges.length === 0) return null;
    const from = ranges.reduce((min, e) => (e.start < min ? e.start : min), ranges[0].start);
    const to = ranges.reduce((max, e) => (e.end > max ? e.end : max), ranges[0].end);
    return { from, to };
  }, [todayEvents]);

  const nextAppt = useMemo(
    () => events.find(e => e.kind === 'appointment' && (e.status === 'confirmed' || e.status === 'requested') && e.end.getTime() >= now.getTime()),
    [events, now],
  );
  const nextLive = useMemo(() => events.find(e => e.kind === 'live' && e.end.getTime() >= now.getTime()), [events, now]);
  /** Lo próximo = lo primero que ocurra, sea consulta o Live (requisito 9). */
  const nextUp = useMemo(() => {
    if (nextAppt && nextLive) return nextAppt.start <= nextLive.start ? nextAppt : nextLive;
    return nextAppt || nextLive || null;
  }, [nextAppt, nextLive]);

  const requestedCount = useMemo(
    () => events.filter(e => e.kind === 'appointment' && e.status === 'requested' && e.start.getTime() >= now.getTime()).length,
    [events, now],
  );
  const recentPatients = useMemo(() => patients.slice(0, 4), [patients]);
  const consultCountByPatient = useMemo(() => {
    const m = new Map<string, number>();
    patients.forEach(p => m.set(p.id, p.consultationsCount));
    return m;
  }, [patients]);

  const openNewConsultation = useCallback((patientId?: string) => {
    setNewConsultPatient(patientId);
    setNewConsultOpen(true);
  }, []);

  // El guard de rol va DESPUÉS de todos los hooks.
  if (role !== 'doctor') {
    return <Navigate to="/lives" replace />;
  }

  const doctorProfile = user?.doctorProfile;
  const isApproved = doctorProfile?.status === 'approved';

  const typeLabel = (e: AgendaEvent) => {
    if (e.kind === 'appointment') {
      const n = e.patientId ? consultCountByPatient.get(e.patientId) || 0 : 0;
      return n > 0 ? t('mm2.dashboard.type.followUp') : t('mm2.dashboard.type.firstVisit');
    }
    if (e.kind === 'live') return t('mm2.dashboard.type.live');
    if (e.kind === 'blocked') return t('mm2.dashboard.type.blocked');
    return t('mm2.dashboard.type.available');
  };

  const statusPill = (e: AgendaEvent) => {
    if (e.kind === 'appointment') {
      if (e.status === 'confirmed') return <span className="pro-pill pro-pill-ok">{t('mm2.dashboard.status.confirmed')}</span>;
      if (e.status === 'requested') return <span className="pro-pill pro-pill-warn">{t('mm2.dashboard.status.pending')}</span>;
      if (e.status === 'cancelled') return <span className="pro-pill pro-pill-muted">{t('mm2.dashboard.status.cancelled')}</span>;
      return <span className="pro-pill pro-pill-muted">{t('mm2.dashboard.status.completed')}</span>;
    }
    if (e.kind === 'live') return <span className="pro-pill pro-pill-live">{t('mm2.dashboard.type.live')}</span>;
    if (e.kind === 'blocked') return <span className="pro-pill pro-pill-muted">{t('mm2.dashboard.type.blocked')}</span>;
    return <span className="pro-pill pro-pill-info">{t('mm2.dashboard.type.available')}</span>;
  };

  const canStart = (e: AgendaEvent) =>
    e.kind === 'appointment' && !!e.roomUrl && e.status === 'confirmed' &&
    e.start.getTime() - now.getTime() < 30 * 60_000 && e.end.getTime() > now.getTime();

  const whenSub = (d: Date) => {
    const mins = differenceInMinutes(d, now);
    if (mins <= 0) return t('mm2.dashboard.next.now');
    if (mins < 60) return fill(t('mm2.dashboard.next.inMinutes'), { n: mins });
    if (isSameDay(d, now)) return fill(t('mm2.dashboard.next.inHours'), { n: Math.round(mins / 60) });
    return `${fmt.formatDate(d, 'd MMM')} · ${fmt.formatTime(d)}`;
  };

  const patientStatusLabel = (status: string) => {
    if (status === 'pending') return t('mm2.dashboard.patients.statusPending');
    if (status === 'next') return t('mm2.dashboard.patients.statusNext');
    if (status === 'followUp') return t('mm2.dashboard.patients.statusFollowUp');
    if (status === 'follower') return t('mm2.dashboard.patients.statusFollower');
    return t('mm2.dashboard.patients.statusActive');
  };
  const patientStatusClass = (status: string) =>
    status === 'pending' ? 'pro-pill pro-pill-warn'
      : status === 'next' ? 'pro-pill pro-pill-info'
        : status === 'follower' ? 'pro-pill pro-pill-muted'
          : 'pro-pill pro-pill-ok';

  const monthName = fmt.formatDate(now, 'LLL').replace('.', '');
  const lastDay = endOfMonth(now).getDate();
  const ticks = [1, 8, 15, 22, lastDay].filter((v, i, a) => a.indexOf(v) === i);
  const chartData = monthEarnings?.series || [];
  const hasMovements = (monthEarnings?.total || 0) > 0;

  // Tareas pendientes: solo cosas accionables y comprobables en la base.
  // Fuera el contador de «documentos de pacientes»: era el inventario del
  // archivo del médico, no una tarea suya.
  const pendingItems: { icon: React.ElementType; text: React.ReactNode; href: string }[] = [];
  if (requestedCount > 0) {
    pendingItems.push({
      icon: Calendar,
      text: <span dangerouslySetInnerHTML={{ __html: fill(requestedCount === 1 ? t('mm2.dashboard.tasks.appointments') : t('mm2.dashboard.tasks.appointmentsPlural'), { n: `<b>${requestedCount}</b>` }) }} />,
      href: doctorHref('agenda', { tab: 'consultas' }),
    });
  }
  if (toCloseCount > 0) {
    pendingItems.push({
      icon: Stethoscope,
      text: <span dangerouslySetInnerHTML={{ __html: fill(toCloseCount === 1 ? t('mm2.dashboard.tasks.toClose') : t('mm2.dashboard.tasks.toClosePlural'), { n: `<b>${toCloseCount}</b>` }) }} />,
      href: doctorHref('agenda', { tab: 'consultas' }),
    });
  }
  if (chatUnread > 0) {
    pendingItems.push({
      icon: MessageSquare,
      text: <span dangerouslySetInnerHTML={{ __html: fill(chatUnread === 1 ? t('mm2.dashboard.tasks.unread') : t('mm2.dashboard.tasks.unreadPlural'), { n: `<b>${chatUnread}</b>` }) }} />,
      href: '/chat',
    });
  }
  if (contentPending > 0) {
    pendingItems.push({
      icon: PlayCircle,
      text: <span dangerouslySetInnerHTML={{ __html: fill(contentPending === 1 ? t('mm2.dashboard.tasks.content') : t('mm2.dashboard.tasks.contentPlural'), { n: `<b>${contentPending}</b>` }) }} />,
      href: doctorHref('contenido', { tab: 'publicaciones' }),
    });
  }
  if (residentPending > 0) {
    pendingItems.push({
      icon: UserPlus,
      text: <span dangerouslySetInnerHTML={{ __html: fill(residentPending === 1 ? t('mm2.dashboard.tasks.residents') : t('mm2.dashboard.tasks.residentsPlural'), { n: `<b>${residentPending}</b>` }) }} />,
      href: doctorHref('comunidad', { tab: 'feed' }),
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
              <span className="truncate">{t('mm2.dashboard.title')}</span>
            </h1>
            <p className="pro-page-sub">
              <span className="inline-flex items-center gap-1 min-w-0 max-w-full align-bottom">
                <span className="truncate">
                  {fill(t('mm2.dashboard.greeting'), { name: user?.name?.split(' ')[0] || '' })} · {t('mm2.dashboard.subtitle')}
                </span>
                <DoctorBadgeIcon userId={user?.id} size="md" className="flex-shrink-0" />
              </span>
            </p>
            {isApproved && (
              <div className="pro-badges-row">
                <Badge variant="verified" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs">
                  <CheckCircle className="w-3 h-3" />
                  {t('mm2.dashboard.verified')}
                </Badge>
                <DoctorBadge type={getDoctorBadgeType(doctorProfile?.totalConsultations || 0, doctorProfile?.rating || 0, (doctorProfile as any)?.badgeOverride ?? null)} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none" onClick={() => openNewConsultation()}>
              <Plus /> {t('mm2.dashboard.newConsultation')}
            </button>
            <Link to="/doctor/go-live" className="pro-btn pro-btn-ghost flex-1 sm:flex-none">
              <Video /> {t('mm2.dashboard.startLive')}
            </Link>
          </div>
        </div>

        {/* Lo próximo + KPIs del día */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <section className="pro-card pro-card-pad bg-card lg:col-span-5 min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><CalendarClock /> <span className="truncate">{t('mm2.dashboard.next.title')}</span></h2>
              <Link to={doctorHref('agenda', { tab: 'calendario' })} className="pro-link">{t('mm2.dashboard.next.agenda')} <ArrowRight /></Link>
            </div>
            {nextUp ? (
              <div className="flex items-center gap-3">
                <span className="pro-initials w-12 h-12 flex-shrink-0">
                  {nextUp.kind === 'live'
                    ? <Radio className="w-5 h-5" />
                    : nextUp.patientAvatar
                      ? <img src={nextUp.patientAvatar} alt="" />
                      : initialsOf(nextUp.patientName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pro-pill pro-pill-plain pro-pill-info">
                      {nextUp.kind === 'live' ? t('mm2.dashboard.next.live') : t('mm2.dashboard.next.consultation')}
                    </span>
                    {nextUp.kind === 'appointment' && statusPill(nextUp)}
                  </div>
                  <div className="pro-row-name truncate mt-1">{nextUp.title}</div>
                  <div className="pro-row-sub">{fmt.formatTime(nextUp.start)} · {whenSub(nextUp.start)}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {nextUp.kind === 'appointment' && canStart(nextUp) && (
                      <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => window.open(nextUp.roomUrl!, '_blank')}>
                        <Video /> {t('mm2.dashboard.next.enterRoom')}
                      </button>
                    )}
                    {nextUp.kind === 'live' && (
                      <Link to="/doctor/go-live" className="pro-btn pro-btn-teal pro-btn-sm">
                        <Radio /> {t('mm2.dashboard.next.goLive')}
                      </Link>
                    )}
                    <Link
                      to={nextUp.kind === 'live'
                        ? doctorHref('contenido', { tab: 'lives' })
                        : doctorHref('agenda', { tab: 'consultas' })}
                      className="pro-btn pro-btn-outline pro-btn-sm"
                    >
                      {t('mm2.dashboard.next.details')}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="pro-muted text-sm">{t('mm2.dashboard.next.empty')}</p>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-3" onClick={() => openNewConsultation()}>
                  <Plus /> {t('mm2.dashboard.newConsultation')}
                </button>
              </div>
            )}
          </section>

          <div className={`lg:col-span-7 grid grid-cols-1 min-[440px]:grid-cols-2 ${showFinance ? 'xl:grid-cols-3' : ''} gap-3 sm:gap-4 content-start`}>
            <Kpi
              icon={MessageSquare}
              label={t('mm2.dashboard.kpi.unread')}
              value={chatUnread}
              chevron
              onClick={() => navigate('/chat')}
            />
            <Kpi
              icon={Users}
              label={t('mm2.dashboard.kpi.patients')}
              value={patients.length}
              chevron
              onClick={() => navigate(doctorHref('pacientes'))}
            />
            {showFinance && (
              <Kpi
                icon={BarChart3}
                label={t('mm2.dashboard.kpi.income')}
                value={monthEarnings ? (showAmount ? `${money(monthEarnings.total, language)} MXN` : '$ ••••') : '…'}
                chevron
                onClick={() => navigate(doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' }))}
                aside={
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={showAmount ? t('mm2.dashboard.finance.hideAmount') : t('mm2.dashboard.finance.showAmount')}
                    onClick={(e) => { e.stopPropagation(); toggleAmount(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleAmount(); } }}
                    className="pro-kebab self-center"
                  >
                    {showAmount ? <EyeOff /> : <Eye />}
                  </span>
                }
              />
            )}
          </div>
        </div>

        {/* Agenda de hoy + Pacientes recientes */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12 mt-3 sm:mt-4">
          <section className="pro-card pro-card-pad bg-card lg:col-span-7 min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Calendar /> <span className="truncate">{t('mm2.dashboard.today.title')}</span></h2>
              <Link to={doctorHref('agenda', { tab: 'calendario' })} className="pro-link">{t('mm2.dashboard.today.fullAgenda')} <ArrowRight /></Link>
            </div>
            {todayHours && (
              <p className="pro-muted text-[12.5px] mb-2">
                <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                {fill(t('mm2.dashboard.today.hours'), { from: fmt.formatTime(todayHours.from), to: fmt.formatTime(todayHours.to) })}
                {' · '}
                <Link to={doctorHref('agenda', { tab: 'disponibilidad' })} className="pro-link inline">{t('mm2.dashboard.today.editHours')}</Link>
              </p>
            )}
            {agendaLoading && todayScheduled.length === 0 ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-[#eef3f6] animate-pulse" />)}
              </div>
            ) : todayScheduled.length === 0 ? (
              <p className="pro-muted text-sm py-4">{t('mm2.dashboard.today.empty')}</p>
            ) : (
              <div>
                {todayScheduled.map(e => {
                  const sessionId = e.kind === 'appointment' ? sessionIdFor(e.patientId) : null;
                  return (
                    <div key={e.id} className="pro-row">
                      <div className="pro-row-time">{fmt.formatTime(e.start)}</div>
                      <span className="pro-initials w-9 h-9 text-[11px]">
                        {e.patientAvatar ? <img src={e.patientAvatar} alt="" /> : e.kind === 'appointment' ? initialsOf(e.patientName) : e.kind === 'live' ? <Radio className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
                            <Video /> <span className="hidden sm:inline">{t('mm2.dashboard.today.start')}</span>
                          </button>
                        ) : (
                          <Link to={doctorHref('agenda', { tab: 'consultas' })} className="pro-btn pro-btn-outline pro-btn-sm">
                            <Video /> <span className="hidden sm:inline">{t('mm2.dashboard.today.view')}</span>
                          </Link>
                        )
                      ) : (
                        <Link
                          to={e.kind === 'live' ? doctorHref('contenido', { tab: 'lives' }) : doctorHref('agenda', { tab: 'disponibilidad' })}
                          className="pro-btn pro-btn-outline pro-btn-sm"
                        >
                          <Calendar /> <span className="hidden sm:inline">{t('mm2.dashboard.today.view')}</span>
                        </Link>
                      )}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="pro-kebab" aria-label={t('mm2.dashboard.more')}><MoreVertical /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          {e.kind === 'appointment' && (
                            <DropdownMenuItem onClick={() => navigate(doctorHref('agenda', { tab: 'consultas' }))}>
                              <Stethoscope className="w-4 h-4 mr-2" />{t('mm2.dashboard.today.openConsultation')}
                            </DropdownMenuItem>
                          )}
                          {e.kind === 'appointment' && e.patientId && (
                            <DropdownMenuItem onClick={() => navigate(doctorPatientHref(e.patientId!, 'resumen'))}>
                              <Users className="w-4 h-4 mr-2" />{t('mm2.dashboard.today.openPatient')}
                            </DropdownMenuItem>
                          )}
                          {sessionId && (
                            <DropdownMenuItem onClick={() => navigate(`/chat?session=${sessionId}`)}>
                              <MessageSquare className="w-4 h-4 mr-2" />{t('mm2.dashboard.today.openChat')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(doctorHref('agenda', { tab: 'calendario' }))}>
                            <Calendar className="w-4 h-4 mr-2" />{t('mm2.dashboard.today.openInAgenda')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="pro-card pro-card-pad bg-card lg:col-span-5 min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Users /> <span className="truncate">{t('mm2.dashboard.patients.title')}</span></h2>
              <Link to={doctorHref('pacientes')} className="pro-link">{t('mm2.dashboard.patients.viewAll')} <ArrowRight /></Link>
            </div>
            {recentPatients.length === 0 ? (
              <p className="pro-muted text-sm py-4">{t('mm2.dashboard.patients.empty')}</p>
            ) : (
              <div>
                {recentPatients.map(p => {
                  const sessionId = sessionIdFor(p.id);
                  return (
                    <div key={p.id} className="pro-row">
                      <span className="pro-initials w-10 h-10">
                        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initialsOf(p.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link to={doctorPatientHref(p.id, 'resumen')} className="pro-row-name truncate block">{p.name || t('mm2.patients.unnamed')}</Link>
                        <div className="pro-row-sub truncate">
                          {p.lastInteraction
                            ? `${t('mm2.dashboard.patients.lastContact')}: ${fmt.formatDate(new Date(p.lastInteraction), 'd MMM')}`
                            : patientStatusLabel(p.status)}
                        </div>
                      </div>
                      <span className={`${patientStatusClass(p.status)} hidden min-[380px]:inline-flex`}>{patientStatusLabel(p.status)}</span>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="pro-kebab" aria-label={t('mm2.dashboard.more')}><MoreVertical /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuItem onClick={() => navigate(doctorPatientHref(p.id, 'resumen'))}>
                            <Users className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.record')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(doctorPatientHref(p.id, 'consultas'))}>
                            <Stethoscope className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.consultations')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(doctorPatientHref(p.id, 'documentos'))}>
                            <FileText className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.documents')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(doctorPatientHref(p.id, 'agenda'))}>
                            <Calendar className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.agenda')}
                          </DropdownMenuItem>
                          {sessionId && (
                            <DropdownMenuItem onClick={() => navigate(`/chat?session=${sessionId}`)}>
                              <MessageSquare className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.chat')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openNewConsultation(p.id)}>
                            <Plus className="w-4 h-4 mr-2" />{t('mm2.dashboard.patients.schedule')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Tareas pendientes · Actividad reciente · Resumen financiero (opcional) */}
        <div className={`grid gap-3 sm:gap-4 md:grid-cols-2 ${showFinance ? 'xl:grid-cols-3' : ''} mt-3 sm:mt-4`}>
          <section className="pro-card pro-card-pad bg-card min-w-0">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><CheckSquare /> <span className="truncate">{t('mm2.dashboard.tasks.title')}</span></h2>
            </div>
            {pendingItems.length === 0 ? (
              <p className="pro-muted text-sm py-3">{t('mm2.dashboard.tasks.empty')}</p>
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

          <DashboardRecentActivity nameById={patientName} />

          {showFinance && (
            <section className="pro-card pro-card-pad bg-card min-w-0 md:col-span-2 xl:col-span-1">
              <div className="pro-card-head">
                <h2 className="pro-card-title"><BarChart3 /> <span className="truncate">{t('mm2.dashboard.finance.title')}</span></h2>
                <button
                  type="button"
                  className="pro-kebab"
                  aria-label={t('mm2.dashboard.finance.hide')}
                  title={t('mm2.dashboard.finance.hide')}
                  onClick={toggleFinance}
                >
                  <EyeOff />
                </button>
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
                      formatter={(v: any) => [showAmount ? money(Number(v), language) : '$ ••••', t('mm2.dashboard.finance.earnings')]}
                      labelFormatter={(d) => `${d} ${monthName}`}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e3ecf0', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="v" stroke="#227787" strokeWidth={2.5} fill="url(#proIncome)" dot={hasMovements ? { r: 3, fill: '#227787', strokeWidth: 0 } : false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="pro-muted text-xs">{hasMovements ? t('mm2.dashboard.finance.earnings') : t('mm2.dashboard.finance.noMovements')}</p>
                <Link to={doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' })} className="pro-link">
                  {t('mm2.dashboard.finance.viewAll')} <ArrowRight />
                </Link>
              </div>
            </section>
          )}
        </div>

        {!showFinance && (
          <div className="mt-3">
            <button type="button" className="pro-btn pro-btn-ghost pro-btn-sm" onClick={toggleFinance}>
              <Eye /> {t('mm2.dashboard.finance.show')}
            </button>
          </div>
        )}

        <NewConsultationDialog
          open={newConsultOpen}
          onOpenChange={(o) => { setNewConsultOpen(o); if (!o) setNewConsultPatient(undefined); }}
          defaultPatientId={newConsultPatient}
          onCreated={() => navigate(doctorHref('agenda', { tab: 'consultas' }))}
        />
      </div>
    </MainLayout>
  );
}
