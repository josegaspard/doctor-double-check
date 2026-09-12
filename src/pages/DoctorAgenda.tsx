// Agenda del médico: centro de trabajo con cuatro pestañas (11-sep-2026).
//   calendario     · mes/semana/día con consultas, Lives, bloqueos y el horario de
//                    atención efectivo (tramos por día de la semana y días sueltos)
//   consultas      · DoctorConsultations incrustado
//   disponibilidad · editor de horario + bloqueos + Lives y huecos puntuales
//   reuniones      · Meetings incrustado
// «Nueva consulta» abre siempre NewConsultationDialog (nunca Disponibilidad), y
// también ?nueva=consulta&fecha=&hora=&paciente= para los enlaces antiguos.
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay,
  addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isToday, isSameMonth, format,
} from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDoctorAgenda, AgendaEvent, AgendaKind } from '@/hooks/useDoctorAgenda';
import { useDoctorScheduleRanges, resolveEffectiveRanges } from '@/hooks/useDoctorScheduleRanges';
import MainLayout from '@/components/layout/MainLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionTabs, useSectionParam } from '@/components/common/SectionTabs';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { NewConsultationDialog } from '@/components/doctor/NewConsultationDialog';
import { ScheduleEditor } from '@/components/doctor/schedule/ScheduleEditor';
import { DOCTOR_SECTION_BY_ID, doctorPatientHref } from '@/lib/doctorSections';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Ban, Plus, Radio, Video,
  Clock, MessageSquare, Loader2, Trash2, ArrowRight, ListChecks, Sun, User, Users,
} from 'lucide-react';
import { fill, cap, fmtTime, fmtDayLong, whenLabel, tzLabel, initialsOf } from '@/lib/proFormat';
import { getIntlLocale } from '@/lib/dateLocale';

const DoctorConsultations = React.lazy(() => import('@/pages/DoctorConsultations'));
const DoctorAvailabilityPage = React.lazy(() => import('@/pages/DoctorAvailability'));
const Meetings = React.lazy(() => import('@/pages/Meetings'));

const AGENDA_TABS = ['calendario', 'consultas', 'disponibilidad', 'reuniones'] as const;
type AgendaTab = typeof AGENDA_TABS[number];

type View = 'month' | 'week' | 'day';
type Filter = 'all' | 'consultations' | 'lives' | 'availability';
type Rail = 'today' | 'summary' | 'nextLive';

const HOUR_START = 7;
const HOUR_END = 21; // exclusivo: la última fila es 20:00–21:00
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const WEEK = { weekStartsOn: 1 as const };
const HOURS_COLOR = '#7fa7e3';

const toMin = (s: string) => {
  const [h, m] = (s || '').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const kindClass = (e: AgendaEvent) => {
  if (e.kind === 'appointment') {
    if (e.status === 'requested') return 'pro-ev-appt is-pending';
    if (e.status === 'cancelled') return 'pro-ev-appt is-cancelled';
    return 'pro-ev-appt';
  }
  if (e.kind === 'live') return 'pro-ev-live';
  if (e.kind === 'blocked') return 'pro-ev-blocked';
  return 'pro-ev-avail';
};

const kindColor = (k: AgendaKind, status?: string) =>
  k === 'appointment' ? (status === 'requested' ? '#e0a63a' : '#1f9d5a')
  : k === 'live' ? '#e5322d'
  : k === 'blocked' ? '#b8c4cf'
  : HOURS_COLOR;

function layoutDay(evs: AgendaEvent[]) {
  const sorted = [...evs].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const laneEnds: number[] = [];
  const placed = sorted.map(ev => {
    let lane = laneEnds.findIndex(end => end <= ev.start.getTime());
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(ev.end.getTime()); }
    else laneEnds[lane] = ev.end.getTime();
    return { ev, lane };
  });
  const count = Math.max(1, laneEnds.length);
  return placed.map(p => ({ ...p, count }));
}

export default function DoctorAgenda() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const locale = getIntlLocale(language as any);
  const [params, setParams] = useSearchParams();
  const [tab, setTabParam] = useSectionParam<AgendaTab>('tab', AGENDA_TABS, 'calendario');
  const { confirm, dialog } = useConfirmAction();

  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'));
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [rail, setRail] = useState<Rail | null>(null);
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [block, setBlock] = useState<{ open: boolean; date: string; time: string; duration: number; allDay: boolean; title: string }>({
    open: false, date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', duration: 60, allDay: false, title: '',
  });
  const [saving, setSaving] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [newConsult, setNewConsult] = useState<{ open: boolean; date?: string; time?: string; patientId?: string }>({ open: false });
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [consultsKey, setConsultsKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Enlaces de otras pantallas: ?nueva=consulta abre Nueva consulta con fecha, hora y
  // paciente si vienen; ?nueva=live|disponible lleva a Disponibilidad, donde el
  // diálogo de Lives y huecos puntuales se abre solo.
  useEffect(() => {
    const nueva = params.get('nueva');
    if (!nueva) return;
    if (nueva === 'consulta') {
      const fecha = params.get('fecha');
      const hora = params.get('hora');
      setNewConsult({
        open: true,
        date: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined,
        time: hora && /^\d{2}:\d{2}$/.test(hora) ? hora : undefined,
        patientId: params.get('paciente') || undefined,
      });
      // ?nueva=… se limpia al CERRAR el diálogo (ver clearNuevaParams), no al abrirlo: si
      // algo remonta la Agenda a mitad (p. ej. la sesión aún hidratándose tras iniciar
      // sesión), este efecto vuelve a correr con el parámetro todavía en la URL y reabre
      // el diálogo solo, en vez de quedarse con la URL limpia y el diálogo cerrado.
    } else if ((nueva === 'live' || nueva === 'disponible') && params.get('tab') !== 'disponibilidad') {
      const next = new URLSearchParams(params);
      next.set('tab', 'disponibilidad');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const range = useMemo(() => {
    if (view === 'month') return { start: startOfWeek(startOfMonth(cursor), WEEK), end: endOfWeek(endOfMonth(cursor), WEEK) };
    if (view === 'week') return { start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) };
    return { start: startOfDay(cursor), end: endOfDay(cursor) };
  }, [view, cursor]);

  // Se consulta un poco más de lo visible para que "Hoy", "Próximo Live" y los bloqueos tengan datos.
  const fetchStart = useMemo(() => {
    const today = startOfDay(new Date());
    return range.start < today ? range.start : today;
  }, [range.start]);
  const fetchEnd = useMemo(() => {
    const far = endOfDay(addDays(new Date(), 90));
    return range.end > far ? range.end : far;
  }, [range.end]);

  const { events, loading, error, refresh, createBlock, removeBlock } = useDoctorAgenda(fetchStart, fetchEnd);
  const { ranges: scheduleRanges, reload: reloadSchedule } = useDoctorScheduleRanges();

  const passesFilter = (e: AgendaEvent) => {
    if (filter === 'all') return true;
    if (filter === 'consultations') return e.kind === 'appointment';
    if (filter === 'lives') return e.kind === 'live';
    return e.kind === 'office_hours' || e.kind === 'consultation' || e.kind === 'blocked';
  };
  const visible = useMemo(
    () => events.filter(e => e.start.getTime() <= range.end.getTime() && e.end.getTime() >= range.start.getTime() && passesFilter(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, range.start, range.end, filter],
  );

  const days = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range.start, range.end]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }), [cursor]);
  const todayEvents = useMemo(() => events.filter(e => isSameDay(e.start, new Date())).sort((a, b) => a.start.getTime() - b.start.getTime()), [events]);
  const nextLive = useMemo(() => events.find(e => e.kind === 'live' && e.end.getTime() >= Date.now()), [events]);
  const pendingRequests = useMemo(
    () => events.filter(e => e.kind === 'appointment' && e.status === 'requested' && e.end.getTime() >= Date.now()).length,
    [events],
  );
  const upcomingBlocks = useMemo(() => events.filter(e => e.kind === 'blocked' && e.end.getTime() >= Date.now()), [events]);

  // Horario de atención efectivo de cada día visible (una fecha suelta manda sobre su día de la semana).
  const hoursByDay = useMemo(() => {
    const map = new Map<string, { start: string; end: string }[]>();
    resolveEffectiveRanges(scheduleRanges, range.start, range.end)
      .forEach(r => map.set(r.day, [...(map.get(r.day) || []), { start: r.start_time, end: r.end_time }]));
    return map;
  }, [scheduleRanges, range.start, range.end]);
  const showHours = filter === 'all' || filter === 'availability';

  const HOUR_PX = isMobile ? 52 : 56;
  const totalH = HOURS.length * HOUR_PX;
  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const patientLabel = (e: AgendaEvent) => (e.kind === 'appointment' ? e.patientName || t('mm2.patients.unnamed') : e.title);
  const durationLabel = (m: number) => (m < 60 ? `${m} ${t('pro.common.min')}` : `${m / 60} ${t('pro.common.hours')}`);

  const changeTab = async (next: AgendaTab) => {
    if (next === tab) return;
    if (tab === 'disponibilidad' && scheduleDirty) {
      const ok = await confirm({
        title: t('mm2.agenda.leaveSchedule.title'),
        description: t('mm2.agenda.leaveSchedule.desc'),
        confirmLabel: t('mm2.agenda.leaveSchedule.confirm'),
        tone: 'destructive',
      });
      if (!ok) return;
      setScheduleDirty(false);
    }
    setTabParam(next);
  };

  const openNewConsultation = (opts?: { date?: string; time?: string; patientId?: string }) =>
    setNewConsult({ open: true, ...(opts || {}) });

  const clearNuevaParams = useCallback(() => {
    if (!params.get('nueva')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      ['nueva', 'fecha', 'hora', 'paciente'].forEach(k => next.delete(k));
      return next;
    }, { replace: true });
  }, [params, setParams]);

  const go = (dir: -1 | 1) => {
    if (view === 'month') setCursor(addMonths(cursor, dir));
    else if (view === 'week') setCursor(addWeeks(cursor, dir));
    else setCursor(addDays(cursor, dir));
  };

  const rangeLabel = () => {
    if (view === 'month') return cap(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cursor));
    if (view === 'day') return cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(cursor));
    const s = startOfWeek(cursor, WEEK);
    const e = endOfWeek(cursor, WEEK);
    const month = (d: Date) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
    const romance = /^(es|ca|pt|it|fr)/.test(language);
    if (s.getMonth() === e.getMonth()) {
      return romance ? `${s.getDate()}–${e.getDate()} de ${month(s)} de ${e.getFullYear()}` : `${cap(month(s))} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
    }
    return romance ? `${s.getDate()} ${month(s)} – ${e.getDate()} ${month(e)} ${e.getFullYear()}` : `${cap(month(s))} ${s.getDate()} – ${cap(month(e))} ${e.getDate()}, ${e.getFullYear()}`;
  };

  const dayHead = (d: Date) => cap(new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, ''));

  const kindLabel = (e: AgendaEvent) => {
    if (e.kind === 'appointment') return e.status === 'requested' ? t('pro.agenda.pendingConsultation') : t('pro.agenda.consultation');
    if (e.kind === 'live') return t('pro.agenda.live');
    if (e.kind === 'blocked') return t('pro.agenda.unavailable');
    return t('pro.agenda.available');
  };
  const statusLabel = (e: AgendaEvent) => {
    if (e.kind === 'appointment') {
      if (e.status === 'confirmed') return t('pro.dashboard.confirmed');
      if (e.status === 'requested') return t('pro.dashboard.pendingStatus');
      if (e.status === 'cancelled') return t('pro.dashboard.cancelled');
      return t('pro.dashboard.completed');
    }
    return kindLabel(e);
  };

  const openSlot = (day: Date, hour: number) => {
    setSlot(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0));
  };

  const openBlockDialog = (date?: Date) => {
    const d = date || new Date();
    setBlock({
      open: true,
      date: format(d, 'yyyy-MM-dd'),
      time: date ? format(d, 'HH:mm') : '09:00',
      duration: 60,
      allDay: false,
      title: '',
    });
  };

  const saveBlock = async () => {
    const start = block.allDay ? new Date(`${block.date}T00:00:00`) : new Date(`${block.date}T${block.time}:00`);
    if (isNaN(start.getTime())) { toast.error(t('pro.agenda.blockError')); return; }
    const durationMinutes = block.allDay ? 24 * 60 : block.duration;
    const ok = await confirm({
      title: t('mm2.agenda.blocks.confirmTitle'),
      description: t('mm2.agenda.blocks.confirmDesc'),
      details: [
        { label: t('mm2.agenda.blocks.when'), value: block.allDay ? fmtDayLong(start, language) : `${fmtDayLong(start, language)} · ${fmtTime(start, language)}` },
        { label: t('mm2.agenda.blocks.duration'), value: block.allDay ? t('mm2.agenda.blocks.allDay') : durationLabel(durationMinutes) },
        { label: t('mm2.agenda.blocks.reason'), value: block.title.trim() || t('mm2.agenda.blocks.noReason') },
      ],
      confirmLabel: t('pro.agenda.block'),
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await createBlock({ start, durationMinutes, title: block.title });
      if (!res.success) throw new Error(res.error || 'error');
      toast.success(t('pro.agenda.blocked'));
      setBlock(b => ({ ...b, open: false }));
    } catch (e: any) {
      toast.error(`${t('pro.agenda.blockError')}${e?.message ? ` · ${e.message}` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (e: AgendaEvent) => {
    const ok = await confirm({
      title: t('mm2.agenda.blocks.confirmRemoveTitle'),
      description: t('mm2.agenda.blocks.confirmRemoveDesc'),
      details: [
        { label: t('mm2.agenda.blocks.when'), value: `${fmtDayLong(e.start, language)} · ${fmtTime(e.start, language)} – ${fmtTime(e.end, language)}` },
        { label: t('mm2.agenda.blocks.reason'), value: e.title || t('mm2.agenda.blocks.noReason') },
      ],
      confirmLabel: t('mm2.agenda.blocks.remove'),
      tone: 'destructive',
    });
    if (!ok) return;
    setSaving(true);
    const res = await removeBlock(e.raw.id);
    setSaving(false);
    if (res.success) { toast.success(t('pro.agenda.unblocked')); setSelected(null); }
    else toast.error(res.error || t('pro.common.error'));
  };

  const canEnter = (e: AgendaEvent) =>
    e.kind === 'appointment' && !!e.roomUrl && e.status === 'confirmed' &&
    e.start.getTime() - Date.now() < 30 * 60_000 && e.end.getTime() > Date.now();

  const summary = (() => {
    const consultations = visible.filter(e => e.kind === 'appointment' && e.status !== 'cancelled').length;
    const lives = visible.filter(e => e.kind === 'live').length;
    const oneOffMin = visible.filter(e => e.kind === 'office_hours' || e.kind === 'consultation').reduce((s, e) => s + e.durationMinutes, 0);
    const scheduleMin = [...hoursByDay.values()].flat().reduce((s, h) => s + Math.max(0, toMin(h.end) - toMin(h.start)), 0);
    const blocks = visible.filter(e => e.kind === 'blocked').length;
    return { consultations, lives, availableHours: Math.round(((oneOffMin + scheduleMin) / 60) * 10) / 10, blocks };
  })();

  const renderEvent = (e: AgendaEvent, style: React.CSSProperties) => (
    <button
      key={e.id}
      type="button"
      className={`pro-cal-ev ${kindClass(e)}`}
      style={style}
      onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
      title={`${fmtTime(e.start, language)} · ${patientLabel(e)}`}
    >
      <b>{fmtTime(e.start, language)}{e.durationMinutes >= 60 ? ` – ${fmtTime(e.end, language)}` : ''}</b>
      <span>{e.kind === 'appointment' ? `${patientLabel(e)} · ${kindLabel(e)}` : e.kind === 'blocked' ? (e.title || t('pro.agenda.unavailable')) : e.kind === 'live' ? `LIVE · ${e.title}` : `${kindLabel(e)}${e.title ? ` · ${e.title}` : ''}`}</span>
      {e.kind === 'appointment' && <span className="st">{statusLabel(e)}</span>}
      {e.kind === 'blocked' && <span className="st" style={{ color: 'var(--pro-muted)' }}><Ban className="w-3 h-3" /> {t('pro.agenda.unavailable')}</span>}
    </button>
  );

  const timeGrid = (gridDays: Date[]) => (
    <div className="pro-cal" style={{ ['--days' as any]: gridDays.length, ['--hour' as any]: `${HOUR_PX}px` }}>
      <div className="pro-cal-head">
        <div />
        {gridDays.map(d => (
          <div key={d.toISOString()} className={`pro-cal-day ${isToday(d) ? 'is-today' : ''}`}>{gridDays.length === 1 ? fmtDayLong(d, language) : dayHead(d)}</div>
        ))}
      </div>
      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: isMobile ? '58vh' : '64vh' }}>
        <div className="pro-cal-body">
          <div className="pro-cal-gutter" style={{ height: totalH }}>
            {HOURS.map(h => <div key={h} className="pro-cal-hour">{String(h).padStart(2, '0')}:00</div>)}
          </div>
          {gridDays.map(d => {
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), HOUR_START, 0, 0, 0);
            const dayEvents = visible.filter(e => isSameDay(e.start, d) || (e.start < startOfDay(d) && e.end > startOfDay(d)));
            const laid = layoutDay(dayEvents);
            const nowTop = isToday(d) ? ((nowTick.getTime() - dayStart.getTime()) / 3600000) * HOUR_PX : -1;
            return (
              <div key={d.toISOString()} className={`pro-cal-col ${isToday(d) ? 'is-today' : ''}`} style={{ height: totalH }}>
                {HOURS.map(h => (
                  <div key={h} className="pro-cal-slot" style={{ top: (h - HOUR_START) * HOUR_PX }} onClick={() => openSlot(d, h)} role="button" aria-label={`${dayHead(d)} ${String(h).padStart(2, '0')}:00`} />
                ))}
                {/* Horario de atención: franja de fondo que no tapa los clics */}
                {showHours && (hoursByDay.get(dayKey(d)) || []).map(h => {
                  const from = Math.max(0, toMin(h.start) - HOUR_START * 60);
                  const to = Math.min(HOURS.length * 60, toMin(h.end) - HOUR_START * 60);
                  if (to <= from) return null;
                  return (
                    <div
                      key={`hours-${h.start}-${h.end}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute', left: 0, right: 0, top: (from / 60) * HOUR_PX, height: ((to - from) / 60) * HOUR_PX,
                        background: 'rgba(127,167,227,0.16)', borderLeft: `3px solid ${HOURS_COLOR}`, pointerEvents: 'none',
                      }}
                    />
                  );
                })}
                {laid.map(({ ev, lane, count }) => {
                  const startMin = Math.max(0, (ev.start.getTime() - dayStart.getTime()) / 60000);
                  const endMin = Math.min(HOURS.length * 60, (ev.end.getTime() - dayStart.getTime()) / 60000);
                  if (endMin <= 0 || startMin >= HOURS.length * 60) return null;
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(28, ((endMin - startMin) / 60) * HOUR_PX - 2);
                  const w = 100 / count;
                  return renderEvent(ev, { top, height, left: `calc(${lane * w}% + 3px)`, width: `calc(${w}% - 6px)` });
                })}
                {nowTop >= 0 && nowTop <= totalH && <div className="pro-cal-now" style={{ top: nowTop }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const monthGrid = (
    <div>
      <div className="grid grid-cols-7 text-center text-[12px] font-semibold pro-ink-2 mb-1">
        {weekDays.map(d => <div key={d.toISOString()}>{cap(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).replace('.', ''))}</div>)}
      </div>
      <div className="pro-month">
        {days.map(d => {
          const evs = visible.filter(e => isSameDay(e.start, d)).sort((a, b) => a.start.getTime() - b.start.getTime());
          const hours = showHours ? hoursByDay.get(dayKey(d)) || [] : [];
          const maxEvents = hours.length ? 2 : 3;
          return (
            <div key={d.toISOString()} className={`pro-month-cell ${isSameMonth(d, cursor) ? '' : 'is-out'} ${isToday(d) ? 'is-today' : ''}`} onClick={() => { setCursor(d); setView('day'); }}>
              <span className="d">{d.getDate()}</span>
              {hours.length > 0 && (
                <span className="pro-month-ev" style={{ borderLeftColor: HOURS_COLOR, background: '#eef4fd' }} title={t('mm2.agenda.hoursLegend')}>
                  <Clock className="inline w-3 h-3 -mt-0.5 mr-0.5" />{hours.map(h => `${h.start}–${h.end}`).join(', ')}
                </span>
              )}
              {evs.slice(0, maxEvents).map(e => (
                <span key={e.id} className="pro-month-ev" style={{ borderLeftColor: kindColor(e.kind, e.status), background: e.kind === 'blocked' ? '#eef2f5' : e.kind === 'live' ? '#fde8e8' : e.kind === 'appointment' ? (e.status === 'requested' ? '#fff4d9' : '#dff6ea') : '#e3eefc' }}>
                  {fmtTime(e.start, language)} {e.kind === 'appointment' ? patientLabel(e) : kindLabel(e)}
                </span>
              ))}
              {evs.length > maxEvents && <span className="pro-month-ev" style={{ borderLeftColor: 'transparent', color: 'var(--pro-muted)' }}>{fill(t('pro.agenda.more'), { n: evs.length - maxEvents })}</span>}
              <span className="pro-month-dots">{evs.slice(0, 4).map(e => <i key={e.id} style={{ background: kindColor(e.kind, e.status) }} />)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const railButton = (key: Rail, label: string, Icon: React.ElementType) => (
    <button key={key} type="button" className={`pro-rail-tab ${rail === key ? 'is-active' : ''}`} onClick={() => setRail(key)}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  const railBody = (() => {
    if (rail === 'today') {
      return todayEvents.length === 0 ? (
        <p className="pro-muted text-sm">{t('pro.agenda.nothingToday')}</p>
      ) : (
        <div>
          {todayEvents.map(e => (
            <button key={e.id} type="button" className="pro-row w-full text-left" onClick={() => { setRail(null); setSelected(e); }}>
              <span className="pro-row-time">{fmtTime(e.start, language)}</span>
              <span className="min-w-0 flex-1">
                <span className="pro-row-name block truncate">{patientLabel(e)}</span>
                <span className="pro-row-sub block truncate">{kindLabel(e)}</span>
              </span>
              <i className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: kindColor(e.kind, e.status) }} />
            </button>
          ))}
        </div>
      );
    }
    if (rail === 'summary') {
      return (
        <div className="space-y-2">
          <p className="pro-muted text-xs">{rangeLabel()}</p>
          {[
            [t('pro.agenda.summaryConsultations'), summary.consultations, '#1f9d5a'],
            [t('pro.agenda.summaryLives'), summary.lives, '#e5322d'],
            [t('pro.agenda.summaryAvailableHours'), summary.availableHours, HOURS_COLOR],
            [t('pro.agenda.summaryBlocks'), summary.blocks, '#b8c4cf'],
          ].map(([label, val, color]) => (
            <div key={String(label)} className="pro-row">
              <i className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: String(color) }} />
              <span className="flex-1 text-sm pro-ink-2">{label}</span>
              <b className="pro-ink text-base">{val}</b>
            </div>
          ))}
        </div>
      );
    }
    if (rail === 'nextLive') {
      return nextLive ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="pro-icon-box" style={{ background: '#fde8e8' }}><Radio style={{ color: 'var(--pro-live)' }} /></span>
            <div className="min-w-0">
              <div className="pro-row-name">{nextLive.title}</div>
              <div className="pro-row-sub">{whenLabel(nextLive.start, language, t)} · {nextLive.durationMinutes} {t('pro.common.min')}</div>
            </div>
          </div>
          {nextLive.subtitle && <p className="text-sm pro-ink-2">{nextLive.subtitle}</p>}
          <button type="button" className="pro-btn pro-btn-teal w-full" onClick={() => { setRail(null); changeTab('disponibilidad'); }}>{t('pro.agenda.manage')} <ArrowRight /></button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="pro-muted text-sm">{t('pro.agenda.noLive')}</p>
          <button
            type="button"
            className="pro-btn pro-btn-teal w-full"
            onClick={() => {
              setRail(null);
              setParams(prev => { const p = new URLSearchParams(prev); p.set('tab', 'disponibilidad'); p.set('nueva', 'live'); return p; }, { replace: true });
            }}
          >
            <Plus /> {t('pro.agenda.schedule')}
          </button>
        </div>
      );
    }
    return null;
  })();

  const railTitle = rail === 'today' ? t('pro.agenda.railToday') : rail === 'summary' ? t('pro.agenda.railSummary') : t('pro.agenda.railNextLive');

  const tabItems = (DOCTOR_SECTION_BY_ID.agenda.tabs || []).map(tb => ({
    id: tb.id as AgendaTab,
    label: t(tb.labelKey),
    icon: tb.icon,
    badge: tb.id === 'consultas' ? pendingRequests : undefined,
  }));

  const tabLoader = (
    <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>
  );

  // Guard de rol al final: todos los hooks ya se ejecutaron.
  if (role && role !== 'doctor') return <Navigate to="/lives" replace />;

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><CalendarIcon className="w-7 h-7" /> <span className="truncate">{t('mm2.agenda.title')}</span></h1>
            <p className="pro-page-sub">{t('mm2.agenda.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button type="button" className="pro-btn pro-btn-ghost flex-1 sm:flex-none" onClick={() => openBlockDialog()}><Ban /> {t('pro.agenda.block')}</button>
            <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none" onClick={() => openNewConsultation()}><Plus /> {t('mm2.agenda.newConsultation')}</button>
          </div>
        </div>

        <SectionTabs value={tab} onChange={changeTab} items={tabItems} ariaLabel={t('mm2.agenda.tabsLabel')} className="mb-4" />

        {tab === 'calendario' && (
          <div className="flex gap-3 items-start">
            <section className="pro-card pro-card-pad bg-card min-w-0 flex-1">
              {/* Barra de herramientas */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setCursor(new Date())}>{t('pro.agenda.today')}</button>
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" onClick={() => go(-1)} aria-label={t('pro.agenda.prev')}><ChevronLeft /></button>
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" onClick={() => go(1)} aria-label={t('pro.agenda.next')}><ChevronRight /></button>
                </div>
                <h2 className="font-heading font-extrabold text-base sm:text-lg pro-ink min-w-0 flex-1 truncate">{rangeLabel()}</h2>
                <div className="pro-seg">
                  {([['all', t('pro.agenda.all')], ['consultations', t('pro.agenda.consultations')], ['lives', t('pro.agenda.lives')], ['availability', t('pro.agenda.availability')]] as [Filter, string][]).map(([k, l]) => (
                    <button key={k} type="button" className={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>{l}</button>
                  ))}
                </div>
                <div className="pro-seg">
                  {([['month', t('pro.agenda.month')], ['week', t('pro.agenda.week')], ['day', t('pro.agenda.day')]] as [View, string][]).map(([k, l]) => (
                    <button key={k} type="button" className={view === k ? 'is-active' : ''} onClick={() => setView(k)}>{l}</button>
                  ))}
                </div>
              </div>

              {view === 'day' && (
                <div className="pro-daystrip mb-3">
                  {weekDays.map(d => {
                    const has = events.some(e => isSameDay(e.start, d) && passesFilter(e));
                    return (
                      <button key={d.toISOString()} type="button" className={isSameDay(d, cursor) ? 'is-active' : ''} onClick={() => setCursor(d)}>
                        <span>{cap(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).replace('.', ''))}</span>
                        <b>{d.getDate()}</b>
                        {has ? <i /> : <i style={{ background: 'transparent' }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="mb-3 p-3 rounded-xl bg-[#fdecec] text-sm" style={{ color: 'var(--pro-live)' }}>
                  {t('pro.common.error')} <button type="button" className="underline font-semibold ml-1" onClick={refresh}>{t('pro.common.retry')}</button>
                </div>
              )}

              {loading && events.length === 0 ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>
              ) : view === 'month' ? monthGrid : view === 'week' ? (
                <div className="overflow-x-auto -mx-1 px-1">
                  <div style={{ minWidth: isMobile ? 640 : undefined }}>{timeGrid(days)}</div>
                </div>
              ) : (
                timeGrid([cursor])
              )}

              {/* Leyenda + zona horaria */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--pro-line)' }}>
                <div className="pro-legend">
                  <span><i style={{ background: '#1f9d5a' }} />{t('pro.agenda.legendConsultation')}</span>
                  <span><i style={{ background: HOURS_COLOR }} />{t('mm2.agenda.hoursLegend')}</span>
                  <span><i style={{ background: '#e5322d' }} />{t('pro.agenda.legendLive')}</span>
                  <span><i style={{ background: '#b8c4cf' }} />{t('pro.agenda.legendUnavailable')}</span>
                </div>
                <span className="text-xs pro-muted">{t('pro.common.timezone')}: {tzLabel()}</span>
              </div>

              {/* Accesos del carril en móvil/tablet */}
              <div className="flex gap-2 mt-3 lg:hidden">
                {([['today', t('pro.agenda.railToday'), Sun], ['summary', t('pro.agenda.railSummary'), ListChecks], ['nextLive', t('pro.agenda.railNextLive'), Radio]] as [Rail, string, React.ElementType][]).map(([k, l, Icon]) => (
                  <button key={k} type="button" className="pro-btn pro-btn-outline pro-btn-sm flex-1 min-w-0 overflow-hidden px-2" onClick={() => setRail(k)}><Icon /> <span className="truncate">{l}</span></button>
                ))}
              </div>
            </section>

            {/* Carril lateral (escritorio) */}
            <aside className="hidden lg:flex flex-col gap-2 pro-rail-tabs sticky top-24 shrink-0">
              {railButton('today', t('pro.agenda.railToday'), Sun)}
              {railButton('summary', t('pro.agenda.railSummary'), ListChecks)}
              {railButton('nextLive', t('pro.agenda.railNextLive'), Radio)}
            </aside>
          </div>
        )}

        {tab === 'consultas' && (
          <Suspense fallback={tabLoader}>
            <DoctorConsultations key={consultsKey} embedded />
          </Suspense>
        )}

        {tab === 'disponibilidad' && (
          <div className="space-y-4">
            <ScheduleEditor onSaved={reloadSchedule} onDirtyChange={setScheduleDirty} />

            <section className="pro-card pro-card-pad bg-card">
              <div className="pro-card-head flex-wrap gap-2">
                <h2 className="pro-card-title"><Ban /> <span>{t('mm2.agenda.blocks.title')}</span></h2>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openBlockDialog()}><Ban /> {t('pro.agenda.block')}</button>
              </div>
              <p className="text-sm text-slate-600 mb-3">{t('mm2.agenda.blocks.hint')}</p>
              {upcomingBlocks.length === 0 ? (
                <p className="text-sm text-slate-500">{t('mm2.agenda.blocks.empty')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingBlocks.map(b => (
                    <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d6e1e7] bg-white px-3 py-2">
                      <span className="text-sm font-semibold text-slate-900">{fmtDayLong(b.start, language)}</span>
                      <span className="text-sm text-slate-700">
                        {b.durationMinutes >= 24 * 60 ? t('mm2.agenda.blocks.allDay') : `${fmtTime(b.start, language)} – ${fmtTime(b.end, language)}`}
                      </span>
                      {b.title && <span className="text-sm text-slate-500 truncate">· {b.title}</span>}
                      <button type="button" className="pro-btn pro-btn-outline pro-btn-xs ml-auto" disabled={saving} onClick={() => unblock(b)}>
                        <Trash2 /> {t('mm2.agenda.blocks.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pro-card pro-card-pad bg-card">
              <p className="text-sm text-slate-600 mb-3">{t('mm2.agenda.liveHint')}</p>
              <Suspense fallback={tabLoader}>
                <DoctorAvailabilityPage embedded />
              </Suspense>
            </section>
          </div>
        )}

        {tab === 'reuniones' && (
          <section className="pro-card pro-card-pad bg-card">
            <div className="pro-card-head">
              <h2 className="pro-card-title"><Users /> <span>{t('mm2.agenda.meetingsTitle')}</span></h2>
            </div>
            <p className="text-sm text-slate-600 mb-3">{t('mm2.agenda.meetingsHint')}</p>
            <Suspense fallback={tabLoader}>
              <Meetings embedded />
            </Suspense>
          </section>
        )}
      </div>

      {/* Panel del carril */}
      <Sheet open={rail !== null} onOpenChange={(o) => { if (!o) setRail(null); }}>
        <SheetContent side="right" className="w-[min(92vw,380px)] sm:max-w-[380px] overflow-y-auto">
          <SheetHeader className="mb-4"><SheetTitle className="pro-card-title">{railTitle}</SheetTitle></SheetHeader>
          {railBody}
        </SheetContent>
      </Sheet>

      {/* Detalle de evento */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.kind === 'appointment' && (
                    <span className="pro-initials w-9 h-9">{selected.patientAvatar ? <img src={selected.patientAvatar} alt="" /> : initialsOf(patientLabel(selected))}</span>
                  )}
                  {selected.kind === 'live' && <Radio className="w-5 h-5" style={{ color: 'var(--pro-live)' }} />}
                  {selected.kind === 'blocked' && <Ban className="w-5 h-5 pro-muted" />}
                  {(selected.kind === 'office_hours' || selected.kind === 'consultation') && <Clock className="w-5 h-5" style={{ color: '#2f6fdb' }} />}
                  <span className="truncate">{patientLabel(selected)}</span>
                </DialogTitle>
                <DialogDescription>{fmtDayLong(selected.start, language)} · {fmtTime(selected.start, language)} – {fmtTime(selected.end, language)} · {selected.durationMinutes} {t('pro.common.min')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('pro.agenda.type')}</span><b>{kindLabel(selected)}</b></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('pro.agenda.status')}</span><b>{statusLabel(selected)}</b></div>
                {selected.kind === 'appointment' && selected.reason && (
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('pro.agenda.reason')}</span><span className="text-right">{selected.reason}</span></div>
                )}
                {selected.subtitle && selected.kind !== 'appointment' && <p className="text-muted-foreground">{selected.subtitle}</p>}
              </div>
              <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row sm:flex-wrap">
                {selected.kind === 'appointment' && canEnter(selected) && (
                  <button type="button" className="pro-btn pro-btn-teal" onClick={() => window.open(selected.roomUrl!, '_blank')}><Video /> {t('pro.agenda.enter')}</button>
                )}
                {selected.kind === 'appointment' && (
                  <>
                    <button type="button" className="pro-btn pro-btn-outline" onClick={() => { setSelected(null); changeTab('consultas'); }}>{t('mm2.agenda.viewInConsultations')}</button>
                    {selected.patientId && (
                      <button type="button" className="pro-btn pro-btn-outline" onClick={() => navigate(doctorPatientHref(selected.patientId!, 'resumen'))}><User /> {t('mm2.agenda.viewRecord')}</button>
                    )}
                    <button type="button" className="pro-btn pro-btn-outline" onClick={() => navigate('/chat')}><MessageSquare /> {t('pro.dashboard.openChat')}</button>
                  </>
                )}
                {selected.kind === 'blocked' && (
                  <button type="button" className="pro-btn pro-btn-outline" disabled={saving} onClick={() => unblock(selected)}>
                    {saving ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('pro.agenda.unblock')}
                  </button>
                )}
                {(selected.kind === 'live' || selected.kind === 'office_hours' || selected.kind === 'consultation') && (
                  <button type="button" className="pro-btn pro-btn-teal" onClick={() => { setSelected(null); changeTab('disponibilidad'); }}>{t('pro.agenda.openAvailability')} <ArrowRight /></button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hueco libre: nueva consulta o bloquear */}
      <Dialog open={!!slot} onOpenChange={(o) => { if (!o) setSlot(null); }}>
        <DialogContent className="sm:max-w-sm">
          {slot && (
            <>
              <DialogHeader>
                <DialogTitle>{t('pro.agenda.slotTitle')}</DialogTitle>
                <DialogDescription>{fill(t('pro.agenda.slotDesc'), { date: fmtDayLong(slot, language), time: fmtTime(slot, language) })}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <button type="button" className="pro-btn pro-btn-teal w-full" onClick={() => { const d = slot; setSlot(null); openNewConsultation({ date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }); }}>
                  <Plus /> {t('pro.agenda.slotConsultation')}
                </button>
                <button type="button" className="pro-btn pro-btn-outline w-full" onClick={() => { const d = slot; setSlot(null); openBlockDialog(d); }}>
                  <Ban /> {t('pro.agenda.slotBlock')}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bloquear horario */}
      <Dialog open={block.open} onOpenChange={(o) => setBlock(b => ({ ...b, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="w-5 h-5" /> {t('pro.agenda.blockTitle')}</DialogTitle>
            <DialogDescription>{t('pro.agenda.blockDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="block-date">{t('pro.agenda.date')}</Label>
                <Input id="block-date" type="date" value={block.date} onChange={e => setBlock(b => ({ ...b, date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="block-time">{t('pro.agenda.from')}</Label>
                <Input id="block-time" type="time" value={block.time} disabled={block.allDay} onChange={e => setBlock(b => ({ ...b, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-duration">{t('pro.agenda.duration')}</Label>
              <select
                id="block-duration"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={block.allDay ? 'all' : String(block.duration)}
                onChange={e => setBlock(b => e.target.value === 'all' ? { ...b, allDay: true } : { ...b, allDay: false, duration: Number(e.target.value) })}
              >
                {[30, 60, 90, 120, 180, 240, 360, 480].map(m => (
                  <option key={m} value={m}>{durationLabel(m)}</option>
                ))}
                <option value="all">{t('pro.agenda.allDay')}</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-title">{t('pro.agenda.blockReason')}</Label>
              <Input id="block-title" value={block.title} placeholder={t('pro.agenda.blockReasonPlaceholder')} onChange={e => setBlock(b => ({ ...b, title: e.target.value }))} maxLength={80} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="pro-btn pro-btn-outline" onClick={() => setBlock(b => ({ ...b, open: false }))}>{t('pro.common.cancel')}</button>
            <button type="button" className="pro-btn pro-btn-teal" disabled={saving} onClick={saveBlock}>
              {saving ? <Loader2 className="animate-spin" /> : <Ban />} {t('pro.agenda.block')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva consulta: su propio flujo, nada se guarda sin la revisión final */}
      <NewConsultationDialog
        open={newConsult.open}
        onOpenChange={(o) => { setNewConsult(s => (o ? { ...s, open: true } : { open: false })); if (!o) clearNuevaParams(); }}
        defaultPatientId={newConsult.patientId}
        defaultDate={newConsult.date}
        defaultTime={newConsult.time}
        onCreated={() => { setNewConsult({ open: false }); clearNuevaParams(); refresh(); setConsultsKey(k => k + 1); }}
      />
      {dialog}
    </MainLayout>
  );
}
