// Nueva consulta — flujo propio del médico (11-sep-2026).
//
// Hasta hoy los 7 botones «Nueva consulta» abrían /doctor/availability?nueva=consulta,
// que es el editor del HORARIO SEMANAL: el médico creía agendar y lo que hacía
// era sobrescribir su horario al primer clic. Este diálogo agenda de verdad:
//   1 paciente · 2 fecha y hora · 3 detalles · 4 revisión · 5 confirmar
// Nada se guarda hasta el paso 5, y nunca se abre Disponibilidad.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, Info, Loader2, Search,
  Stethoscope, User, Video,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorPatients, DoctorPatient } from '@/hooks/useDoctorPatients';
import { useCreateAppointment, isMissingDbObject } from '@/hooks/useCreateAppointment';
import type { CreateAppointmentFailure } from '@/hooks/useCreateAppointment';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill, initialsOf, norm } from '@/lib/proFormat';

export interface NewConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Paciente preseleccionado (desde su ficha, la agenda o el chat) */
  defaultPatientId?: string;
  /** 'YYYY-MM-DD' (hueco pulsado en la agenda) */
  defaultDate?: string;
  /** 'HH:mm' */
  defaultTime?: string;
  onCreated?: (appointmentId: string) => void;
}

type Step = 1 | 2 | 3 | 4;
type ScheduleMode = 'ranges' | 'legacy' | 'none';

interface DayRange { startMin: number; endMin: number; source: string }
interface BusyItem { start: number; end: number; kind: 'appointment' | 'blocked' | 'live'; label: string }

const DURATIONS = [15, 30, 45, 60];
const NOTES_MAX = 500;
/** Único formato que la plataforma sabe agendar hoy (sala de vídeo). */
const MODALITY = 'video';
const DAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const minutesOfTime = (value?: string | null): number | null => {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function NewConsultationDialog({
  open,
  onOpenChange,
  defaultPatientId,
  defaultDate,
  defaultTime,
  onCreated,
}: NewConsultationDialogProps) {
  const { t } = useLanguage();
  const { supabaseUser, role } = useAuth();
  const fmt = useAppDateFormat();
  const { patients, loading: loadingPatients } = useDoctorPatients();
  const { createAppointment, creating, pendingActivation } = useCreateAppointment();
  const { confirm, dialog } = useConfirmAction();

  const [step, setStep] = useState<Step>(1);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [otherTime, setOtherTime] = useState(false);
  const [month, setMonth] = useState<Date>(() => new Date());

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('none');
  const [ranges, setRanges] = useState<Record<string, DayRange[]>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [busy, setBusy] = useState<BusyItem[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const doctorId = supabaseUser?.id || null;

  // ---------------------------------------------------------------- arranque
  useEffect(() => {
    if (!open) return;
    // Los parámetros de la URL (fecha/hora del hueco pulsado) se validan antes de usarlos.
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(defaultDate || '')) ? String(defaultDate) : null;
    const hour = /^\d{2}:\d{2}/.test(String(defaultTime || '')) ? String(defaultTime).slice(0, 5) : null;
    setStep(defaultPatientId ? 2 : 1);
    setPatientId(defaultPatientId || null);
    setTerm('');
    setDateKey(day);
    setTime(hour);
    setOtherTime(!!hour);
    setDuration(30);
    setNotes('');
    setMonth(day ? fmt.parseDateKey(day) : new Date());
    // fmt es estable por idioma; las props solo importan al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPatientId, defaultDate, defaultTime]);

  // -------------------------------------------------- horario del médico (lectura)
  const loadSchedule = useCallback(async (visibleMonth: Date) => {
    if (!doctorId) return;
    setLoadingSchedule(true);
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    const fromKey = fmt.toDateKey(first);
    const toKey = fmt.toDateKey(last);
    try {
      const { data, error } = await (supabase.rpc as any)('get_doctor_schedule', {
        p_doctor_id: doctorId,
        p_from: fromKey,
        p_to: toKey,
      });
      if (!error && Array.isArray(data)) {
        const map: Record<string, DayRange[]> = {};
        (data as any[]).forEach(row => {
          const key = String(row.day || '').slice(0, 10);
          const s = minutesOfTime(row.start_time);
          const e = minutesOfTime(row.end_time);
          if (!key || s === null || e === null || e <= s) return;
          (map[key] = map[key] || []).push({ startMin: s, endMin: e, source: String(row.source || 'weekly') });
        });
        Object.values(map).forEach(list => list.sort((a, b) => a.startMin - b.startMin));
        setRanges(map);
        setScheduleMode('ranges');
        return;
      }
      if (error && !isMissingDbObject(error)) console.warn('[NewConsultation] get_doctor_schedule', error);
    } catch (e) {
      console.warn('[NewConsultation] get_doctor_schedule', e);
    }

    // Todavía sin la tabla nueva: se usa el horario semanal actual
    // (doctor_profiles.office_*), que es del que /book saca los turnos.
    try {
      const { data: prof } = await supabase
        .from('doctor_profiles')
        .select('office_days, office_hours_start, office_hours_end')
        .eq('user_id', doctorId)
        .maybeSingle();
      const days: string[] = ((prof as any)?.office_days || []) as string[];
      const s = minutesOfTime((prof as any)?.office_hours_start);
      const e = minutesOfTime((prof as any)?.office_hours_end);
      if (!days.length || s === null || e === null || e <= s) {
        setRanges({});
        setScheduleMode('none');
        return;
      }
      const nums = new Set(days.map(d => DAY_NUM[String(d).toLowerCase()]).filter(n => n !== undefined));
      const map: Record<string, DayRange[]> = {};
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
        if (!nums.has(d.getDay())) continue;
        map[fmt.toDateKey(d)] = [{ startMin: s, endMin: e, source: 'legacy' }];
      }
      setRanges(map);
      setScheduleMode('legacy');
    } catch (e) {
      console.warn('[NewConsultation] office_hours', e);
      setRanges({});
      setScheduleMode('none');
    } finally {
      setLoadingSchedule(false);
    }
  }, [doctorId, fmt]);

  useEffect(() => {
    if (!open || !doctorId) return;
    loadSchedule(month).finally(() => setLoadingSchedule(false));
  }, [open, doctorId, month, loadSchedule]);

  // ------------------------------------------- lo que ya ocupa el día elegido
  useEffect(() => {
    if (!open || !doctorId || !dateKey) { setBusy([]); return; }
    let active = true;
    const start = fmt.parseDateKey(dateKey);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    setLoadingDay(true);
    (async () => {
      try {
        const [apptRes, availRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, patient_id, scheduled_at, duration_minutes, status')
            .eq('doctor_id', doctorId)
            .in('status', ['requested', 'confirmed'])
            .gte('scheduled_at', start.toISOString())
            .lt('scheduled_at', end.toISOString()),
          supabase
            .from('doctor_availability')
            .select('id, title, type, status, scheduled_at, duration_minutes')
            .eq('doctor_id', doctorId)
            .in('status', ['scheduled', 'confirmed'])
            .gte('scheduled_at', start.toISOString())
            .lt('scheduled_at', end.toISOString()),
        ]);
        if (!active) return;
        const items: BusyItem[] = [];
        ((apptRes.data as any[]) || []).forEach(a => {
          const s = new Date(a.scheduled_at).getTime();
          const mins = Number(a.duration_minutes) || 30;
          const patient = patients.find(p => p.id === a.patient_id);
          items.push({
            start: s,
            end: s + mins * 60000,
            kind: 'appointment',
            label: patient?.name || t('mm2.newConsultation.when.someone'),
          });
        });
        ((availRes.data as any[]) || []).forEach(v => {
          const type = String(v.type || '');
          if (type !== 'blocked' && type !== 'live') return;
          const s = new Date(v.scheduled_at).getTime();
          const mins = Number(v.duration_minutes) || 60;
          items.push({ start: s, end: s + mins * 60000, kind: type as 'blocked' | 'live', label: v.title || '' });
        });
        setBusy(items.sort((a, b) => a.start - b.start));
      } catch (e) {
        console.warn('[NewConsultation] día ocupado', e);
        if (active) setBusy([]);
      } finally {
        if (active) setLoadingDay(false);
      }
    })();
    return () => { active = false; };
    // `patients` solo se usa para poner nombre al choque
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doctorId, dateKey]);

  // --------------------------------------------------------------- derivados
  const patient = useMemo(
    () => patients.find(p => p.id === patientId) || null,
    [patients, patientId],
  );

  const filteredPatients = useMemo(() => {
    const q = norm(term);
    if (!q) return patients;
    return patients.filter(p => norm(p.name).includes(q) || norm(p.email || '').includes(q));
  }, [patients, term]);

  const dayRanges = dateKey ? ranges[dateKey] || [] : [];

  const overlaps = useCallback(
    (startMs: number, mins: number) => {
      const endMs = startMs + mins * 60000;
      return busy.filter(b => startMs < b.end && endMs > b.start);
    },
    [busy],
  );

  const slots = useMemo(() => {
    if (!dateKey || dayRanges.length === 0) return [] as string[];
    const base = fmt.parseDateKey(dateKey);
    const now = Date.now();
    const out: string[] = [];
    dayRanges.forEach(r => {
      for (let m = r.startMin; m + duration <= r.endMin; m += duration) {
        const d = new Date(base);
        d.setHours(Math.floor(m / 60), m % 60, 0, 0);
        const ms = d.getTime();
        if (ms <= now) continue;
        if (overlaps(ms, duration).length > 0) continue;
        out.push(hhmm(m));
      }
    });
    return Array.from(new Set(out));
  }, [dateKey, dayRanges, duration, fmt, overlaps]);

  const timeOptions = useMemo(() => {
    const list: string[] = [];
    for (let m = 0; m < 24 * 60; m += 15) list.push(hhmm(m));
    if (time && !list.includes(time)) list.push(time);
    return list.sort();
  }, [time]);

  const startsAt = useMemo(() => {
    if (!dateKey || !time) return null;
    const d = fmt.parseDateKey(dateKey);
    const mins = minutesOfTime(time);
    if (Number.isNaN(d.getTime()) || mins === null) return null;
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  }, [dateKey, time, fmt]);

  const isPast = !!startsAt && startsAt.getTime() <= Date.now();

  const conflicts = useMemo(
    () => (startsAt ? overlaps(startsAt.getTime(), duration) : []),
    [startsAt, duration, overlaps],
  );

  const outsideSchedule = useMemo(() => {
    if (!startsAt || scheduleMode === 'none') return false;
    const mins = startsAt.getHours() * 60 + startsAt.getMinutes();
    return !dayRanges.some(r => mins >= r.startMin && mins + duration <= r.endMin);
  }, [startsAt, scheduleMode, dayRanges, duration]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    conflicts.forEach(c => {
      if (c.kind === 'appointment') list.push(fill(t('mm2.newConsultation.when.conflict'), { name: c.label }));
      else if (c.kind === 'live') list.push(t('mm2.newConsultation.when.conflictLive'));
      else list.push(t('mm2.newConsultation.when.conflictBlock'));
    });
    if (outsideSchedule) list.push(t('mm2.newConsultation.when.outsideSchedule'));
    return list;
  }, [conflicts, outsideSchedule, t]);

  const daysWithSchedule = useMemo(
    () => Object.keys(ranges).map(k => fmt.parseDateKey(k)).filter(d => !Number.isNaN(d.getTime())),
    [ranges, fmt],
  );

  const canContinue =
    step === 1 ? !!patientId
      : step === 2 ? !!startsAt && !isPast
        : true;

  // ----------------------------------------------------------------- guardar
  const submit = async () => {
    if (!patient || !startsAt) return;
    const ok = await confirm({
      title: t('mm2.newConsultation.confirmTitle'),
      description: t('mm2.newConsultation.confirmDescription'),
      details: [
        { label: t('mm2.newConsultation.review.patient'), value: patient.name || t('mm2.patients.unnamed') },
        { label: t('mm2.newConsultation.review.when'), value: `${fmt.formatDate(startsAt)} · ${fmt.formatTime(startsAt)}` },
        { label: t('mm2.newConsultation.review.duration'), value: fill(t('mm2.newConsultation.details.minutes'), { n: duration }) },
        { label: t('mm2.newConsultation.review.modality'), value: t('mm2.newConsultation.details.modalityVideo') },
        // Decisión de la clienta: la cita nace PENDIENTE de que el paciente la acepte.
        { label: t('mm2.newConsultation.review.status'), value: t('mm2.newConsultation.review.statusPending'), emphasis: true },
      ],
      confirmLabel: t('mm2.newConsultation.confirmCta'),
    });
    if (!ok) return;

    const res = await createAppointment({
      patientId: patient.id,
      startsAt,
      durationMinutes: duration,
      notes: notes.trim() ? notes.trim() : null,
      modality: MODALITY,
    });

    if (res.ok) {
      toast.success(t('mm2.newConsultation.created'));
      onCreated?.(res.appointmentId);
      onOpenChange(false);
      return;
    }
    // Sin strictNullChecks el discriminante `ok` no estrecha el tipo: se lee el motivo aparte.
    const reason: CreateAppointmentFailure = (res as { reason: CreateAppointmentFailure }).reason;
    if (reason === 'pending_activation') toast.error(t('mm2.newConsultation.errors.pending'));
    else if (reason === 'conflict') toast.error(t('mm2.newConsultation.errors.conflict'));
    else if (reason === 'forbidden') toast.error(t('mm2.newConsultation.errors.forbidden'));
    else if (reason === 'invalid') toast.error(t('mm2.newConsultation.errors.invalid'));
    else toast.error(t('mm2.newConsultation.errors.generic'));
  };

  // El guard de rol va al final, después de todos los hooks.
  if (role !== 'doctor') return null;

  const stepLabels = [
    t('mm2.newConsultation.steps.patient'),
    t('mm2.newConsultation.steps.when'),
    t('mm2.newConsultation.steps.details'),
    t('mm2.newConsultation.steps.review'),
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-secondary">
              <Stethoscope className="h-5 w-5 text-primary" />
              {t('mm2.newConsultation.title')}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {t('mm2.newConsultation.subtitle')}
            </DialogDescription>
          </DialogHeader>

          {/* Pasos */}
          <ol className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stepLabels.map((label, i) => {
              const n = (i + 1) as Step;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="flex flex-none items-center gap-1.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      current ? 'bg-primary text-white' : done ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : n}
                  </span>
                  <span className={`text-[12px] font-semibold ${current ? 'text-secondary' : 'text-slate-500'}`}>
                    {label}
                  </span>
                  {i < stepLabels.length - 1 && <span className="mx-1 h-px w-4 bg-slate-200" />}
                </li>
              );
            })}
          </ol>

          {pendingActivation && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <Info className="mt-0.5 h-4 w-4 flex-none" />
              <span>{t('mm2.newConsultation.errors.pending')}</span>
            </p>
          )}

          {/* ---------------------------------------------------- 1 · paciente */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3">
                <Search className="h-4 w-4 flex-none text-slate-400" />
                <input
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  placeholder={t('mm2.newConsultation.patient.search')}
                  className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
                />
              </div>

              {loadingPatients ? (
                <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('mm2.newConsultation.patient.loading')}
                </p>
              ) : patients.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-[13.5px] text-slate-600">
                  {t('mm2.newConsultation.patient.empty')}
                </p>
              ) : filteredPatients.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-[13.5px] text-slate-600">
                  {t('mm2.newConsultation.patient.noResults')}
                </p>
              ) : (
                <ul className="max-h-[46vh] space-y-1 overflow-y-auto pr-1">
                  {filteredPatients.map((p: DoctorPatient) => {
                    const active = p.id === patientId;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPatientId(p.id)}
                          aria-pressed={active}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                            active ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                            {p.avatarUrl
                              ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                              : initialsOf(p.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-slate-900">{p.name || t('mm2.patients.unnamed')}</span>
                            {p.email && <span className="block truncate text-[12px] text-slate-500">{p.email}</span>}
                          </span>
                          {active && <Check className="h-4 w-4 flex-none text-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {defaultPatientId && !loadingPatients && !patients.some(p => p.id === defaultPatientId) && (
                <p className="text-[13px] text-amber-700">{t('mm2.newConsultation.patient.notFound')}</p>
              )}
            </div>
          )}

          {/* ----------------------------------------------- 2 · fecha y hora */}
          {step === 2 && (
            <div className="space-y-3">
              {patient && (
                <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                  <User className="h-4 w-4 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{patient.name || t('mm2.patients.unnamed')}</span>
                  <button type="button" className="text-[12px] font-semibold text-primary underline" onClick={() => setStep(1)}>
                    {t('mm2.newConsultation.patient.change')}
                  </button>
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-none rounded-xl border border-slate-200">
                  <Calendar
                    mode="single"
                    locale={fmt.locale}
                    weekStartsOn={fmt.weekStartsOn}
                    month={month}
                    onMonthChange={setMonth}
                    selected={dateKey ? fmt.parseDateKey(dateKey) : undefined}
                    onSelect={(d?: Date) => { if (d) { setDateKey(fmt.toDateKey(d)); setTime(null); } }}
                    disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                    modifiers={{ conHorario: daysWithSchedule }}
                    modifiersClassNames={{ conHorario: 'underline decoration-primary decoration-2 underline-offset-4' }}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-700">
                    {dateKey ? fmt.formatDate(fmt.parseDateKey(dateKey)) : t('mm2.newConsultation.when.date')}
                  </p>

                  {!dateKey ? (
                    <p className="text-[13px] text-slate-500">{t('mm2.newConsultation.when.pickDay')}</p>
                  ) : loadingDay || loadingSchedule ? (
                    <p className="flex items-center gap-2 text-[13px] text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t('mm2.newConsultation.when.loadingSlots')}
                    </p>
                  ) : (
                    <>
                      {scheduleMode === 'none' ? (
                        <p className="text-[12.5px] text-slate-500">{t('mm2.newConsultation.when.scheduleUnavailable')}</p>
                      ) : slots.length > 0 ? (
                        <>
                          <p className="text-[12.5px] text-slate-500">{t('mm2.newConsultation.when.slots')}</p>
                          <div className="flex max-h-[28vh] flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {slots.map(s => (
                              <button
                                key={s}
                                type="button"
                                aria-pressed={time === s}
                                onClick={() => { setTime(s); setOtherTime(false); }}
                                className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                                  time === s
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {fmt.formatTime(new Date(`${dateKey}T${s}:00`))}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[12.5px] text-slate-500">{t('mm2.newConsultation.when.noSlots')}</p>
                      )}

                      <button
                        type="button"
                        className="text-[12.5px] font-semibold text-primary underline"
                        onClick={() => setOtherTime(v => !v)}
                      >
                        {t('mm2.newConsultation.when.otherTime')}
                      </button>

                      {otherTime && (
                        <label className="block">
                          <span className="mb-1 block text-[12.5px] text-slate-500">{t('mm2.newConsultation.when.time')}</span>
                          <select
                            value={time || ''}
                            onChange={e => setTime(e.target.value || null)}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
                          >
                            <option value="">—</option>
                            {timeOptions.map(o => (
                              <option key={o} value={o}>
                                {fmt.formatTime(new Date(`${dateKey}T${o}:00`))}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {isPast && <p className="text-[12.5px] font-semibold text-red-600">{t('mm2.newConsultation.when.past')}</p>}
                      {!isPast && warnings.map(w => (
                        <p key={w} className="flex items-start gap-1.5 text-[12.5px] text-amber-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                          <span>{w}</span>
                        </p>
                      ))}
                      <p className="text-[12px] text-slate-400">{fill(t('mm2.common.timezoneNote'), { zone: fmt.tzLabel() })}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------------------------- 3 · detalles */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-700">{t('mm2.newConsultation.details.duration')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={duration === d}
                      onClick={() => setDuration(d)}
                      className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                        duration === d
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {fill(t('mm2.newConsultation.details.minutes'), { n: d })}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-700">{t('mm2.newConsultation.details.modality')}</p>
                <p className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-[13px] font-semibold text-slate-800">
                  <Video className="h-4 w-4 text-primary" />
                  {t('mm2.newConsultation.details.modalityVideo')}
                </p>
                <p className="mt-1 text-[12.5px] text-slate-500">{t('mm2.newConsultation.details.modalityHelp')}</p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  {t('mm2.newConsultation.details.notes')}
                </span>
                <Textarea
                  value={notes}
                  maxLength={NOTES_MAX}
                  onChange={e => setNotes(e.target.value.slice(0, NOTES_MAX))}
                  placeholder={t('mm2.newConsultation.details.notesPlaceholder')}
                  className="min-h-[90px] bg-white"
                />
                <span className="mt-1 block text-right text-[12px] text-slate-400">{notes.length}/{NOTES_MAX}</span>
              </label>
            </div>
          )}

          {/* -------------------------------------------------- 4 · revisión */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-secondary">{t('mm2.newConsultation.review.title')}</p>
              <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.patient')}</dt>
                  <dd className="text-right text-[13.5px] font-semibold text-slate-800">{patient?.name || '—'}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.when')}</dt>
                  <dd className="text-right text-[13.5px] font-semibold text-slate-800">
                    {startsAt ? `${fmt.formatDate(startsAt)} · ${fmt.formatTime(startsAt)}` : '—'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.duration')}</dt>
                  <dd className="text-right text-[13.5px] font-semibold text-slate-800">
                    {fill(t('mm2.newConsultation.details.minutes'), { n: duration })}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.modality')}</dt>
                  <dd className="text-right text-[13.5px] font-semibold text-slate-800">
                    {t('mm2.newConsultation.details.modalityVideo')}
                  </dd>
                </div>
                {/* La cita nace pendiente: el paciente tiene que aceptarla (decisión de la clienta). */}
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.status')}</dt>
                  <dd className="text-right text-[13.5px] font-bold text-amber-700">
                    {t('mm2.newConsultation.review.statusPending')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-[13px] text-slate-500">{t('mm2.newConsultation.review.notes')}</dt>
                  <dd className="max-w-[60%] text-right text-[13.5px] text-slate-800">
                    {notes.trim() || t('mm2.newConsultation.review.noNotes')}
                  </dd>
                </div>
              </dl>

              {warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-[12.5px] font-bold text-amber-800">{t('mm2.newConsultation.review.warnings')}</p>
                  {warnings.map(w => (
                    <p key={w} className="mt-0.5 text-[12.5px] text-amber-800">· {w}</p>
                  ))}
                </div>
              )}

              <p className="flex items-start gap-2 text-[12.5px] text-slate-600">
                <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
                <span>{t('mm2.newConsultation.review.whatHappens')}</span>
              </p>
            </div>
          )}

          {/* ----------------------------------------------------- navegación */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => (step === 1 ? onOpenChange(false) : setStep((step - 1) as Step))}
            >
              {step === 1 ? t('mm2.common.cancel') : (<><ArrowLeft className="h-4 w-4" /> {t('mm2.common.back')}</>)}
            </button>

            {step < 4 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((step + 1) as Step)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('mm2.common.next')} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={creating || !patient || !startsAt || isPast}
                onClick={submit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {t('mm2.newConsultation.submit')}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {dialog}
    </>
  );
}

export default NewConsultationDialog;
