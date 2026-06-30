import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DailyVideoPlayer, DailyVideoPlayerHandle } from './DailyVideoPlayer';
import { LiveChat } from './LiveChat';
import { AnimatedViewerCount } from './AnimatedViewerCount';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import logoMmWhite from '@/assets/logo-medical-masters-white.png';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Clock,
  Heart,
  MessageSquare,
  StopCircle,
  X,
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  Maximize,
  Minimize,
} from 'lucide-react';

interface LiveStreamViewProps {
  liveData: {
    id: string;
    title: string;
    specialty: string;
    viewerCount: number;
    likesCount: number;
    startedAt: Date;
  };
  elapsedTime: number;
  viewerCount: number;
  likesCount: number;
  showChat: boolean;
  onToggleChat: () => void;
  onEndClick: () => void;
  roomUrl: string;
  ownerToken: string;
  isMobile: boolean;
}

export function LiveStreamView({
  liveData,
  elapsedTime,
  viewerCount,
  likesCount,
  showChat,
  onToggleChat,
  onEndClick,
  roomUrl,
  ownerToken,
  isMobile,
}: LiveStreamViewProps) {
  const [mobileChatOpen, setMobileChatOpen] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mobileFullscreen, setMobileFullscreen] = useState(false);
  const playerRef = useRef<DailyVideoPlayerHandle>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  // Cédula propia del doctor para el lower-third del live (cliente 2026-06-16).
  const [ownCedula, setOwnCedula] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('doctor_profiles').select('cedula_profesional').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setOwnCedula((data as any).cedula_profesional || null);
    });
  }, [user?.id]);

  // Force re-render to read ref state after toggles
  const [, forceUpdate] = useState(0);

  // Resolved counts: prefer realtime (non-null) over liveData initial
  const resolvedViewerCount = viewerCount ?? liveData.viewerCount;
  const resolvedLikesCount = likesCount ?? liveData.likesCount;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-hide top bar after 3 seconds on mobile
  const resetHideTimer = useCallback(() => {
    setShowOverlay(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowOverlay(false), 3000);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [isMobile, resetHideTimer]);

  const handleTapVideo = useCallback(() => {
    if (isMobile) resetHideTimer();
  }, [isMobile, resetHideTimer]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      screen.orientation?.unlock?.();
    };
  }, []);

  // Logo Medical Masters (marca/trademark) + lower-third del doctor (nombre, especialidad,
  // cédula y correo) abajo a la derecha — cliente 2026-06-16, en la vista del que transmite.
  const doctorBadge = (
    <>
      <img src={logoMmWhite} alt="Medical Masters" className="absolute top-3 left-3 z-20 h-5 sm:h-6 w-auto opacity-40 pointer-events-none drop-shadow" />
      <div className="absolute bottom-16 right-3 z-[25] max-w-[70%] rounded-lg bg-black/55 backdrop-blur-sm px-3 py-1.5 text-right pointer-events-none">
        <p className="text-white text-xs sm:text-sm font-semibold leading-tight truncate">{user?.name}</p>
        {liveData.specialty && <p className="text-white/85 text-[10px] sm:text-xs leading-tight truncate">{liveData.specialty}</p>}
        {ownCedula && <p className="text-white/70 text-[9px] sm:text-[10px] leading-tight mt-0.5">Céd. <span className="font-mono">{ownCedula}</span></p>}
        {user?.email && <p className="text-white/60 text-[9px] sm:text-[10px] leading-tight truncate">{user.email}</p>}
      </div>
    </>
  );

  if (isMobile) {
    const isMuted = playerRef.current?.isMuted ?? false;
    const isVideoOff = playerRef.current?.isVideoOff ?? false;

    return (
      <div
        className="fixed inset-0 z-50 bg-black flex flex-col"
        style={{ height: '100dvh' }}
        onClick={handleTapVideo}
      >
        {/* Persistent stats badges (hidden when fullscreen — shown inside player instead) */}
        {!mobileFullscreen && (
          <div
            className="absolute top-0 right-0 z-40 flex items-center gap-1.5 px-2 py-1"
            style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}
          >
            <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              <Heart className="w-3 h-3 text-destructive" />
              {resolvedLikesCount}
            </span>
            <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
              <AnimatedViewerCount count={resolvedViewerCount} variant="inline" />
            </span>
          </div>
        )}

        {/* Compact top overlay — auto-hides */}
        {!mobileFullscreen && (
          <div
            className={`absolute top-0 left-0 right-0 z-30 px-3 py-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
              showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  EN VIVO
                </span>
                <p className="text-white text-xs font-medium truncate">{liveData.title}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/80 shrink-0">
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Video area — single player, wrapped in fullscreen container when active */}
        <div className={mobileFullscreen ? 'mobile-doctor-fullscreen' : 'contents'}>
          <DailyVideoPlayer
            ref={playerRef}
            roomUrl={roomUrl}
            token={ownerToken}
            isOwner={true}
            hideControls={true}
            onLeave={onEndClick}
            onJoined={() => {
              // Marca el live como broadcasting=true cuando el doctor JOIN
              // el Daily room. Hasta este momento, los pacientes NO ven el
              // live en /lives (gate de visibilidad). Esto evita "ghost lives"
              // que aparecen sin nadie del otro lado.
              supabase.rpc('mark_live_broadcasting', { p_live_id: liveData.id }).catch(() => {});
            }}
            onParticipantCountChange={() => {}}
            onMobileFullscreenToggle={handleToggleMobileFullscreen}
            isMobileFullscreen={mobileFullscreen}
            className={`relative bg-black overflow-hidden group ${mobileFullscreen ? 'w-full h-full' : 'h-[40dvh]'}`}
          >
            {/* Stats overlay inside player when fullscreen */}
            {mobileFullscreen && (
              <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5">
                <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                  <Heart className="w-3 h-3 text-destructive" />
                  {resolvedLikesCount}
                </span>
                <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                  <AnimatedViewerCount count={resolvedViewerCount} variant="inline" />
                </span>
              </div>
            )}

            {/* Control bar */}
            <div className={`absolute ${mobileFullscreen ? 'bottom-4' : 'bottom-2'} left-0 right-0 z-30 flex items-center justify-center gap-3 px-4`}>
              {/* Hover de cambio de color removido: hacía que el icono blanco se
                  fundiera con el fondo en la transición. Cada botón mantiene su
                  color base. La identificación pressed/active es por la diferencia
                  del color destructive/primary vs white/10 y por el ícono. */}
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => { e.stopPropagation(); playerRef.current?.toggleMute(); forceUpdate(n => n + 1); }}
                className={`h-11 w-11 rounded-full border-white/20 text-white ${isMuted ? 'bg-destructive/70' : 'bg-white/10'}`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => { e.stopPropagation(); playerRef.current?.toggleVideo(); forceUpdate(n => n + 1); }}
                className={`h-11 w-11 rounded-full border-white/20 text-white ${isVideoOff ? 'bg-destructive/70' : 'bg-white/10'}`}
              >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleToggleMobileFullscreen(); }}
                className={`h-11 w-11 rounded-full border-white/20 text-white ${mobileFullscreen ? 'bg-primary/70' : 'bg-white/10'}`}
              >
                {mobileFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
              {!mobileFullscreen && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setMobileChatOpen(!mobileChatOpen); }}
                  className={`h-11 w-11 rounded-full border-white/20 text-white ${mobileChatOpen ? 'bg-primary/70' : 'bg-white/10'}`}
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onEndClick(); }}
                className="h-11 gap-1.5 rounded-full px-5"
              >
                <StopCircle className="w-5 h-5" />
                Finalizar
              </Button>
            </div>
            <DynamicWatermark email={user?.email} userId={user?.id} />
            {doctorBadge}
          </DailyVideoPlayer>
        </div>

        {/* Chat below video — only when not fullscreen */}
        {!mobileFullscreen && mobileChatOpen && (
          <div
            className="flex-1 bg-background flex flex-col min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
              <span className="font-semibold text-sm">Chat en vivo</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileChatOpen(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LiveChat liveId={liveData.id} isOwner={true} liveStartedAt={liveData.startedAt} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold truncate">{liveData.title}</h1>
            <p className="text-xs text-muted-foreground">{liveData.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(elapsedTime)}
            </span>
            <AnimatedViewerCount count={resolvedViewerCount} variant="inline" />
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {resolvedLikesCount}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={onToggleChat} className="gap-1">
            <MessageSquare className="w-4 h-4" />
            {showChat ? 'Ocultar' : 'Chat'}
          </Button>

          <Button variant="destructive" size="sm" onClick={onEndClick} className="gap-1">
            <StopCircle className="w-4 h-4" />
            Finalizar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className={showChat ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <div className="relative">
            <DailyVideoPlayer
              roomUrl={roomUrl}
              token={ownerToken}
              isOwner={true}
              onLeave={onEndClick}
              onParticipantCountChange={() => {}}
            />
            <DynamicWatermark email={user?.email} userId={user?.id} />
          </div>
        </div>

        {showChat && (
          <div className="lg:col-span-1">
            <LiveChat liveId={liveData.id} isOwner={true} liveStartedAt={liveData.startedAt} />
          </div>
        )}
      </div>
    </div>
  );
}
