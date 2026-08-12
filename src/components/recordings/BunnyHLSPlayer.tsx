import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, RefreshCw, Eye, Volume2 } from 'lucide-react';

// Etiqueta del botón "Activar sonido" en los 8 idiomas de la app.
const SOUND_LABEL: Record<string, string> = {
  es: 'Activar sonido', en: 'Enable sound', pt: 'Ativar som', fr: 'Activer le son',
  it: 'Attiva audio', de: 'Ton aktivieren', ca: 'Activa el so', zh: '开启声音',
};
import { Button } from '@/components/ui/button';
import { useDevToolsDetector } from '@/hooks/useDevToolsDetector';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBunnyCaptionTracks } from '@/hooks/useBunnyCaptionTracks';

interface BunnyHLSPlayerProps {
  /** Master HLS manifest signed URL */
  signedUrl: string;
  videoId?: string;
  cdnHost?: string;
  thumbnailUrl?: string;
  /** MP4 fallback URL si HLS falla en el browser */
  mp4FallbackUrl?: string;
  recordingId: string;
  /** Idiomas con subtítulos generados (recordings.captions_languages, batch93) */
  captionLanguages?: string[];
  onDurationUpdate?: (s: number) => void;
  onTimeUpdate?: (s: number) => void;
  autoPlay?: boolean;
  sessionId?: string;
  onRefreshSignedUrl?: () => void;
}


/**
 * Player HLS para Bunny Stream con ABR adaptativo.
 * Arranque rápido en 240p, sube a 1080p conforme la red lo permite (YouTube-style).
 * Safari/iOS usan HLS nativo. Resto via hls.js.
 * Si hls.js falla (rare), cae a MP4 720p como fallback.
 *
 * Anti-piracy:
 * - HLS fragmentado (.ts segments) — no es 1 file descargable directo
 * - controlsList=nodownload, disablePictureInPicture
 * - onContextMenu bloqueado
 */
export function BunnyHLSPlayer({
  signedUrl,
  videoId,
  cdnHost,
  thumbnailUrl,
  mp4FallbackUrl,
  recordingId,
  captionLanguages,
  onDurationUpdate,
  onTimeUpdate,
  autoPlay,
  sessionId,
  onRefreshSignedUrl,
}: BunnyHLSPlayerProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [errorKind, setErrorKind] = useState<'not_found' | 'forbidden' | 'network' | null>(null);
  const [fellBackToMp4, setFellBackToMp4] = useState(false);
  const derivedCdnHost = cdnHost || (() => {
    try { return new URL(signedUrl).host; } catch { return null; }
  })();
  const poster = thumbnailUrl
    || (videoId && derivedCdnHost ? `https://${derivedCdnHost}/${videoId}/thumbnail.jpg` : undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AUDIO: intentar reproducir CON sonido; si el navegador bloquea el autoplay con
  // audio (sin gesto previo), arrancar en silencio y ofrecer un botón para activarlo.
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const playPreferAudio = useCallback(async (video: HTMLVideoElement) => {
    try {
      video.muted = false;
      await video.play();
      setNeedsUnmute(false);
    } catch {
      video.muted = true;
      setNeedsUnmute(true);
      try { await video.play(); } catch { /* ignore */ }
    }
  }, []);
  const enableSound = useCallback(() => {
    const v = videoRef.current;
    if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); }
    setNeedsUnmute(false);
  }, []);

  // "Continuar donde lo dejaste": posición persistida por grabación.
  const RESUME_KEY = `mm-resume-${recordingId}`;

  // SUBTÍTULOS (batch93): el manifest de Bunny NO expone las pistas SUBTITLES
  // (CLOSED-CAPTIONS=NONE), así que las inyectamos como <track> (hook compartido
  // con la ruta MP4 /original).
  const captionTracks = useBunnyCaptionTracks(videoId, signedUrl, captionLanguages);

  // DevTools detection: pause playback + log forensic event.
  // If the user reopens DevTools, video stays paused until they close them.
  const devtoolsOpen = useDevToolsDetector({
    fileId: recordingId,
    bucket: 'bunny-stream',
    onOpen: () => {
      const vid = videoRef.current;
      if (vid && !vid.paused) vid.pause();
    },
  });

  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !signedUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Safari / iOS — HLS nativo (más eficiente, sin hls.js)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = signedUrl;
      const onLoaded = () => setIsLoading(false);
      video.addEventListener('loadedmetadata', onLoaded);
      return () => video.removeEventListener('loadedmetadata', onLoaded);
    }

    if (!Hls.isSupported()) {
      console.warn('[BunnyHLSPlayer] HLS no soportado — fallback a MP4');
      if (mp4FallbackUrl) {
        video.src = mp4FallbackUrl;
        setFellBackToMp4(true);
        setIsLoading(false);
      }
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 60,
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      // Arrancar en rendition más bajo → primer frame casi instantáneo
      startLevel: 0,
      abrEwmaDefaultEstimate: 500000,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
    });

    hlsRef.current = hls;
    hls.loadSource(signedUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setIsLoading(false);
      if (autoPlay) {
        void playPreferAudio(video);
      }
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const total = data.details.totalduration;
      if (Number.isFinite(total) && total > 0 && onDurationUpdate) {
        onDurationUpdate(Math.floor(total));
      }
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      console.warn('[BunnyHLSPlayer] HLS error:', data.type, data.details, 'http:', data.response?.code);
      if (!data.fatal) return;

      const httpCode = data.response?.code;
      if (httpCode === 404) {
        setErrorKind('not_found');
        setIsLoading(false);
        hls.destroy();
        hlsRef.current = null;
        return;
      }
      if (httpCode === 403) {
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

      // Fallback a MP4 si HLS errores fatales y tenemos MP4 URL
      if (mp4FallbackUrl && !fellBackToMp4) {
        console.log('[BunnyHLSPlayer] HLS fatal, fallback a MP4 720p');
        hls.destroy();
        hlsRef.current = null;
        video.src = mp4FallbackUrl;
        setFellBackToMp4(true);
        setIsLoading(false);
        if (autoPlay) {
          void playPreferAudio(video);
        }
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
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
  }, [signedUrl, autoPlay, onDurationUpdate, onRefreshSignedUrl, mp4FallbackUrl, fellBackToMp4, playPreferAudio]);

  // Atajos de teclado: espacio/K = play·pausa · ←/→ = ±10s · ↑/↓ = volumen ·
  // F = pantalla completa · M = silenciar. Se ignoran si el foco está en un input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      switch (e.key) {
        case ' ': case 'k': case 'K':
          e.preventDefault(); if (v.paused) v.play().catch(() => {}); else v.pause(); break;
        case 'ArrowRight':
          e.preventDefault(); v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10); break;
        case 'ArrowLeft':
          e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowUp':
          e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown':
          e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
        case 'f': case 'F':
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen?.();
          else v.requestFullscreen?.();
          break;
        case 'm': case 'M':
          e.preventDefault(); v.muted = !v.muted; if (!v.muted) setNeedsUnmute(false); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          <h3 className="font-semibold text-foreground mb-2">{t('bunnyHLSPlayer.notFoundTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('bunnyHLSPlayer.notFoundDescription')}
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
            {errorKind === 'forbidden' ? t('bunnyHLSPlayer.sessionExpiredTitle') : t('bunnyHLSPlayer.connectionErrorTitle')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {errorKind === 'forbidden'
              ? t('bunnyHLSPlayer.sessionExpiredDescription')
              : t('bunnyHLSPlayer.connectionErrorDescription')}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('bunnyHLSPlayer.reload')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Poster blur al fondo — visible instantáneo aunque HLS aún cargue */}
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
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={(e) => {
          const vid = e.currentTarget as HTMLVideoElement;
          if (onTimeUpdate) onTimeUpdate(Math.floor(vid.currentTime));
          // Guardar posición para "continuar donde lo dejaste".
          try {
            if (vid.duration && vid.currentTime > 5) {
              if (vid.currentTime >= vid.duration - 5) localStorage.removeItem(RESUME_KEY);
              else localStorage.setItem(RESUME_KEY, String(Math.floor(vid.currentTime)));
            }
          } catch { /* ignore */ }
        }}
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget as HTMLVideoElement;
          if (onDurationUpdate && Number.isFinite(vid.duration) && vid.duration > 0) {
            onDurationUpdate(Math.floor(vid.duration));
          }
          // Reanudar donde se quedó (si hay posición guardada válida).
          try {
            const saved = Number(localStorage.getItem(RESUME_KEY));
            if (saved > 5 && vid.duration && saved < vid.duration - 5) vid.currentTime = saved;
          } catch { /* ignore */ }
        }}
      >
        {/* Pistas de subtítulos (blob same-origin); el botón CC nativo aparece solo */}
        {captionTracks.map((tr) => (
          <track key={tr.lang} kind="subtitles" srcLang={tr.lang} label={tr.label} src={tr.src} />
        ))}
      </video>

      {/* AUDIO: el navegador bloqueó el arranque con sonido → un clic para activarlo */}
      {needsUnmute && (
        <button
          type="button"
          onClick={enableSound}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg hover:opacity-90 animate-pulse"
        >
          <Volume2 className="w-4 h-4" /> {SOUND_LABEL[language] || SOUND_LABEL.es}
        </button>
      )}

      {/* Anti-piracy: watermark centrado tenue — sobrevive capturas de pantalla */}
      {user?.email && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center select-none"
        >
          <span
            className="font-mono text-white/15 text-base sm:text-xl md:text-2xl tracking-widest -rotate-12 px-4 py-2 text-center max-w-[80%] break-all"
            style={{ textShadow: '0 0 8px rgba(0,0,0,0.5)' }}
            data-testid="player-watermark-centered"
          >
            {user.email} · {recordingId.slice(0, 8)}
          </span>
        </div>
      )}

      {/* DevTools detected overlay: pausa + advertencia */}
      {devtoolsOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-md"
          data-testid="devtools-block-overlay"
        >
          <div className="text-center max-w-md px-6">
            <Eye className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <h3 className="font-semibold text-white text-lg mb-2">
              {t('bunnyHLSPlayer.playbackPausedTitle')}
            </h3>
            <p className="text-sm text-white/80">
              {t('bunnyHLSPlayer.playbackPausedDescription')}
            </p>
            <p className="text-[10px] text-white/40 mt-4 font-mono">
              {t('bunnyHLSPlayer.eventRecorded')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
