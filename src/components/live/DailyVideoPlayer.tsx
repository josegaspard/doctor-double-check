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
  Settings,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
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
  const callRef = useRef<DailyCall | null>(null);
  
  const [isJoining, setIsJoining] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize Daily call
  useEffect(() => {
    if (!roomUrl || !token) return;

    const initCall = async () => {
      try {
        // Create Daily call object
        const call = Daily.createCallObject({
          videoSource: isOwner,
          audioSource: isOwner,
        });
        
        callRef.current = call;

        // Event listeners
        call.on('joined-meeting', handleJoinedMeeting);
        call.on('left-meeting', handleLeftMeeting);
        call.on('participant-joined', handleParticipantUpdate);
        call.on('participant-left', handleParticipantUpdate);
        call.on('participant-updated', handleParticipantUpdate);
        call.on('error', handleError);

        // Join the room
        await call.join({
          url: roomUrl,
          token: token,
        });

      } catch (err: any) {
        console.error('Error joining Daily room:', err);
        setError(err.message || 'Error al conectar');
        setIsJoining(false);
      }
    };

    initCall();

    // Cleanup
    return () => {
      if (callRef.current) {
        callRef.current.leave();
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, [roomUrl, token, isOwner]);

  // Update video container when connected
  useEffect(() => {
    if (!isConnected || !videoContainerRef.current || !callRef.current) return;

    // Get local and remote participants
    const participants = callRef.current.participants();
    updateVideoElements(participants);
  }, [isConnected]);

  const handleJoinedMeeting = useCallback(() => {
    setIsJoining(false);
    setIsConnected(true);
    toast.success(isOwner ? 'Transmisión iniciada' : 'Conectado a la transmisión');
  }, [isOwner]);

  const handleLeftMeeting = useCallback(() => {
    setIsConnected(false);
    onLeave?.();
  }, [onLeave]);

  const handleParticipantUpdate = useCallback(() => {
    if (!callRef.current) return;
    
    const participants = callRef.current.participants();
    const count = Object.keys(participants).length;
    setParticipantCount(count);
    onParticipantCountChange?.(count);
    
    // Update video elements
    if (videoContainerRef.current) {
      updateVideoElements(participants);
    }
  }, [onParticipantCountChange]);

  const handleError = useCallback((event: DailyEventObject) => {
    console.error('Daily error:', event);
    
    // Handle specific error types with user-friendly messages
    const errorMsg = (event as any).errorMsg || '';
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
  }, []);

  const updateVideoElements = (participants: Record<string, DailyParticipant>) => {
    if (!videoContainerRef.current) return;
    
    // Clear existing videos
    videoContainerRef.current.innerHTML = '';
    
    Object.values(participants).forEach((participant) => {
      if (participant.video) {
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = participant.local;
        videoEl.className = participant.local 
          ? 'absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover z-10 border-2 border-primary'
          : 'w-full h-full object-cover';
        
        if (participant.videoTrack) {
          const stream = new MediaStream([participant.videoTrack]);
          videoEl.srcObject = stream;
        }
        
        videoContainerRef.current?.appendChild(videoEl);
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

  const leaveCall = () => {
    if (callRef.current) {
      callRef.current.leave();
    }
    onLeave?.();
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    
    if (!isFullscreen) {
      videoContainerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center">
          <VideoOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={onLeave} className="mt-4" variant="outline">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="aspect-video bg-muted rounded-xl overflow-hidden">
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
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden group">
      {/* Video Container */}
      <div 
        ref={videoContainerRef} 
        className="absolute inset-0 flex items-center justify-center"
      >
        {!isConnected && (
          <Video className="w-16 h-16 text-muted-foreground/30" />
        )}
      </div>
      
      {/* Live Indicator */}
      <div className="absolute top-4 left-4 z-20">
        <Badge variant="live" className="gap-1">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          EN VIVO
        </Badge>
      </div>
      
      {/* Participant Count */}
      <div className="absolute top-4 right-4 z-20">
        <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
          <Users className="w-3 h-3" />
          {participantCount} viendo
        </Badge>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center justify-center gap-2">
          {isOwner && (
            <>
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "secondary"}
                onClick={toggleMute}
                className="rounded-full"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Button
                size="icon"
                variant={isVideoOff ? "destructive" : "secondary"}
                onClick={toggleVideo}
                className="rounded-full"
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </Button>
            </>
          )}
          
          <Button
            size="icon"
            variant="secondary"
            onClick={toggleFullscreen}
            className="rounded-full"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
          
          {isOwner && (
            <Button
              size="icon"
              variant="destructive"
              onClick={leaveCall}
              className="rounded-full"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
