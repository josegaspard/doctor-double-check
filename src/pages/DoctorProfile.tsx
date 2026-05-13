import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import DoctorCredentials from '@/components/doctor/DoctorCredentials';
import DoctorReviews from '@/components/doctor/DoctorReviews';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Stethoscope, Star, Award, MessageSquare, Video, MapPin, Users, Radio, Loader2, Wallet, CreditCard, Clock, Shield, CheckCircle, Bell, Calendar as CalendarIcon } from 'lucide-react';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { DoctorBadge, getDoctorBadgeType } from '@/components/doctor/DoctorBadge';
import { BlockUserButton } from '@/components/blocks/BlockUserButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

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
}

interface LiveData {
  id: string;
  title: string;
  viewerCount: number;
}

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const { createSession } = useChat();
  const { balance, purchase, canAfford } = useWallet();
  const { t } = useLanguage();
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

  const isFreeConsultation = doctor?.consultationFee === 0;
  const canChatDirectly = role === 'doctor' || hasActiveSession || isFreeConsultation;

  const startChatSession = async () => {
    if (!user?.id || !doctor) return;

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
        
        navigate('/chat');
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-3xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!doctor) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-3xl text-center">
          <h1 className="text-2xl font-bold mb-4">{t('doctorProfile.notFound')}</h1>
          <Button onClick={() => navigate('/lives')}>{t('doctorProfile.backToLives')}</Button>
        </div>
      </MainLayout>
    );
  }

  const showPendingBanner = isPending && user?.id === id;
  const isSelf = user?.id === doctor?.id;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('doctorProfile.back')}
        </Button>

        {/* Pending Verification Banner */}
        {showPendingBanner && (
          <Card className="mb-4 border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Verificación pendiente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tu perfil está siendo revisado por nuestro equipo. Mientras tanto, puedes completar tu información.
                    Te notificaremos por email cuando tu cuenta sea aprobada.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Shield className="w-3 h-3" />
                      En revisión
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Tiempo estimado: 24-48 horas</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Indicator Banner */}
        {activeLive && (
          <Card 
            className="mb-4 border-destructive/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
            onClick={() => navigate(`/live/${activeLive.id}`)}
          >
            <CardContent className="p-4">
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
                      <Badge variant="destructive" className="gap-1">
                        <Radio className="w-3 h-3" />
                        {t('doctorProfile.live')}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activeLive.viewerCount} {t('doctorProfile.watching')}
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1">{activeLive.title}</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" className="gap-1 w-full sm:w-auto">
                  <Video className="w-4 h-4" />
                  {t('doctorProfile.watchNow')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Profile Card — Clean & Scannable */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            {/* Hero: Avatar + Name + Specialty + Rating inline */}
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 sm:gap-6">
              {/* Avatar — larger on mobile for recognition */}
              <div className="relative flex-shrink-0">
                {doctor.avatarUrl ? (
                  <img
                    src={doctor.avatarUrl}
                    alt={doctor.name}
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}
                  />
                ) : (
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary/10 flex items-center justify-center ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}>
                    <Stethoscope className="w-12 h-12 text-primary" />
                  </div>
                )}
                {activeLive && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    LIVE
                  </div>
                )}
              </div>

              {/* Name + Specialty + Rating + Key badges */}
              <div className="flex-1 w-full space-y-2">
                <div>
                  <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">{doctor.name}</h1>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                    <p className="text-muted-foreground text-sm sm:text-base">{doctor.specialty}</p>
                    <div className="flex items-center gap-1 bg-premium/10 px-2 py-0.5 rounded-full">
                      <Star className="w-3.5 h-3.5 fill-premium text-premium" />
                      <span className="font-semibold text-xs text-premium">{doctor.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Badges — minimal on mobile */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                  <DoctorBadge type={getDoctorBadgeType(doctor.totalConsultations, doctor.rating, (doctor as any).badgeOverride)} size="sm" />
                  {doctor.isIdentityVerified && (
                    <Badge variant="verified" className="gap-1 text-xs">
                      <CheckCircle className="w-3 h-3" />
                      {t('doctorProfile.verified')}
                    </Badge>
                  )}
                  {/* Followers — hidden on mobile to reduce clutter */}
                  <Badge variant="secondary" className="gap-1 text-xs overflow-hidden hidden sm:inline-flex">
                    <Users className="w-3 h-3" />
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={doctor.followersCount}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        {doctor.followersCount}
                      </motion.span>
                    </AnimatePresence>
                    {' '}{t('doctorProfile.followers')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats + Office Hours + CTA — Second Card */}
        <Card className="mt-3">
          <CardContent className="p-5 sm:p-6 space-y-5">
            {/* Stats grid — with icons and color tints */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="text-center p-2 sm:p-3 bg-success/5 rounded-lg border border-success/10">
                <Stethoscope className="w-4 h-4 mx-auto mb-1 text-success" />
                <p className="text-base sm:text-xl font-bold text-foreground">{doctor.totalConsultations}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{t('doctorProfile.consultations')}</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-premium/5 rounded-lg border border-premium/10">
                <Wallet className="w-4 h-4 mx-auto mb-1 text-premium" />
                {isFreeConsultation ? (
                  <p className="text-base sm:text-xl font-bold text-success">{t('doctorProfile.free')}</p>
                ) : (
                  <p className="text-sm sm:text-xl font-bold text-premium"><PriceDisplay amount={doctor.consultationFee} size="sm" /></p>
                )}
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{t('doctorProfile.consultation')}</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 bg-info/5 rounded-lg border border-info/10 col-span-2 sm:col-span-1">
                {doctor.location ? (
                  <>
                    <MapPin className="w-4 h-4 mb-1 text-info" />
                    <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-1 max-w-full">{doctor.location}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{t('doctorProfile.locationLabel')}</p>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mb-1 text-info" />
                    <p className="text-base sm:text-xl font-bold text-foreground">{doctor.followersCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{t('doctorProfile.followers')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Office Hours — Compact: only active days, inline availability */}
            {(doctor.officeHoursStart || (doctor.officeDays && doctor.officeDays.length > 0)) && (() => {
              let isInHours = false;
              if (doctor.officeHoursStart && doctor.officeHoursEnd && doctor.officeDays?.length) {
                const now = new Date();
                const dayMap: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
                const todayNum = now.getDay();
                const isToday = doctor.officeDays.some(d => dayMap[d.toLowerCase()] === todayNum);
                const [startH, startM] = doctor.officeHoursStart.split(':').map(Number);
                const [endH, endM] = doctor.officeHoursEnd.split(':').map(Number);
                const nowMins = now.getHours() * 60 + now.getMinutes();
                isInHours = isToday && nowMins >= startH * 60 + startM && nowMins <= endH * 60 + endM;
              }
              const activeDays = doctor.officeDays?.filter(Boolean) || [];

              return (
                <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg">
                  {/* Row: icon + time + availability */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                      {doctor.officeHoursStart && doctor.officeHoursEnd && (
                        <span className="text-sm font-medium text-foreground">
                          {doctor.officeHoursStart.slice(0, 5)} — {doctor.officeHoursEnd.slice(0, 5)}
                        </span>
                      )}
                    </div>
                    {doctor.officeHoursStart && doctor.officeHoursEnd && doctor.officeDays?.length && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isInHours
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isInHours ? 'bg-success animate-pulse' : 'bg-muted-foreground/50'}`} />
                        {isInHours ? t('doctorProfile.availableNow') : t('doctorProfile.notAvailableNow')}
                      </span>
                    )}
                  </div>
                  {/* Active days only */}
                  {activeDays.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeDays.map(day => (
                        <span key={day} className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                          {t(`doctorProfile.${day.toLowerCase()}`)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bio — concise, expandable */}
            {doctor.bio && (
              <div>
                <p className={`text-muted-foreground text-sm leading-relaxed ${!bioExpanded ? 'line-clamp-2 sm:line-clamp-3' : ''}`}>
                  {doctor.bio}
                </p>
                <button
                  className="text-primary text-xs font-medium mt-1"
                  onClick={() => setBioExpanded(!bioExpanded)}
                >
                  {bioExpanded ? t('doctorProfile.readLess') : t('doctorProfile.readMore')}
                </button>
              </div>
            )}

            {/* Action panel — clear hierarchy */}
            {!isSelf && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-2.5">
              {/* Primary CTA */}
              <Button 
                className="gap-2 w-full" 
                size="lg"
                onClick={handleStartConsultation}
                disabled={isStartingChat || isRequestingConnection || (role === 'resident' && residentConnectionStatus === 'pending')}
              >
                {(isStartingChat || isRequestingConnection) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-5 h-5" />
                )}
                {isStartingChat 
                  ? t('doctorProfile.starting')
                  : role === 'resident'
                    ? residentConnectionStatus === 'accepted'
                      ? t('doctorProfile.startChat')
                      : residentConnectionStatus === 'pending'
                        ? t('doctorProfile.connectionPending')
                        : t('doctorProfile.requestConnection')
                  : isFreeConsultation 
                    ? t('doctorProfile.freeConsultation')
                    : canChatDirectly 
                      ? t('doctorProfile.startConsultation')
                      : (
                        <>
                          {t('doctorProfile.consultation')} (<PriceDisplay amount={doctor.consultationFee} size="sm" />)
                        </>
                      )
                }
              </Button>

              {/* Schedule appointment (patients only — does not block UI for others) */}
              {(role === 'patient' || role === 'visitor') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => navigate(`/book/${doctor.id}`)}
                >
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  Reservar cita
                </Button>
              )}

              {/* Secondary actions — stacked on mobile, row on sm+ */}
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-2">
                <SubscribeButton doctorId={doctor.id} doctorName={doctor.name} size="sm" variant="outline" className="w-full" onSubscriptionChange={async () => {
                  await new Promise(r => setTimeout(r, 1000));
                  const { data } = await supabase.rpc('get_doctor_public_profile', { p_user_id: doctor.id });
                  const profile = Array.isArray(data) ? data[0] : data;
                  if (profile) setDoctor(prev => prev ? { ...prev, followersCount: profile.followers_count } : prev);
                }} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => navigate(`/recordings?doctor=${doctor.id}`)}
                  >
                    <Video className="w-3.5 h-3.5 text-primary" />
                    <span className="truncate">{t('doctorProfile.viewLives')}</span>
                  </Button>
                  <BlockUserButton targetUserId={doctor.id} targetUserName={doctor.name} size="icon" />
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* How it works — premium card */}
        <div className="mt-3 p-5 bg-card border border-border rounded-xl shadow-sm">
          <h4 className="text-base font-semibold text-foreground mb-4">{t('doctorProfile.howItWorks')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:divide-x divide-border">
            {[
              { num: 1, Icon: Bell, title: t('doctorProfile.step1Title'), desc: t('doctorProfile.step1Desc') },
              { num: 2, Icon: Star, title: t('doctorProfile.step2Title'), desc: t('doctorProfile.step2Desc') },
              { num: 3, Icon: MessageSquare, title: t('doctorProfile.step3Title'), desc: t('doctorProfile.step3Desc') },
            ].map(({ num, Icon, title, desc }) => (
              <div key={num} className="flex flex-col items-center text-center px-2 md:px-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center text-white font-bold text-sm mb-2 shadow-md">
                  {num}
                </div>
                <Icon className="w-5 h-5 text-[#163a83] mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Academic & Professional Profile */}
        <DoctorCredentials 
          doctorId={doctor.id} 
          isOwner={user?.id === doctor.id} 
        />

        {/* Patient Reviews */}
        <DoctorReviews 
          doctorId={doctor.id} 
          onRatingCalculated={(avg) => setDoctor(prev => prev ? { ...prev, rating: avg } : prev)}
        />

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
    </MainLayout>
  );
}
