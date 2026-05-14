import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';

import { supabase } from '@/integrations/supabase/client';

// CloudflareRecordingPlayer trae hls.js (~300KB). Lazy-load para que NO se descargue
// en la mayoría de los casos (B2 mp4 nunca lo necesita).
const CloudflareRecordingPlayer = React.lazy(() =>
  import('@/components/recordings/CloudflareRecordingPlayer').then(m => ({ default: m.CloudflareRecordingPlayer }))
);
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface RecordingVideoPlayerProps {
  videoUrl: string;
  recordingId: string;
  onDurationUpdate?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  autoPlay?: boolean;
  // Si el padre ya pre-fetcheó el signed URL en paralelo con otras queries,
  // lo recibimos directamente y saltamos el primer round-trip al edge fn.
  prefetchedSignedUrl?: string | null;
  prefetchedTtl?: number;
}

function isStorageRef(url: string) {
  return url.startsWith('storage:');
}

function isB2Ref(url: string) {
  return url.startsWith('b2:');
}

function isBunnyRef(url: string) {
  return url.startsWith('bunny:');
}

function getStoragePath(url: string) {
  return url.replace(/^storage:/, '');
}

function getB2Path(url: string) {
  return url.replace(/^b2:/, '');
}

function getBunnyVideoId(url: string) {
  return url.replace(/^bunny:/, '');
}

/**
 * Player unificado:
 * - Cloudflare (UID / pending:UID) via CloudflareRecordingPlayer
 * - Storage Supabase (storage:path) via signed URL + HTML5 video
 * - Backblaze B2 (b2:path) via edge function presigned URL + HTML5 video
 * - Bunny Stream (bunny:videoId) via MP4 progresivo + HTML5 video
 *
 * Bunny: usamos MP4 progresivo (play_720p.mp4) en vez de HLS. HTML5 video
 * hace Range requests y empieza a reproducir en segundos, como YouTube.
 * Sin hls.js → menos código, más compatibilidad, más simple.
 */
export function RecordingVideoPlayer({ videoUrl, recordingId, onDurationUpdate, onTimeUpdate, autoPlay, prefetchedSignedUrl, prefetchedTtl }: RecordingVideoPlayerProps) {
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

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlGeneratedAt, setUrlGeneratedAt] = useState<number>(0);
  const [urlTtlSec, setUrlTtlSec] = useState<number>(3600);
  const [expired, setExpired] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
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
          const cached = JSON.parse(raw) as { url: string; poster?: string; generatedAt: number; ttlSec: number };
          const ageMs = Date.now() - cached.generatedAt;
          const validMs = (cached.ttlSec - 300) * 1000;
          if (ageMs < validMs) {
            setSignedUrl(cached.url);
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

    const tryGet = async (): Promise<{ url: string; poster?: string; ttlSec: number } | null> => {
      if (bunnyVideoId) {
        const { data, error: invokeErr } = await supabase.functions.invoke('bunny-signed-url', {
          body: { videoId: bunnyVideoId, ttlSec: 3600 },
        });
        if (invokeErr || !data?.mp4Url) {
          const detail = (invokeErr as any)?.message || data?.error || 'No se pudo obtener URL del video';
          throw new Error(detail);
        }
        const ttl = typeof data.expiresSec === 'number' ? data.expiresSec : 3600;
        return { url: data.mp4Url as string, poster: data.thumbnailUrl as string | undefined, ttlSec: ttl };
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
        return { url: data.url as string, ttlSec: ttl };
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
        if (result.poster) setPosterUrl(result.poster);
        setUrlGeneratedAt(now);
        setUrlTtlSec(result.ttlSec);
        setRetryAttempt(0);
        if (cacheKey && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ url: result.url, poster: result.poster, generatedAt: now, ttlSec: result.ttlSec }));
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
  }, [storagePath, b2Path, bunnyVideoId]);

  useEffect(() => {
    if (!storagePath && !b2Path && !bunnyVideoId) return;
    if (prefetchedSignedUrl) {
      setSignedUrl(prefetchedSignedUrl);
      setUrlGeneratedAt(Date.now());
      setUrlTtlSec(prefetchedTtl ?? 3600);
      setIsLoading(false);
      return;
    }
    fetchSignedUrl(0);
  }, [storagePath, b2Path, bunnyVideoId, fetchSignedUrl, prefetchedSignedUrl, prefetchedTtl]);

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

  useEffect(() => {
    if (!urlGeneratedAt || !urlTtlSec) return;
    const renewMs = Math.max(60_000, Math.floor(urlTtlSec * 1000 * 0.8));
    const timeout = setTimeout(() => {
      console.log('[RecordingVideoPlayer] Pre-renewing signed URL before expiry');
      fetchSignedUrl(0, true);
    }, renewMs);
    return () => clearTimeout(timeout);
  }, [urlGeneratedAt, urlTtlSec, fetchSignedUrl]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (onDurationUpdate && Number.isFinite(vid.duration) && vid.duration > 0) {
      onDurationUpdate(Math.floor(vid.duration));
    }
  };

  // Cloudflare: ningún prefix match
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
          <Button onClick={() => { setRetryAttempt(0); fetchSignedUrl(0); }} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            {expired ? 'Renovar sesión' : 'Reintentar'}
          </Button>
        </div>
      </div>
    );
  }

  // Mientras se obtiene el signed URL, mostramos un spinner limpio en vez de
  // un <video> vacío con controles HTML5 (que daba spinner infinito al usuario).
  if (!signedUrl) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="relative max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video"
    >
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
      />
      <DynamicWatermark email={user?.email} userId={supabaseUser?.id} sessionId={sessionId} />
    </div>
  );
}
