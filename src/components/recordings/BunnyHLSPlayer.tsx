import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';

interface BunnyHLSPlayerProps {
  /** URL del manifest.m3u8 firmado con token Bunny */
  signedUrl: string;
  /** Video ID Bunny — para construir el poster thumbnail */
  videoId?: string;
  /** CDN hostname Bunny — default desde el manifest URL */
  cdnHost?: string;
  /** Custom thumbnail URL (e.g. live thumbnail subido por doctor) */
  thumbnailUrl?: string;
  recordingId: string;
  onDurationUpdate?: (s: number) => void;
  onTimeUpdate?: (s: number) => void;
  autoPlay?: boolean;
  sessionId?: string;
  /** Callback para pedir un signed URL fresh cuando el token expira */
  onRefreshSignedUrl?: () => void;
}

/**
 * Player HLS para Bunny Stream con ABR (adaptive bitrate).
 * Arranca en 240p en ~500ms y sube a 1080p conforme la red lo permite,
 * estilo YouTube. Reutiliza hls.js cuando el browser no soporta HLS nativo.
 */
export function BunnyHLSPlayer({
  signedUrl,
  videoId,
  cdnHost,
  thumbnailUrl,
  recordingId,
  onDurationUpdate,
  onTimeUpdate,
  autoPlay,
  sessionId,
  onRefreshSignedUrl,
}: BunnyHLSPlayerProps) {
  const [errorKind, setErrorKind] = useState<'not_found' | 'forbidden' | 'network' | null>(null);
  // Poster: prioridad thumbnail custom del doctor → thumbnail auto de Bunny
  // Bunny genera thumbnail.jpg automáticamente en /<videoId>/thumbnail.jpg
  // Es PÚBLICO (no requiere signed URL) → carga instantánea como póster.
  // Si el manifest URL apunta a vz-xxx.b-cdn.net, derivamos el host de ahí.
  const derivedCdnHost = cdnHost || (() => {
    try { return new URL(signedUrl).host; } catch { return null; }
  })();
  const poster = thumbnailUrl
    || (videoId && derivedCdnHost ? `https://${derivedCdnHost}/${videoId}/thumbnail.jpg` : undefined);
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
      console.warn('[BunnyHLSPlayer] HLS error:', data.type, data.details, 'response:', data.response?.code);
      if (!data.fatal) return;

      // Detectar errores de signed URL / video missing
      const httpCode = data.response?.code;
      if (httpCode === 404) {
        // Video no existe en Bunny — la grabación está marcada como ready
        // pero el archivo no está. Probablemente el TUS upload falló.
        setErrorKind('not_found');
        setIsLoading(false);
        hls.destroy();
        hlsRef.current = null;
        return;
      }
      if (httpCode === 403) {
        // Token expirado o signature inválida
        if (onRefreshSignedUrl) {
          console.log('[BunnyHLSPlayer] Token expired, requesting refresh');
          onRefreshSignedUrl();
        } else {
          setErrorKind('forbidden');
          setIsLoading(false);
        }
        hls.destroy();
        hlsRef.current = null;
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          // Reintentar — error de red transitorio
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          setErrorKind('network');
          setIsLoading(false);
          hls.destroy();
          hlsRef.current = null;
      }
    });
  }, [signedUrl, autoPlay, onDurationUpdate, onRefreshSignedUrl]);

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

  if (errorKind === 'not_found') {
    return (
      <div className="w-full max-h-[80vh] mx-auto bg-muted rounded-xl flex items-center justify-center aspect-video">
        <div className="text-center p-6 max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Grabación no disponible</h3>
          <p className="text-sm text-muted-foreground mb-4">
            El archivo de video no se encuentra en el servidor. La subida original puede haber fallado.
            Si esta grabación era importante, por favor contacta a soporte.
          </p>
        </div>
      </div>
    );
  }

  if (errorKind === 'forbidden' || errorKind === 'network') {
    return (
      <div className="w-full max-h-[80vh] mx-auto bg-muted rounded-xl flex items-center justify-center aspect-video">
        <div className="text-center p-6 max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h3 className="font-semibold text-foreground mb-2">
            {errorKind === 'forbidden' ? 'Sesión expirada' : 'Error de conexión'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorKind === 'forbidden'
              ? 'El enlace de reproducción ha caducado. Recarga para continuar viendo.'
              : 'No se pudo cargar el video. Verifica tu conexión.'}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video">
      {/* Poster blur en background — visible instantáneo aunque el HLS aún no
          haya parseado el manifest. El video con poster lo cubre al cargar. */}
      {poster && (
        <img
          src={poster}
          alt=""
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover opacity-60 blur-sm scale-105"
          aria-hidden="true"
        />
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        className="relative w-full h-full object-contain z-[1]"
        poster={poster}
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
