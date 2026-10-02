// Inicio del médico (/doctor/dashboard) — diseño de Marta, 12-sep-2026.
//
// Requisito 9 del encargo: el Inicio SOLO trae lo del día — la próxima consulta,
// la agenda de hoy, las tareas pendientes, los mensajes sin leer, los pacientes
// recientes, el próximo Live y un resumen financiero opcional.
//
// Maquetación según el mockup «panel-de-medico.jpg»: cabecera «Panel de médico»,
// cuatro KPI iguales, agenda de hoy (2/3) + pacientes recientes (1/3) y tres
// tarjetas abajo (Próximo Live · Pendientes · Resumen del mes). Solo cambia el
// diseño: los datos y los handlers son los de la reorganización del 11-sep.
// «Actividad reciente» no la dibuja el mockup pero la exige el análisis de Marta
// (requisito 9 del Inicio): va al pie, a todo el ancho. Lo que hacía la tarjeta
// «Lo siguiente» (entrar a la sala, ir al Live, ver detalles) sigue en las filas
// de la agenda, en «Próximo Live» y en la cabecera.
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
import { DashboardRecentActivity } from '@/components/doctor/DashboardRecentActivity';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
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
import '@/styles/diseno-inicio.css';

/** Preferencia nueva: enseñar o no TODO el resumen financiero (KPI + gráfico). */
const SHOW_FINANCE_KEY = 'mm.pro.showFinance';
/** Preferencia anterior: solo tapaba el importe. Se respeta si ya existía. */
const LEGACY_INCOME_KEY = 'mm.pro.showIncome';
/** Una consulta confirmada que pasó hace más de una hora está «por cerrar». */
const TO_CLOSE_MARGIN_MS = 60 * 60 * 1000;

/** KPI del mockup: icono en círculo · etiqueta completa · valor grande · sub · chevron. */
function Kpi({
  icon: Icon,
  label,
  labelAside,
  value,
  sub,
  chevron,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  /** Control pequeño junto a la etiqueta (el ojo de «Ingresos del mes»). */
  labelAside?: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  // El envoltorio es el contenedor (@container dikpi) que consulta la tarjeta:
  // así la regla de «tarjeta estrecha» se aplica de verdad (un elemento no
  // puede consultarse a sí mismo).
  return (
    <div className="di-kpi-wrap">
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="pro-card di-kpi bg-card">
        <span className="pro-icon-box"><Icon /></span>
        <div className="di-kpi-body">
          <div className="di-kpi-label"><span>{label}</span>{labelAside}</div>
          <div className="di-kpi-value">{value}</div>
          {sub && <div className="di-kpi-sub">{sub}</div>}
        </div>
        {chevron && <ChevronRight className="di-kpi-chev" />}
      </Tag>
    </div>
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

  /** Próxima consulta (KPI 1): la primera cita confirmada o solicitada que no haya terminado. */
  const nextAppt = useMemo(
    () => events.find(e => e.kind === 'appointment' && (e.status === 'confirmed' || e.status === 'requested') && e.end.getTime() >= now.getTime()),
    [events, now],
  );
  /** Próximo Live (tarjeta de la fila 3): sale de `doctor_availability` type `live`, como en la Agenda. */
  const nextLive = useMemo(() => events.find(e => e.kind === 'live' && e.end.getTime() >= now.getTime()), [events, now]);

  const requestedCount = useMemo(
    () => events.filter(e => e.kind === 'appointment' && e.status === 'requested' && e.start.getTime() >= now.getTime()).length,
    [events, now],
  );
  const recentPatients = useMemo(() => patients.slice(0, 4), [patients]);
  // Nombre ya conocido del paciente para «Actividad reciente» (evita releer perfiles).
  const patientNameById = useCallback((id: string) => patients.find(p => p.id === id)?.name || null, [patients]);
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

  /** «10 sep» (sin el punto de la abreviatura que añaden algunos idiomas). */
  const dateShort = (d: Date) => fmt.formatDate(d, 'd MMM').replace('.', '');

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

  /** Sub del KPI «Próxima consulta»: «En N min» si es hoy; la fecha corta si es otro día. */
  const nextApptSub = nextAppt
    ? (isSameDay(nextAppt.start, now) ? whenSub(nextAppt.start) : dateShort(nextAppt.start))
    : t('mm2.dashboard.kpi.noConsultationsToday');

  // Estados vacíos: la tarjeta sin datos no se estira a la altura de la vecina (CSS `.is-empty`).
  const agendaEmpty = !agendaLoading && todayScheduled.length === 0;
  const patientsEmpty = recentPatients.length === 0;
  const liveEmpty = !agendaLoading && !nextLive;
  const tasksEmpty = pendingItems.length === 0;

  const amountToggle = (
    <span
      role="button"
      tabIndex={0}
      aria-label={showAmount ? t('mm2.dashboard.finance.hideAmount') : t('mm2.dashboard.finance.showAmount')}
      title={showAmount ? t('mm2.dashboard.finance.hideAmount') : t('mm2.dashboard.finance.showAmount')}
      onClick={(e) => { e.stopPropagation(); toggleAmount(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleAmount(); } }}
      className="di-kpi-eye"
    >
      {showAmount ? <EyeOff /> : <Eye />}
    </span>
  );

  return (
    <MainLayout>
      <div className="pro-container pro-page di-shell">
        {/* Cabecera: «Panel de médico» con el icono de Live delante + subtítulo */}
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <span className="pro-live-dot"><Radio className="w-5 h-5" style={{ color: 'var(--pro-live)' }} /></span>
              <span>{t('mm2.dashboard.panelTitle')}</span>
            </h1>
            <p className="pro-page-sub">{t('mm2.dashboard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none" onClick={() => openNewConsultation()}>
              <Plus /> {t('mm2.dashboard.newConsultation')}
            </button>
            <Link to="/doctor/go-live" className="pro-btn pro-btn-live flex-1 sm:flex-none">
              <Video /> {t('mm2.dashboard.startLive')}
            </Link>
          </div>
        </div>

        {/* Fila 1 · cuatro KPI iguales */}
        <div className={`di-kpis${showFinance ? '' : ' is-3'}`}>
          <Kpi
            icon={CalendarClock}
            label={t('mm2.dashboard.kpi.nextConsultation')}
            value={nextAppt ? fmt.formatTime(nextAppt.start) : (agendaLoading ? '…' : '—')}
            sub={nextAppt || !agendaLoading ? nextApptSub : undefined}
          />
          <Kpi
            icon={MessageSquare}
            label={t('mm2.dashboard.kpi.pendingMessages')}
            value={chatUnread}
            chevron
            onClick={() => navigate('/chat')}
          />
          <Kpi
            icon={Users}
            label={t('mm2.dashboard.kpi.activePatients')}
            value={patients.length}
            chevron
            onClick={() => navigate(doctorHref('pacientes'))}
          />
          {showFinance && (
            <Kpi
              icon={BarChart3}
              label={t('mm2.dashboard.kpi.income')}
              labelAside={amountToggle}
              value={monthEarnings ? (showAmount ? `${money(monthEarnings.total, language)} MXN` : '$ ••••') : '…'}
              chevron
              onClick={() => navigate(doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' }))}
            />
          )}
        </div>

        {/* Fila 2 · Agenda de hoy (2/3) + Pacientes recientes (1/3) */}
        <div className="di-row2">
          <section className={`pro-card pro-card-pad bg-card di-agenda min-w-0${agendaEmpty ? ' is-empty' : ''}`}>
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Calendar /> <span>{t('mm2.dashboard.today.title')}</span></h2>
              <Link to={doctorHref('agenda', { tab: 'calendario' })} className="pro-link">{t('mm2.dashboard.today.fullAgenda')} <ArrowRight /></Link>
            </div>
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
                        <div className="di-name">{e.title}</div>
                        <div className="di-sub-type">{typeLabel(e)}</div>
                        <div className="di-stack">{statusPill(e)}</div>
                      </div>
                      <span className="di-type">{typeLabel(e)}</span>
                      <span className="di-inline">{statusPill(e)}</span>
                      {e.kind === 'appointment' ? (
                        canStart(e) ? (
                          <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => window.open(e.roomUrl!, '_blank')}>
                            <Video /> <span className="di-btn-label">{t('mm2.dashboard.today.start')}</span>
                          </button>
                        ) : (
                          <Link to={doctorHref('agenda', { tab: 'consultas' })} className="pro-btn pro-btn-outline pro-btn-sm">
                            <Video /> <span className="di-btn-label">{t('mm2.dashboard.today.view')}</span>
                          </Link>
                        )
                      ) : (
                        <Link
                          to={e.kind === 'live' ? doctorHref('contenido', { tab: 'lives' }) : doctorHref('agenda', { tab: 'disponibilidad' })}
                          className="pro-btn pro-btn-outline pro-btn-sm"
                        >
                          <Calendar /> <span className="di-btn-label">{t('mm2.dashboard.today.view')}</span>
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
            {/* Horario de hoy: línea discreta al pie (el mockup no la dibuja, pero el enlace a editar el horario se conserva) */}
            {todayHours && (
              <p className="di-hours">
                <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                {fill(t('mm2.dashboard.today.hours'), { from: fmt.formatTime(todayHours.from), to: fmt.formatTime(todayHours.to) })}
                {' · '}
                <Link to={doctorHref('agenda', { tab: 'disponibilidad' })} className="pro-link inline">{t('mm2.dashboard.today.editHours')}</Link>
              </p>
            )}
          </section>

          <section className={`pro-card pro-card-pad bg-card di-patients min-w-0${patientsEmpty ? ' is-empty' : ''}`}>
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Users /> <span>{t('mm2.dashboard.patients.title')}</span></h2>
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
                        <Link to={doctorPatientHref(p.id, 'resumen')} className="di-name">{p.name || t('mm2.patients.unnamed')}</Link>
                        <div className="pro-row-sub">
                          {p.lastInteraction
                            ? `${t('mm2.dashboard.patients.lastContact')}: ${fmt.formatDate(new Date(p.lastInteraction), 'd MMM')}`
                            : patientStatusLabel(p.status)}
                        </div>
                        <div className="di-stack"><span className={patientStatusClass(p.status)}>{patientStatusLabel(p.status)}</span></div>
                      </div>
                      <span className={`${patientStatusClass(p.status)} di-inline`}>{patientStatusLabel(p.status)}</span>
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

        {/* Fila 3 · Próximo Live · Pendientes · Resumen del mes (opcional) */}
        <div className={`di-row3${showFinance ? '' : ' is-2'}`}>
          <section className={`pro-card pro-card-pad bg-card min-w-0${liveEmpty ? ' is-empty' : ''}`}>
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Video /> <span>{t('mm2.dashboard.live.title')}</span></h2>
              <Link to={doctorHref('contenido', { tab: 'lives' })} className="pro-link">{t('mm2.dashboard.live.viewAll')} <ArrowRight /></Link>
            </div>
            {agendaLoading && !nextLive ? (
              <div className="di-live">
                <div className="di-live-thumb animate-pulse" style={{ background: '#eef3f6' }} />
                <div className="di-live-body">
                  <div className="h-4 w-3/4 rounded bg-[#eef3f6] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[#eef3f6] animate-pulse" />
                </div>
              </div>
            ) : nextLive ? (
              <div className="di-live">
                <span className="di-live-thumb"><Radio /></span>
                <div className="di-live-body">
                  <div className="di-live-title">{nextLive.title}</div>
                  <div className="di-live-when">{dateShort(nextLive.start)} · {fmt.formatTime(nextLive.start)}</div>
                  <div className="di-live-actions">
                    <Link to={doctorHref('agenda', { tab: 'disponibilidad' })} className="pro-btn pro-btn-outline pro-btn-sm">
                      {t('mm2.dashboard.live.manage')}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="pro-muted text-sm">{t('mm2.dashboard.live.empty')}</p>
                <Link to={doctorHref('contenido', { tab: 'crear', crear: 'live' })} className="pro-link mt-2">
                  {t('mm2.dashboard.live.schedule')} <ArrowRight />
                </Link>
              </div>
            )}
          </section>

          <section className={`pro-card pro-card-pad bg-card min-w-0${tasksEmpty ? ' is-empty' : ''}`}>
            <div className="pro-card-head">
              <h2 className="pro-card-title"><CheckSquare /> <span>{t('mm2.dashboard.tasks.title')}</span></h2>
            </div>
            {pendingItems.length === 0 ? (
              <p className="pro-muted text-sm py-3">{t('mm2.dashboard.tasks.empty')}</p>
            ) : (
              <div>
                {pendingItems.map((item, i) => (
                  <Link key={i} to={item.href} className="pro-todo">
                    <item.icon />
                    <span className="min-w-0 flex-1">{item.text}</span>
                    <ChevronRight className="chev w-4 h-4" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {showFinance && (
            <section className="pro-card pro-card-pad bg-card min-w-0 di-span">
              <div className="pro-card-head">
                <h2 className="pro-card-title"><BarChart3 /> <span>{t('mm2.dashboard.finance.monthSummary')}</span></h2>
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

        {/* Fila 4 · Actividad reciente (análisis de Marta, requisito 9) */}
        <div className="mt-3 sm:mt-4">
          <DashboardRecentActivity nameById={patientNameById} />
        </div>

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
