import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';
import { logFileAccess } from '@/lib/fileAccessLog';

interface SecureImageProps {
  signedUrl: string;
  alt?: string;
  fileId?: string;
  bucket?: string;
  maxHeight?: string;
  className?: string;
}

export function SecureImage({ signedUrl, alt = 'Archivo', fileId, bucket, maxHeight = '60vh', className }: SecureImageProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;

        const bitmap = await createImageBitmap(blob);
        if (cancelled) {
          bitmap.close();
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const maxW = 1600;
        const scale = Math.min(1, maxW / bitmap.width);
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const dpr = window.devicePixelRatio || 1;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(bitmap, 0, 0, w, h);

        const stamp = `${user?.email || 'visitante'} · ${new Date().toLocaleString('es-MX')}`;
        ctx.save();
        ctx.font = `${Math.max(12, w / 80)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'center';
        ctx.strokeText(stamp, 0, 0);
        ctx.fillText(stamp, 0, 0);
        ctx.restore();

        bitmap.close();
        setDims({ w, h });
        logFileAccess({
          fileId: fileId || alt,
          bucket: bucket || 'unknown',
          fileType: 'image',
          action: 'viewed',
        });
      } catch (err) {
        if (cancelled) return;
        console.error('[SecureImage] load failed', err);
        setError('No se pudo cargar la imagen');
        logFileAccess({
          fileId: fileId || alt,
          bucket: bucket || 'unknown',
          fileType: 'image',
          action: 'access_denied',
          error: String((err as any)?.message || err).slice(0, 200),
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedUrl, fileId, bucket, alt, user?.email]);

  return (
    <div
      className={`relative w-full flex items-center justify-center select-none ${className || ''}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any, maxHeight }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      data-testid="secure-image"
    >
      {isLoading && (
        <div className="flex flex-col items-center gap-2 py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Cargando imagen…</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center gap-2 py-10">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div className="relative" style={{ display: isLoading || error ? 'none' : 'block' }}>
        <canvas
          ref={canvasRef}
          className="block max-w-full pointer-events-none rounded-lg"
          style={{ touchAction: 'none', maxHeight }}
          aria-label={alt}
        />
        {dims && <DynamicWatermark email={user?.email} userId={user?.id} />}
      </div>
    </div>
  );
}
