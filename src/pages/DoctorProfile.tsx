// Perfil público del médico · Directorio médico › Dra. X
// Diseño de Marta (mockup «perfil-publico-directorio.jpg», 12-sep-2026):
// migas · hero a todo el ancho (foto, nombre, especialidad, metadatos, bio,
// bloque de CTA a la derecha) · pestañas Perfil / Servicios y precios /
// Suscripciones / Lives · cuerpo 2/3 + 1/3. Toda la lógica (chat, pago,
// conexión de residente, seguir, bloquear, reseñas…) es la de siempre.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import DoctorReviews from '@/components/doctor/DoctorReviews';
import DoctorUpcomingEvents from '@/components/doctor/DoctorUpcomingEvents';
import DoctorCongresses from '@/components/doctor/DoctorCongresses';
import DoctorBooks from '@/components/doctor/DoctorBooks';
import { ServicesCard } from '@/components/doctor/public-profile/ServicesCard';
import { CareerCard } from '@/components/doctor/public-profile/CareerCard';
import { SubscriptionsCard } from '@/components/doctor/public-profile/SubscriptionsCard';
import { NextLiveCard } from '@/components/doctor/public-profile/NextLiveCard';
import { SectionTabs, useSectionParam, type SectionTabItem } from '@/components/common/SectionTabs';
import { BOOKING_SLOT_MIN } from '@/lib/booking';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Star, MessageSquare, Video, MapPin, Users, Radio, Loader2, Wallet, CreditCard, Clock, Shield,
  BadgeCheck, Home, ChevronRight, User, Tag, Calendar as CalendarIcon,
} from 'lucide-react';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import { ManualBadge } from '@/components/doctor/ManualBadge';
import { ProfileCategoryMark } from '@/components/profile/ProfileCategoryMark';
import { BlockUserButton } from '@/components/blocks/BlockUserButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isConsultationCountryAllowed } from '@/lib/consultationRegions';
import { useChat } from '@/contexts/ChatContext';
import { useWallet } from '@/contexts/WalletContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { money2, fill, initialsOf } from '@/lib/proFormat';
import { doctorHref } from '@/lib/doctorSections';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { toast } from 'sonner';
import '@/styles/diseno-perfil.css';

interface DoctorData {
  id: string;
  visibleId: string;
  name: string;
  specialty: string;
  bio?: string;
  rating: number;
  totalConsultations: number;
  consultationFee: number;
  location?: string;
  followersCount: number;
  avatarUrl?: string;
  officeHoursStart?: string;
  officeHoursEnd?: string;
  officeDays?: string[];
  countryFlag?: string;
  isIdentityVerified?: boolean;
  manualBadge?: string | null;
}

interface LiveData {
  id: string;
  title: string;
  viewerCount: number;
}

const PROFILE_TABS = ['perfil', 'servicios', 'suscripciones', 'lives'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

/** Minutos del tramo de orientación que ofrece el flujo de reserva (BookAppointment). */
const ORIENTATION_SLOT_MIN = BOOKING_SLOT_MIN;
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const { createSession } = useChat();
  const { balance, purchase, canAfford } = useWallet(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { t, language } = useLanguage();
  const { toggles } = useSiteToggles();
  // Pagar, abrir chat y pedir conexión pasan por la revisión: el primer clic no ejecuta.
  const { confirm, dialog } = useConfirmAction();
  const [tab, setTab] = useSectionParam<ProfileTab>('tab', PROFILE_TABS, 'perfil');
  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [activeLive, setActiveLive] = useState<LiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [residentConnectionStatus, setResidentConnectionStatus] = useState<string | null>(null);
  const [isRequestingConnection, setIsRequestingConnection] = useState(false);
  // «Ver sus Lives · N»: grabaciones publicadas del médico + Lives futuros programados.
  const [recordingsCount, setRecordingsCount] = useState<number | null>(null);
  const [upcomingLives, setUpcomingLives] = useState(0);
  // Los dos botones de seguir de la página (hero y tarjeta de suscripciones)
  // se vuelven a montar cuando uno cambia el estado, para que el otro lo relea.
  // Dos botones de seguir en la página (hero y tarjeta Suscripciones): tras seguir desde uno,
  // solo se remonta el OTRO; remontar el que se pulsó lo dejaba parpadeando en pleno uso.
  const [heroKey, setHeroKey] = useState(0);
  const [subsKey, setSubsKey] = useState(0);

  // Check if there's an active chat session with this specific doctor
  useEffect(() => {
    const checkActiveSession = async () => {
      if (!user?.id || !id) return;

      if (role === 'patient') {
        const { data } = await supabase
          .from('chat_sessions')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${user.id})`)
          .eq('status', 'active')
          .eq('is_double_check', false)
          .maybeSingle();
        setHasActiveSession(!!data);
      }

      // Check resident connection status
      if (role === 'resident') {
        const { data } = await supabase
          .from('doctor_resident_connections')
          .select('status')
          .eq('resident_id', user.id)
          .eq('doctor_id', id)
          .maybeSingle();
        setResidentConnectionStatus(data?.status || null);
      }
    };
    checkActiveSession();
  }, [user?.id, id, role]);

  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;

      const { data: doctorData, error } = await supabase.rpc(
        'get_doctor_public_profile',
        { p_user_id: id }
      );

      if (error) {
        console.error('Error fetching doctor profile:', error);
      }

      const doctorProfile = Array.isArray(doctorData) ? doctorData[0] : doctorData;

      if (doctorProfile) {
        setDoctor({
          id: doctorProfile.user_id,
          visibleId: doctorProfile.profile_id,
          name: doctorProfile.name || 'Doctor',
          specialty: doctorProfile.specialty,
          bio: doctorProfile.bio || undefined,
          rating: Number(doctorProfile.rating),
          totalConsultations: doctorProfile.total_consultations,
          consultationFee: Number(doctorProfile.consultation_fee),
          location: doctorProfile.location || undefined,
          followersCount: doctorProfile.followers_count,
          avatarUrl: doctorProfile.avatar_url || undefined,
          officeHoursStart: doctorProfile.office_hours_start || undefined,
          officeHoursEnd: doctorProfile.office_hours_end || undefined,
          officeDays: doctorProfile.office_days || undefined,
          countryFlag: doctorProfile.country_flag || undefined,
          isIdentityVerified: (doctorProfile as any).is_identity_verified || false,
          manualBadge: (doctorProfile as any).manual_badge ?? null,
        });

        const { data: liveData } = await supabase
          .from('lives')
          .select('id, title, viewer_count')
          .eq('doctor_id', doctorProfile.user_id)
          .eq('status', 'live')
          .maybeSingle();

        if (liveData) {
          setActiveLive({
            id: liveData.id,
            title: liveData.title,
            viewerCount: liveData.viewer_count,
          });
        }
      } else if (user?.id === id) {
        // Current user is viewing their own pending profile
        const [{ data: profileData }, { data: dpData }] = await Promise.all([
          supabase.from('profiles').select('name, avatar_url').eq('id', id).single(),
          supabase.from('doctor_profiles').select('*').eq('user_id', id).single(),
        ]);

        if (dpData && profileData) {
          setIsPending(dpData.status === 'pending');
          setDoctor({
            id: id,
            visibleId: dpData.id,
            name: profileData.name || 'Doctor',
            specialty: dpData.specialty,
            bio: dpData.bio || undefined,
            rating: Number(dpData.rating),
            totalConsultations: dpData.total_consultations,
            consultationFee: Number(dpData.consultation_fee),
            location: dpData.location || undefined,
            followersCount: dpData.followers_count,
            avatarUrl: profileData.avatar_url || undefined,
            manualBadge: (dpData as any).manual_badge ?? null,
          });
        }
      }
      setIsLoading(false);
    };

    fetchDoctor();

    const channel = supabase
      .channel('doctor-live-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lives' },
        (payload) => {
          if (payload.new && (payload.new as any).doctor_id === doctor?.id) {
            const live = payload.new as any;
            if (live.status === 'live') {
              setActiveLive({
                id: live.id,
                title: live.title,
                viewerCount: live.viewer_count,
              });
            } else {
              setActiveLive(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Grabaciones publicadas de este médico (misma tabla que lee /recordings?doctor=…),
  // solo para el contador de «Ver sus Lives · N». Si no se puede leer, no se pinta el número.
  useEffect(() => {
    if (!doctor?.id) return;
    let alive = true;
    (async () => {
      const { count, error } = await supabase
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('doctor_id', doctor.id);
      if (alive && !error && typeof count === 'number') setRecordingsCount(count);
    })();
    return () => { alive = false; };
  }, [doctor?.id]);

  const isFreeConsultation = doctor?.consultationFee === 0;
  const canChatDirectly = role === 'doctor' || hasActiveSession || isFreeConsultation;

  const startChatSession = async () => {
    if (!user?.id || !doctor) return;
    const ok = await confirm({
      title: fill(t('mm2.confirm.startChat.title'), { name: doctor.name }),
      description: t('mm2.confirm.startChat.desc'),
      details: [
        { label: t('mm2.confirm.startChat.doctorLabel'), value: doctor.name },
        { label: t('mm2.patients.chatConfirm.type'), value: t('mm2.patients.chatConfirm.typeValue') },
      ],
      confirmLabel: t('mm2.confirm.startChat.cta'),
    });
    if (!ok) return;

    setIsStartingChat(true);
    try {
      const result = await createSession(doctor.id, 'doctor', false);

      if (result.success && result.session) {
        try {
          await supabase.functions.invoke('notify-new-chat', {
            body: {
              doctorId: doctor.id,
              patientName: user.name,
              sessionId: result.session.id,
              isDoubleCheck: false,
            },
          });
        } catch (notifyError) {
          console.error('Error notifying doctor:', notifyError);
        }

        navigate(`/chat?session=${result.session.id}`);
        toast.success(`${t('doctorProfile.chatStarted')} ${doctor.name}`);
      } else {
        toast.error(result.error || t('doctorProfile.chatError'));
      }
    } catch (error) {
      toast.error(t('doctorProfile.chatError'));
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleRequestConnection = async () => {
    if (!user?.id || !doctor) return;
    const ok = await confirm({
      title: t('mm2.community.confirmConnectTitle'),
      description: t('mm2.community.confirmConnectDesc'),
      details: [
        { label: t('mm2.community.confirmDoctor'), value: doctor.name || '—' },
        { label: t('mm2.community.confirmSpecialty'), value: doctor.specialty || '—' },
      ],
      confirmLabel: t('mm2.community.confirmConnectCta'),
    });
    if (!ok) return;
    setIsRequestingConnection(true);
    try {
      const { error } = await supabase.from('doctor_resident_connections').insert({
        resident_id: user.id,
        doctor_id: doctor.id,
        status: 'pending',
      });
      if (error) throw error;
      setResidentConnectionStatus('pending');
      toast.success(t('doctorProfile.connectionRequested'));
    } catch (err: any) {
      toast.error(err.message || t('doctorProfile.connectionError'));
    } finally {
      setIsRequestingConnection(false);
    }
  };

  const handleStartConsultation = async () => {
    if (!isAuthenticated || !user?.id) {
      navigate('/login');
      return;
    }

    if (!doctor) return;

    // Consultas solo para México por ahora (cliente 2026-06-29).
    if (!isConsultationCountryAllowed(user.countryCode)) {
      toast.error(t('bookAppointment.toastMexicoOnly'));
      return;
    }

    // Patient chat globally disabled by admin toggle → block EVERY chat-start
    // path (resident, doctor-direct, free, and paid) before any DB session is
    // created or a doctor notification email is sent.
    if (!toggles.enable_patient_chat) {
      toast.error(t('featureUnavailable.title') || 'Esta función no está disponible en este momento.');
      return;
    }

    // Resident flow
    if (role === 'resident') {
      if (residentConnectionStatus === 'accepted') {
        await startChatSession();
      } else if (residentConnectionStatus === 'pending') {
        toast.info(t('doctorProfile.connectionPending'));
      } else {
        await handleRequestConnection();
      }
      return;
    }

    // Doctor flow — direct chat
    if (role === 'doctor') {
      await startChatSession();
      return;
    }

    // Patient flow
    if (role !== 'patient') {
      toast.error(t('doctorProfile.onlyPatients'));
      return;
    }

    if (canChatDirectly) {
      await startChatSession();
      return;
    }

    setShowPaymentModal(true);
  };

  const handleWalletPayment = async () => {
    if (!doctor || !user?.id) return;

    // Don't charge for a chat consultation if patient chat is disabled — the
    // user would pay and then land on "feature unavailable".
    if (!toggles.enable_patient_chat) {
      setShowPaymentModal(false);
      toast.error(t('featureUnavailable.title') || 'Esta función no está disponible en este momento.');
      return;
    }

    const ok = await confirm({
      title: t('mm2.confirm.payConsultation.title'),
      description: t('mm2.confirm.payConsultation.desc'),
      tone: 'payment',
      details: [
        { label: t('mm2.confirm.payCommon.conceptLabel'), value: doctor.name },
        { label: t('mm2.confirm.payCommon.methodLabel'), value: t('mm2.confirm.payCommon.methodWallet') },
        { label: t('mm2.confirm.payCommon.balanceNowLabel'), value: money2(balance, language) },
        { label: t('mm2.confirm.payCommon.balanceAfterLabel'), value: money2(Math.max(0, balance - doctor.consultationFee), language) },
        { label: t('mm2.confirm.payCommon.amountLabel'), value: money2(doctor.consultationFee, language), emphasis: true },
      ],
      confirmLabel: t('mm2.confirm.payCommon.confirmLabel'),
    });
    if (!ok) return;

    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.rpc('process_consultation_purchase', {
        p_doctor_id: doctor.id,
        p_amount: doctor.consultationFee,
        p_patient_name: user.name || 'Paciente',
      });

      if (error) {
        console.error('Consultation purchase error:', error);
        toast.error(error.message || t('doctorProfile.paymentError'));
        return;
      }

      const result = data as {
        success: boolean;
        error?: string;
        amount_charged?: number;
        session_id?: string;
        consultation_id?: string;
      };

      if (result.success) {
        setShowPaymentModal(false);
        toast.success(t('doctorProfile.paymentSuccess'));
        navigate(`/chat?session=${result.session_id}`);
      } else {
        toast.error(result.error || t('doctorProfile.paymentError'));
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(t('doctorProfile.paymentError'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStripePayment = async () => {
    if (!doctor) return;

    // Same gate as wallet: no paid chat consultation when patient chat is off.
    if (!toggles.enable_patient_chat) {
      setShowPaymentModal(false);
      toast.error(t('featureUnavailable.title') || 'Esta función no está disponible en este momento.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-consultation-checkout', {
        body: {
          doctorId: doctor.id,
          consultationFee: doctor.consultationFee,
          doctorName: doctor.name,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(t('doctorProfile.paymentError'));
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      toast.error(t('doctorProfile.paymentError'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // «Solicitar consulta» / «Reservar»: Orientación en el calendario del doctor (cliente 2026-07-07).
  const goBook = () => {
    if (!doctor) return;
    if (role === 'patient' || role === 'resident') { navigate(`/book/${doctor.id}`); return; }
    if (!isAuthenticated) { navigate('/login'); return; }
    toast.info(t('doctorProfile.onlyPatients'));
  };

  // Tras seguir / dejar de seguir: releer el contador de seguidores y
  // volver a montar el otro botón de seguir de la página.
  const refreshAfterSubscription = async (origen: 'hero' | 'subs') => {
    if (!doctor) return;
    await new Promise(r => setTimeout(r, 1000));
    const { data } = await supabase.rpc('get_doctor_public_profile', { p_user_id: doctor.id });
    const profile = Array.isArray(data) ? data[0] : data;
    if (profile) setDoctor(prev => prev ? { ...prev, followersCount: profile.followers_count } : prev);
    setTimeout(() => { if (origen === 'hero') setSubsKey(k => k + 1); else setHeroKey(k => k + 1); }, 1500);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="pro-container pro-page">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-56 rounded bg-white/30" />
            <div className="h-72 rounded-[18px] bg-white/60" />
            <div className="h-64 rounded-[18px] bg-white/40" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!doctor) {
    return (
      <MainLayout>
        <div className="pro-container pro-page text-center">
          <div className="pro-card pro-card-pad bg-card inline-block">
            <h1 className="font-heading text-2xl font-bold mb-4 pro-ink">{t('doctorProfile.notFound')}</h1>
            <Button onClick={() => navigate('/lives')}>{t('doctorProfile.backToLives')}</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const showPendingBanner = isPending && user?.id === id;
  const isSelf = user?.id === doctor?.id;
  const directoryHref = role === 'doctor' ? doctorHref('comunidad', { tab: 'descubrir', ver: 'medicos' }) : '/doctors';
  // Mismo destino que tenía el botón «Ver Lives» de siempre.
  const livesHref = `/recordings?doctor=${doctor.id}`;
  const livesCount = (recordingsCount || 0) + upcomingLives;

  // Horario de atención: línea discreta bajo el bloque de CTA.
  // «Disponible ahora» es un cálculo del navegador sobre el horario publicado,
  // no una confirmación en tiempo real del médico: lleva descargo.
  const hasHours = !!(doctor.officeHoursStart && doctor.officeHoursEnd);
  const activeDays = (doctor.officeDays || []).filter(Boolean);
  let isInHours = false;
  if (hasHours && activeDays.length) {
    const now = new Date();
    const dayMap: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
    const todayNum = now.getDay();
    const isToday = activeDays.some(d => dayMap[d.toLowerCase()] === todayNum);
    const [startH, startM] = doctor.officeHoursStart.split(':').map(Number);
    const [endH, endM] = doctor.officeHoursEnd.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    isInHours = isToday && nowMins >= startH * 60 + startM && nowMins <= endH * 60 + endM;
  }
  // «Lun–Vie» cuando los días son seguidos; «Lun, Mié, Vie» cuando no.
  const dayIdx = [...new Set(activeDays.map(d => DAY_ORDER.indexOf(d.toLowerCase())).filter(i => i >= 0))].sort((a, b) => a - b);
  const dayLab = (i: number) => t(`doctorProfile.${DAY_ORDER[i]}`);
  const dayRuns: string[] = [];
  for (let s = 0; s < dayIdx.length;) {
    let e = s;
    while (e + 1 < dayIdx.length && dayIdx[e + 1] === dayIdx[e] + 1) e++;
    dayRuns.push(e - s >= 2 ? `${dayLab(dayIdx[s])}–${dayLab(dayIdx[e])}` : dayIdx.slice(s, e + 1).map(dayLab).join(', '));
    s = e + 1;
  }
  const daysLabel = dayRuns.join(', ');
  const hoursLabel = hasHours ? `${doctor.officeHoursStart.slice(0, 5)}–${doctor.officeHoursEnd.slice(0, 5)}` : '';
  const attendsLabel = fill(t('mm2.publicProfile.attends'), { days: daysLabel, hours: hoursLabel }).replace(/\s+/g, ' ').trim();

  const chatLabel = isStartingChat
    ? t('doctorProfile.starting')
    : role === 'resident'
      ? residentConnectionStatus === 'accepted'
        ? t('doctorProfile.chat')
        : residentConnectionStatus === 'pending'
          ? t('doctorProfile.connectionPending')
          : t('doctorProfile.requestConnection')
      : (isFreeConsultation || canChatDirectly)
        ? t('doctorProfile.chat')
        : (
          <>
            {t('doctorProfile.chat')} (<PriceDisplay amount={doctor.consultationFee} size="sm" />)
          </>
        );

  const tabItems: SectionTabItem<ProfileTab>[] = [
    { id: 'perfil', label: t('mm2.publicProfile.tabProfile'), icon: User },
    { id: 'servicios', label: t('mm2.publicProfile.tabServices'), icon: Tag },
    { id: 'suscripciones', label: t('mm2.publicProfile.tabSubscriptions'), icon: CreditCard },
    { id: 'lives', label: t('mm2.publicProfile.tabLives'), icon: Radio },
  ];

  const subsCard = (
    <SubscriptionsCard
      doctorId={doctor.id}
      doctorName={doctor.name}
      isOwner={isSelf}
      refreshKey={subsKey}
      onSubscriptionChange={() => refreshAfterSubscription('subs')}
    />
  );
  const liveCard = (
    <NextLiveCard doctorId={doctor.id} activeLive={activeLive} allHref={livesHref} onUpcomingCount={setUpcomingLives} />
  );

  return (
    <MainLayout>
      <div className="pro-container pro-page pp-shell">
        {/* Migas: ⌂ Directorio médico › Dra. X */}
        <nav className="pp-crumbs" aria-label={t('mm2.publicProfile.breadcrumbAria')}>
          <Link to={directoryHref}><Home /> {t('mm2.publicProfile.breadcrumbDirectory')}</Link>
          <ChevronRight className="sep" aria-hidden="true" />
          <span className="cur">{doctor.name}</span>
        </nav>

        {/* Pending Verification Banner */}
        {showPendingBanner && (
          <div className="pro-card pp-banner bg-card">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('doctorProfilePage.pendingVerificationTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('doctorProfilePage.pendingVerificationDesc')}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Shield className="w-3 h-3" />
                    {t('doctorProfilePage.underReview')}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{t('doctorProfilePage.estimatedTime')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Indicator Banner */}
        {activeLive && (
          <div
            className="pro-card pp-banner pp-banner-live bg-card"
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/live/${activeLive.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/live/${activeLive.id}`); }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pro-pill pro-pill-live">{t('doctorProfile.live')}</span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {activeLive.viewerCount} {t('doctorProfile.watching')}
                    </span>
                  </div>
                  <p className="font-medium text-sm mt-1">{activeLive.title}</p>
                </div>
              </div>
              <button type="button" className="pro-btn pro-btn-live pro-btn-sm w-full sm:w-auto">
                <Video />
                {t('doctorProfile.watchNow')}
              </button>
            </div>
          </div>
        )}

        {/* Hero: foto · nombre · especialidad · metadatos · bio  |  CTA */}
        <section className="pro-card pp-hero bg-card">
          <div className="pp-hero-main">
            <div className="pp-photo">
              {doctor.avatarUrl ? (
                <img src={doctor.avatarUrl} alt={doctor.name} />
              ) : (
                <span className="pp-initials" aria-hidden="true">{initialsOf(doctor.name)}</span>
              )}
            </div>
            <div className="pp-id">
              <div className="pp-name-row">
                <h1 className="pp-name">{doctor.countryFlag ? `${doctor.countryFlag} ` : ''}{doctor.name}</h1>
                {doctor.isIdentityVerified && (
                  <BadgeCheck className="pp-verified" role="img" aria-label={t('doctorProfile.verified')} />
                )}
                {!isSelf && (
                  <span className="pp-follow">
                    <SubscribeButton
                      key={`pp-follow-${heroKey}`}
                      doctorId={doctor.id}
                      doctorName={doctor.name}
                      size="sm"
                      variant="outline"
                      showUpgrade={false}
                      onSubscriptionChange={() => refreshAfterSubscription('hero')}
                    />
                  </span>
                )}
              </div>
              <div className="pp-spec">{doctor.specialty}</div>
              <div className="pp-badges">
                <ManualBadge badge={doctor.manualBadge} size="lg" iconOnly />
                {/* Categoría de perfil: estrella / punto morado / punto verde (cliente 2026-08-28) */}
                <ProfileCategoryMark userId={doctor.id} size="md" withLabel />
                <DoctorBadge type={getDoctorBadgeType(doctor.totalConsultations, doctor.rating, (doctor as any).badgeOverride)} size="sm" />
              </div>
              <div className="pp-meta">
                {doctor.location && <span><MapPin /> {doctor.location}</span>}
                <span>
                  <Users />
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={doctor.followersCount}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      {doctor.followersCount}
                    </motion.span>
                  </AnimatePresence>
                  {' '}{t('doctorProfile.followers')}
                </span>
                {doctor.rating > 0 && <span className="star"><Star /> {doctor.rating.toFixed(1)}</span>}
              </div>
              {doctor.bio && (
                <>
                  <p className={`pp-bio ${bioExpanded ? '' : 'is-clamped'}`}>{doctor.bio}</p>
                  {(bioExpanded || doctor.bio.length > 200) && (
                    <button type="button" className="pp-more" onClick={() => setBioExpanded(v => !v)}>
                      {bioExpanded ? t('doctorProfile.readLess') : t('doctorProfile.readMore')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="pp-cta">
            <div className="pp-cta-from">
              <span>{t('mm2.publicProfile.feeFrom')}</span>
              <b>{isFreeConsultation ? t('doctorProfile.free') : <PriceDisplay amount={doctor.consultationFee} size="lg" />}</b>
            </div>
            {!isSelf && (
              <button type="button" className="pro-btn pro-btn-teal pp-cta-primary" onClick={goBook}>
                <CalendarIcon /> {t('mm2.publicProfile.requestConsultation')}
              </button>
            )}
            <button type="button" className="pro-btn pro-btn-outline" onClick={() => setTab('lives')}>
              <Radio /> {t('mm2.publicProfile.viewLives')}{livesCount > 0 ? ` · ${livesCount}` : ''}
            </button>
            {!isSelf && (
              <div className="pp-cta-row">
                <button
                  type="button"
                  className="pro-btn pro-btn-outline pro-btn-sm"
                  onClick={handleStartConsultation}
                  disabled={isStartingChat || isRequestingConnection || (role === 'resident' && residentConnectionStatus === 'pending')}
                >
                  {(isStartingChat || isRequestingConnection) ? <Loader2 className="animate-spin" /> : <MessageSquare />}
                  <span>{chatLabel}</span>
                </button>
                <BlockUserButton targetUserId={doctor.id} targetUserName={doctor.name} size="icon" />
              </div>
            )}
            <p className="pp-cta-phrase">
              {fill(t('mm2.publicProfile.connectPhrase'), { name: doctor.name, specialty: doctor.specialty || '' })}
            </p>
            {(hasHours || activeDays.length > 0) && (
              <div className="pp-hours">
                <span><Clock /> {hasHours ? attendsLabel : daysLabel}</span>
                {hasHours && activeDays.length > 0 && (
                  <span className={`pro-pill ${isInHours ? 'pro-pill-ok' : 'pro-pill-muted'}`}>
                    {isInHours ? t('doctorProfile.availableNow') : t('doctorProfile.notAvailableNow')}
                  </span>
                )}
              </div>
            )}
            {hasHours && <p className="pp-disclaimer">{t('mm2.publicProfile.hoursDisclaimer')}</p>}
          </aside>
        </section>

        {/* Cuerpo: pestañas + 2/3 · 1/3 */}
        <div className="pp-body">
          <div className="pp-main">
            <SectionTabs<ProfileTab>
              value={tab}
              onChange={setTab}
              items={tabItems}
              variant="onLight"
              ariaLabel={t('mm2.publicProfile.tabsAria')}
              className="pp-tabs"
            />

            {(tab === 'perfil' || tab === 'servicios') && (
              <ServicesCard
                consultationFee={doctor.consultationFee}
                durationMinutes={ORIENTATION_SLOT_MIN}
                canBook={!isSelf}
                onBook={goBook}
              />
            )}

            {tab === 'perfil' && <CareerCard doctorId={doctor.id} isOwner={isSelf} />}

            {tab === 'suscripciones' && subsCard}
            {tab === 'lives' && liveCard}

            {tab === 'perfil' && (
              <>
                {/* Libros/cursos PDF de pago del doctor (cliente 2026-07-08): solo si hay alguno o si es el dueño. */}
                <div className="pp-embed"><DoctorBooks doctorId={doctor.id} isOwner={isSelf} /></div>
                {/* Congresos donde este doctor es conferencista (en vivo, próximos y archivados) */}
                <div className="pp-embed"><DoctorCongresses doctorId={doctor.id} /></div>
                {/* Upcoming events organized by this doctor */}
                <div className="pp-embed"><DoctorUpcomingEvents doctorId={doctor.id} /></div>
                {/* Patient Reviews */}
                <div className="pp-embed">
                  <DoctorReviews
                    doctorId={doctor.id}
                    onRatingCalculated={(avg) => setDoctor(prev => prev ? { ...prev, rating: avg } : prev)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="pp-side">
            {tab !== 'suscripciones' && subsCard}
            {tab !== 'lives' && liveCard}
          </div>
        </div>

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                {t('doctorProfile.paymentTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('doctorProfile.paymentDescription').replace('{name}', doctor.name).replace('${price}', String(doctor.consultationFee))}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Wallet Payment Option */}
              <Card
                className={`cursor-pointer transition-colors ${
                  canAfford(doctor.consultationFee)
                    ? 'hover:border-primary'
                    : 'opacity-60'
                }`}
                onClick={() => canAfford(doctor.consultationFee) && handleWalletPayment()}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{t('doctorProfile.payWithBalance')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('doctorProfile.availableBalance').replace('${balance}', balance.toFixed(2))}
                        </p>
                      </div>
                    </div>
                    {canAfford(doctor.consultationFee) ? (
                      <Badge variant="secondary">{t('doctorProfile.available')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('doctorProfile.insufficientBalance')}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recargar Wallet — solo cuando hay saldo insuficiente */}
              {!canAfford(doctor.consultationFee) && (
                <Card
                  className="cursor-pointer hover:border-primary transition-colors border-dashed"
                  onClick={() => { setShowPaymentModal(false); navigate('/wallet'); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t('doctorProfile.topUpBalance')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('doctorProfile.topUpBalanceDesc')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{t('doctorProfile.topUpAction')}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card Payment Option */}
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={handleStripePayment}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{t('doctorProfile.payWithCard')}</p>
                        <p className="text-sm text-muted-foreground">
                          Visa, Mastercard, AMEX
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Stripe</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {isProcessingPayment && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('doctorProfile.processing')}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {dialog}
    </MainLayout>
  );
}
