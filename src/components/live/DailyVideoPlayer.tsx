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
  onParticipantCountChange,
  onMobileFullscreenToggle,
  isMobileFullscreen = false,
  className: externalClassName,
  children,
}, ref) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const cleaningUpRef = useRef(false);
  const isLeavingRef = useRef(false);
  const userHasUnmutedRef = useRef(false);
  
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const connectionStats = useConnectionQuality(callRef.current, isConnected);

  useEffect(() => {
    if (!roomUrl || !token) return;
    let cancelled = false;

    const initCall = async () => {
      try {
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

        await call.join({ url: roomUrl, token });
      } catch (err: any) {
        if (cancelled) return;
        console.error('Error joining Daily room:', err);
        setError(err.message || 'Error al conectar');
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
  }, [roomUrl, token, isOwner]);

  useEffect(() => {
    if (!isConnected || !videoContainerRef.current || !callRef.current) return;
    const participants = callRef.current.participants();
    updateVideoElements(participants);
  }, [isConnected]);

  const handleJoinedMeeting = useCallback(() => {
    setIsJoining(false);
    setIsConnected(true);
    toast.success(isOwner ? 'Transmisión iniciada' : 'Conectado a la transmisión');
  }, [isOwner]);

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
      console.log('Daily error suppressed (leaving/cleanup):', (event as any).errorMsg);
      return;
    }

    const errorMsg = ((event as any).errorMsg || '').toLowerCase();
    
    const nonCriticalPatterns = [
      'meeting has ended', 'exp', 'nbf',
      'connection error', 'disconnected', 'transport closed',
      'websocket', 'network connection', 'ice',
    ];
    
    if (
      nonCriticalPatterns.some(p => errorMsg.includes(p)) ||
      (event as any).error?.type === 'meeting-session-state-error'
    ) {
      console.log('Daily room ended by host');
      setIsConnected(false);
      onLeave?.();
      return;
    }

    console.error('Daily error:', event);
    let userMessage = 'Error de conexión';
    
    if (errorMsg.includes('account-missing-payment-method')) {
      userMessage = 'Se requiere configurar un método de pago en Daily.co para transmitir';
    } else if (errorMsg.includes('invalid-request-error')) {
      userMessage = 'Error de configuración del servidor de video';
    } else if (errorMsg.includes('not-allowed')) {
      userMessage = 'Permisos de cámara/micrófono denegados';
    }
    
    setError(userMessage);
    toast.error(userMessage);
  }, [onLeave]);

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

        const isMobileDevice = window.innerWidth < 768;
        videoEl.className = participant.local && hasAnyScreenShare
          ? 'absolute bottom-2 right-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-primary shadow-lg'
          : hasAnyScreenShare && !participant.local
            ? 'absolute bottom-2 left-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-muted shadow-lg'
            : isMobileDevice
              ? 'w-full h-full object-cover absolute inset-0'
              : 'w-full h-full object-cover';
        
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
      toast.error('No se pudo compartir pantalla');
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

  if (error) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center px-4">
          <VideoOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={onLeave} className="mt-4" variant="outline">Volver</Button>
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
            <p className="text-muted-foreground">Conectando...</p>
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
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 cursor-pointer"
        >
          <div className="flex items-center gap-2 bg-background/90 text-foreground px-5 py-3 rounded-full shadow-lg text-sm font-medium">
            <Volume2 className="w-5 h-5" />
            Toca para activar el sonido
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
              EN VIVO
            </Badge>
          </div>
          
          {/* Participant Count */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
            <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
              <Users className="w-3 h-3" />
              {participantCount} viendo
            </Badge>
          </div>

          {/* Screen share indicator */}
          {showingScreenShare && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <Badge variant="secondary" className="gap-1 bg-blue-600/80 text-white border-0">
                <Monitor className="w-3 h-3" />
                Pantalla compartida
              </Badge>
            </div>
          )}

          {/* Controls */}
          <div className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-20 transition-opacity ${
            isFullscreen ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
            style={{ paddingBottom: isFullscreen ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}
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
                onClick={toggleFullscreen}
                className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
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
