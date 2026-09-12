// Editor del horario de atención del médico (Agenda › Disponibilidad), 11-sep-2026.
//
// Lo que pidió la clienta: cada día de la semana con SUS tramos (lunes 9-13 y 16-19,
// martes 10-14…) y días sueltos del mes con un horario que solo vale ese día.
// Nada se guarda hasta pulsar «Guardar horario» y confirmar el resumen.
//
// Fuente: useDoctorScheduleRanges (tabla doctor_schedule_ranges). Mientras la
// migración no esté aplicada se ve el horario antiguo (office_days + una franja) y
// solo se guarda lo que ese formato admite: la misma franja en todos los días y un
// tramo por día. Lo demás lo dice en pantalla en vez de fingir que guarda.
import React, { useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek, addMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Loader2, Pencil, Plus, RotateCcw, Save, Trash2, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import {
  useDoctorScheduleRanges, resolveEffectiveRanges, ScheduleRange, WEEKDAY_KEYS,
} from '@/hooks/useDoctorScheduleRanges';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill } from '@/lib/proFormat';

type Draft = ScheduleRange & { _key: string };
type Tramo = { _key: string; start_time: string; end_time: string };

let seq = 0;
const newKey = () => `r${++seq}`;
const hhmm = (s: string) => (s || '').slice(0, 5);
const toMin = (s: string) => {
  const [h, m] = hhmm(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const DEFAULT_TRAMO = { start_time: '09:00', end_time: '14:00' };
// Un día suelto «sin atención» se guarda como un tramo inactivo (la base exige fin > inicio).
const CLOSED_TRAMO = { start_time: '00:00', end_time: '23:59' };
const WORKWEEK = [1, 2, 3, 4, 5];

const byStart = <T extends { start_time: string }>(list: T[]) =>
  [...list].sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time)));

/** Error de un grupo de tramos (un día de la semana o una fecha). */
function groupError(list: { start_time: string; end_time: string; is_active?: boolean }[]): 'order' | 'overlap' | null {
  const active = byStart(list.filter(r => r.is_active !== false));
  if (active.some(r => toMin(r.end_time) <= toMin(r.start_time))) return 'order';
  for (let i = 1; i < active.length; i++) {
    if (toMin(active[i].start_time) < toMin(active[i - 1].end_time)) return 'overlap';
  }
  return null;
}

const rowSig = (r: ScheduleRange) =>
  `${r.weekday ?? ''}|${r.specific_date ?? ''}|${hhmm(r.start_time)}|${hhmm(r.end_time)}|${r.is_active ? 1 : 0}`;
const listSig = (list: ScheduleRange[]) => list.map(rowSig).sort().join(';');
const tramosLabel = (list: { start_time: string; end_time: string }[]) =>
  byStart(list).map(r => `${hhmm(r.start_time)}–${hhmm(r.end_time)}`).join(', ');

const timeInput =
  'h-9 w-[92px] rounded-lg border border-[#d6e1e7] bg-white px-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

function TramoInputs({
  start, end, onChange, onRemove, invalid, disabled, removeLabel, fromLabel, toLabel,
}: {
  start: string; end: string; onChange: (patch: { start_time?: string; end_time?: string }) => void;
  onRemove: () => void; invalid: boolean; disabled?: boolean; removeLabel: string; fromLabel: string; toLabel: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${invalid ? 'bg-red-50 ring-1 ring-red-300' : 'bg-[#f3f6fa]'}`}>
      <Clock className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
      <input type="time" step={900} value={hhmm(start)} aria-label={fromLabel} disabled={disabled}
        onChange={e => onChange({ start_time: e.target.value })} className={timeInput} />
      <span className="text-slate-500">–</span>
      <input type="time" step={900} value={hhmm(end)} aria-label={toLabel} disabled={disabled}
        onChange={e => onChange({ end_time: e.target.value })} className={timeInput} />
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={removeLabel} title={removeLabel}
        className="ml-auto inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ScheduleEditor({
  onSaved,
  onDirtyChange,
}: {
  onSaved?: () => void;
  /** Avisa a la Agenda de que hay cambios sin guardar (para no perderlos al cambiar de pestaña). */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const { ranges, loading, saving, error, pendingActivation, reload, saveAll } = useDoctorScheduleRanges();
  const { confirm, dialog } = useConfirmAction();

  const [draft, setDraft] = useState<Draft[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateTramos, setDateTramos] = useState<Tramo[]>([{ _key: newKey(), ...DEFAULT_TRAMO }]);
  const [dateClosed, setDateClosed] = useState(false);
  const [previewMonth, setPreviewMonth] = useState(() => startOfMonth(new Date()));
  const [legacySaving, setLegacySaving] = useState(false);

  // El borrador arranca con lo guardado y se rehace cada vez que la base cambia.
  useEffect(() => {
    setDraft(ranges.map(r => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time), _key: r.id || newKey() })));
  }, [ranges]);

  const dirty = useMemo(() => listSig(draft) !== listSig(ranges), [draft, ranges]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const todayKey = fmt.toDateKey(new Date());
  const weekday = (w: number) => byStart(draft.filter(r => r.weekday === w));
  const dateGroups = useMemo(() => {
    const map = new Map<string, Draft[]>();
    draft.filter(r => r.specific_date).forEach(r => map.set(r.specific_date!, [...(map.get(r.specific_date!) || []), r]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [draft]);
  const upcomingDates = dateGroups.filter(([k]) => k >= todayKey);

  const weekdayErrors = useMemo(() => {
    const out = new Map<number, 'order' | 'overlap'>();
    for (let w = 0; w < 7; w++) {
      const err = groupError(draft.filter(r => r.weekday === w));
      if (err) out.set(w, err);
    }
    return out;
  }, [draft]);
  const dateErrors = useMemo(() => {
    const out = new Map<string, 'order' | 'overlap'>();
    dateGroups.forEach(([k, rows]) => { const err = groupError(rows); if (err) out.set(k, err); });
    return out;
  }, [dateGroups]);
  const hasErrors = weekdayErrors.size > 0 || dateErrors.size > 0;
  const tramosError = dateClosed ? null : groupError(dateTramos);

  // Lo que el formato antiguo (sin la migración) sabe guardar.
  const legacyPayload = useMemo(() => {
    if (draft.some(r => r.specific_date || !r.is_active)) return null;
    const perDay = new Map<number, number>();
    draft.forEach(r => perDay.set(r.weekday!, (perDay.get(r.weekday!) || 0) + 1));
    if ([...perDay.values()].some(n => n > 1)) return null;
    const franjas = new Set(draft.map(r => `${hhmm(r.start_time)}-${hhmm(r.end_time)}`));
    if (franjas.size > 1) return null;
    const [start, end] = franjas.size ? [...franjas][0].split('-') : ['08:00', '20:00'];
    return {
      office_days: WEEKDAY_KEYS.filter((_, i) => perDay.has(i)),
      office_hours_start: `${start}:00`,
      office_hours_end: `${end}:00`,
    };
  }, [draft]);

  // ------------------------------------------------------------ semana
  const patch = (key: string, p: Partial<ScheduleRange>) =>
    setDraft(d => d.map(r => (r._key === key ? { ...r, ...p } : r)));
  const removeRow = (key: string) => setDraft(d => d.filter(r => r._key !== key));

  const addWeekdayTramo = (w: number) =>
    setDraft(d => {
      const own = byStart(d.filter(r => r.weekday === w));
      const last = own[own.length - 1];
      let start = DEFAULT_TRAMO.start_time;
      let end = DEFAULT_TRAMO.end_time;
      if (last) {
        // El tramo nuevo nace una hora después del último para no solaparse.
        const s = Math.min(toMin(last.end_time) + 60, 22 * 60);
        start = fromMin(s);
        end = fromMin(Math.min(s + 180, 23 * 60 + 45));
      }
      return [...d, { _key: newKey(), weekday: w, specific_date: null, start_time: start, end_time: end, is_active: true }];
    });

  const toggleWeekday = (w: number, on: boolean) => {
    if (on) addWeekdayTramo(w);
    else setDraft(d => d.filter(r => r.weekday !== w));
  };

  const copyWeekday = (from: number, targets: number[]) => {
    const list = targets.filter(w => w !== from);
    setDraft(d => {
      const source = d.filter(r => r.weekday === from);
      const rest = d.filter(r => r.weekday === null || !list.includes(r.weekday));
      const copies = list.flatMap(w => source.map(r => ({ ...r, id: undefined, _key: newKey(), weekday: w })));
      return [...rest, ...copies];
    });
    toast.success(t('mm2.schedule.copied'));
  };

  // ------------------------------------------------------ días sueltos
  const specialKeys = new Set(dateGroups.map(([k]) => k));
  const closedKeys = new Set(dateGroups.filter(([, rows]) => !rows.some(r => r.is_active)).map(([k]) => k));

  const applyToDates = () => {
    if (!selectedDates.length || tramosError) return;
    const keys = selectedDates.map(d => fmt.toDateKey(d));
    const rows: Draft[] = keys.flatMap((k): Draft[] =>
      dateClosed
        ? [{ _key: newKey(), weekday: null, specific_date: k, ...CLOSED_TRAMO, is_active: false }]
        : dateTramos.map(tr => ({
          _key: newKey(), weekday: null, specific_date: k, start_time: tr.start_time, end_time: tr.end_time, is_active: true,
        })),
    );
    setDraft(d => [...d.filter(r => !r.specific_date || !keys.includes(r.specific_date)), ...rows]);
    toast.success(fill(t(keys.length === 1 ? 'mm2.schedule.appliedOne' : 'mm2.schedule.applied'), { n: keys.length }));
    setSelectedDates([]);
  };

  const editDate = (key: string) => {
    const rows = draft.filter(r => r.specific_date === key);
    const active = byStart(rows.filter(r => r.is_active));
    setSelectedDates([fmt.parseDateKey(key)]);
    setDateClosed(active.length === 0);
    setDateTramos(active.length
      ? active.map(r => ({ _key: newKey(), start_time: r.start_time, end_time: r.end_time }))
      : [{ _key: newKey(), ...DEFAULT_TRAMO }]);
    document.getElementById('mm-schedule-dates')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeDate = (key: string) => setDraft(d => d.filter(r => r.specific_date !== key));

  // ----------------------------------------------------------- vista previa
  const previewDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(previewMonth, { weekStartsOn: fmt.weekStartsOn }),
    end: endOfWeek(endOfMonth(previewMonth), { weekStartsOn: fmt.weekStartsOn }),
  }), [previewMonth, fmt.weekStartsOn]);
  const previewByDay = useMemo(() => {
    const map = new Map<string, { start_time: string; end_time: string; source: string }[]>();
    resolveEffectiveRanges(draft, previewDays[0], previewDays[previewDays.length - 1])
      .forEach(r => map.set(r.day, [...(map.get(r.day) || []), r]));
    return map;
  }, [draft, previewDays]);

  // -------------------------------------------------------------- guardar
  const errorText = (err: 'order' | 'overlap') => t(err === 'order' ? 'mm2.schedule.errors.order' : 'mm2.schedule.errors.overlap');

  const summary = () => {
    const week = fmt.weekdayOrder
      .map(w => {
        const list = draft.filter(r => r.weekday === w && r.is_active);
        return list.length ? `${fmt.formatWeekday(w, 'short')} ${tramosLabel(list)}` : null;
      })
      .filter(Boolean) as string[];
    const dates = upcomingDates.map(([k, rows]) => {
      const active = rows.filter(r => r.is_active);
      return `${fmt.formatDate(fmt.parseDateKey(k), 'd MMM').replace('.', '')}: ${active.length ? tramosLabel(active) : t('mm2.schedule.closed')}`;
    });
    const before = new Set(ranges.map(rowSig));
    const after = new Set(draft.map(rowSig));
    const added = [...after].filter(x => !before.has(x)).length;
    const removed = [...before].filter(x => !after.has(x)).length;
    return [
      { label: t('mm2.schedule.confirm.week'), value: week.length ? week.join(' · ') : t('mm2.schedule.confirm.noWeek') },
      {
        label: t('mm2.schedule.confirm.dates'),
        value: dates.length ? dates.slice(0, 6).join(' · ') + (dates.length > 6 ? ` · +${dates.length - 6}` : '') : t('mm2.schedule.confirm.noDates'),
      },
      { label: t('mm2.schedule.confirm.changes'), value: fill(t('mm2.schedule.confirm.changesValue'), { added, removed }), emphasis: true },
    ];
  };

  const handleSave = async () => {
    if (hasErrors) { toast.error(t('mm2.schedule.errors.fix')); return; }
    if (pendingActivation && !legacyPayload) { toast.error(t('mm2.schedule.pending.needsActivation')); return; }
    const ok = await confirm({
      title: t('mm2.schedule.confirm.title'),
      description: t('mm2.schedule.confirm.desc'),
      details: summary(),
      confirmLabel: t('mm2.schedule.confirm.cta'),
    });
    if (!ok) return;

    if (pendingActivation) {
      if (!user?.id || !legacyPayload) return;
      setLegacySaving(true);
      const { error: err } = await supabase.from('doctor_profiles').update(legacyPayload as any).eq('user_id', user.id);
      setLegacySaving(false);
      if (err) { console.error('[ScheduleEditor] legacy save', err); toast.error(t('mm2.schedule.saveError')); return; }
      toast.success(t('mm2.schedule.saved'));
      await reload();
      onSaved?.();
      return;
    }

    const res = await saveAll(draft.map(({ _key, ...r }) => r));
    if (res.ok) { toast.success(t('mm2.schedule.saved')); onSaved?.(); return; }
    // Sin strictNullChecks TypeScript no estrecha la unión por `ok`.
    const reason = (res as { reason?: string }).reason;
    if (reason === 'invalid') toast.error(t('mm2.schedule.errors.invalid'));
    else if (reason === 'pending_activation') toast.error(t('mm2.schedule.pending.needsActivation'));
    else toast.error(t('mm2.schedule.saveError'));
  };

  const discard = () => {
    setDraft(ranges.map(r => ({ ...r, _key: r.id || newKey() })));
    setSelectedDates([]);
  };

  const busy = saving || legacySaving;

  if (loading) {
    return (
      <section className="pro-card pro-card-pad bg-card flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="pro-card pro-card-pad bg-card text-center py-10">
        <p className="text-sm text-slate-600">{t('mm2.schedule.loadError')}</p>
        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-3" onClick={reload}>{t('mm2.schedule.retry')}</button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {pendingActivation && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('mm2.schedule.pending.title')}</p>
            <p className="text-xs mt-0.5">{t('mm2.schedule.pending.desc')}</p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- por día de la semana */}
      <section className="pro-card pro-card-pad bg-card">
        <div className="pro-card-head flex-wrap gap-2">
          <h2 className="pro-card-title"><Clock /> <span>{t('mm2.schedule.weekTitle')}</span></h2>
          <span className="text-xs text-slate-500">{fill(t('mm2.schedule.tz'), { tz: fmt.tzLabel() })}</span>
        </div>
        <p className="text-sm text-slate-600 mb-3">{t('mm2.schedule.weekHint')}</p>
        <div className="grid gap-2 lg:grid-cols-2">
          {fmt.weekdayOrder.map(w => {
            const list = weekday(w);
            const on = list.length > 0;
            const err = weekdayErrors.get(w);
            const dayName = fmt.formatWeekday(w, 'long');
            return (
              <div key={w} className={`rounded-2xl border bg-white p-3 ${err ? 'border-red-300' : 'border-[#d6e1e7]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-3 min-w-0 cursor-pointer">
                    <Switch checked={on} onCheckedChange={v => toggleWeekday(w, v)} aria-label={dayName} />
                    <span className="font-semibold text-slate-900 truncate">{dayName}</span>
                    {!on && <span className="text-xs text-slate-500">{t('mm2.schedule.closed')}</span>}
                  </label>
                  {on && (
                    <div className="flex items-center gap-1 flex-none">
                      <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => addWeekdayTramo(w)}>
                        <Plus /> <span className="hidden sm:inline">{t('mm2.schedule.addRange')}</span>
                      </button>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" aria-label={t('mm2.schedule.copyTo')} title={t('mm2.schedule.copyTo')}>
                            <Copy />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => copyWeekday(w, [0, 1, 2, 3, 4, 5, 6])}>{t('mm2.schedule.copyAll')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyWeekday(w, WORKWEEK)}>{t('mm2.schedule.copyWeekdays')}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {fmt.weekdayOrder.filter(o => o !== w).map(o => (
                            <DropdownMenuItem key={o} onClick={() => copyWeekday(w, [o])}>{fmt.formatWeekday(o, 'long')}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                {on && (
                  <div className="mt-2 space-y-1.5">
                    {list.map(r => (
                      <TramoInputs
                        key={r._key}
                        start={r.start_time}
                        end={r.end_time}
                        invalid={!!err}
                        onChange={p => patch(r._key, p)}
                        onRemove={() => removeRow(r._key)}
                        removeLabel={t('mm2.schedule.removeRange')}
                        fromLabel={`${dayName} · ${t('mm2.schedule.from')}`}
                        toLabel={`${dayName} · ${t('mm2.schedule.to')}`}
                      />
                    ))}
                  </div>
                )}
                {err && <p className="mt-2 text-xs font-medium text-red-600">{errorText(err)}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ días sueltos del mes */}
      <section id="mm-schedule-dates" className="pro-card pro-card-pad bg-card scroll-mt-24">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><CalendarDays /> <span>{t('mm2.schedule.datesTitle')}</span></h2>
        </div>
        <p className="text-sm text-slate-600 mb-3">{t('mm2.schedule.datesHint')}</p>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="rounded-2xl border border-[#d6e1e7] bg-white self-start max-w-full overflow-x-auto">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={v => setSelectedDates(v || [])}
              disabled={{ before: startOfDay(new Date()) }}
              modifiers={{
                special: (d: Date) => specialKeys.has(fmt.toDateKey(d)),
                closedDay: (d: Date) => closedKeys.has(fmt.toDateKey(d)),
              }}
              modifiersClassNames={{
                special: 'ring-2 ring-inset ring-[#227787] font-bold',
                closedDay: 'line-through',
              }}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-2xl border border-[#d6e1e7] bg-[#f8fafc] p-3">
              {selectedDates.length === 0 ? (
                <p className="text-sm text-slate-600">{t('mm2.schedule.pickDays')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {fill(t(selectedDates.length === 1 ? 'mm2.schedule.selectedOne' : 'mm2.schedule.selectedCount'), { n: selectedDates.length })}
                    </p>
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => setSelectedDates([])}>
                      <X /> {t('mm2.schedule.clearSelection')}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    {[...selectedDates].sort((a, b) => a.getTime() - b.getTime()).map(d => fmt.formatDate(d, 'EEE d MMM').replace(/\./g, '')).join(' · ')}
                  </p>
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <Switch checked={dateClosed} onCheckedChange={setDateClosed} />
                    <span className="text-sm text-slate-800">{t('mm2.schedule.closedToggle')}</span>
                  </label>
                  {!dateClosed && (
                    <div className="space-y-1.5">
                      {dateTramos.map(tr => (
                        <TramoInputs
                          key={tr._key}
                          start={tr.start_time}
                          end={tr.end_time}
                          invalid={!!tramosError}
                          onChange={p => setDateTramos(list => list.map(x => (x._key === tr._key ? { ...x, ...p } : x)))}
                          onRemove={() => setDateTramos(list => (list.length > 1 ? list.filter(x => x._key !== tr._key) : list))}
                          removeLabel={t('mm2.schedule.removeRange')}
                          fromLabel={t('mm2.schedule.from')}
                          toLabel={t('mm2.schedule.to')}
                        />
                      ))}
                      <button
                        type="button"
                        className="pro-btn pro-btn-outline pro-btn-xs"
                        onClick={() => setDateTramos(list => {
                          const last = byStart(list)[list.length - 1];
                          const s = last ? Math.min(toMin(last.end_time) + 60, 22 * 60) : toMin(DEFAULT_TRAMO.start_time);
                          return [...list, { _key: newKey(), start_time: fromMin(s), end_time: fromMin(Math.min(s + 180, 23 * 60 + 45)) }];
                        })}
                      >
                        <Plus /> {t('mm2.schedule.addRange')}
                      </button>
                      {tramosError && <p className="text-xs font-medium text-red-600">{errorText(tramosError)}</p>}
                    </div>
                  )}
                  <button type="button" className="pro-btn pro-btn-teal pro-btn-sm w-full sm:w-auto mt-3" disabled={!!tramosError} onClick={applyToDates}>
                    <CalendarDays /> {t('mm2.schedule.apply')}
                  </button>
                </>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t('mm2.schedule.datesListTitle')}</h3>
              {upcomingDates.length === 0 ? (
                <p className="text-sm text-slate-500">{t('mm2.schedule.datesEmpty')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingDates.map(([k, rows]) => {
                    const active = rows.filter(r => r.is_active);
                    const err = dateErrors.get(k);
                    return (
                      <li key={k} className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2 ${err ? 'border-red-300' : 'border-[#d6e1e7]'}`}>
                        <span className="text-sm font-semibold text-slate-900 min-w-[120px]">
                          {fmt.formatDate(fmt.parseDateKey(k), 'EEE d MMM yyyy').replace(/\./g, '')}
                        </span>
                        <span className={`text-sm ${active.length ? 'text-slate-700' : 'text-slate-500 italic'}`}>
                          {active.length ? tramosLabel(active) : t('mm2.schedule.closed')}
                        </span>
                        {err && <span className="text-xs font-medium text-red-600">{errorText(err)}</span>}
                        <span className="ml-auto flex items-center gap-1">
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => editDate(k)}>
                            <Pencil /> <span className="hidden sm:inline">{t('mm2.schedule.editDate')}</span>
                          </button>
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => removeDate(k)} title={t('mm2.schedule.removeDate')} aria-label={t('mm2.schedule.removeDate')}>
                            <RotateCcw />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ vista previa */}
      <section className="pro-card pro-card-pad bg-card">
        <div className="pro-card-head flex-wrap gap-2">
          <h2 className="pro-card-title"><CalendarDays /> <span>{t('mm2.schedule.previewTitle')}</span></h2>
          <div className="flex items-center gap-1">
            <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" aria-label={t('mm2.schedule.prevMonth')} onClick={() => setPreviewMonth(m => addMonths(m, -1))}><ChevronLeft /></button>
            <span className="min-w-[150px] text-center text-sm font-semibold text-slate-900">{fmt.formatMonthYear(previewMonth)}</span>
            <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" aria-label={t('mm2.schedule.nextMonth')} onClick={() => setPreviewMonth(m => addMonths(m, 1))}><ChevronRight /></button>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-3">{t('mm2.schedule.previewHint')}</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {fmt.weekdayOrder.map(w => (
                <div key={w} className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">{fmt.formatWeekday(w, 'short')}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {previewDays.map(d => {
                const key = fmt.toDateKey(d);
                const list = previewByDay.get(key) || [];
                const special = specialKeys.has(key);
                const inMonth = isSameMonth(d, previewMonth);
                return (
                  <div
                    key={key}
                    className={`min-h-[76px] rounded-xl border p-1.5 text-left ${inMonth ? 'bg-white' : 'bg-slate-50 opacity-60'} ${special ? 'border-[#227787]' : 'border-[#e3eaef]'} ${isToday(d) ? 'ring-2 ring-primary/40' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{d.getDate()}</span>
                      {special && <span className="h-2 w-2 rounded-full bg-[#227787]" aria-hidden="true" />}
                    </div>
                    {list.length === 0 ? (
                      <span className="mt-1 block text-[10px] text-slate-400">{t('mm2.schedule.closed')}</span>
                    ) : (
                      <>
                        {list.slice(0, 3).map(r => (
                          <span key={`${r.start_time}-${r.end_time}`} className={`mt-0.5 block truncate rounded px-1 text-[10px] font-semibold ${r.source === 'date' ? 'bg-[#dff1f3] text-[#155e6b]' : 'bg-[#e3eefc] text-[#23457f]'}`}>
                            {r.start_time}–{r.end_time}
                          </span>
                        ))}
                        {list.length > 3 && <span className="block text-[10px] text-slate-500">{fill(t('mm2.schedule.more'), { n: list.length - 3 })}</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#e3eefc] ring-1 ring-[#23457f]/30" />{t('mm2.schedule.legendWeek')}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#dff1f3] ring-1 ring-[#155e6b]/30" />{t('mm2.schedule.legendDate')}</span>
        </div>
      </section>

      {/* ------------------------------------------------------- guardar */}
      <div className="sticky bottom-3 z-20">
        <div className={`rounded-2xl border bg-white p-3 shadow-lg flex flex-col sm:flex-row sm:items-center gap-2 ${dirty ? 'border-primary/40' : 'border-[#d6e1e7]'}`}>
          <p className="text-sm text-slate-700 min-w-0 flex-1">
            {hasErrors ? <span className="font-medium text-red-600">{t('mm2.schedule.errors.fix')}</span>
              : dirty ? t('mm2.schedule.unsaved') : t('mm2.schedule.upToDate')}
          </p>
          <div className="flex gap-2">
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm flex-1 sm:flex-none" disabled={!dirty || busy} onClick={discard}>
              <RotateCcw /> {t('mm2.schedule.discard')}
            </button>
            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm flex-1 sm:flex-none" disabled={!dirty || busy || hasErrors} onClick={handleSave}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />} {t('mm2.schedule.save')}
            </button>
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

export default ScheduleEditor;
