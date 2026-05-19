import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarClock, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export function ScheduleCourseForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const SPECIALTIES = [
    { value: 'Cardiología', label: t('scheduleCourseForm.specialties.cardiology') },
    { value: 'Pediatría', label: t('scheduleCourseForm.specialties.pediatrics') },
    { value: 'Ginecología', label: t('scheduleCourseForm.specialties.gynecology') },
    { value: 'Dermatología', label: t('scheduleCourseForm.specialties.dermatology') },
    { value: 'Neurología', label: t('scheduleCourseForm.specialties.neurology') },
    { value: 'Psicología', label: t('scheduleCourseForm.specialties.psychology') },
    { value: 'Medicina General', label: t('scheduleCourseForm.specialties.generalMedicine') },
    { value: 'Otro', label: t('scheduleCourseForm.specialties.other') },
  ];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('Medicina General');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!title.trim() || title.trim().length < 4) return toast.error(t('scheduleCourseForm.validation.titleTooShort'));
    if (!scheduledAt) return toast.error(t('scheduleCourseForm.validation.pickDateTime'));
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) return toast.error(t('scheduleCourseForm.validation.dateMustBeFuture'));

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('lives')
        .insert({
          doctor_id: user.id,
          title: title.trim().slice(0, 200),
          description: description.trim().slice(0, 1000) || null,
          specialty,
          status: 'scheduled' as any,
          scheduled_at: when.toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;

      // Notify followers
      try {
        await supabase.rpc('notify_subscribers', {
          p_doctor_id: user.id,
          p_notification_type: 'doctor_live' as any,
          p_title: t('scheduleCourseForm.notification.title'),
          p_message: `${title.trim()} — ${when.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`,
          p_data: { live_id: data?.id, scheduled_at: when.toISOString() },
        });
      } catch { /* non-blocking */ }

      toast.success(t('scheduleCourseForm.toast.success'));
      setTitle(''); setDescription(''); setScheduledAt('');
      navigate('/doctor/recordings?tab=lives-pasados');
    } catch (e: any) {
      // RLS de Postgres: el doctor no está aprobado para crear lives/cursos.
      const rawMsg: string = e?.message || '';
      const isRls =
        e?.code === '42501' ||
        /row-level security/i.test(rawMsg) ||
        /violates row-level/i.test(rawMsg);
      if (isRls) {
        toast.error(t('contextErrors.notVerifiedToCreateLive'));
      } else {
        toast.error(rawMsg || t('scheduleCourseForm.toast.errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
            <Label>{t('scheduleCourseForm.fields.specialtyLabel')}</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={specialty} onChange={e => setSpecialty(e.target.value)}>
              {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('scheduleCourseForm.fields.dateTimeLabel')}</Label>
            <Input type="datetime-local" value={scheduledAt} min={minDateTime} onChange={e => setScheduledAt(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t('scheduleCourseForm.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
