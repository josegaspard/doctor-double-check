import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useAppDateFormat } from '@/lib/dateFormat';
import { doctorHref } from '@/lib/doctorSections';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarClock, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

// «Programar Live» (11-sep-2026). Antes insertaba en `lives` con status 'scheduled' y
// scheduled_at: ni ese estado existe en el enum live_status ni la columna en la tabla,
// así que el botón fallaba SIEMPRE en producción. Un Live programado es una fila de
// doctor_availability (type 'live'): es lo que pintan la Agenda, la portada de Lives y
// lo que dispara los avisos a seguidores (createAvailability ya avisa por su cuenta).
const DURATIONS = [30, 45, 60, 90, 120];

export function ScheduleCourseForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const { createAvailability } = useDoctorAvailability();
  // Programar avisa a los seguidores: el primer clic no ejecuta, antes va la revisión.
  const { confirm, dialog } = useConfirmAction();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!title.trim() || title.trim().length < 4) return toast.error(t('scheduleCourseForm.validation.titleTooShort'));
    if (!scheduledAt) return toast.error(t('scheduleCourseForm.validation.pickDateTime'));
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) return toast.error(t('scheduleCourseForm.validation.dateMustBeFuture'));

    const ok = await confirm({
      title: t('mm2.confirm.availabilityCreate.title'),
      description: t('mm2.confirm.availabilityCreate.descLive'),
      details: [
        { label: t('mm2.confirm.availabilityCommon.titleLabel'), value: title.trim() },
        { label: t('mm2.confirm.availabilityCommon.typeLabel'), value: 'Live' },
        { label: t('mm2.confirm.availabilityCommon.whenLabel'), value: `${fmt.formatDate(when)} · ${fmt.formatTime(when)}` },
        { label: t('mm2.confirm.availabilityCommon.durationLabel'), value: `${duration} min` },
      ],
      confirmLabel: t('mm2.confirm.availabilityCreate.cta'),
    });
    if (!ok) return;

    setSubmitting(true);
    const result = await createAvailability({
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 1000) || undefined,
      type: 'live',
      scheduledAt: when,
      durationMinutes: duration,
      extraInvitees: [],
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(t('scheduleCourseForm.toast.success'));
      setTitle(''); setDescription(''); setScheduledAt('');
      navigate(doctorHref('agenda', { tab: 'disponibilidad' }));
      return;
    }
    // RLS de Postgres: el médico no está aprobado para programar Lives.
    const rawMsg = result.error || '';
    if (/row-level security|violates row-level|42501/i.test(rawMsg)) {
      toast.error(t('contextErrors.notVerifiedToCreateLive'));
    } else {
      toast.error(rawMsg || t('scheduleCourseForm.toast.errorGeneric'));
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            {t('scheduleCourseForm.card.title')}
          </CardTitle>
          <CardDescription>
            {t('scheduleCourseForm.card.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('scheduleCourseForm.fields.titleLabel')}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder={t('scheduleCourseForm.fields.titlePlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('scheduleCourseForm.fields.descriptionLabel')}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder={t('scheduleCourseForm.fields.descriptionPlaceholder')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('scheduleCourseForm.fields.dateTimeLabel')}</Label>
              <Input type="datetime-local" value={scheduledAt} min={minDateTime} onChange={e => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('mm2.confirm.availabilityCommon.durationLabel')}</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('scheduleCourseForm.submit')}
          </Button>
        </CardContent>
      </Card>
      {dialog}
    </>
  );
}
