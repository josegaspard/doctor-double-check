import { useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocalRecordingState {
  isRecording: boolean;
  hasRecording: boolean;
  isUploading: boolean;
  uploadProgress: number;
  recordingDuration: number;
  chunkCount: number;
  bytesRecorded: number;
  lastError: string | null;
}

/**
 * Hook para grabación local en el navegador como respaldo.
 * Graba el stream local DIRECTO con MediaRecorder.
 * Sin canvas intermedio: el pipeline canvas rompía la grabación cuando
 * Daily.co tomaba la cámara o cuando sourceVideo.play() fallaba silenciosamente
 * (cliente perdiendo grabaciones — incidente 2026-05-22). El issue de orientación
 * vertical en móvil se resuelve en post por Bunny (auto-rotate del transcode).
 */
export function useLocalRecording() {
  const [state, setState] = useState<LocalRecordingState>({
    isRecording: false,
    hasRecording: false,
    isUploading: false,
    uploadProgress: 0,
    recordingDuration: 0,
    chunkCount: 0,
    bytesRecorded: 0,
    lastError: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopPromiseResolveRef = useRef<(() => void) | null>(null);

  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) {
      console.warn('[LocalRecording] No stream provided');
      return false;
    }

    try {
      if (!window.MediaRecorder) {
        console.error('[LocalRecording] MediaRecorder not supported');
        setState(prev => ({ ...prev, lastError: 'MediaRecorder not supported in this browser' }));
        return false;
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      console.log('[LocalRecording] Stream tracks:', { video: videoTracks.length, audio: audioTracks.length });
      if (videoTracks.length === 0) {
        console.error('[LocalRecording] Stream has no video tracks');
        setState(prev => ({ ...prev, lastError: 'No video track in stream' }));
        return false;
      }

      // Cascada de MIME types. WebM/VP8 primero porque es el más compatible
      // con MediaRecorder (Chrome/Firefox/Edge). Safari iOS 14.5+ ya soporta
      // video/mp4 con H.264 nativo, pero Chrome MediaRecorder NO siempre acepta
      // mp4 aunque isTypeSupported('video/mp4') diga true. WebM funciona en
      // todos los browsers que tienen MediaRecorder.
      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeCandidates) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        console.error('[LocalRecording] No supported MIME type found');
        setState(prev => ({ ...prev, lastError: 'No supported MIME type for MediaRecorder' }));
        return false;
      }

      console.log('[LocalRecording] Starting MediaRecorder with MIME:', selectedMimeType);

      recordedChunksRef.current = [];

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2_500_000,
          audioBitsPerSecond: 128_000,
        });
      } catch (ctorErr: any) {
        // Algunos browsers rechazan bitrate hints. Reintenta sin ellos.
        console.warn('[LocalRecording] MediaRecorder ctor failed with bitrates, retrying minimal:', ctorErr?.message);
        mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('[LocalRecording] Chunk:', event.data.size, 'bytes (total chunks:', recordedChunksRef.current.length + ')');
          setState(prev => ({
            ...prev,
            chunkCount: prev.chunkCount + 1,
            bytesRecorded: prev.bytesRecorded + event.data.size,
            hasRecording: true,
          }));
        } else {
          console.warn('[LocalRecording] Empty chunk received (size 0) — stream may have no frames');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[LocalRecording] Stopped. Total chunks:', recordedChunksRef.current.length,
          'bytes:', recordedChunksRef.current.reduce((a, b) => a + b.size, 0));
        setState(prev => ({
          ...prev,
          isRecording: false,
          hasRecording: recordedChunksRef.current.length > 0,
        }));

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        if (stopPromiseResolveRef.current) {
          stopPromiseResolveRef.current();
          stopPromiseResolveRef.current = null;
        }
      };

      mediaRecorder.onerror = (event: any) => {
        const msg = event?.error?.message || event?.error?.name || 'MediaRecorder error';
        console.error('[LocalRecording] MediaRecorder error:', event);
        setState(prev => ({ ...prev, lastError: msg }));
      };

      // timeslice: chunk cada 2s. Más chunks = menos pérdida si el browser
      // mata el tab inesperadamente, y el resumer puede empezar a subir antes.
      mediaRecorder.start(2000);
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();

      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, recordingDuration: duration }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        hasRecording: false,
        recordingDuration: 0,
        chunkCount: 0,
        bytesRecorded: 0,
        lastError: null,
      }));

      console.log('[LocalRecording] ✅ Recording started (direct stream)');
      return true;
    } catch (error: any) {
      console.error('[LocalRecording] Failed to start:', error);
      setState(prev => ({ ...prev, lastError: error?.message || 'Failed to start MediaRecorder', isRecording: false }));
      return false;
    }
  }, []);

  /**
   * Detiene la grabación local
   */
  const stopRecording = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        console.log('[LocalRecording] Stopping recording...');
        stopPromiseResolveRef.current = resolve;
        // requestData fuerza flush del buffer actual ANTES de stop, así no
        // perdemos el último chunk parcial (ej. live de 1.5s con timeslice 2s
        // antes no entregaba nada).
        try { recorder.requestData(); } catch { /* ignore */ }
        recorder.stop();
        return;
      }

      resolve();
    });
  }, []);

  /**
   * Obtiene el blob de la grabación
   */
  const getRecordingBlob = useCallback((): Blob | null => {
    if (recordedChunksRef.current.length === 0) {
      return null;
    }

    const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
    return new Blob(recordedChunksRef.current, { type: mimeType });
  }, []);

  /**
   * Sube la grabación local a Supabase Storage y crea el registro
   */
  const uploadRecording = useCallback(async (params: {
    liveId: string;
    doctorId: string;
    title: string;
    description?: string;
    specialty: string;
    tags?: string[];
    price: number;
    recordingId?: string;
    thumbnailUrl?: string;
  }): Promise<{ success: boolean; recordingId?: string }> => {
    const blob = getRecordingBlob();
    
    if (!blob) {
      console.error('[LocalRecording] No recording blob available');
      return { success: false };
    }

    console.log('[LocalRecording] Starting upload, blob size:', blob.size);

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }));

    try {
      const contentType = blob.type || 'video/mp4';

      console.log('[LocalRecording] Requesting Bunny video shell for live:', params.liveId);

      // Step 1: create video shell + signed upload (scoped a este videoId)
      const { data: bunnyInit, error: bunnyInitErr } = await supabase.functions.invoke('bunny-create-video', {
        body: { title: params.title || `Live ${params.liveId}`, recordingId: params.recordingId },
      });
      if (bunnyInitErr || !bunnyInit?.videoId) {
        console.error('[LocalRecording] bunny-create-video error:', bunnyInitErr, bunnyInit);
        throw new Error(`No se pudo crear el video en Bunny: ${(bunnyInitErr as any)?.message || bunnyInit?.error || 'unknown'}`);
      }

      const { videoId, libraryId, authSignature, authExpire } = bunnyInit;
      console.log('[LocalRecording] Bunny video shell created:', videoId);

      setState(prev => ({ ...prev, uploadProgress: 5 }));

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Step 2a: Persistir el blob + metadata en IndexedDB ANTES del upload.
      // Si el usuario cierra el tab a la mitad, al volver a entrar el resumer
      // (useBackgroundUploadResumer) lo detecta y reanuda automáticamente
      // donde quedó (TUS resumable + blob recuperado de IndexedDB).
      const { saveUpload, removeUpload } = await import('@/lib/uploadQueue');
      const uploadId = `upload-${videoId}`;
      try {
        await saveUpload({
          id: uploadId,
          blob,
          meta: {
            liveId: params.liveId,
            doctorId: params.doctorId,
            title: params.title,
            description: params.description,
            specialty: params.specialty,
            tags: params.tags,
            price: params.price,
            thumbnailUrl: params.thumbnailUrl,
            recordingId: params.recordingId,
            bunnyVideoId: videoId,
            libraryId: String(libraryId),
            authSignature,
            authExpire,
          },
          createdAt: Date.now(),
        });
        console.log('[LocalRecording] Blob persistido en IndexedDB:', uploadId);
      } catch (e) {
        console.warn('[LocalRecording] No se pudo persistir blob en IndexedDB (continúa upload sin resume):', e);
      }

      // Step 2b: PARALELIZAR — registramos la grabación en la DB AHORA con
      // bunny_status='uploading'. El doctor ve su grabación instantáneamente
      // en /recordings (con indicador "subiendo X%"), no tiene que esperar a
      // que termine el TUS upload para sentir que se guardó.
      const savePromise = supabase.functions.invoke('save-recording', {
        body: {
          liveId: params.liveId,
          storagePath: videoId,
          backend: 'bunny',
          duration,
          price: params.price,
          title: params.title,
          description: params.description || null,
          specialty: params.specialty,
          tags: params.tags || [],
          thumbnailUrl: params.thumbnailUrl || null,
          bunnyStatus: 'uploading',
        },
      });

      // Toast: el doctor puede cerrar el tab y navegar libremente
      toast.success('Grabación guardada — subiendo en segundo plano. Puedes cerrar la ventana, se reanudará automáticamente.', { duration: 8000 });

      // Step 3: TUS resumable upload (Bunny). El frontend NUNCA ve el API key;
      // solo recibe una signature scoped al videoId que expira en 2h.
      // tus-js-client persiste fingerprint en localStorage → si recargas la
      // página el upload reanuda desde el byte exacto donde quedó.
      const { Upload } = await import('tus-js-client');
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(blob, {
          endpoint: 'https://video.bunnycdn.com/tusupload',
          retryDelays: [0, 2000, 5000, 10000, 20000, 60000],
          chunkSize: 5 * 1024 * 1024,
          // Identificador estable del upload → tus.io guarda en localStorage
          // un mapping (fingerprint → upload URL) que permite reanudar
          // exactamente desde el último byte enviado.
          fingerprint: () => Promise.resolve(uploadId),
          headers: {
            AuthorizationSignature: authSignature,
            AuthorizationExpire: String(authExpire),
            VideoId: videoId,
            LibraryId: String(libraryId),
          },
          metadata: {
            filetype: contentType,
            title: (params.title || `Live ${params.liveId}`).slice(0, 200),
          },
          onError: (error) => {
            console.error('[LocalRecording] TUS upload error:', error);
            reject(error);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = 5 + Math.floor((bytesUploaded / bytesTotal) * 90);
            setState(prev => ({ ...prev, uploadProgress: pct }));
          },
          onSuccess: async () => {
            console.log('[LocalRecording] TUS upload complete:', videoId);
            // Limpiar de IndexedDB — ya no hace falta resumir
            try { await removeUpload(uploadId); } catch { /* ignore */ }
            resolve();
          },
        });
        upload.start();
      });

      setState(prev => ({ ...prev, uploadProgress: 95 }));
      console.log('[LocalRecording] Video uploaded to Bunny:', videoId);

      // Esperar que save-recording termine (debería haber terminado hace rato
      // en paralelo, pero por si acaso)
      const { data: saveData, error: saveError } = await savePromise;

      if (saveError || !saveData?.ok) {
        const detail = (saveError as any)?.message || saveData?.error || 'unknown';
        console.error('[LocalRecording] save-recording failed:', detail, saveData);
        throw new Error(`No se pudo registrar la grabación: ${detail}`);
      }

      // TUS terminó → Bunny tiene el /original disponible YA. Movemos el status
      // de 'uploading' a 'processing' para desbloquear playback del recording.
      // El player usa /original mientras Bunny encodea (HLS llega ~1-3min).
      // El webhook bunny-webhook flip a 'ready' cuando termine.
      if (saveData.recordingId) {
        await supabase
          .from('recordings')
          .update({ bunny_status: 'processing' })
          .eq('id', saveData.recordingId)
          .then(({ error }) => {
            if (error) console.warn('[LocalRecording] No se pudo marcar processing:', error.message);
          });
      }

      // TUS terminó. Bunny ahora encodea async. El webhook bunny-webhook se
      // disparará automáticamente cuando cambie el status (uploaded → processing
      // → finished) y actualizará bunny_status en la DB. No hacemos llamadas
      // adicionales — el realtime postgres_changes del frontend recogerá el
      // cambio y el card desaparece.

      setState(prev => ({ ...prev, uploadProgress: 100, isUploading: false }));

      console.log('[LocalRecording] ✅ Upload complete, recording ID:', saveData.recordingId);

      return { success: true, recordingId: saveData.recordingId };
    } catch (error: any) {
      console.error('[LocalRecording] Upload failed:', error);
      setState(prev => ({ ...prev, isUploading: false }));
      toast.error('Error al subir la grabación: ' + (error.message || 'Error desconocido'));
      return { success: false };
    }
  }, [getRecordingBlob]);

  /**
   * Limpia los recursos
   */
  const cleanup = useCallback(() => {
    stopRecording();
    recordedChunksRef.current = [];
    setState({
      isRecording: false,
      hasRecording: false,
      isUploading: false,
      uploadProgress: 0,
      recordingDuration: 0,
      chunkCount: 0,
      bytesRecorded: 0,
      lastError: null,
    });
  }, [stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    getRecordingBlob,
    uploadRecording,
    cleanup,
  };
}
