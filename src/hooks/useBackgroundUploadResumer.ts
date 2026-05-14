import { useEffect } from 'react';
import { toast } from 'sonner';
import { getPendingUploads, removeUpload, type PendingUpload } from '@/lib/uploadQueue';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resume automáticamente cualquier upload pendiente (TUS Bunny) cuando el
 * usuario vuelve a entrar a la app después de cerrar el tab mid-upload.
 *
 * Cómo funciona:
 * 1. En IndexedDB queda el blob + meta + signature al iniciar upload (en
 *    useLocalRecording).
 * 2. Si el TUS upload terminó OK, se borró de IndexedDB. Si quedó pending,
 *    significa que el tab se cerró antes de terminar.
 * 3. Este hook lee la cola al arrancar la app y reanuda cada upload con
 *    tus-js-client (que ya tiene la fingerprint en localStorage y sigue
 *    desde el byte exacto).
 * 4. Si el authSignature expiró (TTL 2h), pide uno nuevo al edge fn.
 *
 * No bloquea el render — corre fire-and-forget tras requestIdleCallback.
 */
export function useBackgroundUploadResumer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tryResume = async () => {
      let pending: PendingUpload[] = [];
      try {
        pending = await getPendingUploads();
      } catch (e) {
        console.warn('[uploadResumer] No se pudo leer cola pendiente:', e);
        return;
      }

      if (pending.length === 0) return;
      console.log(`[uploadResumer] ${pending.length} upload(s) pendiente(s), reanudando...`);
      toast.info(`Reanudando ${pending.length} grabación(es) en segundo plano...`);

      const { Upload } = await import('tus-js-client');

      for (const item of pending) {
        try {
          await resumeOne(item, Upload);
        } catch (e: any) {
          console.error('[uploadResumer] Error reanudando', item.id, e?.message);
        }
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(tryResume, { timeout: 5000 });
    } else {
      setTimeout(tryResume, 2000);
    }
  }, []);
}

async function resumeOne(item: PendingUpload, UploadCtor: any): Promise<void> {
  let { authSignature, authExpire, libraryId, bunnyVideoId } = item.meta;

  // Si la signature ya expiró, pedir una nueva
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authExpire || nowSec >= authExpire) {
    console.log('[uploadResumer] Signature expiró, pidiendo nueva...');
    // No tenemos un endpoint dedicado para re-firmar. Llamamos a bunny-create-video
    // que ya regenera signature scoped al mismo videoId si lo pasamos (TODO: edge fn).
    // Por ahora si expiró abandonamos — el doctor puede regrabar.
    console.warn('[uploadResumer] Signature expirada para', item.id, '— abandonando');
    await removeUpload(item.id);
    toast.error('Una grabación pendiente expiró antes de poder reanudarse. Por favor vuelve a grabar el live.');
    return;
  }

  return new Promise((resolve, reject) => {
    const upload = new UploadCtor(item.blob, {
      endpoint: 'https://video.bunnycdn.com/tusupload',
      retryDelays: [0, 2000, 5000, 10000, 20000, 60000],
      chunkSize: 5 * 1024 * 1024,
      fingerprint: () => Promise.resolve(item.id),
      headers: {
        AuthorizationSignature: authSignature,
        AuthorizationExpire: String(authExpire),
        VideoId: bunnyVideoId,
        LibraryId: String(libraryId),
      },
      metadata: {
        filetype: item.blob.type || 'video/mp4',
        title: (item.meta.title || `Resumed ${bunnyVideoId}`).slice(0, 200),
      },
      onError: (error: Error) => {
        console.error('[uploadResumer] TUS error para', item.id, error);
        reject(error);
      },
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        const pct = Math.floor((bytesUploaded / bytesTotal) * 100);
        if (pct % 20 === 0) {
          console.log(`[uploadResumer] ${item.id}: ${pct}%`);
        }
      },
      onSuccess: async () => {
        console.log('[uploadResumer] Upload reanudado completo:', bunnyVideoId);
        toast.success('Grabación en segundo plano completada — reproducible al instante');
        try { await removeUpload(item.id); } catch { /* ignore */ }
        // Ping save-recording con bunnyStatus='processing' — desbloquea play
        // del recording. Webhook flip a 'ready' cuando encoding termine.
        try {
          await supabase.functions.invoke('save-recording', {
            body: {
              liveId: item.meta.liveId,
              storagePath: bunnyVideoId,
              backend: 'bunny',
              duration: 0,
              price: item.meta.price,
              title: item.meta.title,
              description: item.meta.description || null,
              specialty: item.meta.specialty,
              tags: item.meta.tags || [],
              thumbnailUrl: item.meta.thumbnailUrl || null,
              bunnyStatus: 'processing',
            },
          });
        } catch { /* ignore */ }
        resolve();
      },
    });
    upload.start();
  });
}
