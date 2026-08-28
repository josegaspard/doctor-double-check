import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Volume2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DemoVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vídeo a reproducir. Por defecto el del home (editable por el súper admin). */
  src?: string;
  poster?: string;
}

const DEFAULT_SRC = '/landing-mm-2026.mp4';
const DEFAULT_POSTER = '/landing-mm-2026-poster.jpg';

/**
 * Reproductor del "Ver Demo en Vivo".
 *
 * 🚨 2026-08-18 — por qué se reescribió: el vídeo apuntaba a
 * gestomarketing.com.mx y la CSP de vercel.json (`media-src 'self' blob:
 * https://*.daily.co …`) BLOQUEABA la carga. El diálogo abría con una caja azul
 * vacía y el cliente lo reportó como "no funciona". Ahora se sirve desde el
 * propio dominio (o desde Supabase Storage si el admin sube otro), que es lo
 * único que la CSP permite.
 *
 * El tamaño se calcula para que el 16:9 ENTERO quepa siempre: se limita a la vez
 * por ancho (96vw) y por alto (100dvh − 5rem), así no se corta ni en móvil
 * vertical, ni en apaisado, ni en tablet, ni en escritorio.
 *
 * 🚨 El <video> se localiza con un ref-callback (`setVideoEl`), NO con
 * `useRef` + efecto sobre `open`: Radix monta el contenido del diálogo DESPUÉS
 * del efecto del padre, así que en ese momento `ref.current` todavía es null y
 * el vídeo se quedaba parado en el póster.
 */
export function DemoVideoModal({ open, onOpenChange, src, poster }: DemoVideoModalProps) {
  const { t } = useLanguage();
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const startedRef = useRef(false);

  const videoSrc = src || DEFAULT_SRC;
  const isDefault = videoSrc.split('?')[0].endsWith(DEFAULT_SRC);
  const videoPoster = poster || (isDefault ? DEFAULT_POSTER : undefined);

  // Arranca con sonido; si el navegador bloquea el autoplay (iOS/Chrome),
  // reproduce en silencio y ofrece el botón "Activar sonido".
  const tryPlay = useCallback((v: HTMLVideoElement) => {
    v.muted = false;
    const p = v.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        startedRef.current = true;
        setNeedsUnmute(false);
      }).catch(() => {
        v.muted = true;
        setNeedsUnmute(true);
        v.play()
          .then(() => {
            startedRef.current = true;
          })
          .catch(() => {
            /* si tampoco deja, quedan los controles nativos */
          });
      });
    } else {
      startedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!open || !videoEl) return;
    setLoading(videoEl.readyState < 2);
    setFailed(false);
    setNeedsUnmute(false);
    startedRef.current = false;
    try {
      videoEl.currentTime = 0;
    } catch {
      /* aún sin metadatos: empieza en 0 igualmente */
    }
    tryPlay(videoEl);
  }, [open, videoEl, videoSrc, tryPlay]);

  const unmute = () => {
    if (!videoEl) return;
    videoEl.muted = false;
    setNeedsUnmute(false);
    videoEl.play().catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden bg-black border-0 rounded-2xl shadow-2xl w-auto max-w-none max-h-none"
        style={{
          // Cabe entero por ancho Y por alto en cualquier pantalla.
          width: 'min(96vw, 1120px, calc((100dvh - 5rem) * 16 / 9))',
        }}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('landing.hero.ctaSecondary')}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-video bg-black">
          <video
            ref={setVideoEl}
            key={videoSrc}
            controls
            playsInline
            preload="auto"
            controlsList="nodownload"
            poster={videoPoster}
            className="absolute inset-0 w-full h-full object-contain"
            src={videoPoster ? videoSrc : `${videoSrc}#t=0.1`}
            onLoadedData={() => setLoading(false)}
            onCanPlay={(e) => {
              setLoading(false);
              if (!startedRef.current) tryPlay(e.currentTarget);
            }}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />

          {loading && !failed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="w-10 h-10 text-white/80 animate-spin" />
            </div>
          )}

          {needsUnmute && !failed && (
            <button
              type="button"
              onClick={unmute}
              className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 text-white text-xs font-semibold shadow-lg transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {t('landing.video.soundOn')}
            </button>
          )}

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-white/85">{t('landing.video.error')}</p>
              <a
                href={videoSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#227787] hover:bg-[#1a606e] text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {t('landing.video.openInNewTab')}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
