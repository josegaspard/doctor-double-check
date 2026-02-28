import React, { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'lucide-react';

interface DailyVideoPlayerProps {
  roomUrl: string;
  token: string;
  isOwner?: boolean;
  onLeave?: () => void;
  onParticipantCountChange?: (count: number) => void;
}

export function DailyVideoPlayer({
  roomUrl,
  token,
  isOwner = false,
  onLeave,
  onParticipantCountChange,
}: DailyVideoPlayerProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const cleaningUpRef = useRef(false);
  
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

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomUrl || !token) return;
    let cancelled = false;

    const initCall = async () => {
      try {
        // Destroy any lingering instance first (handles React 18 StrictMode double-mount)
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

    // Detect screen shares
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
    const errorMsg = (event as any).errorMsg || '';
    
    // When the doctor ends the live, the room is destroyed and viewers get
    // a "meeting has ended" or "exp" error — this is NOT a real error.
    if (
      errorMsg.includes('meeting has ended') ||
      errorMsg.includes('exp') ||
      errorMsg.includes('nbf') ||
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

    // Also clear screen share container
    if (screenShareRef.current) {
      screenShareRef.current.innerHTML = '';
    }

    // Detect screen share directly from participants (avoid stale closure)
    let hasAnyScreenShare = false;
    Object.values(participants).forEach(p => {
      if (p.screen && p.screenVideoTrack) {
        hasAnyScreenShare = true;
      }
    });
    
    Object.values(participants).forEach((participant) => {
      // Handle screen share track
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
        // Start ALL videos muted so autoplay works on iOS/mobile
        videoEl.muted = true;

        videoEl.className = participant.local && hasAnyScreenShare
          ? 'absolute bottom-2 right-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-primary shadow-lg'
          : hasAnyScreenShare && !participant.local
            ? 'absolute bottom-2 left-2 w-24 h-18 sm:w-32 sm:h-24 rounded-lg object-cover z-10 border-2 border-muted shadow-lg'
            : 'w-full h-full object-cover';
        
        const tracks: MediaStreamTrack[] = [participant.videoTrack];
        if (!participant.local && participant.audioTrack) {
          tracks.push(participant.audioTrack);
        }
        const stream = new MediaStream(tracks);
        videoEl.srcObject = stream;
        videoContainerRef.current?.appendChild(videoEl);

        // Attempt to play, then try unmuting for remote participants
        videoEl.play().then(() => {
          if (!participant.local) {
            try {
              videoEl.muted = false;
            } catch {
              setShowUnmutePrompt(true);
            }
          }
        }).catch(() => {
          if (!participant.local) {
            setShowUnmutePrompt(true);
          }
        });
      } else if (!participant.local && participant.audioTrack && !participant.video) {
        // Audio-only fallback
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.muted = true;
        const audioStream = new MediaStream([participant.audioTrack]);
        audioEl.srcObject = audioStream;
        videoContainerRef.current?.appendChild(audioEl);

        audioEl.play().then(() => {
          try { audioEl.muted = false; } catch { setShowUnmutePrompt(true); }
        }).catch(() => {
          setShowUnmutePrompt(true);
        });
      }
    });
  };

  const toggleMute = () => {
    if (!callRef.current) return;
    const newMuted = !isMuted;
    callRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  };

  const toggleVideo = () => {
    if (!callRef.current) return;
    const newVideoOff = !isVideoOff;
    callRef.current.setLocalVideo(!newVideoOff);
    setIsVideoOff(newVideoOff);
  };

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

  const leaveCall = () => {
    if (callRef.current) callRef.current.leave();
    onLeave?.();
  };

  const handleUnmute = useCallback(() => {
    const containers = [videoContainerRef.current, screenShareRef.current];
    containers.forEach(container => {
      if (!container) return;
      container.querySelectorAll('video, audio').forEach((el) => {
        (el as HTMLMediaElement).muted = false;
        (el as HTMLMediaElement).play().catch(() => {});
      });
    });
    setShowUnmutePrompt(false);
  }, []);

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!isFullscreen) {
      wrapperRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
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
      className={`relative bg-black rounded-xl overflow-hidden group ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'aspect-video'
      }`}
    >
      {/* Screen share layer — always rendered so ref is available when tracks arrive */}
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
      
      {/* Tap to unmute overlay */}
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

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-20 transition-opacity ${
        isFullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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

              <Button
                size="icon"
                variant={isScreenSharing ? "default" : "secondary"}
                onClick={toggleScreenShare}
                className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
              >
                {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            </>
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
    </div>
  );
}
