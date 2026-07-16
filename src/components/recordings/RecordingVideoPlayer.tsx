import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';

import { supabase } from '@/integrations/supabase/client';

const CloudflareRecordingPlayer = React.lazy(() =>
  import('@/components/recordings/CloudflareRecordingPlayer').then(m => ({ default: m.CloudflareRecordingPlayer }))
);
const BunnyHLSPlayer = React.lazy(() =>
  import('@/components/recordings/BunnyHLSPlayer').then(m => ({ default: m.BunnyHLSPlayer }))
);
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface RecordingVideoPlayerProps {
  videoUrl: string;
  recordingId: string;
  bunnyStatus?: 'uploading' | 'processing' | 'ready' | 'failed' | string | null;
  /** Idiomas con subtítulos generados en Bunny (recordings.captions_languages) */
  captionLanguages?: string[];
  onDurationUpdate?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  autoPlay?: boolean;
  prefetchedSignedUrl?: string | null;
  prefetchedTtl?: number;
  prefetchedThumbUrl?: string | null;
}

function isStorageRef(url: string) { return url.startsWith('storage:'); }
function isB2Ref(url: string) { return url.startsWith('b2:'); }
function isBunnyRef(url: string) { return url.startsWith('bunny:'); }
function getStoragePath(url: string) { return url.replace(/^storage:/, ''); }
function getB2Path(url: string) { return url.replace(/^b2:/, ''); }
function getBunnyVideoId(url: string) { return url.replace(/^bunny:/, ''); }

interface BunnyUrls {
  hlsUrl: string;
  mp4Url: string;
  originalUrl: string;
  thumbnailUrl: string;
}

/**
 * Player unificado para grabaciones premium:
 *
 * Bunny Stream (bunny:videoId):
 *   - HLS via hls.js (fragmentado .ts segments — anti-descarga directa)
 *   - Si bunny_status='processing' → reproduce /original (MP4 crudo, disponible
 *     apenas termina el TUS upload, antes del encoding). Ver al instante.
 *   - Fallback MP4 720p si HLS falla
 *
 * Backblaze B2 (b2:path): HTML5 video con signed URL
 * Supabase Storage (storage:path): HTML5 video con signed URL
 * Cloudflare (sin prefix): CloudflareRecordingPlayer (legacy)
 *
 * Anti-piracy frontend:
 *   - controlsList=nodownload + disablePictureInPicture + oncontextmenu blocked
 *   - Watermark dinámica con userId+sessionId
 *   - TTL corto (5min) en signed URLs → comparten URL muere rápido
 *   - Keyboard shortcuts bloqueados (Ctrl+S, F12)
 */
export function RecordingVideoPlayer({
  videoUrl,
  recordingId,
  bunnyStatus,
  captionLanguages,
  onDurationUpdate,
  onTimeUpdate,
  autoPlay,
  prefetchedSignedUrl,
  prefetchedTtl,
  prefetchedThumbUrl,
}: RecordingVideoPlayerProps) {
  const storagePath = useMemo(() => (isStorageRef(videoUrl) ? getStoragePath(videoUrl) : null), [videoUrl]);
  const b2Path = useMemo(() => (isB2Ref(videoUrl) ? getB2Path(videoUrl) : null), [videoUrl]);
  const bunnyVideoId = useMemo(() => (isBunnyRef(videoUrl) ? getBunnyVideoId(videoUrl) : null), [videoUrl]);
  const { user, supabaseUser } = useAuth();
  const sessionId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    [recordingId]
  );

  const [bunnyUrls, setBunnyUrls] = useState<BunnyUrls | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlGeneratedAt, setUrlGeneratedAt] = useState<number>(0);
  const [urlTtlSec, setUrlTtlSec] = useState<number>(600);
  const [expired, setExpired] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  // Cuando bunny_status != ready, usamos /original mientras procesa
  const isStillProcessing = bunnyStatus === 'processing' || bunnyStatus === 'uploading';
  const videoRef = useRef<HTMLVideoElement>(null);
  // Subtítulos también en la ruta MP4 /original (mismo token de la hlsUrl): hoy
  // casi todos los videos caen aquí porque el webhook de bunny_status no marca
  // 'ready'. Sin esto el CC solo saldría en la ruta HLS (que casi nunca ocurre).
  const fallbackCaptionTracks = useBunnyCaptionTracks(bunnyVideoId, bunnyUrls?.hlsUrl, captionLanguages);
  const MAX_AUTO_RETRIES = 3;

  const cacheKey = useMemo(
    () => (bunnyVideoId || b2Path || storagePath)
      ? `signedurl-v3:${bunnyVideoId ? 'bunny:' : b2Path ? 'b2:' : ''}${bunnyVideoId || b2Path || storagePath}`
      : null,
    [bunnyVideoId, b2Path, storagePath]
  );

  const fetchSignedUrl = useCallback(async (attempt: number = 0, skipCache: boolean = false): Promise<void> => {
    if (!storagePath && !b2Path && !bunnyVideoId) return;

    if (!skipCache && cacheKey && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { url: string; bunny?: BunnyUrls; poster?: string; generatedAt: number; ttlSec: number };
          const ageMs = Date.now() - cached.generatedAt;
          const validMs = (cached.ttlSec - 60) * 1000;
          if (ageMs < validMs) {
            setSignedUrl(cached.url);
            if (cached.bunny) setBunnyUrls(cached.bunny);
            if (cached.poster) setPosterUrl(cached.poster);
            setUrlGeneratedAt(cached.generatedAt);
            setUrlTtlSec(cached.ttlSec);
            setIsLoading(false);
            return;
          }
          sessionStorage.removeItem(cacheKey);
        }
      } catch { /* corrupted cache, ignore */ }
    }

    setIsLoading(true);
    setError(null);
    setExpired(false);

    const tryGet = async (): Promise<{ url: string; bunny?: BunnyUrls; poster?: string; ttlSec: number } | null> => {
      if (bunnyVideoId) {
        const { data, error: invokeErr } = await supabase.functions.invoke('bunny-signed-url', {
          body: { videoId: bunnyVideoId, ttlSec: 180 },
        });
        if (invokeErr || !data?.hlsUrl) {
          const detail = (invokeErr as any)?.message || data?.error || 'No se pudo obtener URL del video';
          throw new Error(detail);
        }
        const ttl = typeof data.expiresSec === 'number' ? data.expiresSec : 180;
        const bunny: BunnyUrls = {
          hlsUrl: data.hlsUrl,
          mp4Url: data.mp4Url,
          originalUrl: data.originalUrl,
          thumbnailUrl: data.thumbnailUrl,
        };
        // Si está procesando, /original ya existe y reproduce al instante
        const primaryUrl = isStillProcessing ? data.originalUrl : data.hlsUrl;
        return { url: primaryUrl, bunny, poster: data.thumbnailUrl, ttlSec: ttl };
      }
      if (b2Path) {
        const { data, error: invokeErr } = await supabase.functions.invoke('b2-presigned-url', {
          body: { operation: 'get', path: b2Path },
        });
        if (invokeErr || !data?.url) {
          const detail = (invokeErr as any)?.message || data?.error || 'No se pudo obtener URL del video';
          throw new Error(detail);
        }
        const ttl = typeof data.expiresSec === 'number' ? data.expiresSec : 3600;
        return { url: data.url, ttlSec: ttl };
      }
      const { data, error: signError } = await supabase.storage
        .from('recordings')
        .createSignedUrl(storagePath!, 60 * 60);
      if (signError) {
        const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(storagePath!);
        if (publicUrlData?.publicUrl) return { url: publicUrlData.publicUrl, ttlSec: 3600 };
        throw signError;
      }
      return { url: data.signedUrl, ttlSec: 3600 };
    };

    try {
      const result = await tryGet();
      if (result) {
        const now = Date.now();
        setSignedUrl(result.url);
        if (result.bunny) setBunnyUrls(result.bunny);
        if (result.poster) setPosterUrl(result.poster);
        setUrlGeneratedAt(now);
        setUrlTtlSec(result.ttlSec);
        setRetryAttempt(0);
        if (cacheKey && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              url: result.url, bunny: result.bunny, poster: result.poster,
              generatedAt: now, ttlSec: result.ttlSec,
            }));
          } catch { /* quota exceeded, ignore */ }
        }
      }
    } catch (e: any) {
      console.warn(`[RecordingVideoPlayer] Signed URL attempt ${attempt + 1} failed:`, e?.message);
      if (attempt < MAX_AUTO_RETRIES) {
        const backoffMs = [500, 1500, 3500][attempt] ?? 3500;
        setRetryAttempt(attempt + 1);
        setTimeout(() => fetchSignedUrl(attempt + 1), backoffMs);
        return;
      }
      console.error('[RecordingVideoPlayer] Signed URL exhausted retries:', e);
      setError(e?.message || 'No se pudo cargar el video despues de varios intentos');
    } finally {
      if (attempt >= MAX_AUTO_RETRIES) setIsLoading(false);
      else if (attempt === 0) setIsLoading(false);
    }
  }, [storagePath, b2Path, bunnyVideoId, cacheKey, isStillProcessing]);

  useEffect(() => {
    if (!storagePath && !b2Path && !bunnyVideoId) return;
    if (prefetchedSignedUrl) {
      setSignedUrl(prefetchedSignedUrl);
      if (prefetchedThumbUrl) setPosterUrl(prefetchedThumbUrl);
      setUrlGeneratedAt(Date.now());
      setUrlTtlSec(prefetchedTtl ?? 180);
      setIsLoading(false);
      return;
    }
    fetchSignedUrl(0);
  }, [storagePath, b2Path, bunnyVideoId, fetchSignedUrl, prefetchedSignedUrl, prefetchedTtl, prefetchedThumbUrl]);

  useEffect(() => {
    if (!signedUrl || !autoPlay) return;
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    const playPromise = vid.play();
    if (playPromise) {
      playPromise.catch((err) => {
        console.warn('[RecordingVideoPlayer] auto-play blocked:', err?.message);
      });
    }
  }, [signedUrl, autoPlay]);

  // Pre-renew signed URL al 60% del TTL para evitar 403 mid-playback.
  // Con TTL=180s, renueva cada ~108s — ventana copy-and-share <3 min.
  useEffect(() => {
    if (!urlGeneratedAt || !urlTtlSec) return;
    const renewMs = Math.max(30_000, Math.floor(urlTtlSec * 1000 * 0.6));
    const timeout = setTimeout(() => {
      console.log('[RecordingVideoPlayer] Pre-renewing signed URL');
      fetchSignedUrl(0, true);
    }, renewMs);
    return () => clearTimeout(timeout);
  }, [urlGeneratedAt, urlTtlSec, fetchSignedUrl]);

  // Anti-piracy: bloquear keyboard shortcuts comunes para guardar/inspeccionar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: guardar página (incluye blobs de video)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return;
      }
      // F12 / Ctrl+Shift+I / Ctrl+Shift+J: dev tools (best effort — no detiene
      // a un atacante real, sólo disuade al 95% de usuarios)
      if (e.key === 'F12') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (onDurationUpdate && Number.isFinite(vid.duration) && vid.duration > 0) {
      onDurationUpdate(Math.floor(vid.duration));
    }
  };

  // Cloudflare branch — ningún prefix match
  if (!storagePath && !b2Path && !bunnyVideoId) {
    return (
      <div className="relative">
        <Suspense fallback={
          <div className="aspect-video bg-black rounded-xl flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        }>
          <CloudflareRecordingPlayer videoUrl={videoUrl} recordingId={recordingId} onDurationUpdate={onDurationUpdate} onTimeUpdate={onTimeUpdate} autoPlay={autoPlay} />
        </Suspense>
        <DynamicWatermark email={user?.email} userId={supabaseUser?.id} sessionId={sessionId} />
      </div>
    );
  }

  if (error || expired) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">
            {expired ? 'Sesión expirada — recarga la URL para continuar viendo' : error}
          </p>
          <Button onClick={() => { setRetryAttempt(0); fetchSignedUrl(0, true); }} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            {expired ? 'Renovar sesión' : 'Reintentar'}
          </Button>
        </div>
      </div>
    );
  }

  // Mientras carga signed URL — spinner limpio (NO <video> vacío con controls
  // nativos que daba spinner infinito al usuario).
  if (!signedUrl) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Bunny + bunny_status=ready → HLS via hls.js (anti-descarga + ABR YouTube-style)
  if (bunnyVideoId && bunnyUrls && !isStillProcessing) {
    return (
      <div className="relative max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video select-none">
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        }>
          <BunnyHLSPlayer
            signedUrl={bunnyUrls.hlsUrl}
            videoId={bunnyVideoId}
            captionLanguages={captionLanguages}
            thumbnailUrl={bunnyUrls.thumbnailUrl}
            mp4FallbackUrl={bunnyUrls.mp4Url}
            recordingId={recordingId}
            onDurationUpdate={onDurationUpdate}
            onTimeUpdate={onTimeUpdate}
            autoPlay={autoPlay}
            sessionId={sessionId}
            onRefreshSignedUrl={() => fetchSignedUrl(0, true)}
          />
        </Suspense>
        <DynamicWatermark email={user?.email} userId={supabaseUser?.id} sessionId={sessionId} />
      </div>
    );
  }

  // Bunny + procesando: reproducir /original (MP4 sin transcodear, disponible
  // apenas TUS upload termina). Visible al instante mientras encoding sucede en
  // background. Cuando bunny_status pase a 'ready' el componente re-renderiza
  // y switchea a HLS automáticamente.
  // Otros backends (b2, storage): HTML5 video con signedUrl.
  return (
    <div
      className="relative max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video select-none"
    >
      {/* Badge "Optimizando calidad" removido. Mientras Bunny no marca 'ready'
          el player ya está sirviendo /original (MP4 crudo), así que el usuario
          ve y oye el contenido completo. No vale la pena mostrar un badge
          insistente que confunde si el webhook de Bunny tarda en llegar. */}
      <video
        key={signedUrl}
        ref={videoRef}
        className="w-full h-full object-contain"
        src={signedUrl}
        poster={posterUrl || undefined}
        controls
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        preload="auto"
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          if (onTimeUpdate) onTimeUpdate(Math.floor((e.currentTarget as HTMLVideoElement).currentTime));
        }}
        onError={(e) => {
          if (urlGeneratedAt && Date.now() - urlGeneratedAt > urlTtlSec * 1000 * 0.95) {
            setExpired(true);
            return;
          }
          const vid = e.currentTarget as HTMLVideoElement;
          const errCode = vid.error?.code;
          console.warn('[RecordingVideoPlayer] video onError code:', errCode);
          if (retryAttempt < MAX_AUTO_RETRIES) {
            console.log('[RecordingVideoPlayer] Auto-retry: regenerating signed URL');
            setRetryAttempt(prev => prev + 1);
            setTimeout(() => fetchSignedUrl(0, true), 600);
            return;
          }
          const isWebm = storagePath?.endsWith('.webm');
          if (isWebm) {
            setError('Esta grabación está en formato .webm que no es compatible con todos los dispositivos. Las nuevas grabaciones se guardarán en formato compatible.');
          } else {
            setError('No se pudo reproducir el video. Verifica tu conexión e intenta de nuevo.');
          }
        }}
      >
        {/* Subtítulos generados en Bunny (pistas blob same-origin); el botón CC
            nativo aparece solo cuando hay al menos una pista. */}
        {fallbackCaptionTracks.map((tr) => (
          <track key={tr.lang} kind="subtitles" srcLang={tr.lang} label={tr.label} src={tr.src} />
        ))}
      </video>
      <DynamicWatermark email={user?.email} userId={supabaseUser?.id} sessionId={sessionId} />
    </div>
  );
}
