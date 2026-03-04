import React, { useState, useEffect, useRef } from 'react';
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
  
  // Daily viewer state
  const [viewerToken, setViewerToken] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [isJoiningStream, setIsJoiningStream] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

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

  // Real-time viewer count hook
  const { viewerCount, likesCount: realtimeLikesCount } = useViewerCount({
    liveId: id || '',
    autoJoin: isLiveActive && !isOwner,
  });
  
  const isLiked = live ? hasLiked(live.id) : false;
  const [liveEnded, setLiveEnded] = useState(false);

  // Scroll to top on mount / live change
  useEffect(() => {
    window.scrollTo(0, 0);
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
      if (isLiked) { await unlikeLive(live.id); } else { await likeLive(live.id); }
    } finally { setIsLiking(false); }
  };

  const handleShare = async () => {
    const shareData = {
      title: live.title,
      text: `${live.doctorName} - ${live.title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success(t('livePlayer.sharedSuccessfully'));
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t('livePlayer.linkCopied'));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast.success(t('livePlayer.linkCopied'));
        } catch {
          toast.error(t('livePlayer.shareError'));
        }
      }
    }
  };

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
        navigate(`/chat?session=${sessions[0].id}`);
      } else {
        toast.info(t('livePlayer.noActiveSession'));
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

  // Watermark
  const Watermark = () => {
    if (!user || role === 'visitor') return null;
    return (
      <>
        <div className="watermark top-4 left-4">
          {user.email} • {new Date().toISOString().slice(0, 10)}
        </div>
        <div className="watermark bottom-4 right-4">
          ID: {user.id}
        </div>
      </>
    );
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
                likesCount={realtimeLikesCount || live.likesCount}
                peakViewers={live.viewerCount}
                duration={formatDuration(live.startedAt)}
              />
            ) : roomUrl && viewerToken ? (
              <DailyVideoPlayer
                roomUrl={roomUrl}
                token={viewerToken}
                isOwner={isOwner}
                onLeave={() => navigate('/lives')}
                onParticipantCountChange={() => {}}
              />
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
                <Watermark />
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant="live" className="gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {t('livePlayer.liveBadge')}
                  </Badge>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <AnimatedViewerCount count={viewerCount || live.viewerCount} />
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
                  <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-300">
                    <Star className="w-3 h-3" />
                    {t('livePlayer.premiumEarlyAccess')}
                  </Badge>
                )}
                {live.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <Separator className="my-3 sm:my-4" />
              {/* Action buttons - sticky on mobile */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={isLiked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleLike} 
                  disabled={role === 'visitor' || isLiking} 
                  className="gap-1.5 h-9 sm:h-8 text-xs sm:text-sm min-w-[44px]"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{realtimeLikesCount || live.likesCount}</span>
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
              </div>
              <Separator className="my-3 sm:my-4" />
              <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap overflow-hidden">{live.description}</p>
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

            {/* Doctor Info Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0">
                    {live.doctorAvatar ? (
                      <AvatarImage src={live.doctorAvatar} alt={live.doctorName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10">
                      <Stethoscope className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{live.doctorName}</h3>
                    <p className="text-sm text-muted-foreground">{live.specialty}</p>
                    <Badge variant="verified" className="mt-2 gap-1">
                      <Award className="w-3 h-3" />
                      {t('livePlayer.verified')}
                    </Badge>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{realtimeLikesCount || live.likesCount}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Heart className="w-3 h-3 fill-destructive text-destructive" />
                      {t('livePlayer.likes')}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{live.followersCount || 0}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 fill-premium text-premium" />
                      {t('livePlayer.followers')}
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />
                <Button className="w-full h-10" onClick={() => navigate(`/doctor/${live.doctorId}`)}>{t('livePlayer.viewProfile')}</Button>
                {role === 'patient' && (
                  <Button variant="outline" className="w-full mt-2 h-10" onClick={handleStartPrivateChat}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {t('livePlayer.startPrivateChat')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Premium Recording Card */}
            <Card className="bg-premium/5 border-premium/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-premium/10 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-premium" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{t('livePlayer.premiumRecording')}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('livePlayer.premiumRecordingDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Doctor Controls */}
            {isOwner && isLiveActive && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <StopCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm">{t('livePlayer.doctorPanel')}</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">{t('livePlayer.doctorPanelDesc')}</p>
                      <Button variant="destructive" size="sm" className="w-full h-10" onClick={() => setShowEndDialog(true)}>
                        <StopCircle className="w-4 h-4 mr-2" />
                        {t('livePlayer.endLive')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visitor CTA */}
            {role === 'visitor' && (
              <Card className="bg-info/5 border-info/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">{t('livePlayer.registerToChat')}</p>
                  <Button size="sm" className="h-10" onClick={() => navigate('/login')}>{t('livePlayer.createAccount')}</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

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