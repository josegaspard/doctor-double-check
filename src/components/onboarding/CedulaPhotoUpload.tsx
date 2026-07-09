import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

// Foto de la cédula profesional en el onboarding del doctor (cliente 2026-07-08):
// el doctor sube una foto de su cédula para que el admin pueda checar su identidad.
// Va al bucket PRIVADO 'doctor-credentials' (carpeta del propio uid; el admin tiene
// SELECT por política). Guardamos el PATH dentro del bucket — InlineFileViewer y
// este preview firman URLs bajo demanda.

interface CedulaPhotoUploadProps {
  userId: string;
  currentPath: string | null;
  onChange: (path: string | null) => void;
  hasError?: boolean;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function CedulaPhotoUpload({ userId, currentPath, onChange, hasError }: CedulaPhotoUploadProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const lastSignedPath = useRef<string | null>(null);

  // El preview se firma desde el path (también cubre restaurar progreso guardado).
  useEffect(() => {
    if (!currentPath) {
      setPreviewUrl(null);
      lastSignedPath.current = null;
      return;
    }
    if (lastSignedPath.current === currentPath) return;
    let cancelled = false;
    supabase.storage
      .from('doctor-credentials')
      .createSignedUrl(currentPath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
          lastSignedPath.current = currentPath;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('onboarding.cedulaPhotoInvalidType'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t('onboarding.cedulaPhotoTooLarge'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const { compressImageIfNeeded, withTimeout } = await import('@/lib/imageUpload');
      const upload = await compressImageIfNeeded(file);
      const ext = (upload.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/cedula-foto-${Date.now()}.${ext}`;

      const { error } = await withTimeout(
        supabase.storage.from('doctor-credentials').upload(path, upload, {
          upsert: true,
          contentType: upload.type || 'image/jpeg',
        }),
        60_000,
        'subida de foto de cédula',
      );
      if (error) throw error;

      onChange(path);
      toast.success(t('onboarding.cedulaPhotoUploaded'));
    } catch (err: any) {
      console.error('[CedulaPhotoUpload] upload error', err);
      toast.error(err?.message || t('onboarding.cedulaPhotoUploadError'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    const path = currentPath;
    onChange(null);
    // Limpieza best-effort del archivo anterior; no bloquea el flujo si falla.
    if (path) {
      supabase.storage.from('doctor-credentials').remove([path]).catch(() => {});
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      {previewUrl ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          <div className="relative">
            <img
              src={previewUrl}
              alt={t('onboarding.cedulaPhoto')}
              className="w-full max-h-56 object-contain rounded-md bg-background"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <button
              type="button"
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
              onClick={handleRemove}
              aria-label={t('onboarding.cedulaPhotoRemove')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-success flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {t('onboarding.cedulaPhotoUploaded')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5" />
              {t('onboarding.cedulaPhotoChange')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full rounded-lg border-2 border-dashed p-5 flex flex-col items-center gap-2 text-center transition-colors hover:bg-muted/40 ${
            hasError ? 'border-destructive/60' : 'border-border'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          ) : (
            <Camera className="w-6 h-6 text-primary" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isUploading ? t('onboarding.saving') : t('onboarding.cedulaPhotoUpload')}
          </span>
          <span className="text-[11px] text-muted-foreground leading-relaxed max-w-xs">
            {t('onboarding.cedulaPhotoHelp')}
          </span>
        </button>
      )}
    </div>
  );
}
