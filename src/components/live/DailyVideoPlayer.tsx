import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Daily, { DailyCall, DailyEventObject, DailyParticipant } from '@daily-co/daily-js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Maximize,
  Minimize,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useConnectionQuality } from '@/hooks/useConnectionQuality';
import { ConnectionQualityIndicator } from '@/components/videocall/ConnectionQualityIndicator';
import { useLanguage } from '@/contexts/LanguageContext';

export interface DailyVideoPlayerHandle {
  toggleMute: () => void;
  toggleVideo: () => void;
  leaveCall: () => void;
  toggleFullscreen: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  isFullscreen: boolean;
}

interface DailyVideoPlayerProps {
  roomUrl: string;
  token: string;
  isOwner?: boolean;
  hideControls?: boolean;
  onLeave?: () => void;
  onJoined?: () => void;
  onParticipantCountChange?: (count: number) => void;
  onMobileFullscreenToggle?: () => void;
  isMobileFullscreen?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const DailyVideoPlayer = forwardRef<DailyVideoPlayerHandle, DailyVideoPlayerProps>(function DailyVideoPlayer({
  roomUrl,
  token,
  isOwner = false,
  hideControls = false,
  onLeave,
  onJoined,
  onParticipantCountChange,
  onMobileFullscreenToggle,
  isMobileFullscreen = false,
  className: externalClassName,
  children,
}, ref) {
  const { t } = useLanguage();
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const cleaningUpRef = useRef(false);
  const isLeavingRef = useRef(false);
  const userHasUnmutedRef = useRef(false);
  const joinAttemptRef = useRef(0);
  
  const [isJoining, setIsJoining] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasRemoteScreenShare, setHasRemoteScreenShare] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(false);
  const [viewerAudioMuted, setViewerAudioMuted] = useState(true);
  // Cada bump reintenta el join (re-ejecuta el effect de abajo). Lo usa el
  // watchdog anti-"Conectando..." infinito y el botón Reintentar del error.
  const [joinAttempt, setJoinAttempt] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectionStats = useConnectionQuality(callRef.current, isConnected);

  useEffect(() => {
    if (!roomUrl || !token) return;
    let cancelled = false;

    const initCall = async () => {
      try {
        // Reset por si esto es un reintento (joinAttempt bump): volvemos a
        // mostrar el skeleton de "Conectando" y limpiamos el error anterior.
        setError(null);
        setIsConnected(false);
        setIsJoining(true);

        try {
          const existing = Daily.getCallInstance();
          if (existing) {
            await existing.destroy();
          }
        } catch { /* no existing instance */ }

        if (cancelled) return;

        const call = Daily.createCallObject({
          videoSource: isOwner,
          audioSource: isOwner,
        });

        if (cancelled) {
          call.destroy();
          return;
        }
        
        cleaningUpRef.current = false;
        callRef.current = call;

        call.on('joined-meeting', handleJoinedMeeting);
        call.on('left-meeting', handleLeftMeeting);
        call.on('participant-joined', handleParticipantUpdate);
        call.on('participant-left', handleParticipantUpdate);
        call.on('participant-updated', handleParticipantUpdate);
        call.on('error', handleError);

        console.log('[DAILY] joining room:', roomUrl, 'tokenLen:', token?.length || 0);
        await call.join({ url: roomUrl, token });
      } catch (err: any) {
        if (cancelled) return;
        console.error('[DAILY] join failed:', err);
        console.error('[DAILY] error stack:', err?.stack);
        const detail = err?.errorMsg || err?.message || err?.toString?.() || t('dailyVideoPlayer.unknownError');
        setError(`${t('dailyVideoPlayer.joinFailed')} ${detail}`);
        toast.error(`${t('dailyVideoPlayer.connectFailed')} ${detail}`, { duration: 8000 });
        setIsJoining(false);
      }
    };

    initCall();

    return () => {
      cancelled = true;
      cleaningUpRef.current = true;
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy().catch(() => {});
        callRef.current = null;
      }
    };
  }, [roomUrl, token, isOwner, joinAttempt]);

  // Watchdog anti "Conectando..." infinito ("no carga"): si tras 18s seguimos
  // sin unirnos a la sala, reintentamos el join automáticamente (hasta 2 veces).
  // Si aun así no entra, mostramos un error accionable con botón Reintentar en
  // lugar de un spinner eterno. Los joins normales tardan 2-5s, así que 18s no
  // dispara falsos positivos.
  useEffect(() => {
    if (!roomUrl || !token) return;
    if (isConnected || error) return;
    const id = setTimeout(() => {
      if (isConnected || cleaningUpRef.current) return;
      if (joinAttemptRef.current < 2) {
        joinAttemptRef.current += 1;
        setJoinAttempt((a) => a + 1);
      } else {
        setIsJoining(false);
        setError(t('dailyVideoPlayer.joinTakingLong'));
      }
    }, 18000);
    return () => clearTimeout(id);
  }, [roomUrl, token, isConnected, error, joinAttempt, t]);

  const handleRetry = useCallback(() => {
    joinAttemptRef.current = 0;
    setError(null);
    setIsJoining(true);
    setJoinAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    if (!isConnected || !videoContainerRef.current || !callRef.current) return;
    const participants = callRef.current.participants();
    updateVideoElements(participants);
  }, [isConnected]);

  const handleJoinedMeeting = useCallback(() => {
    setIsJoining(false);
    setIsConnected(true);
    toast.success(isOwner ? t('dailyVideoPlayer.streamStarted') : t('dailyVideoPlayer.connectedToStream'));
    onJoined?.();
  }, [isOwner, onJoined, t]);

  const handleLeftMeeting = useCallback(() => {
    if (cleaningUpRef.current) return;
    setIsConnected(false);
    onLeave?.();
  }, [onLeave]);

  const handleParticipantUpdate = useCallback(() => {
    if (!callRef.current) return;
    
    const participants = callRef.current.participants();
    const count = Object.keys(participants).length;
    setParticipantCount(count);
    onParticipantCountChange?.(count);

    let foundScreenShare = false;
    Object.values(participants).forEach(p => {
      if (p.screen && p.screenVideoTrack) {
        foundScreenShare = true;
      }
    });
    setHasRemoteScreenShare(foundScreenShare);
    
    if (videoContainerRef.current) {
      updateVideoElements(participants);
    }
  }, [onParticipantCountChange]);

  const handleError = useCallback((event: DailyEventObject) => {
    const meetingState = callRef.current?.meetingState?.();
    if (isLeavingRef.current || cleaningUpRef.current || meetingState === 'leaving-meeting' as any || meetingState === 'left-meeting' as any) {
      console.log('[DAILY] error suppressed (leaving/cleanup):', (event as any).errorMsg);
      return;
    }

    const rawMsg = (event as any).errorMsg || (event as any).error?.message || '';
    const errorType = (event as any).error?.type || '';
    const errorMsg = rawMsg.toLowerCase();

    // Telemetría amplia para diagnosticar el error en consola
    console.error('[DAILY ERROR] full event:', event);
    console.error('[DAILY ERROR] errorMsg:', rawMsg);
    console.error('[DAILY ERROR] errorType:', errorType);
    console.error('[DAILY ERROR] roomUrl:', roomUrl);
    console.error('[DAILY ERROR] tokenLen:', token?.length || 0);
    console.error('[DAILY ERROR] meetingState:', meetingState);

    const nonCriticalPatterns = [
      'meeting has ended', 'exp', 'nbf',
      'transport closed',
    ];

    if (
      nonCriticalPatterns.some(p => errorMsg.includes(p)) ||
      errorType === 'meeting-session-state-error'
    ) {
      console.log('[DAILY] room ended by host (non-critical)');
      setIsConnected(false);
      onLeave?.();
      return;
    }

    // Mensajes accionables según tipo
    let userMessage: string;
    if (errorMsg.includes('account-missing-payment-method')) {
      userMessage = t('dailyVideoPlayer.errorPaymentMethod');
    } else if (errorMsg.includes('invalid-request-error') || errorType === 'invalid-request-error') {
      userMessage = `${t('dailyVideoPlayer.errorInvalidConfig')} ${rawMsg}`;
    } else if (errorMsg.includes('not-allowed') || errorMsg.includes('permission')) {
      userMessage = t('dailyVideoPlayer.errorPermissionDenied');
    } else if (errorMsg.includes('meeting-token-error') || errorMsg.includes('token')) {
      userMessage = t('dailyVideoPlayer.errorInvalidToken');
    } else if (errorMsg.includes('connection') || errorMsg.includes('network') || errorMsg.includes('websocket') || errorMsg.includes('ice')) {
      userMessage = `${t('dailyVideoPlayer.errorNetworkBlocked')} ${rawMsg || errorType || t('dailyVideoPlayer.unknown')}`;
    } else {
      // Mostrar el mensaje real de Daily para que el usuario pueda compartirlo
      userMessage = `Daily: ${rawMsg || errorType || t('dailyVideoPlayer.unknownError')}`;
    }

    setError(userMessage);
    toast.error(userMessage, { duration: 8000 });
  }, [onLeave, roomUrl, token, t]);

  const updateVideoElements = (participants: Record<string, DailyParticipant>) => {
    if (!videoContainerRef.current) return;
    videoContainerRef.current.innerHTML = '';

    if (screenShareRef.current) {
      screenShareRef.current.innerHTML = '';
    }

    let hasAnyScreenShare = false;
    Object.values(participants).forEach(p => {
      if (p.screen && p.screenVideoTrack) {
        hasAnyScreenShare = true;
      }
    });
    
    Object.values(participants).forEach((participant) => {
      if (participant.screen && participant.screenVideoTrack && screenShareRef.current) {
        const screenEl = document.createElement('video');
        screenEl.autoplay = true;
        screenEl.playsInline = true;
        screenEl.muted = true;
        screenEl.className = 'w-full h-full object-contain';
        const stream = new MediaStream([participant.screenVideoTrack]);
        screenEl.srcObject = stream;
        screenShareRef.current.appendChild(screenEl);
      }

      if (participant.video && participant.videoTrack) {
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = true;

        videoEl.className = participant.local && hasAnyScreenShare
          ? 'absolute bottom-2 right-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-primary shadow-lg'
          : hasAnyScreenShare && !participant.local
            ? 'absolute bottom-2 left-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-muted shadow-lg'
            : 'w-full h-full object-contain absolute inset-0';
        
        const tracks: MediaStreamTrack[] = [participant.videoTrack];
        if (!participant.local && participant.audioTrack) {
          tracks.push(participant.audioTrack);
        }
        const stream = new MediaStream(tracks);
        videoEl.srcObject = stream;
        videoContainerRef.current?.appendChild(videoEl);

        if (userHasUnmutedRef.current && !participant.local) {
          // User already unmuted — play with sound directly, no prompt
          videoEl.muted = false;
          videoEl.play().catch(() => {
            // If unmuted play fails, try muted
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          });
        } else {
          videoEl.play().then(() => {
            if (!participant.local) {
              videoEl.muted = false;
              setTimeout(() => {
                if (videoEl.paused) {
                  videoEl.muted = true;
                  videoEl.play().catch(() => {});
                  if (!userHasUnmutedRef.current) setShowUnmutePrompt(true);
                }
              }, 150);
            }
          }).catch(() => {
            if (!participant.local && !userHasUnmutedRef.current) {
              setShowUnmutePrompt(true);
            }
          });
        }
      } else if (!participant.local && participant.audioTrack && !participant.video) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = !userHasUnmutedRef.current;
        const audioStream = new MediaStream([participant.audioTrack]);
        audioEl.srcObject = audioStream;
        videoContainerRef.current?.appendChild(audioEl);

        if (userHasUnmutedRef.current) {
          audioEl.play().catch(() => {
            audioEl.muted = true;
            audioEl.play().catch(() => {});
          });
        } else {
          audioEl.play().then(() => {
            audioEl.muted = false;
            setTimeout(() => {
              if (audioEl.paused) {
                audioEl.muted = true;
                audioEl.play().catch(() => {});
                if (!userHasUnmutedRef.current) setShowUnmutePrompt(true);
              }
            }, 150);
          }).catch(() => { if (!userHasUnmutedRef.current) setShowUnmutePrompt(true); });
        }
      }
    });
  };

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const newMuted = !isMuted;
    callRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (!callRef.current) return;
    const newVideoOff = !isVideoOff;
    callRef.current.setLocalVideo(!newVideoOff);
    setIsVideoOff(newVideoOff);
  }, [isVideoOff]);

  const toggleScreenShare = async () => {
    if (!callRef.current) return;
    try {
      if (isScreenSharing) {
        await callRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await callRef.current.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Screen share error:', err);
      toast.error(t('dailyVideoPlayer.screenShareFailed'));
    }
  };

  const leaveCall = useCallback(() => {
    isLeavingRef.current = true;
    if (callRef.current) callRef.current.leave();
    onLeave?.();
  }, [onLeave]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Exit native fullscreen
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
      screen.orientation?.unlock?.();
      return;
    }

    // Exit CSS fallback fullscreen (iOS)
    if (isFullscreen) {
      setIsFullscreen(false);
      document.body.style.overflow = '';
      screen.orientation?.unlock?.();
      return;
    }

    // Enter native fullscreen, fallback to CSS — lock landscape like YouTube
    const requestFs = el.requestFullscreen?.bind(el) || (el as any).webkitRequestFullscreen?.bind(el);
    if (requestFs) {
      requestFs().then(() => {
        screen.orientation?.lock?.('landscape').catch(() => {});
      }).catch(() => {
        setIsFullscreen(true);
        document.body.style.overflow = 'hidden';
        screen.orientation?.lock?.('landscape').catch(() => {});
      });
    } else {
      setIsFullscreen(true);
      document.body.style.overflow = 'hidden';
      screen.orientation?.lock?.('landscape').catch(() => {});
    }
  }, [isFullscreen]);

  // Expose controls to parent via ref
  useImperativeHandle(ref, () => ({
    toggleMute,
    toggleVideo,
    leaveCall,
    toggleFullscreen,
    get isMuted() { return isMuted; },
    get isVideoOff() { return isVideoOff; },
    get isFullscreen() { return isFullscreen; },
  }), [toggleMute, toggleVideo, leaveCall, toggleFullscreen, isMuted, isVideoOff, isFullscreen]);

  const handleUnmute = useCallback(() => {
    userHasUnmutedRef.current = true;
    const containers = [videoContainerRef.current, screenShareRef.current];
    containers.forEach(container => {
      if (!container) return;
      container.querySelectorAll('video, audio').forEach((el) => {
        (el as HTMLMediaElement).muted = false;
        (el as HTMLMediaElement).play().catch(() => {});
      });
    });
    setShowUnmutePrompt(false);
    setViewerAudioMuted(false);
  }, []);

  const toggleViewerAudio = useCallback(() => {
    const containers = [videoContainerRef.current, screenShareRef.current];
    const newMuted = !viewerAudioMuted;
    containers.forEach(container => {
      if (!container) return;
      container.querySelectorAll('video, audio').forEach((el) => {
        (el as HTMLMediaElement).muted = newMuted;
        if (!newMuted) (el as HTMLMediaElement).play().catch(() => {});
      });
    });
    setViewerAudioMuted(newMuted);
    if (!newMuted) userHasUnmutedRef.current = true;
  }, [viewerAudioMuted]);

  // Sync fullscreen state with native Fullscreen API (including webkit prefix for iOS)
  useEffect(() => {
    const handleFsChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      document.body.style.overflow = isFull ? 'hidden' : '';
      if (!isFull) {
        screen.orientation?.unlock?.();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.body.style.overflow = '';
    };
  }, []);

  const showingScreenShare = isScreenSharing || hasRemoteScreenShare;

  // MUST be before early returns to keep hook count stable
  const handleFullscreenClick = useCallback(() => {
    if (onMobileFullscreenToggle) {
      onMobileFullscreenToggle();
    } else {
      toggleFullscreen();
    }
  }, [onMobileFullscreenToggle, toggleFullscreen]);

  const resolvedFullscreen = isMobileFullscreen || isFullscreen;

  if (error) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center px-4">
          <VideoOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={handleRetry}>{t('dailyVideoPlayer.retry')}</Button>
            <Button onClick={onLeave} variant="outline">{t('dailyVideoPlayer.back')}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="aspect-video bg-muted rounded-xl overflow-hidden relative">
        <Skeleton className="w-full h-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground">{t('dailyVideoPlayer.connecting')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={externalClassName || `relative bg-black overflow-hidden group ${
        isFullscreen ? 'fixed z-[9999] rounded-none landscape-fs' : 'aspect-video rounded-xl'
      }`}
      style={isFullscreen && !externalClassName ? { inset: 0, width: '100vw', height: '100dvh' } : undefined}
    >
      {/* Connection quality indicator for viewers */}
      {!isOwner && isConnected && (
        <ConnectionQualityIndicator stats={connectionStats} />
      )}

      {/* Screen share layer */}
      <div
        ref={screenShareRef}
        className={`absolute inset-0 flex items-center justify-center bg-black z-0 ${showingScreenShare ? '' : 'hidden'}`}
      />

      {/* Camera video container */}
      <div 
        ref={videoContainerRef} 
        className={`absolute ${showingScreenShare ? 'inset-0 pointer-events-none' : 'inset-0'} flex items-center justify-center`}
      >
        {!isConnected && (
          <Video className="w-16 h-16 text-muted-foreground/30" />
        )}
      </div>
      
      {/* Tap to unmute overlay — always show regardless of hideControls */}
      {showUnmutePrompt && (
        <button
          onClick={handleUnmute}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px] cursor-pointer"
        >
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-5 py-3 rounded-full shadow-xl ring-1 ring-white/20 text-sm font-semibold hover:scale-105 transition-transform">
            <Volume2 className="w-5 h-5" />
            {t('dailyVideoPlayer.tapToUnmute')}
          </div>
        </button>
      )}

      {/* Overlays and controls — hidden when parent provides its own */}
      {!hideControls && (
        <>
          {/* Live Indicator */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
            <Badge variant="live" className="gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {t('dailyVideoPlayer.live')}
            </Badge>
          </div>
          
          {/* Participant Count */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
            <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
              <Users className="w-3 h-3" />
              {participantCount} {t('dailyVideoPlayer.watching')}
            </Badge>
          </div>

          {/* Screen share indicator */}
          {showingScreenShare && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <Badge variant="secondary" className="gap-1 bg-primary/80 text-white border-0">
                <Monitor className="w-3 h-3" />
                {t('dailyVideoPlayer.screenShared')}
              </Badge>
            </div>
          )}

          {/* Controls */}
          <div className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-20 transition-opacity ${
            resolvedFullscreen ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
            style={{ paddingBottom: resolvedFullscreen ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}
          >
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {isOwner && (
                <>
                  <Button
                    size="icon"
                    variant={isMuted ? "destructive" : "secondary"}
                    onClick={toggleMute}
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    size="icon"
                    variant={isVideoOff ? "destructive" : "secondary"}
                    onClick={toggleVideo}
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                  >
                    {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </Button>

                  {(() => {
                    const isPhone = typeof window !== 'undefined' && window.innerWidth < 768 && !/iPad|Macintosh/.test(navigator.userAgent);
                    if (isPhone) return null;
                    return (
                      <Button
                        size="icon"
                        variant={isScreenSharing ? "default" : "secondary"}
                        onClick={toggleScreenShare}
                        className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                      >
                        {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                      </Button>
                    );
                  })()}
                </>
              )}

              {/* Viewer audio toggle */}
              {!isOwner && (
                <Button
                  size="icon"
                  variant={viewerAudioMuted ? "destructive" : "secondary"}
                  onClick={toggleViewerAudio}
                  className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                >
                  {viewerAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              )}
              
              <Button
                size="icon"
                variant="secondary"
                onClick={handleFullscreenClick}
                className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
              >
                {resolvedFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>
              
              {isOwner && (
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={leaveCall}
                  className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {children}
    </div>
  );
});
