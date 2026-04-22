import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';

import { CloudflareRecordingPlayer } from '@/components/recordings/CloudflareRecordingPlayer';
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

function getStoragePath(url: string) {
  return url.replace(/^storage:/, '');
}

/**
 * Player que soporta:
 * - Cloudflare (UID / pending:UID) via CloudflareRecordingPlayer
 * - Almacenamiento (storage:path) via signed URL + HTML5 video
 */
export function RecordingVideoPlayer({ videoUrl, recordingId, onDurationUpdate, onTimeUpdate, autoPlay }: RecordingVideoPlayerProps) {
  const storagePath = useMemo(() => (isStorageRef(videoUrl) ? getStoragePath(videoUrl) : null), [videoUrl]);
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
  const [expired, setExpired] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!storagePath) return;

    setIsLoading(true);
    setError(null);
    setExpired(false);
    try {
      const { data, error: signError } = await supabase.storage
        .from('recordings')
        .createSignedUrl(storagePath, 60 * 60); // 1h

      if (signError) {
        // Fallback: if bucket is public, public URL will work.
        const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(storagePath);
        if (publicUrlData?.publicUrl) {
          setSignedUrl(publicUrlData.publicUrl);
          setUrlGeneratedAt(Date.now());
          return;
        }
        throw signError;
      }

      setSignedUrl(data.signedUrl);
      setUrlGeneratedAt(Date.now());
    } catch (e: any) {
      console.error('[RecordingVideoPlayer] Signed URL error:', e);
      setError('No se pudo cargar el video desde almacenamiento');
    } finally {
      setIsLoading(false);
    }
  }, [storagePath]);

  useEffect(() => {
    if (!storagePath) return;
    fetchSignedUrl();
  }, [storagePath, fetchSignedUrl]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (onDurationUpdate && Number.isFinite(vid.duration) && vid.duration > 0) {
      onDurationUpdate(Math.floor(vid.duration));
    }
  };

  if (!storagePath) {
    return (
      <div className="relative">
        <CloudflareRecordingPlayer videoUrl={videoUrl} recordingId={recordingId} onDurationUpdate={onDurationUpdate} onTimeUpdate={onTimeUpdate} autoPlay={autoPlay} />
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
          <Button onClick={fetchSignedUrl} variant="outline">
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
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => {
          if (onTimeUpdate) onTimeUpdate(Math.floor((e.currentTarget as HTMLVideoElement).currentTime));
        }}
        onError={() => {
          // Detect signed URL expiration (TTL ~1h)
          if (urlGeneratedAt && Date.now() - urlGeneratedAt > 55 * 60 * 1000) {
            setExpired(true);
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