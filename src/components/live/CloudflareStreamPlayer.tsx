import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Hls from 'hls.js';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';

interface CloudflareStreamPlayerProps {
  // For broadcasters (doctor)
  localStream?: MediaStream | null;
  // For viewers
  playbackUrl?: string;
  // Common props
  isOwner?: boolean;
  onToggleMute?: (muted: boolean) => void;
  onToggleVideo?: (videoOff: boolean) => void;
  onLeave?: () => void;
  viewerCount?: number;
}

export function CloudflareStreamPlayer({
  localStream,
  playbackUrl,
  isOwner = false,
  onToggleMute,
  onToggleVideo,
  onLeave,
  viewerCount = 0,
}: CloudflareStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerMuted, setViewerMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For owner: display local stream
  useEffect(() => {
    if (!isOwner || !localStream || !videoRef.current) return;

    videoRef.current.srcObject = localStream;
    videoRef.current.muted = true; // Always mute local preview to avoid echo
    videoRef.current.play().catch(console.error);
    
    setIsConnecting(false);
    setIsConnected(true);
  }, [isOwner, localStream]);

  // For viewers: play HLS stream
  useEffect(() => {
    if (isOwner || !playbackUrl || !videoRef.current) return;

    setIsConnecting(true);
    setError(null);

    const video = videoRef.current;

    // Check if native HLS is supported (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsConnecting(false);
        setIsConnected(true);
      });
      video.addEventListener('error', () => {
        setError('Error al cargar la transmisión');
        setIsConnecting(false);
      });
    } else if (Hls.isSupported()) {
      // Use HLS.js for other browsers
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsConnecting(false);
        setIsConnected(true);
        video.play().catch(console.error);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Error de transmisión');
              setIsConnecting(false);
              break;
          }
        }
      });
    } else {
      setError('Tu navegador no soporta streaming de video');
      setIsConnecting(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOwner, playbackUrl]);

  const handleToggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onToggleMute?.(newMuted);
  }, [isMuted, onToggleMute]);

  const handleToggleVideo = useCallback(() => {
    const newVideoOff = !isVideoOff;
    setIsVideoOff(newVideoOff);
    onToggleVideo?.(newVideoOff);
  }, [isVideoOff, onToggleVideo]);

  const handleToggleViewerMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !viewerMuted;
      videoRef.current.muted = newMuted;
      setViewerMuted(newMuted);
    }
  }, [viewerMuted]);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  return (
    <div 
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden group"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isOwner || viewerMuted}
        className="w-full h-full object-cover"
      />

      {/* Loading State */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-white/80">Conectando...</p>
          </div>
        </div>
      )}

      {/* Live Indicator */}
      <div className="absolute top-4 left-4 z-20">
        <Badge variant="live" className="gap-1">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          EN VIVO
        </Badge>
      </div>

      {/* Viewer Count */}
      <div className="absolute top-4 right-4 z-20">
        <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
          <Users className="w-3 h-3" />
          {viewerCount} viendo
        </Badge>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center justify-center gap-2">
          {isOwner ? (
            // Owner controls
            <>
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "secondary"}
                onClick={handleToggleMute}
                className="rounded-full"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Button
                size="icon"
                variant={isVideoOff ? "destructive" : "secondary"}
                onClick={handleToggleVideo}
                className="rounded-full"
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </Button>
            </>
          ) : (
            // Viewer controls
            <Button
              size="icon"
              variant={viewerMuted ? "secondary" : "default"}
              onClick={handleToggleViewerMute}
              className="rounded-full"
            >
              {viewerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          )}
          
          <Button
            size="icon"
            variant="secondary"
            onClick={handleToggleFullscreen}
            className="rounded-full"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
          
          {isOwner && (
            <Button
              size="icon"
              variant="destructive"
              onClick={onLeave}
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
