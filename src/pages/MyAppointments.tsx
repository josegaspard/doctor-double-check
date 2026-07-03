import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Clock, Stethoscope, Loader2, X, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

interface Appt {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason: string | null;
  daily_room_url: string | null;
  cancellation_reason: string | null;
  doctor_name?: string | null;
  doctor_avatar?: string | null;
  patient_name?: string | null;
  patient_avatar?: string | null;
  specialty?: string | null;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function MyAppointments() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const STATUS_BADGE: Record<string, { label: string; variant: any; cls?: string }> = {
    requested: { label: t('myAppointments.statusRequested'), variant: 'secondary' },
    confirmed: { label: t('myAppointments.statusConfirmed'), variant: 'default', cls: 'bg-success' },
    cancelled: { label: t('myAppointments.statusCancelled'), variant: 'destructive' },
    completed: { label: t('myAppointments.statusCompleted'), variant: 'outline' },
  };

  const fetchAppts = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    const userColumn = role === 'doctor' ? 'doctor_id' : 'patient_id';
    let q = supabase
      .from('appointments')
      .select('id, patient_id, doctor_id, scheduled_at, duration_minutes, status, reason, daily_room_url, cancellation_reason')
      .eq(userColumn, user.id);

    if (tab === 'upcoming') {
      q = q.gte('scheduled_at', now).in('status', ['requested', 'confirmed']).order('scheduled_at', { ascending: true });
    } else {
      q = q.or(`scheduled_at.lt.${now},status.in.(cancelled,completed)`).order('scheduled_at', { ascending: false });
    }

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data as any[]) || [];

    // Enrich with counterpart profiles
    const otherIds = [...new Set(rows.map((r) => (role === 'doctor' ? r.patient_id : r.doctor_id)))];
    const profMap: Record<string, any> = {};
    const specMap: Record<string, string> = {};
    if (otherIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name, avatar_url').in('id', otherIds);
      (profs || []).forEach((p: any) => (profMap[p.id] = p));
      if (role !== 'doctor') {
        const { data: dps } = await supabase.from('doctor_profiles').select('user_id, specialty').in('user_id', otherIds);
        (dps || []).forEach((d: any) => (specMap[d.user_id] = d.specialty));
      }
    }

    setAppts(
      rows.map((r) => {
        const otherId = role === 'doctor' ? r.patient_id : r.doctor_id;
        const prof = profMap[otherId] || {};
        return {
          ...r,
          doctor_name: role === 'doctor' ? null : prof.name,
          doctor_avatar: role === 'doctor' ? null : prof.avatar_url,
          patient_name: role === 'doctor' ? prof.name : null,
          patient_avatar: role === 'doctor' ? prof.avatar_url : null,
          specialty: specMap[otherId] || null,
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchAppts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab, role]);

  const cancelAppt = async (id: string) => {
    if (!confirm(t('myAppointments.confirmCancel'))) return;
    setCancelling(id);
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: t('myAppointments.cancelledByUser') } as any)
      .eq('id', id);
    setCancelling(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('myAppointments.toastCancelled'));
    fetchAppts();
  };

  const confirmAppt = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' } as any).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('myAppointments.toastConfirmed'));
    supabase.functions.invoke('send-appointment-confirmation', { body: { appointmentId: id } })
      .catch((e) => console.warn('send-appointment-confirmation failed:', e));
    fetchAppts();
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" />
              {role === 'doctor' ? t('myAppointments.titleDoctor') : t('myAppointments.titlePatient')}
            </h1>
            <p className="text-sm text-muted-foreground">{role === 'doctor' ? t('myAppointments.subtitleDoctor') : t('myAppointments.subtitlePatient')}</p>
          </div>
          {role !== 'doctor' && (
            <Button onClick={() => navigate('/doctors')} size="sm">{t('myAppointments.findDoctor')}</Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="grid grid-cols-2 w-full sm:w-fit">
            <TabsTrigger value="upcoming">{t('myAppointments.tabUpcoming')}</TabsTrigger>
            <TabsTrigger value="past">{t('myAppointments.tabPast')}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : appts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                {tab === 'upcoming' ? t('myAppointments.emptyUpcoming') : t('myAppointments.emptyPast')}
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {appts.map((a) => {
                  const badge = STATUS_BADGE[a.status] || STATUS_BADGE.requested;
                  const counterpart = role === 'doctor' ? a.patient_name : a.doctor_name;
                  const counterpartAvatar = role === 'doctor' ? a.patient_avatar : a.doctor_avatar;
                  const liveSoon = a.status === 'confirmed' && Math.abs(new Date(a.scheduled_at).getTime() - Date.now()) < 30 * 60_000;
                  return (
                    <Card key={a.id}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <Avatar className="w-12 h-12 border">
                          <AvatarImage src={counterpartAvatar || undefined} alt={counterpart || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {(counterpart || (role === 'doctor' ? t('myAppointments.fallbackPatient') : t('myAppointments.fallbackDoctor'))).split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm inline-flex items-center gap-1 min-w-0">
                                <span className="truncate">{role === 'doctor' ? counterpart : `${t('myAppointments.doctorPrefix')} ${counterpart}`}</span>
                                {role !== 'doctor' && <DoctorBadgeIcon userId={a.doctor_id} size="sm" className="flex-shrink-0" />}
                              </p>
                              {a.specialty && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1"><Stethoscope className="w-3 h-3" />{a.specialty}</p>
                              )}
                            </div>
                            <Badge {...({} as any)} variant={badge.variant} className={`text-[10px] ${badge.cls || ''}`}>{badge.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{formatDate(a.scheduled_at)}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(a.scheduled_at)} · {a.duration_minutes} {t('myAppointments.minutes')}</span>
                          </div>
                          {a.reason && <p className="mt-2 text-xs text-foreground/80 line-clamp-2 italic">"{a.reason}"</p>}
                          {a.cancellation_reason && a.status === 'cancelled' && (
                            <p className="mt-1 text-[11px] text-destructive">{a.cancellation_reason}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {role === 'doctor' && a.status === 'requested' && (
                            <Button size="sm" className="bg-success hover:bg-success h-7 text-xs" onClick={() => confirmAppt(a.id)}>{t('myAppointments.confirm')}</Button>
                          )}
                          {liveSoon && a.daily_room_url && (
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => window.open(a.daily_room_url!, '_blank')}>
                              <Video className="w-3 h-3" /> {t('myAppointments.enter')}
                            </Button>
                          )}
                          {tab === 'upcoming' && a.status !== 'cancelled' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" disabled={cancelling === a.id} onClick={() => cancelAppt(a.id)}>
                              {cancelling === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              {t('myAppointments.cancel')}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
