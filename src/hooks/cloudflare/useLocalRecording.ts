import { useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocalRecordingState {
  isRecording: boolean;
  hasRecording: boolean;
  isUploading: boolean;
  uploadProgress: number;
  recordingDuration: number;
}

/**
 * Hook para grabación local en el navegador como respaldo.
 * Usa MediaRecorder para capturar el stream mientras se transmite.
 * Si Cloudflare no genera la grabación, sube el archivo a Supabase Storage.
 */
export function useLocalRecording() {
  const [state, setState] = useState<LocalRecordingState>({
    isRecording: false,
    hasRecording: false,
    isUploading: false,
    uploadProgress: 0,
    recordingDuration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopPromiseResolveRef = useRef<(() => void) | null>(null);

  /**
   * Inicia la grabación local del stream
   */
  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) {
      console.warn('[LocalRecording] No stream provided');
      return false;
    }

    try {
      // Verificar soporte de MediaRecorder
      if (!window.MediaRecorder) {
        console.error('[LocalRecording] MediaRecorder not supported');
        return false;
      }

      // Determinar el mejor formato soportado
      // MP4 first for maximum mobile compatibility (iOS only supports MP4)
      const mimeTypes = [
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        console.error('[LocalRecording] No supported MIME type found');
        return false;
      }

      console.log('[LocalRecording] Starting with MIME type:', selectedMimeType);

      // Limpiar chunks anteriores
      recordedChunksRef.current = [];

      // Crear MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('[LocalRecording] Chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[LocalRecording] Recording stopped, total chunks:', recordedChunksRef.current.length);
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

      mediaRecorder.onerror = (event) => {
        console.error('[LocalRecording] Error:', event);
        setState(prev => ({ ...prev, isRecording: false }));
      };

      // Iniciar grabación - capturar datos cada 5 segundos
      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();

      // Actualizar duración cada segundo
      durationIntervalRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, recordingDuration: duration }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        hasRecording: false,
        recordingDuration: 0,
      }));

      console.log('[LocalRecording] ✅ Recording started');
      return true;
    } catch (error) {
      console.error('[LocalRecording] Failed to start:', error);
      return false;
    }
  }, []);

  /**
   * Detiene la grabación local
   */
  const stopRecording = useCallback(() => {
    return new Promise<void>((resolve) => {
      // Always clear interval immediately
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        console.log('[LocalRecording] Stopping recording...');
        stopPromiseResolveRef.current = resolve;
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
    recordingId?: string; // si existe, actualiza este registro en lugar de crear uno nuevo
  }): Promise<{ success: boolean; recordingId?: string }> => {
    const blob = getRecordingBlob();
    
    if (!blob) {
      console.error('[LocalRecording] No recording blob available');
      return { success: false };
    }

    console.log('[LocalRecording] Starting upload, blob size:', blob.size);

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }));

    try {
      // Generar nombre de archivo único
      const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `${params.liveId}-${Date.now()}.${fileExtension}`;
      const filePath = `${params.doctorId}/${fileName}`;

      console.log('[LocalRecording] Uploading to path:', filePath);

      // Subir a Supabase Storage (bucket 'recordings')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('[LocalRecording] Upload error:', uploadError);
        throw uploadError;
      }

      setState(prev => ({ ...prev, uploadProgress: 50 }));

      // Guardamos únicamente la ruta (no URL firmada) para poder generar URLs firmadas al reproducir
      const videoRef = `storage:${filePath}`;
      console.log('[LocalRecording] Video stored at path:', filePath);

      setState(prev => ({ ...prev, uploadProgress: 75 }));

      // Calcular duración
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Crear o actualizar registro en la tabla recordings
      const payload = {
        live_id: params.liveId,
        doctor_id: params.doctorId,
        title: params.title,
        description: params.description || null,
        specialty: params.specialty,
        tags: params.tags || [],
        price: params.price,
        duration,
        video_url: videoRef,
        thumbnail_url: null as string | null,
      };

      const query = params.recordingId
        ? supabase
            .from('recordings')
            .update(payload)
            .eq('id', params.recordingId)
            .eq('doctor_id', params.doctorId)
            .select()
            .single()
        : supabase
            .from('recordings')
            .insert(payload)
            .select()
            .single();

      const { data: recording, error: dbError } = await query;

      if (dbError) {
        console.error('[LocalRecording] DB insert error:', dbError);
        throw dbError;
      }

      setState(prev => ({ ...prev, uploadProgress: 100, isUploading: false }));

      console.log('[LocalRecording] ✅ Upload complete, recording ID:', recording.id);
      toast.success('Grabación guardada exitosamente');

      return { success: true, recordingId: recording.id };
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
