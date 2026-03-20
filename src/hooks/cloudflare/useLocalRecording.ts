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
 * Utiliza un canvas intermedio para garantizar que los frames se graben
 * con la orientación correcta (fix para grabaciones verticales desde móvil).
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

  // Canvas pipeline refs
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupCanvasPipeline = useCallback(() => {
    if (drawIntervalRef.current) {
      clearInterval(drawIntervalRef.current);
      drawIntervalRef.current = null;
    }
    if (sourceVideoRef.current) {
      sourceVideoRef.current.pause();
      sourceVideoRef.current.srcObject = null;
      sourceVideoRef.current.remove();
      sourceVideoRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  /**
   * Inicia la grabación local del stream.
   * Usa un canvas intermedio para capturar frames con orientación correcta.
   */
  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) {
      console.warn('[LocalRecording] No stream provided');
      return false;
    }

    try {
      if (!window.MediaRecorder) {
        console.error('[LocalRecording] MediaRecorder not supported');
        return false;
      }

      // Determinar el mejor formato soportado
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

      // Limpiar chunks anteriores y canvas previo
      recordedChunksRef.current = [];
      cleanupCanvasPipeline();

      // Crear video oculto para renderizar el stream con orientación correcta del navegador
      const sourceVideo = document.createElement('video');
      sourceVideo.srcObject = stream;
      sourceVideo.muted = true;
      sourceVideo.playsInline = true;
      sourceVideo.setAttribute('playsinline', 'true');
      sourceVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(sourceVideo);
      sourceVideoRef.current = sourceVideo;

      // Cuando el video tenga metadatos, crear canvas y empezar a grabar
      sourceVideo.onloadedmetadata = () => {
        const w = sourceVideo.videoWidth || 640;
        const h = sourceVideo.videoHeight || 480;

        console.log('[LocalRecording] Source video dimensions:', w, 'x', h);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        canvasRef.current = canvas;

        // Loop de dibujo: captura frames del video (ya orientados por el navegador)
        // Usa setInterval para que siga funcionando en background
        const drawLoop = setInterval(() => {
          if (sourceVideo.readyState >= 2) {
            ctx.drawImage(sourceVideo, 0, 0, w, h);
          }
        }, 1000 / 30);
        drawIntervalRef.current = drawLoop;

        // Crear stream del canvas + audio original
        const recordStream = canvas.captureStream(30);
        stream.getAudioTracks().forEach(t => {
          recordStream.addTrack(t);
        });

        // Crear MediaRecorder con el stream del canvas (frames correctamente orientados)
        const mediaRecorder = new MediaRecorder(recordStream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            console.log('[LocalRecording] Chunk received:', event.data.size, 'bytes');
          }
        };

        mediaRecorder.onstop = () => {
          console.log('[LocalRecording] Recording stopped, total chunks:', recordedChunksRef.current.length);
          cleanupCanvasPipeline();
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
          cleanupCanvasPipeline();
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

        console.log('[LocalRecording] ✅ Recording started via canvas pipeline');
      };

      sourceVideo.play().catch(err => {
        console.error('[LocalRecording] Failed to play source video:', err);
        cleanupCanvasPipeline();
      });

      setState(prev => ({
        ...prev,
        isRecording: true,
        hasRecording: false,
        recordingDuration: 0,
      }));

      return true;
    } catch (error) {
      console.error('[LocalRecording] Failed to start:', error);
      cleanupCanvasPipeline();
      return false;
    }
  }, [cleanupCanvasPipeline]);

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
        recorder.stop();
        return;
      }

      cleanupCanvasPipeline();
      resolve();
    });
  }, [cleanupCanvasPipeline]);

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
      const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `${params.liveId}-${Date.now()}.${fileExtension}`;
      const filePath = `${params.doctorId}/${fileName}`;

      console.log('[LocalRecording] Uploading to path:', filePath);

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

      const videoRef = `storage:${filePath}`;
      console.log('[LocalRecording] Video stored at path:', filePath);

      setState(prev => ({ ...prev, uploadProgress: 75 }));

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

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
        thumbnail_url: params.thumbnailUrl || null as string | null,
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
    cleanupCanvasPipeline();
    recordedChunksRef.current = [];
    setState({
      isRecording: false,
      hasRecording: false,
      isUploading: false,
      uploadProgress: 0,
      recordingDuration: 0,
    });
  }, [stopRecording, cleanupCanvasPipeline]);

  return {
    ...state,
    startRecording,
    stopRecording,
    getRecordingBlob,
    uploadRecording,
    cleanup,
  };
}
