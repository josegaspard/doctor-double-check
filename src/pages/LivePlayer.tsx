import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { LiveEndedOverlay } from '@/components/live/LiveEndedOverlay';
import { LiveConsultationBooking } from '@/components/live/LiveConsultationBooking';


import { useViewerCount } from '@/hooks/useViewerCount';
import { useWallet } from '@/contexts/WalletContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useDaily } from '@/hooks/useDaily';
import { useIsMobile } from '@/hooks/use-mobile';
import MainLayout from '@/components/layout/MainLayout';
import { DailyVideoPlayer } from '@/components/live/DailyVideoPlayer';
import { LiveChat } from '@/components/live/LiveChat';
import { AnimatedViewerCount } from '@/components/live/AnimatedViewerCount';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Video,
  Users,
  Clock,
  ArrowLeft,
  MessageSquare,
  Share2,
  Heart,
  Stethoscope,
  Star,
  Award,
  StopCircle,
  Save,
  Radio,
  Loader2,
} from 'lucide-react';

export default function LivePlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getLive, likeLive, unlikeLive, hasLiked, endLive, isLoading, refreshLives } = useLives();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getSubscription } = useSubscriptions();
  const { getViewerToken } = useDaily();
  
  const [isLiking, setIsLiking] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [saveAsRecording, setSaveAsRecording] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [consultationFee, setConsultationFee] = useState(0);
  const [liveInteraction, setLiveInteraction] = useState<{ chat_enabled: boolean; max_paid_chats: number | null; paid_chats_count: number }>({ chat_enabled: true, max_paid_chats: null, paid_chats_count: 0 });
  const [showShareModal, setShowShareModal] = useState(false);
  const [mobileFullscreen, setMobileFullscreen] = useState(false);
  const isMobile = useIsMobile();
  
  // Daily viewer state
  const [viewerToken, setViewerToken] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [isJoiningStream, setIsJoiningStream] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const prerollDone = true;

  // Direct DB fallback state
  const [directLive, setDirectLive] = useState<any>(null);
  const [directLoading, setDirectLoading] = useState(false);
  
  const contextLive = getLive(id || '');
  const live = contextLive || directLive;
  
  // Direct DB fetch fallback when context can't find the live
  useEffect(() => {
    if (!id || contextLive || directLive || directLoading) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    const doDirectFetch = async () => {
      setDirectLoading(true);
      try {
        const { data } = await supabase
          .from('lives')
          .select('*')
          .eq('id', id)
          .single();
        
        if (data) {
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('id, name, avatar_url')
            .eq('id', data.doctor_id)
            .single();
          
          setDirectLive({
            id: data.id,
            title: data.title,
            description: data.description || undefined,
            doctorId: data.doctor_id,
            doctorName: profile?.name || 'Doctor',
            doctorAvatar: profile?.avatar_url || undefined,
            specialty: data.specialty,
            status: data.status as any,
            viewerCount: data.viewer_count,
            likesCount: data.likes_count,
            startedAt: new Date(data.started_at),
            endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
            thumbnailUrl: data.thumbnail_url || undefined,
            recordingPrice: data.recording_price ? Number(data.recording_price) : undefined,
            tags: data.tags || [],
            followersCount: 0,
            dailyRoomName: data.daily_room_name || undefined,
          });
        }
      } catch (e) {
        console.error('Direct live fetch failed:', e);
      } finally {
        setDirectLoading(false);
      }
    };
    
    if (isLoading) {
      timeoutId = setTimeout(doDirectFetch, 5000);
    } else {
      doDirectFetch();
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, contextLive, directLive, directLoading, isLoading]);
  
  const isOwner = user?.id === live?.doctorId;
  const isLiveActive = live?.status === 'live';
  const mySubToDoctor = live?.doctorId ? getSubscription(live.doctorId) : undefined;

  // Fetch consultation fee & live interaction limits
  useEffect(() => {
    if (!live?.doctorId) return;
    supabase.from('doctor_profiles').select('consultation_fee').eq('user_id', live.doctorId).single().then(({ data }) => {
      if (data) setConsultationFee(Number(data.consultation_fee) || 0);
    });
    if (id) {
      supabase.from('lives').select('chat_enabled, max_paid_chats, paid_chats_count').eq('id', id).single().then(({ data }) => {
        if (data) setLiveInteraction({ chat_enabled: data.chat_enabled, max_paid_chats: data.max_paid_chats, paid_chats_count: data.paid_chats_count });
      });
    }
  }, [live?.doctorId, id]);

  // Real-time viewer count hook
  const { viewerCount, likesCount: realtimeLikesCount } = useViewerCount({
    liveId: id || '',
    autoJoin: isLiveActive && !isOwner,
  });
  
  const isLiked = live ? hasLiked(live.id) : false;
  const [liveEnded, setLiveEnded] = useState(false);

  // Scroll to top on mount / live change + detect chat_paid return
  useEffect(() => {
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    if (params.get('chat_paid') === 'success') {
      toast.success('¡Pago completado! Tu mensaje destacado será publicado.');
      // Clean URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('chat_paid');
      window.history.replaceState({}, '', url.pathname);
    } else if (params.get('chat_paid') === 'cancel') {
      toast.info('Pago cancelado');
      const url = new URL(window.location.href);
      url.searchParams.delete('chat_paid');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [id]);

  // Direct realtime subscription on this specific live to detect ending reliably
  useEffect(() => {
    if (!id || isOwner) return;

    const channel = supabase
      .channel(`live-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lives', filter: `id=eq.${id}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus === 'ended') {
            setLiveEnded(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isOwner]);

  // Also check via context updates (fallback) + initial state
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!live || isOwner) return;
    if (live.status === 'ended' && !liveEnded) {
      setLiveEnded(true);
    }
    if (prevStatusRef.current === 'live' && live.status === 'ended') {
      setLiveEnded(true);
    }
    prevStatusRef.current = live.status;
  }, [live?.status, isOwner, liveEnded]);

  // Resolve Daily room for viewers (with retry logic)
  const retryCountRef = useRef(0);
  const [manualRetry, setManualRetry] = useState(0);

  useEffect(() => {
    if (!live || !isLiveActive) return;

    let cancelled = false;
    retryCountRef.current = 0;

    const resolveViewer = async () => {
      setIsJoiningStream(true);
      setPlaybackError(null);

      let roomName = live.dailyRoomName;
      if (!roomName) {
        const { data: freshLive } = await supabase
          .from('lives')
          .select('daily_room_name')
          .eq('id', live.id)
          .maybeSingle();
        roomName = freshLive?.daily_room_name || undefined;
      }

      if (!roomName) {
        setPlaybackError(t('livePlayer.streamInitializing'));
        setIsJoiningStream(false);
        if (!cancelled && retryCountRef.current < 8) {
          retryCountRef.current++;
          setTimeout(() => { if (!cancelled) resolveViewer(); }, 4000);
        }
        return;
      }

      // Retry getViewerToken up to 3 times with 3s delays
      let token: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        token = await getViewerToken(roomName, isOwner);
        if (cancelled) return;
        if (token) break;
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 3000));
          if (cancelled) return;
        }
      }

      if (!token) {
        setPlaybackError('No se pudo conectar. Intenta de nuevo.');
        setIsJoiningStream(false);
        return;
      }

      setRoomUrl(`https://doctores.daily.co/${roomName}`);
      setViewerToken(token);
      setIsJoiningStream(false);
    };

    resolveViewer();

    return () => { cancelled = true; };
  }, [live?.id, isLiveActive, isOwner, live?.dailyRoomName, manualRetry]);

  useEffect(() => {
    refreshLives();
    const interval = setInterval(() => refreshLives(), 10000);
    return () => clearInterval(interval);
  }, [refreshLives, id]);

  if ((isLoading || directLoading) && !live) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!live) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('livePlayer.streamNotFound')}</h2>
          <Button onClick={() => navigate('/lives')}>{t('livePlayer.backToLives')}</Button>
        </div>
      </MainLayout>
    );
  }

  const formatDuration = (startedAt: Date) => {
    const diff = Date.now() - startedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} ${t('livePlayer.minutes')}`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const handleLike = async () => {
    if (role === 'visitor' || !user || isLiking) return;
    setIsLiking(true);
    try {
      if (isLiked) {
        await unlikeLive(live.id);
        // Update directLive if loaded via fallback
        if (directLive) setDirectLive((prev: any) => prev ? { ...prev, likesCount: Math.max(0, prev.likesCount - 1) } : prev);
      } else {
        await likeLive(live.id);
        if (directLive) setDirectLive((prev: any) => prev ? { ...prev, likesCount: prev.likesCount + 1 } : prev);
      }
    } finally { setIsLiking(false); }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = live ? `${live.doctorName} - ${live.title}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('livePlayer.linkCopied'));
      setShowShareModal(false);
    } catch {
      toast.error(t('livePlayer.shareError'));
    }
  };

  const handleToggleMobileFullscreen = useCallback(() => {
    setMobileFullscreen(prev => {
      const next = !prev;
      if (next) {
        document.body.style.overflow = 'hidden';
        screen.orientation?.lock?.('landscape').catch(() => {});
      } else {
        document.body.style.overflow = '';
        screen.orientation?.unlock?.();
      }
      return next;
    });
  }, []);

  // Cleanup mobile fullscreen on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      screen.orientation?.unlock?.();
    };
  }, []);

  const handleStartPrivateChat = async () => {
    if (!user || !live) return;
    
    try {
      // Check if user has an active chat session with this doctor
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id, status')
        .eq('status', 'active')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${live.doctorId}),and(participant1_id.eq.${live.doctorId},participant2_id.eq.${user.id})`);
      
      if (sessions && sessions.length > 0) {
        // Already has active session → go to chat
        navigate(`/chat?session=${sessions[0].id}`);
      } else if (consultationFee > 0 && isLiveActive) {
        // No active session → open booking dialog (orientation from live)
        setShowBooking(true);
      } else {
        // Fallback: go to doctor profile
        navigate(`/doctor/${live.doctorId}`);
      }
    } catch {
      navigate(`/doctor/${live.doctorId}`);
    }
  };

  const handleEndLive = async () => {
    if (!live) return;
    setIsEnding(true);
    try {
      const result = await endLive(live.id, saveAsRecording);
      if (result.success) {
        toast.success(saveAsRecording ? t('livePlayer.liveSaved') : t('livePlayer.liveEnded'));
        setShowEndDialog(false);
        navigate('/lives');
      } else {
        toast.error(result.error || t('livePlayer.endError'));
      }
    } finally { setIsEnding(false); }
  };


  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/lives')} className="hidden sm:inline-flex mb-3 sm:mb-4 h-8 text-xs sm:text-sm">
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          {t('livePlayer.backToLives')}
        </Button>

        {/* Responsive grid: stack on mobile, 2-col tablet, 3-col desktop */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live ended overlay */}
            {liveEnded && !isOwner ? (
              <LiveEndedOverlay
                doctorId={live.doctorId}
                doctorName={live.doctorName}
                doctorAvatar={live.doctorAvatar}
                specialty={live.specialty}
                likesCount={realtimeLikesCount ?? live.likesCount}
                peakViewers={live.viewerCount}
                duration={formatDuration(live.startedAt)}
              />
            ) : roomUrl && viewerToken ? (
              <div className={mobileFullscreen ? 'mobile-live-fullscreen' : 'relative'}>
                {/* Pre-roll ads only on recordings, not lives */}
                <DailyVideoPlayer
                  roomUrl={roomUrl}
                  token={viewerToken}
                  isOwner={isOwner}
                  onLeave={isOwner && isLiveActive ? () => setShowEndDialog(true) : () => navigate('/lives')}
                  onParticipantCountChange={() => {}}
                  onMobileFullscreenToggle={isMobile ? handleToggleMobileFullscreen : undefined}
                  isMobileFullscreen={mobileFullscreen}
                  className={mobileFullscreen ? 'relative bg-black overflow-hidden group w-full h-full' : undefined}
                />
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden no-context-menu">
                {isJoiningStream ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" />
                      <p className="text-white/80 text-sm">{t('livePlayer.connecting')}</p>
                    </div>
                  </div>
                ) : !isLiveActive ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/60 to-muted/40">
                    <div className="text-center px-4">
                      <p className="text-foreground font-medium">{t('livePlayer.notActive')}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => refreshLives()}>
                        {t('livePlayer.refreshList')}
                      </Button>
                    </div>
                  </div>
                ) : playbackError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                    <div className="text-center px-4">
                      <Radio className="w-10 h-10 mx-auto mb-3 text-white animate-pulse" />
                      <p className="text-white font-medium">{playbackError}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => setManualRetry(prev => prev + 1)}
                      >
                        Reintentar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" />
                      <p className="text-white/80 text-sm">{t('livePlayer.connecting')}...</p>
                    </div>
                  </div>
                )}
                
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant="live" className="gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {t('livePlayer.liveBadge')}
                  </Badge>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <AnimatedViewerCount count={viewerCount ?? live.viewerCount} />
                </div>
                <div className="absolute bottom-4 left-4 z-10">
                  <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
                    <Clock className="w-3 h-3" />
                    {formatDuration(live.startedAt)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Video Info */}
            <div>
              <h1 className="font-heading text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2 sm:mb-3">
                {live.title.replace(/^EN VIVO\s*[-–:]\s*/i, '')}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {mySubToDoctor?.tier === 'premium' && (
                  <Badge className="gap-1 bg-premium/10 text-premium border-premium/30">
                    <Star className="w-3 h-3" />
                    {t('livePlayer.premiumEarlyAccess')}
                  </Badge>
                )}
                {live.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <Separator className="my-3 sm:my-4" />
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={isLiked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleLike} 
                  disabled={role === 'visitor' || isLiking} 
                  className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm min-w-[44px]"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{realtimeLikesCount ?? live.likesCount}</span>
                  <span className="hidden xs:inline">{t('livePlayer.like')}</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShare}
                  className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm min-w-[44px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('livePlayer.share')}</span>
                </Button>
                <Button 
                  variant={showChat ? "default" : "outline"} 
                  size="sm" 
                  className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm lg:hidden min-w-[44px]" 
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </Button>
                {role === 'patient' && !isOwner && isLiveActive && consultationFee > 0 && (
                  <Button
                    variant="success"
                    size="sm"
                    className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm min-w-[44px]"
                    onClick={() => setShowBooking(true)}
                  >
                    <Stethoscope className="w-4 h-4" />
                    Reservar Orientación - ${consultationFee}
                  </Button>
                )}
                {isOwner && isLiveActive && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm min-w-[44px] ml-auto"
                    onClick={() => setShowEndDialog(true)}
                  >
                    <StopCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('livePlayer.endLive')}</span>
                  </Button>
                )}
              </div>
              {live.description && (
                <>
                  <Separator className="my-3 sm:my-4" />
                  <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap overflow-hidden line-clamp-3">{live.description}</p>
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3 sm:space-y-4">
            {/* Chat - shown/hidden on mobile via toggle */}
            {showChat && (
              <div className="h-[300px] sm:h-[350px] lg:h-[400px]">
                <LiveChat liveId={live.id} isOwner={isOwner} liveStartedAt={live.startedAt} />
              </div>
            )}

            {/* Compact Doctor Info Card */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    {live.doctorAvatar ? (
                      <AvatarImage src={live.doctorAvatar} alt={live.doctorName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10">
                      <Stethoscope className="w-5 h-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{live.doctorName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">{live.specialty}</span>
                      <Badge variant="verified" className="gap-0.5 text-[10px] px-1.5 py-0 h-4">
                        <Award className="w-2.5 h-2.5" />
                        {t('livePlayer.verified')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Inline stats */}
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Heart className="w-3 h-3 fill-destructive text-destructive" />
                    {realtimeLikesCount ?? live.likesCount} {t('livePlayer.likes')}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Star className="w-3 h-3 fill-premium text-premium" />
                    {live.followersCount || 0} {t('livePlayer.followers')}
                  </Badge>
                </div>

                {/* Compact actions */}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => navigate(`/doctor/${live.doctorId}`)}>
                    {t('livePlayer.viewProfile')}
                  </Button>
                  {role === 'patient' && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={handleStartPrivateChat}>
                      <MessageSquare className="w-3 h-3" />
                      {t('livePlayer.startPrivateChat')}
                    </Button>
                  )}
                </div>

                {/* Premium recording inline banner */}
                <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-premium/5 border border-premium/15">
                  <Video className="w-4 h-4 text-premium flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-tight">{t('livePlayer.premiumRecordingDesc')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Visitor CTA */}
            {role === 'visitor' && (
              <Card className="bg-info/5 border-info/20">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">{t('livePlayer.registerToChat')}</p>
                  <Button size="sm" className="h-8 text-xs" onClick={() => navigate('/login')}>{t('livePlayer.createAccount')}</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Consultation Booking Dialog */}
      {live && (
        <LiveConsultationBooking
          open={showBooking}
          onOpenChange={setShowBooking}
          doctorId={live.doctorId}
          doctorName={live.doctorName}
          doctorAvatar={live.doctorAvatar}
          specialty={live.specialty}
          consultationFee={consultationFee}
          liveId={live.id}
          maxPaidChats={liveInteraction.max_paid_chats}
          paidChatsCount={liveInteraction.paid_chats_count}
        />
      )}

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Compartir Live
            </DialogTitle>
            <DialogDescription>Comparte esta transmisión en tus redes</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button variant="outline" className="gap-2 h-12" onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank'); setShowShareModal(false); }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 h-12" onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank'); setShowShareModal(false); }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </Button>
            <Button variant="outline" className="gap-2 h-12" onClick={() => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank'); setShowShareModal(false); }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X
            </Button>
            <Button variant="outline" className="gap-2 h-12" onClick={handleCopyLink}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Live Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('livePlayer.endLiveTitle')}</DialogTitle>
            <DialogDescription>{t('livePlayer.endLiveDesc')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
              <Checkbox id="saveRecording" checked={saveAsRecording} onCheckedChange={(checked) => setSaveAsRecording(checked === true)} />
              <div className="flex-1">
                <label htmlFor="saveRecording" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {t('livePlayer.saveAsRecording')}
                </label>
                <p className="text-xs text-muted-foreground mt-1">{t('livePlayer.saveAsRecordingDesc')}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)} disabled={isEnding}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleEndLive} disabled={isEnding}>
              {isEnding ? t('livePlayer.ending') : t('livePlayer.endLive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}