import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, AlertCircle } from 'lucide-react';

// Extrae el path dentro del bucket dado un URL público o un path crudo.
// Soporta:
//   https://<ref>.supabase.co/storage/v1/object/public/doctor-content/<userId>/<name>
//   doctor-content/<userId>/<name>
//   <userId>/<name>
function extractPath(bucket: string, fileUrlOrPath: string): string {
  const marker = `/${bucket}/`;
  const idx = fileUrlOrPath.indexOf(marker);
  if (idx >= 0) return fileUrlOrPath.slice(idx + marker.length);
  if (fileUrlOrPath.startsWith(`${bucket}/`)) return fileUrlOrPath.slice(bucket.length + 1);
  return fileUrlOrPath;
}

function detectKind(pathOrName: string): 'image' | 'pdf' | 'office' | 'video' | 'audio' | 'unknown' {
  const lower = pathOrName.toLowerCase().split('?')[0];
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/.test(lower)) return 'image';
  if (/\.pdf$/.test(lower)) return 'pdf';
  if (/\.(docx?|xlsx?|pptx?)$/.test(lower)) return 'office';
  if (/\.(mp4|webm|mov|m4v)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a|ogg)$/.test(lower)) return 'audio';
  return 'unknown';
}

interface Props {
  fileUrl: string;          // URL pública o path dentro del bucket
  bucket?: string;          // default doctor-content
  ttlSeconds?: number;      // default 3600
  className?: string;
}

export function InlineFileViewer({ fileUrl, bucket = 'doctor-content', ttlSeconds = 3600, className }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = useMemo(() => extractPath(bucket, fileUrl), [fileUrl, bucket]);
  const kind = useMemo(() => detectKind(path), [path]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSignedUrl(null);
    (async () => {
      const { data, error: e } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
      if (cancelled) return;
      if (e || !data?.signedUrl) {
        setError(e?.message || 'No se pudo cargar el archivo');
        return;
      }
      setSignedUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [path, bucket, ttlSeconds]);

  // Disable right-click + drag inside the viewer to make casual download attempts harder.
  // (No web-app can 100% prevent screenshots / Network tab capture.)
  const noDownloadProps = {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-destructive ${className || ''}`}>
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    );
  }
  if (!signedUrl) {
    return (
      <div className={`flex items-center justify-center py-10 text-muted-foreground ${className || ''}`}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const wrapClass = `relative w-full max-w-full overflow-hidden rounded-lg border border-border bg-card ${className || ''}`;

  if (kind === 'image') {
    return (
      <div className={wrapClass} {...noDownloadProps}>
        <img
          src={signedUrl}
          alt="Archivo adjunto"
          draggable={false}
          className="block w-full h-auto max-h-[75vh] object-contain select-none pointer-events-auto"
          style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' as any }}
          {...noDownloadProps}
        />
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <div className={wrapClass} {...noDownloadProps} style={{ aspectRatio: '4 / 5' }}>
        {/* #toolbar=0&navpanes=0 esconde la UI de Chrome/Brave que incluye botón descargar */}
        <iframe
          src={`${signedUrl}#toolbar=0&navpanes=0&statusbar=0`}
          title="Archivo PDF"
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
        />
        {/* Capa transparente para suprimir click-derecho sobre el iframe */}
        <div className="absolute inset-0 pointer-events-none" />
      </div>
    );
  }

  if (kind === 'office') {
    // Office Web Viewer requiere URL públicamente alcanzable: signed URL la cumple por su TTL.
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
    return (
      <div className={wrapClass} {...noDownloadProps} style={{ aspectRatio: '4 / 3' }}>
        <iframe
          src={officeUrl}
          title="Documento"
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allowFullScreen
        />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className={wrapClass} {...noDownloadProps}>
        <video
          src={signedUrl}
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          className="w-full h-auto max-h-[75vh] block"
          {...noDownloadProps}
        />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className={`p-4 ${wrapClass}`} {...noDownloadProps}>
        <audio src={signedUrl} controls controlsList="nodownload" className="w-full" />
      </div>
    );
  }

  // Fallback: tipo desconocido — mostrar mensaje en vez de link de descarga
  return (
    <div className={`flex items-center gap-2 p-4 text-sm text-muted-foreground ${wrapClass}`}>
      <FileText className="w-4 h-4" />
      Vista previa no disponible para este tipo de archivo.
    </div>
  );
}
