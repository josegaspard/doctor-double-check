import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BOOKING_SLOT_MIN } from '@/lib/booking';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Stethoscope, Loader2, CheckCircle2, Tag, Monitor, MapPin, Info, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isConsultationCountryAllowed } from '@/lib/consultationRegions';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { usePublicDoctorServices, minServicePrice } from '@/hooks/useDoctorServices';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';
import { serviceIcon } from '@/components/doctor/services/serviceIcons';
import { fill } from '@/lib/proFormat';
import '@/styles/funciones-servicios.css';

interface Slot {
  id: string;
  doctor_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  type: string;
}
interface DoctorInfo {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  specialty: string;
  consultation_fee: number;
  rating: number;
  total_consultations: number;
}

const LOCALE_MAP: Record<string, string> = {
  es: 'es-MX',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
  it: 'it-IT',
  de: 'de-DE',
};
const formatDate = (iso: string, lang: string = 'es') => {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
};
const formatTime = (iso: string, lang: string = 'es') =>
  new Date(iso).toLocaleTimeString(LOCALE_MAP[lang] || 'es-MX', { hour: '2-digit', minute: '2-digit' });

// Orientación (cliente 2026-07-07): el doctor define su horario semanal de atención
// (office_days + horas). Aquí generamos turnos reservables de 30 min dentro de ese
// horario para las próximas semanas, sin que el doctor tenga que crear cada turno.
//
// 12-sep-2026 (F1 servicios): si el paciente elige un servicio del catálogo del médico,
// el tramo de cada turno es la DURACIÓN de ese servicio (sin servicio, 30 min como
// siempre). Un turno se descarta si se SOLAPA con una cita visible o con un bloqueo
// del médico; antes solo se comparaba la hora de inicio, que con tramos de distinta
// duración dejaba pasar turnos que pisaban otros.
const ORIENTATION_SLOT_MIN = BOOKING_SLOT_MIN;
const ORIENTATION_HORIZON_DAYS = 21;
const DAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Tramo ocupado en milisegundos: [inicio, fin). */
type BusyRange = [number, number];
const overlapsBusy = (startMs: number, minutes: number, busy: BusyRange[]) => {
  const endMs = startMs + minutes * 60000;
  return busy.some(([s, e]) => startMs < e && endMs > s);
};

function generateOfficeHourSlots(
  doctorId: string,
  officeDays: string[] | null,
  start: string | null,
  end: string | null,
  busy: BusyRange[],
  now: Date,
  slotMin: number = ORIENTATION_SLOT_MIN,
): Slot[] {
  if (!officeDays?.length || !start || !end) return [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) return [];
  const activeNums = new Set(officeDays.map(d => DAY_NUM[d.toLowerCase()]).filter(n => n !== undefined));
  const out: Slot[] = [];
  for (let d = 0; d < ORIENTATION_HORIZON_DAYS; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    day.setHours(0, 0, 0, 0);
    if (!activeNums.has(day.getDay())) continue;
    for (let m = startMins; m + slotMin <= endMins; m += slotMin) {
      const dt = new Date(day);
      dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (dt.getTime() <= now.getTime()) continue;
      if (overlapsBusy(dt.getTime(), slotMin, busy)) continue;
      const iso = dt.toISOString();
      out.push({
        id: `gen-${iso}`,
        doctor_id: doctorId,
        title: '',
        description: null,
        scheduled_at: iso,
        duration_minutes: slotMin,
        type: 'consultation',
      });
    }
  }
  return out;
}

// 11-sep-2026: turnos a partir del horario por tramos y días sueltos del médico
// (get_doctor_schedule: una fila por tramo efectivo de cada día). Las horas se leen
// en la hora local del navegador, igual que hacía el horario semanal antiguo.
const scheduleDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function generateScheduleSlots(
  doctorId: string,
  rows: { day: string; start_time: string; end_time: string }[],
  busy: BusyRange[],
  now: Date,
  slotMin: number = ORIENTATION_SLOT_MIN,
): Slot[] {
  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const [y, mo, d] = String(r.day || '').split('-').map(Number);
    const [sh, sm] = String(r.start_time || '').split(':').map(Number);
    const [eh, em] = String(r.end_time || '').split(':').map(Number);
    if (!y || !mo || !d || Number.isNaN(sh) || Number.isNaN(eh)) continue;
    const startMins = sh * 60 + (sm || 0);
    const endMins = eh * 60 + (em || 0);
    for (let m = startMins; m + slotMin <= endMins; m += slotMin) {
      const dt = new Date(y, mo - 1, d, Math.floor(m / 60), m % 60, 0, 0);
      if (dt.getTime() <= now.getTime()) continue;
      if (overlapsBusy(dt.getTime(), slotMin, busy)) continue;
      const iso = dt.toISOString();
      if (seen.has(iso)) continue;
      seen.add(iso);
      out.push({
        id: `gen-${iso}`,
        doctor_id: doctorId,
        title: '',
        description: null,
        scheduled_at: iso,
        duration_minutes: slotMin,
        type: 'consultation',
      });
    }
  }
  return out;
}

/** Datos crudos de la agenda: los turnos se calculan después según la duración elegida. */
interface AgendaData {
  dp: any | null;
  discrete: Slot[];
  scheduleRows: { day: string; start_time: string; end_time: string }[] | null;
  booked: BusyRange[];
  blocked: BusyRange[];
  bookedIds: Set<string>;
}

/** Sin la migración 20260913a, appointments no tiene service_id / service_name / price. */
const serviceColumnsMissing = (err: any): boolean => {
  const code = String(err?.code || '');
  if (code === 'PGRST204' || code === '42703') return true;
  const msg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  if (/column/.test(msg) && /service_id|service_name|price/.test(msg)) return true;
  return isMissingDbObject(err);
};

export default function BookAppointment() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    scheduled_at: string;
    appointmentId: string;
    serviceName: string | null;
    price: number | null;
  } | null>(null);

  // Catálogo del médico (F1 servicios). Vacío —sin servicios o sin migración— = flujo de siempre.
  const { services, loading: servicesLoading, reload: reloadServices } = usePublicDoctorServices(doctorId);
  const [serviceId, setServiceId] = useState<string | null>(() => searchParams.get('servicio'));
  const [serviceGone, setServiceGone] = useState(false);
  const selectedService = services.find((s) => s.id === serviceId) || null;
  const needsService = services.length > 0 && !selectedService;
  const slotMin = selectedService ? selectedService.duration_minutes : ORIENTATION_SLOT_MIN;
  const fromPrice = minServicePrice(services);

  // `?servicio=` que ya no existe → aviso; con un solo servicio, se elige solo.
  useEffect(() => {
    if (servicesLoading) return;
    if (serviceId && !services.some((s) => s.id === serviceId)) {
      setServiceGone(true);
      setServiceId(services.length === 1 ? services[0].id : null);
      setSelected(null);
      return;
    }
    if (!serviceId && services.length === 1) setServiceId(services[0].id);
  }, [servicesLoading, services, serviceId]);

  const chooseService = (sid: string) => {
    if (sid === serviceId) return;
    setServiceId(sid);
    setSelected(null);
    setServiceGone(false);
    const next = new URLSearchParams(searchParams);
    next.set('servicio', sid);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!doctorId) return;
    const load = async () => {
      setLoading(true);
      // El paciente NO puede leer doctor_profiles/profiles directo (RLS: solo dueño/admin)
      // → esas queries .single() daban 406 y rompían TODO el booking. Usamos el RPC
      // público SECURITY DEFINER (mismo que usa /doctor/:id) que devuelve el perfil
      // público del doctor APROBADO con fee, horarios y datos de agenda.
      const [{ data: docRows }, { data: avs }, { data: appts }, { data: blocks }, scheduleRes] = await Promise.all([
        supabase.rpc('get_doctor_public_profile', { p_user_id: doctorId }),
        supabase
          .from('doctor_availability')
          .select('id, doctor_id, title, description, scheduled_at, duration_minutes, type')
          .eq('doctor_id', doctorId)
          .in('type', ['available', 'consultation'])
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(50),
        supabase
          .from('appointments')
          .select('availability_id, scheduled_at, duration_minutes')
          .eq('doctor_id', doctorId)
          .in('status', ['requested', 'confirmed']),
        // Tramos que el médico BLOQUEÓ desde su agenda profesional (7-sep-2026):
        // ningún turno generado por horario de atención puede caer dentro.
        supabase
          .from('doctor_availability')
          .select('scheduled_at, duration_minutes')
          .eq('doctor_id', doctorId)
          .eq('type', 'blocked')
          .in('status', ['scheduled', 'confirmed'])
          .gte('scheduled_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
        (supabase.rpc as any)('get_doctor_schedule', {
          p_doctor_id: doctorId,
          p_from: scheduleDateKey(new Date()),
          p_to: scheduleDateKey(new Date(Date.now() + ORIENTATION_HORIZON_DAYS * 86_400_000)),
        }),
      ]);
      const blocked: BusyRange[] = ((blocks as any[]) || []).map((b) => {
        const s = new Date(b.scheduled_at).getTime();
        return [s, s + (Number(b.duration_minutes) || 60) * 60000] as BusyRange;
      });

      const dp = (docRows as any[])?.[0] ?? null;

      if (dp) {
        setDoctor({
          user_id: dp.user_id,
          name: dp.name,
          avatar_url: dp.avatar_url,
          specialty: dp.specialty,
          consultation_fee: Number(dp.consultation_fee) || 0,
          rating: Number(dp.rating) || 0,
          total_consultations: dp.total_consultations || 0,
        });
      }
      const apptRows = (appts as any[]) || [];
      const booked: BusyRange[] = apptRows
        .filter((a) => a.scheduled_at)
        .map((a) => {
          const s = new Date(a.scheduled_at).getTime();
          return [s, s + (Number(a.duration_minutes) || ORIENTATION_SLOT_MIN) * 60000] as BusyRange;
        });
      // Si get_doctor_schedule aún no existe (migración sin aplicar) o falla, se vuelve
      // al horario semanal antiguo del perfil.
      const scheduleRows = !(scheduleRes as any)?.error && Array.isArray((scheduleRes as any)?.data)
        ? ((scheduleRes as any).data as { day: string; start_time: string; end_time: string }[])
        : null;
      setAgenda({
        dp,
        discrete: (avs as any[] as Slot[]) || [],
        scheduleRows,
        booked,
        blocked,
        bookedIds: new Set(apptRows.map((a) => a.availability_id).filter(Boolean)),
      });
      setLoading(false);
    };
    load();
  }, [doctorId]);

  const slots = useMemo<Slot[]>(() => {
    if (!agenda || !doctorId) return [];
    const now = new Date();
    const busy = [...agenda.booked, ...agenda.blocked];
    const discreteTimes = new Set(agenda.discrete.map((s) => new Date(s.scheduled_at).toISOString()));
    // Turnos creados a mano por el médico: con servicio elegido, solo los que dan cabida a su duración.
    const discrete = agenda.discrete.filter(
      (s) =>
        (!selectedService || (Number(s.duration_minutes) || 0) >= slotMin) &&
        !overlapsBusy(new Date(s.scheduled_at).getTime(), Number(s.duration_minutes) || ORIENTATION_SLOT_MIN, agenda.blocked),
    );
    const officeSlots = (agenda.scheduleRows
      ? generateScheduleSlots(doctorId, agenda.scheduleRows, busy, now, slotMin)
      : generateOfficeHourSlots(
        doctorId,
        agenda.dp?.office_days ?? null,
        agenda.dp?.office_hours_start ?? null,
        agenda.dp?.office_hours_end ?? null,
        busy,
        now,
        slotMin,
      )).filter((s) => !discreteTimes.has(new Date(s.scheduled_at).toISOString()));
    return [...discrete, ...officeSlots].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  }, [agenda, doctorId, selectedService, slotMin]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    const bookedIds = agenda?.bookedIds;
    for (const s of slots) {
      if (bookedIds?.has(s.id)) continue;
      const key = new Date(s.scheduled_at).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [slots, agenda]);

  const priceNode = (amount: number, size: 'sm' | 'md' | 'lg' = 'sm') =>
    amount === 0 ? t('doctorProfile.free') : <PriceDisplay amount={amount} size={size} />;

  const book = async () => {
    if (!selected || !user || !doctorId) return;
    if (role !== 'patient' && role !== 'resident') {
      toast.error(t('bookAppointment.toast.onlyPatients'));
      return;
    }
    // Consultas solo para México por ahora (cliente 2026-06-29).
    if (!isConsultationCountryAllowed(user.countryCode)) {
      toast.error(t('bookAppointment.toastMexicoOnly'));
      return;
    }
    if (needsService) {
      toast.error(t('mm2.servicios.booking.chooseFirst'));
      return;
    }
    setSubmitting(true);
    const service = selectedService;
    const baseRow = {
      patient_id: user.id,
      doctor_id: doctorId,
      // Los turnos generados desde el horario semanal (id "gen-…") no tienen fila
      // en doctor_availability → availability_id null.
      availability_id: selected.id.startsWith('gen-') ? null : selected.id,
      scheduled_at: selected.scheduled_at,
      duration_minutes: service ? service.duration_minutes : selected.duration_minutes,
      reason: reason || null,
      status: 'requested',
    };
    // Foto del servicio al reservar (la base la valida y la copia del servicio real).
    const serviceRow = service
      ? { ...baseRow, service_id: service.id, service_name: service.name, price: service.price }
      : baseRow;
    const insertRow = (row: Record<string, any>) =>
      supabase.from('appointments').insert(row as any).select('id').single();

    let { data, error } = await insertRow(serviceRow);
    // Migración sin aplicar: las columnas no existen → la cita se pide igual, sin la foto.
    if (error && service && serviceColumnsMissing(error)) {
      ({ data, error } = await insertRow(baseRow));
    }

    if (error) {
      if (/invalid_service|service_inactive/i.test(String(error.message || ''))) {
        toast.error(t('mm2.servicios.booking.serviceUnavailable'));
        setSelected(null);
        reloadServices();
      } else {
        toast.error(error.message);
      }
      setSubmitting(false);
      return;
    }

    // Avisar al doctor de la nueva solicitud (campanita + push). Antes NO se notificaba:
    // la cita solo aparecía si el doctor abría "Mis citas" por su cuenta.
    try {
      const apptId = (data as any).id;
      const when = new Date(selected.scheduled_at).toLocaleString();
      const title = t('bookAppointment.notifyDoctorTitle');
      const baseMessage = t('bookAppointment.notifyDoctorMessage').replace('{when}', when);
      const message = service
        ? `${baseMessage} ${fill(t('mm2.servicios.booking.notifyService'), { service: service.name })}`
        : baseMessage;
      await supabase.from('notifications').insert({
        user_id: doctorId,
        type: 'system',
        title,
        message,
        data: {
          kind: 'appointment_request',
          appointment_id: apptId,
          deeplink: '/my-appointments',
          ...(service ? { service_id: service.id, service_name: service.name } : {}),
        },
      } as any);
      await supabase.functions.invoke('send-push-notification', {
        body: { user_ids: [doctorId], title, body: message, url: '/my-appointments' },
      }).catch(() => {});
    } catch (e) {
      console.error('notify doctor (appointment) failed:', e);
    }

    setConfirmation({
      scheduled_at: selected.scheduled_at,
      appointmentId: (data as any).id,
      serviceName: service ? service.name : null,
      price: service ? service.price : null,
    });
    setSubmitting(false);
  };

  if (loading || servicesLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </MainLayout>
    );
  }

  if (!doctor) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-lg text-center">
          <p className="text-muted-foreground mb-4">{t('bookAppointment.notFound')}</p>
          <Button variant="outline" onClick={() => navigate('/doctors')}>{t('bookAppointment.viewDirectory')}</Button>
        </div>
      </MainLayout>
    );
  }

  if (confirmation) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="text-center">
            <CardContent className="py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t('bookAppointment.confirmation.title')}</h2>
              <p className="text-muted-foreground text-sm mb-6">
                {t('bookAppointment.confirmation.sentToPrefix')} Dr. {doctor.name}. {t('bookAppointment.confirmation.sentToSuffix')}
              </p>
              <div className="text-sm bg-muted/40 rounded-lg p-4 mb-6 text-left">
                <p><strong>{t('bookAppointment.confirmation.doctorLabel')}</strong> Dr. {doctor.name}</p>
                <p><strong>{t('bookAppointment.confirmation.specialtyLabel')}</strong> {doctor.specialty}</p>
                {confirmation.serviceName && (
                  <p><strong>{t('mm2.servicios.booking.confirmationServiceLabel')}</strong> {confirmation.serviceName}</p>
                )}
                {confirmation.price !== null && (
                  <p className="flex items-center gap-1 flex-wrap">
                    <strong>{t('mm2.servicios.booking.confirmationPriceLabel')}</strong> {priceNode(confirmation.price)}
                  </p>
                )}
                <p><strong>{t('bookAppointment.confirmation.dateLabel')}</strong> {formatDate(confirmation.scheduled_at, language)} · {formatTime(confirmation.scheduled_at, language)}</p>
                <p className="text-xs text-muted-foreground mt-2">{t('bookAppointment.confirmation.idLabel')} <code>{confirmation.appointmentId}</code></p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/my-appointments')}>{t('bookAppointment.confirmation.myAppointments')}</Button>
                <Button onClick={() => navigate('/doctors')}>{t('bookAppointment.confirmation.findMoreDoctors')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <Button variant="back" size="sm" className="gap-1.5 mb-3" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> {t('bookAppointment.back')}
        </Button>

        {!isConsultationCountryAllowed(user?.countryCode) && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground flex items-start gap-2">
            <Stethoscope className="w-4 h-4 mt-0.5 flex-shrink-0 text-warning" />
            <span>{t('bookAppointment.mexicoOnlyNotice')}</span>
          </div>
        )}

        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14 border">
                <AvatarImage src={doctor.avatar_url || undefined} alt={doctor.name || ''} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {(doctor.name || t('bookAppointment.avatarFallback')).split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    {t('bookAppointment.header.titlePrefix')} Dr. {doctor.name}
                    <DoctorBadgeIcon userId={doctorId} size="sm" className="flex-shrink-0" />
                  </span>
                </CardTitle>
                {/* div y no CardDescription (<p>): las Badge son <div> y dentro de un <p> React avisaba de HTML inválido. */}
                <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
                  <span className="inline-flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />{doctor.specialty}</span>
                  {doctor.rating > 0 && <Badge variant="secondary" className="text-[10px]"><Star className="inline w-3 h-3 mr-0.5 fill-current align-[-2px]" aria-hidden="true" />{doctor.rating.toFixed(1)} · {doctor.total_consultations} {t('bookAppointment.header.consultationsSuffix')}</Badge>}
                  {fromPrice !== null ? (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {t('mm2.servicios.booking.from')} {priceNode(fromPrice)}
                    </Badge>
                  ) : (
                    doctor.consultation_fee > 0 && <Badge variant="outline" className="text-[10px]">${doctor.consultation_fee.toFixed(0)} {t('bookAppointment.header.feeSuffix')}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {services.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> {t('mm2.servicios.booking.pickTitle')}
              </CardTitle>
              <CardDescription>{t('mm2.servicios.booking.pickDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 fs-book-pick">
              {serviceGone && (
                <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs flex items-start gap-2" role="status">
                  <Info className="w-4 h-4 flex-shrink-0 text-warning" aria-hidden="true" />
                  <span>{t('mm2.servicios.booking.serviceGone')}</span>
                </p>
              )}
              <div className="fs-book-grid" role="group" aria-label={t('mm2.servicios.booking.pickTitle')}>
                {services.map((s) => {
                  const Icon = serviceIcon(s.icon);
                  const on = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseService(s.id)}
                      className={`fs-book-opt rounded-lg border p-3 transition-all hover:border-primary/60 ${
                        on ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
                      }`}
                    >
                      <span className="fs-book-ico" aria-hidden="true"><Icon /></span>
                      <span className="fs-book-body">
                        <span className="fs-book-name">{s.name}</span>
                        {s.description && <span className="fs-book-desc">{s.description}</span>}
                        <span className="fs-book-meta">
                          <span><Clock aria-hidden="true" /> {fill(t('mm2.publicProfile.minutes'), { n: s.duration_minutes })}</span>
                          <span>
                            {s.modality === 'presencial' ? <MapPin aria-hidden="true" /> : <Monitor aria-hidden="true" />}
                            {t(`mm2.servicios.modality.${s.modality}`)}
                          </span>
                          <b>{priceNode(s.price)}</b>
                        </span>
                      </span>
                      {on && <CheckCircle2 className="fs-book-check" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {needsService ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Tag className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('mm2.servicios.booking.chooseFirst')}</p>
            </CardContent>
          </Card>
        ) : groupedSlots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">{t('bookAppointment.empty.noSlots')}</p>
              <p className="text-xs text-muted-foreground">{t('bookAppointment.empty.chatHint')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/doctor/${doctorId}`)}>{t('bookAppointment.empty.viewProfile')}</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {groupedSlots.map(([dateKey, daySlots]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {new Date(dateKey).toLocaleDateString(LOCALE_MAP[language] || 'es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {daySlots.map((s) => {
                      const isSelected = selected?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`text-left rounded-lg border p-3 transition-all hover:border-primary/60 ${
                            // Fondo blanco también al elegirlo: con bg-primary/5 el turno quedaba casi transparente sobre el fondo teal.
                            isSelected ? 'border-primary bg-card ring-2 ring-primary/50' : 'border-border bg-card'
                          }`}
                        >
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            {formatTime(s.scheduled_at, language)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{selectedService ? slotMin : s.duration_minutes} {t('bookAppointment.minutes')}</p>
                          {s.title && <p className="text-[10px] text-muted-foreground/80 truncate mt-1">{s.title}</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('bookAppointment.confirm.title')}</CardTitle>
                  <CardDescription>
                    {formatDate(selected.scheduled_at, language)} · {formatTime(selected.scheduled_at, language)} ({selectedService ? slotMin : selected.duration_minutes} {t('bookAppointment.minutes')})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedService && (
                    <dl className="fs-book-sum">
                      <div>
                        <dt>{t('mm2.servicios.booking.summaryService')}</dt>
                        <dd>{selectedService.name}</dd>
                      </div>
                      <div>
                        <dt>{t('mm2.servicios.booking.summaryDuration')}</dt>
                        <dd>{fill(t('mm2.publicProfile.minutes'), { n: selectedService.duration_minutes })}</dd>
                      </div>
                      <div>
                        <dt>{t('mm2.servicios.booking.summaryPrice')}</dt>
                        <dd>{priceNode(selectedService.price, 'md')}</dd>
                      </div>
                    </dl>
                  )}
                  <div>
                    <Label htmlFor="reason">{t('bookAppointment.confirm.reasonLabel')}</Label>
                    <Textarea
                      id="reason"
                      placeholder={t('bookAppointment.confirm.reasonPlaceholder')}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('bookAppointment.confirm.disclaimer')}
                    {selectedService ? ` ${t('mm2.servicios.booking.priceNote')}` : ''}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setSelected(null)} disabled={submitting}>{t('bookAppointment.confirm.cancel')}</Button>
                    <Button onClick={book} disabled={submitting} className="gap-1.5">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {t('bookAppointment.confirm.submit')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
