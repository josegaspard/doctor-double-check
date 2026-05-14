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
}

function isStorageRef(url: string) {
  return url.startsWith('storage:');
}

function isB2Ref(url: string) {
  return url.startsWith('b2:');
}

function getStoragePath(url: string) {
  return url.replace(/^storage:/, '');
}

function getB2Path(url: string) {
  return url.replace(/^b2:/, '');
}

/**
 * Player que soporta:
 * - Cloudflare (UID / pending:UID) via CloudflareRecordingPlayer
 * - Almacenamiento Supabase Storage (storage:path) via signed URL + HTML5 video
 * - Backblaze B2 (b2:path) via edge function presigned URL + HTML5 video
 */
export function RecordingVideoPlayer({ videoUrl, recordingId, onDurationUpdate, onTimeUpdate, autoPlay }: RecordingVideoPlayerProps) {
  const storagePath = useMemo(() => (isStorageRef(videoUrl) ? getStoragePath(videoUrl) : null), [videoUrl]);
  const b2Path = useMemo(() => (isB2Ref(videoUrl) ? getB2Path(videoUrl) : null), [videoUrl]);
  const { user, supabaseUser } = useAuth();
  // Generate a unique sessionId per mount — persists across signed URL renewals
  const sessionId = useMemo(
    () =>
      typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    [recordingId]
  );

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlGeneratedAt, setUrlGeneratedAt] = useState<number>(0);
  const [urlTtlSec, setUrlTtlSec] = useState<number>(3600);
  const [expired, setExpired] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const MAX_AUTO_RETRIES = 3;

  // Resilient signed URL fetcher with exponential backoff retry chain:
  //   attempt 1: immediate
  //   attempt 2: 500ms later
  //   attempt 3: 1500ms later
  //   attempt 4: 3500ms later
  // After exhaustion shows the manual "Reintentar" UI.
  const fetchSignedUrl = useCallback(async (attempt: number = 0): Promise<void> => {
    if (!storagePath && !b2Path) return;

    setIsLoading(true);
    setError(null);
    setExpired(false);

    const tryGet = async (): Promise<string | null> => {
      if (b2Path) {
        const { data, error: invokeErr } = await supabase.functions.invoke('b2-presigned-url', {
          body: { operation: 'get', path: b2Path },
        });
        if (invokeErr || !data?.url) {
          const detail = (invokeErr as any)?.message || data?.error || 'No se pudo obtener URL del video';
          throw new Error(detail);
        }
        if (typeof data.expiresSec === 'number') setUrlTtlSec(data.expiresSec);
        return data.url as string;
      }
      const { data, error: signError } = await supabase.storage
        .from('recordings')
        .createSignedUrl(storagePath!, 60 * 60);
      if (signError) {
        const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(storagePath!);
        if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
        throw signError;
      }
      return data.signedUrl;
    };

    try {
      const url = await tryGet();
      if (url) {
        setSignedUrl(url);
        setUrlGeneratedAt(Date.now());
        setRetryAttempt(0);
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
  }, [storagePath, b2Path]);

  useEffect(() => {
    if (!storagePath && !b2Path) return;
    fetchSignedUrl(0);
  }, [storagePath, b2Path, fetchSignedUrl]);

  // Pre-renew the signed URL at 80% of its real TTL so playback never hits
  // a 403. Backend returns 15min for non-owners (shorter blast-radius on URL
  // sharing) and 1h for owners; we honor whatever it returns.
  useEffect(() => {
    if (!urlGeneratedAt || !urlTtlSec) return;
    const renewMs = Math.max(60_000, Math.floor(urlTtlSec * 1000 * 0.8));
    const timeout = setTimeout(() => {
      console.log('[RecordingVideoPlayer] Pre-renewing signed URL before expiry');
      fetchSignedUrl(0);
    }, renewMs);
    return () => clearTimeout(timeout);
  }, [urlGeneratedAt, urlTtlSec, fetchSignedUrl]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (onDurationUpdate && Number.isFinite(vid.duration) && vid.duration > 0) {
      onDurationUpdate(Math.floor(vid.duration));
    }
  };

  if (!storagePath && !b2Path) {
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

  return (
    <div
      className="relative max-h-[80vh] mx-auto bg-black rounded-xl overflow-hidden aspect-video"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      <video
        key={signedUrl || 'pending'}
        ref={videoRef}
        className="w-full h-full object-contain"
        src={signedUrl || undefined}
        controls
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          if (onTimeUpdate) onTimeUpdate(Math.floor((e.currentTarget as HTMLVideoElement).currentTime));
        }}
        onError={(e) => {
          // Detect signed URL expiration based on the real TTL we got back.
          if (urlGeneratedAt && Date.now() - urlGeneratedAt > urlTtlSec * 1000 * 0.95) {
            setExpired(true);
            return;
          }
          // On generic video error, auto-regenerate the signed URL once before
          // showing the error UI. Handles transient network blips + URL races
          // (the "F5 fixed it" scenario the user reported).
          const vid = e.currentTarget as HTMLVideoElement;
          const errCode = vid.error?.code;
          console.warn('[RecordingVideoPlayer] video onError code:', errCode);
          if (retryAttempt < MAX_AUTO_RETRIES) {
            console.log('[RecordingVideoPlayer] Auto-retry: regenerating signed URL');
            setRetryAttempt(prev => prev + 1);
            setTimeout(() => fetchSignedUrl(0), 600);
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