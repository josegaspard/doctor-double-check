import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2 } from 'lucide-react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';

interface BunnyHLSPlayerProps {
  /** URL del manifest.m3u8 firmado con token Bunny */
  signedUrl: string;
  recordingId: string;
  onDurationUpdate?: (s: number) => void;
  onTimeUpdate?: (s: number) => void;
  autoPlay?: boolean;
  sessionId?: string;
}

/**
 * Player HLS para Bunny Stream con ABR (adaptive bitrate).
 * Arranca en 240p en ~500ms y sube a 1080p conforme la red lo permite,
 * estilo YouTube. Reutiliza hls.js cuando el browser no soporta HLS nativo.
 */
export function BunnyHLSPlayer({
  signedUrl,
  recordingId,
  onDurationUpdate,
  onTimeUpdate,
  autoPlay,
  sessionId,
}: BunnyHLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, supabaseUser } = useAuth();

  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !signedUrl) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Safari y iOS soportan HLS nativo → más eficiente
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = signedUrl;
      const onLoaded = () => setIsLoading(false);
      video.addEventListener('loadedmetadata', onLoaded);
      return () => video.removeEventListener('loadedmetadata', onLoaded);
    }

    if (!Hls.isSupported()) {
      console.error('[BunnyHLSPlayer] HLS no soportado en este browser');
      return;
    }

    // ABR config optimizado para "arranque rápido en baja calidad → sube"
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 60,
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      // Arrancar en el rendition más bajo para que el primer frame aparezca casi
      // instantáneo. ABR luego sube a la mejor calidad sostenible.
      startLevel: 0,
      // Capacity test: 8s de buffer antes de pasar al siguiente level
      abrEwmaDefaultEstimate: 500000, // 500 kbps initial bandwidth estimate
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
    });

    hlsRef.current = hls;
    hls.loadSource(signedUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setIsLoading(false);
      if (autoPlay) {
        video.muted = true;
        video.play().catch((err) => console.warn('[BunnyHLSPlayer] autoplay blocked:', err?.message));
      }
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const total = data.details.totalduration;
      if (Number.isFinite(total) && total > 0 && onDurationUpdate) {
        onDurationUpdate(Math.floor(total));
      }
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      console.error('[BunnyHLSPlayer] HLS fatal error:', data);
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          hls.destroy();
          hlsRef.current = null;
      }
    });
  }, [signedUrl, autoPlay, onDurationUpdate]);

  useEffect(() => {
    const cleanup = init();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [init]);

  return (
    <div className="relative max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        preload="auto"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={(e) => {
          if (onTimeUpdate) onTimeUpdate(Math.floor((e.currentTarget as HTMLVideoElement).currentTime));
        }}
      />
      <DynamicWatermark email={user?.email} userId={supabaseUser?.id} sessionId={sessionId} />
    </div>
  );
}
