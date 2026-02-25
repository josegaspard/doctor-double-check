import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Play,
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

export const CloudflareStreamPlayer = React.forwardRef<HTMLDivElement, CloudflareStreamPlayerProps>(function CloudflareStreamPlayer({
  localStream,
  playbackUrl,
  isOwner = false,
  onToggleMute,
  onToggleVideo,
  onLeave,
  viewerCount = 0,
}: CloudflareStreamPlayerProps, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerMuted, setViewerMuted] = useState(true);
  const [needsUserPlay, setNeedsUserPlay] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const effectivePlaybackUrl = useMemo(() => {
    if (!playbackUrl) return undefined;
    const separator = playbackUrl.includes('?') ? '&' : '?';
    return `${playbackUrl}${separator}cb=${reloadKey}`;
  }, [playbackUrl, reloadKey]);

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RETRIES = 12;
  const RETRY_DELAY_MS = 2500;

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback((reason: string) => {
    if (retryTimeoutRef.current) return;

    if (retryCountRef.current >= MAX_RETRIES) {
      console.error('[Cloudflare] Retry limit reached:', reason);
      setError('Error al cargar la transmisión. Verifica tu conexión e intenta de nuevo.');
      setIsConnecting(false);
      return;
    }

    retryCountRef.current += 1;
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      setReloadKey((prev) => prev + 1);
    }, RETRY_DELAY_MS);
  }, []);

  const tryPlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play();
      setNeedsUserPlay(false);
    } catch (playError: any) {
      if (playError?.name === 'NotAllowedError') {
        setNeedsUserPlay(true);
      } else {
        console.warn('[Cloudflare] Playback start warning:', playError);
      }
    }
  }, []);

  // For owner: display local stream
  useEffect(() => {
    if (!isOwner || !localStream || !videoRef.current) return;

    videoRef.current.srcObject = localStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch(console.error);

    setIsConnecting(false);
    setIsConnected(true);
  }, [isOwner, localStream]);

  // For viewers: play HLS stream
  useEffect(() => {
    if (isOwner || !effectivePlaybackUrl || !videoRef.current) return;

    const video = videoRef.current;
    setIsConnecting(true);
    setError(null);
    setNeedsUserPlay(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });

      hlsRef.current = hls;
      hls.loadSource(effectivePlaybackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        setIsConnecting(false);
        setIsConnected(true);
        retryCountRef.current = 0;
        tryPlay(video);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[Cloudflare] HLS error:', data);
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad(-1);
            scheduleRetry('network_error');
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            scheduleRetry('media_error');
            break;
          default:
            scheduleRetry(`fatal_${data.type}`);
            break;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = effectivePlaybackUrl;

      const onCanPlay = () => {
        setError(null);
        setIsConnecting(false);
        setIsConnected(true);
        retryCountRef.current = 0;
        tryPlay(video);
      };

      const onError = () => scheduleRetry('native_hls_error');

      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
      };
    } else {
      setError('Tu navegador no soporta streaming de video');
      setIsConnecting(false);
    }

    return () => {
      clearRetryTimeout();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOwner, effectivePlaybackUrl, scheduleRetry, tryPlay, clearRetryTimeout]);

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

  const handleManualPlay = useCallback(async () => {
    if (!videoRef.current) return;
    await tryPlay(videoRef.current);
  }, [tryPlay]);

  const handleRetryPlayback = useCallback(() => {
    setError(null);
    setIsConnecting(true);
    setNeedsUserPlay(false);
    setReloadKey((prev) => prev + 1);
  }, []);

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
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (error) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center p-4">
          <VideoOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={handleRetryPlayback} variant="outline">
              Reintentar
            </Button>
            <Button onClick={onLeave} variant="outline">
              Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
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
            {!isConnected && retryCountRef.current > 0 && (
              <p className="text-white/60 text-xs mt-2">Intento {retryCountRef.current}/{5}</p>
            )}
          </div>
        </div>
      )}

      {!isOwner && needsUserPlay && !isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <Button
            onClick={handleManualPlay}
            className="rounded-full pointer-events-auto"
            variant="secondary"
          >
            <Play className="w-4 h-4 mr-2" />
            Tocar para reproducir
          </Button>
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
});
