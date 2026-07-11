import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Stethoscope, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isConsultationCountryAllowed } from '@/lib/consultationRegions';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

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
const ORIENTATION_SLOT_MIN = 30;
const ORIENTATION_HORIZON_DAYS = 21;
const DAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
function generateOfficeHourSlots(
  doctorId: string,
  officeDays: string[] | null,
  start: string | null,
  end: string | null,
  bookedTimes: Set<string>,
  now: Date,
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
    for (let m = startMins; m + ORIENTATION_SLOT_MIN <= endMins; m += ORIENTATION_SLOT_MIN) {
      const dt = new Date(day);
      dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (dt.getTime() <= now.getTime()) continue;
      const iso = dt.toISOString();
      if (bookedTimes.has(iso)) continue;
      out.push({
        id: `gen-${iso}`,
        doctor_id: doctorId,
        title: '',
        description: null,
        scheduled_at: iso,
        duration_minutes: ORIENTATION_SLOT_MIN,
        type: 'consultation',
      });
    }
  }
  return out;
}

export default function BookAppointment() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ scheduled_at: string; appointmentId: string } | null>(null);

  useEffect(() => {
    if (!doctorId) return;
    const load = async () => {
      setLoading(true);
      // El paciente NO puede leer doctor_profiles/profiles directo (RLS: solo dueño/admin)
      // → esas queries .single() daban 406 y rompían TODO el booking. Usamos el RPC
      // público SECURITY DEFINER (mismo que usa /doctor/:id) que devuelve el perfil
      // público del doctor APROBADO con fee, horarios y datos de agenda.
      const [{ data: docRows }, { data: avs }, { data: appts }] = await Promise.all([
        supabase.rpc('get_doctor_public_profile', { p_user_id: doctorId }),
        supabase
          .from('doctor_availability')
          .select('id, doctor_id, title, description, scheduled_at, duration_minutes, type')
          .eq('doctor_id', doctorId)
          .in('type', ['available', 'consultation'])
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(50),
        supabase.from('appointments').select('availability_id, scheduled_at').eq('doctor_id', doctorId).in('status', ['requested', 'confirmed']),
      ]);

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
      const bookedTimes = new Set(
        apptRows.map((a) => (a.scheduled_at ? new Date(a.scheduled_at).toISOString() : null)).filter(Boolean) as string[]
      );
      const discreteSlots = (avs as any[] as Slot[]) || [];
      const discreteTimes = new Set(discreteSlots.map((s) => new Date(s.scheduled_at).toISOString()));
      const officeSlots = generateOfficeHourSlots(
        doctorId,
        (dp as any)?.office_days ?? null,
        (dp as any)?.office_hours_start ?? null,
        (dp as any)?.office_hours_end ?? null,
        bookedTimes,
        new Date(),
      ).filter((s) => !discreteTimes.has(new Date(s.scheduled_at).toISOString()));
      const merged = [...discreteSlots, ...officeSlots].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      setSlots(merged);
      setBookedSlotIds(new Set(apptRows.map((a) => a.availability_id).filter(Boolean)));
      setLoading(false);
    };
    load();
  }, [doctorId]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const s of slots) {
      if (bookedSlotIds.has(s.id)) continue;
      const key = new Date(s.scheduled_at).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [slots, bookedSlotIds]);

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
    setSubmitting(true);
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        doctor_id: doctorId,
        // Los turnos generados desde el horario semanal (id "gen-…") no tienen fila
        // en doctor_availability → availability_id null.
        availability_id: selected.id.startsWith('gen-') ? null : selected.id,
        scheduled_at: selected.scheduled_at,
        duration_minutes: selected.duration_minutes,
        reason: reason || null,
        status: 'requested',
      } as any)
      .select('id')
      .single();

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Avisar al doctor de la nueva solicitud (campanita + push). Antes NO se notificaba:
    // la cita solo aparecía si el doctor abría "Mis citas" por su cuenta.
    try {
      const apptId = (data as any).id;
      const when = new Date(selected.scheduled_at).toLocaleString();
      const title = t('bookAppointment.notifyDoctorTitle');
      const message = t('bookAppointment.notifyDoctorMessage').replace('{when}', when);
      await supabase.from('notifications').insert({
        user_id: doctorId,
        type: 'system',
        title,
        message,
        data: { kind: 'appointment_request', appointment_id: apptId, deeplink: '/my-appointments' },
      } as any);
      await supabase.functions.invoke('send-push-notification', {
        body: { user_ids: [doctorId], title, body: message, url: '/my-appointments' },
      }).catch(() => {});
    } catch (e) {
      console.error('notify doctor (appointment) failed:', e);
    }

    setConfirmation({ scheduled_at: selected.scheduled_at, appointmentId: (data as any).id });
    setSubmitting(false);
  };

  if (loading) {
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
                <CardDescription className="flex items-center gap-3 flex-wrap mt-1">
                  <span className="inline-flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />{doctor.specialty}</span>
                  {doctor.rating > 0 && <Badge variant="secondary" className="text-[10px]">★ {doctor.rating.toFixed(1)} · {doctor.total_consultations} {t('bookAppointment.header.consultationsSuffix')}</Badge>}
                  {doctor.consultation_fee > 0 && <Badge variant="outline" className="text-[10px]">${doctor.consultation_fee.toFixed(0)} {t('bookAppointment.header.feeSuffix')}</Badge>}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {groupedSlots.length === 0 ? (
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
                            isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
                          }`}
                        >
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            {formatTime(s.scheduled_at)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{s.duration_minutes} {t('bookAppointment.minutes')}</p>
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
                    {formatDate(selected.scheduled_at, language)} · {formatTime(selected.scheduled_at, language)} ({selected.duration_minutes} {t('bookAppointment.minutes')})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
