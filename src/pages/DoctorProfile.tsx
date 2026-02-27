import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import DoctorCredentials from '@/components/doctor/DoctorCredentials';
import DoctorReviews from '@/components/doctor/DoctorReviews';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Stethoscope, Star, Award, MessageSquare, Video, MapPin, Users, Radio, Loader2, Wallet, CreditCard } from 'lucide-react';
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

  // Check if there's an active chat session with this specific doctor
  useEffect(() => {
    const checkActiveSession = async () => {
      if (!user?.id || !id || role !== 'patient') return;
      const { data } = await supabase
        .from('chat_sessions')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${user.id})`)
        .eq('status', 'active')
        .eq('is_double_check', false)
        .maybeSingle();
      setHasActiveSession(!!data);
    };
    checkActiveSession();
  }, [user?.id, id, role]);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;

      const { data: doctorData, error } = await supabase.rpc(
        'get_doctor_public_profile',
        { p_user_id: id }
      );

      if (error) {
        console.error('Error fetching doctor profile:', error);
        setIsLoading(false);
        return;
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

  const handleStartConsultation = async () => {
    if (!isAuthenticated || !user?.id) {
      navigate('/login');
      return;
    }

    if (role !== 'patient') {
      toast.error(t('doctorProfile.onlyPatients'));
      return;
    }

    if (!doctor) return;

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
        navigate('/chat');
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

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('doctorProfile.back')}
        </Button>

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

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar with live indicator */}
              <div className="relative flex-shrink-0">
                {doctor.avatarUrl ? (
                  <img
                    src={doctor.avatarUrl}
                    alt={doctor.name}
                    className={`w-24 h-24 rounded-full object-cover ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}>
                    <Stethoscope className="w-12 h-12 text-primary" />
                  </div>
                )}
                {activeLive && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    LIVE
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-foreground">{doctor.name}</h1>
                    <p className="text-muted-foreground">{doctor.specialty}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <DoctorBadge type={getDoctorBadgeType(doctor.totalConsultations, doctor.rating, (doctor as any).badgeOverride)} />
                      <Badge variant="verified" className="gap-1">
                        <Award className="w-3 h-3" />
                        {t('doctorProfile.verified')}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 overflow-hidden">
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
                  <div className="flex items-center gap-1 bg-premium/10 px-3 py-1 rounded-full">
                    <Star className="w-4 h-4 fill-premium text-premium" />
                    <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                {doctor.bio && (
                  <p className="text-muted-foreground mb-4">{doctor.bio}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-foreground">{doctor.totalConsultations}</p>
                    <p className="text-xs text-muted-foreground">{t('doctorProfile.consultations')}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    {isFreeConsultation ? (
                      <p className="text-xl font-bold text-success">{t('doctorProfile.free')}</p>
                    ) : (
                      <p className="text-xl font-bold text-premium">${doctor.consultationFee}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t('doctorProfile.consultation')}</p>
                  </div>
                  {doctor.location && (
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{doctor.location}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
                  <SubscribeButton doctorId={doctor.id} doctorName={doctor.name} onSubscriptionChange={async () => {
                    await new Promise(r => setTimeout(r, 1000));
                    const { data } = await supabase.rpc('get_doctor_public_profile', { p_user_id: doctor.id });
                    const profile = Array.isArray(data) ? data[0] : data;
                    if (profile) setDoctor(prev => prev ? { ...prev, followersCount: profile.followers_count } : prev);
                  }} />
                  <Button 
                    className="gap-2 h-11 active:scale-95 transition-transform w-full sm:w-auto" 
                    onClick={handleStartConsultation}
                    disabled={isStartingChat}
                    variant={isFreeConsultation ? 'default' : canChatDirectly ? 'default' : 'secondary'}
                  >
                    {isStartingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    {isStartingChat 
                      ? t('doctorProfile.starting')
                      : isFreeConsultation 
                        ? t('doctorProfile.freeConsultation')
                        : canChatDirectly 
                          ? t('doctorProfile.startConsultation')
                          : `${t('doctorProfile.consultation')} ($${doctor.consultationFee})`
                    }
                  </Button>
                  <Button variant="outline" className="gap-2 h-11 active:scale-95 transition-transform w-full sm:w-auto" onClick={() => navigate(`/recordings?doctor=${doctor.id}`)}>
                    <Video className="w-4 h-4" />
                    {t('doctorProfile.viewLives')}
                  </Button>
                  <BlockUserButton targetUserId={doctor.id} targetUserName={doctor.name} />
                </div>

                {/* How it works section */}
                <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border/50">
                  <h4 className="text-sm font-semibold text-foreground mb-2">¿Cómo funciona?</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                      <span className="text-lg">1️⃣</span>
                      <span><strong>Seguir</strong> — Recibe alertas gratis cuando transmita en vivo</span>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                      <span className="text-lg">2️⃣</span>
                      <span><strong>Suscribirse</strong> — Accede a chat, contenido y grabaciones exclusivas</span>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                      <span className="text-lg">3️⃣</span>
                      <span><strong>Consultar</strong> — Inicia una consulta por chat o videollamada</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
