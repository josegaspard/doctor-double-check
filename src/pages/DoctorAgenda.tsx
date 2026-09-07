import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay,
  addDays, addWeeks, addMonths, eachDayOfInterval, isSameDay, isToday, isSameMonth, format,
} from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDoctorAgenda, AgendaEvent, AgendaKind } from '@/hooks/useDoctorAgenda';
import MainLayout from '@/components/layout/MainLayout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings2, Ban, Plus, Radio, Video,
  Clock, MessageSquare, Loader2, Trash2, ArrowRight, ListChecks, Sun,
} from 'lucide-react';
import { fill, cap, fmtTime, fmtDayLong, whenLabel, tzLabel, initialsOf } from '@/lib/proFormat';
import { getIntlLocale } from '@/lib/dateLocale';

type View = 'month' | 'week' | 'day';
type Filter = 'all' | 'consultations' | 'lives' | 'availability';
type Rail = 'today' | 'summary' | 'nextLive';

const HOUR_START = 7;
const HOUR_END = 21; // exclusivo: la última fila es 20:00–21:00
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const WEEK = { weekStartsOn: 1 as const };

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
  : '#7fa7e3';

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

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    if (view === 'month') return { start: startOfWeek(startOfMonth(cursor), WEEK), end: endOfWeek(endOfMonth(cursor), WEEK) };
    if (view === 'week') return { start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) };
    return { start: startOfDay(cursor), end: endOfDay(cursor) };
  }, [view, cursor]);

  // Se consulta un poco más de lo visible para que "Hoy" y "Próximo Live" tengan datos.
  const fetchStart = useMemo(() => {
    const today = startOfDay(new Date());
    return range.start < today ? range.start : today;
  }, [range.start]);
  const fetchEnd = useMemo(() => {
    const far = endOfDay(addDays(new Date(), 90));
    return range.end > far ? range.end : far;
  }, [range.end]);

  const { events, loading, error, refresh, createBlock, removeBlock } = useDoctorAgenda(fetchStart, fetchEnd);

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

  if (role !== 'doctor') return <Navigate to="/lives" replace />;

  const HOUR_PX = isMobile ? 52 : 56;
  const totalH = HOURS.length * HOUR_PX;

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
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
    setSlot(d);
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
    setSaving(true);
    try {
      const start = block.allDay ? new Date(`${block.date}T00:00:00`) : new Date(`${block.date}T${block.time}:00`);
      if (isNaN(start.getTime())) throw new Error('invalid date');
      const res = await createBlock({ start, durationMinutes: block.allDay ? 24 * 60 : block.duration, title: block.title });
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
    const availableMin = visible.filter(e => e.kind === 'office_hours' || e.kind === 'consultation').reduce((s, e) => s + e.durationMinutes, 0);
    const blocks = visible.filter(e => e.kind === 'blocked').length;
    return { consultations, lives, availableHours: Math.round((availableMin / 60) * 10) / 10, blocks };
  })();

  const renderEvent = (e: AgendaEvent, style: React.CSSProperties) => (
    <button
      key={e.id}
      type="button"
      className={`pro-cal-ev ${kindClass(e)}`}
      style={style}
      onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
      title={`${fmtTime(e.start, language)} · ${e.title}`}
    >
      <b>{fmtTime(e.start, language)}{e.durationMinutes >= 60 ? ` – ${fmtTime(e.end, language)}` : ''}</b>
      <span>{e.kind === 'appointment' ? `${e.title} · ${kindLabel(e)}` : e.kind === 'blocked' ? (e.title || t('pro.agenda.unavailable')) : e.kind === 'live' ? `LIVE · ${e.title}` : `${kindLabel(e)}${e.title ? ` · ${e.title}` : ''}`}</span>
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
          return (
            <div key={d.toISOString()} className={`pro-month-cell ${isSameMonth(d, cursor) ? '' : 'is-out'} ${isToday(d) ? 'is-today' : ''}`} onClick={() => { setCursor(d); setView('day'); }}>
              <span className="d">{d.getDate()}</span>
              {evs.slice(0, 3).map(e => (
                <span key={e.id} className="pro-month-ev" style={{ borderLeftColor: kindColor(e.kind, e.status), background: e.kind === 'blocked' ? '#eef2f5' : e.kind === 'live' ? '#fde8e8' : e.kind === 'appointment' ? (e.status === 'requested' ? '#fff4d9' : '#dff6ea') : '#e3eefc' }}>
                  {fmtTime(e.start, language)} {e.kind === 'appointment' ? e.title : kindLabel(e)}
                </span>
              ))}
              {evs.length > 3 && <span className="pro-month-ev" style={{ borderLeftColor: 'transparent', color: 'var(--pro-muted)' }}>{fill(t('pro.agenda.more'), { n: evs.length - 3 })}</span>}
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
                <span className="pro-row-name block truncate">{e.title}</span>
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
            [t('pro.agenda.summaryAvailableHours'), summary.availableHours, '#7fa7e3'],
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
          <Link to="/doctor/availability" className="pro-btn pro-btn-teal w-full">{t('pro.agenda.manage')} <ArrowRight /></Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="pro-muted text-sm">{t('pro.agenda.noLive')}</p>
          <button type="button" className="pro-btn pro-btn-teal w-full" onClick={() => navigate('/doctor/availability?nueva=live')}><Plus /> {t('pro.agenda.schedule')}</button>
        </div>
      );
    }
    return null;
  })();

  const railTitle = rail === 'today' ? t('pro.agenda.railToday') : rail === 'summary' ? t('pro.agenda.railSummary') : t('pro.agenda.railNextLive');

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><CalendarIcon className="w-7 h-7" /> <span className="truncate">{t('pro.agenda.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.agenda.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link to="/doctor/availability" className="pro-btn pro-btn-ghost flex-1 sm:flex-none"><Settings2 /> {t('pro.agenda.configure')}</Link>
            <button type="button" className="pro-btn pro-btn-ghost flex-1 sm:flex-none" onClick={() => openBlockDialog()}><Ban /> {t('pro.agenda.block')}</button>
            <button type="button" className="pro-btn pro-btn-white flex-1 sm:flex-none" onClick={() => navigate('/doctor/availability?nueva=consulta')}><Plus /> {t('pro.agenda.newConsultation')}</button>
          </div>
        </div>

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
                <span><i style={{ background: '#7fa7e3' }} />{t('pro.agenda.legendAvailable')}</span>
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
                    <span className="pro-initials w-9 h-9">{selected.patientAvatar ? <img src={selected.patientAvatar} alt="" /> : initialsOf(selected.patientName)}</span>
                  )}
                  {selected.kind === 'live' && <Radio className="w-5 h-5" style={{ color: 'var(--pro-live)' }} />}
                  {selected.kind === 'blocked' && <Ban className="w-5 h-5 pro-muted" />}
                  {(selected.kind === 'office_hours' || selected.kind === 'consultation') && <Clock className="w-5 h-5" style={{ color: '#2f6fdb' }} />}
                  <span className="truncate">{selected.title}</span>
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
              <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
                {selected.kind === 'appointment' && canEnter(selected) && (
                  <button type="button" className="pro-btn pro-btn-teal" onClick={() => window.open(selected.roomUrl!, '_blank')}><Video /> {t('pro.agenda.enter')}</button>
                )}
                {selected.kind === 'appointment' && (
                  <>
                    <Link to="/my-appointments" className="pro-btn pro-btn-outline">{t('pro.agenda.openConsultations')}</Link>
                    <Link to="/chat" className="pro-btn pro-btn-outline"><MessageSquare /> {t('pro.dashboard.openChat')}</Link>
                  </>
                )}
                {selected.kind === 'blocked' && (
                  <button type="button" className="pro-btn pro-btn-outline" disabled={saving} onClick={() => unblock(selected)}>
                    {saving ? <Loader2 className="animate-spin" /> : <Trash2 />} {t('pro.agenda.unblock')}
                  </button>
                )}
                {(selected.kind === 'live' || selected.kind === 'office_hours' || selected.kind === 'consultation') && (
                  <Link to="/doctor/availability" className="pro-btn pro-btn-teal">{t('pro.agenda.openAvailability')} <ArrowRight /></Link>
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
                <button type="button" className="pro-btn pro-btn-teal w-full" onClick={() => { const d = slot; setSlot(null); navigate(`/doctor/availability?nueva=consulta&fecha=${format(d, 'yyyy-MM-dd')}&hora=${format(d, 'HH:mm')}`); }}>
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
                  <option key={m} value={m}>{m < 60 ? `${m} ${t('pro.common.min')}` : `${m / 60} ${t('pro.common.hours')}`}</option>
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
    </MainLayout>
  );
}
