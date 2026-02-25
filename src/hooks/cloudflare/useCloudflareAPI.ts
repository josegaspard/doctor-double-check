import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CloudflareStream } from './useCloudflareStream';

export function useCloudflareAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<CloudflareStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createStream = useCallback(async (
    liveId: string, 
    title: string, 
    enableRecording = true
  ): Promise<CloudflareStream | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Cloudflare] Creating stream...', { liveId, title, enableRecording });
      
      const { data, error } = await supabase.functions.invoke('create-cloudflare-stream', {
        body: { liveId, title, enableRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      console.log('[Cloudflare] Stream created:', data.stream);
      setStream(data.stream);
      return data.stream;
    } catch (err: any) {
      console.error('[Cloudflare] Error creating stream:', err);
      setError(err.message || 'Error al crear transmisión');
      toast.error('Error al crear sala de transmisión');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endStream = useCallback(async (
    liveId: string, 
    streamUid?: string, 
    saveRecording = true,
    onStopBroadcast?: () => Promise<void>
  ): Promise<{ success: boolean; recordingId?: string }> => {
    setIsLoading(true);
    
    try {
      console.log('[Cloudflare] Ending stream...', { liveId, streamUid, saveRecording });
      
      // First stop the broadcast (now async - waits for WHIP DELETE)
      if (onStopBroadcast) {
        await onStopBroadcast();
      }

      // Give Cloudflare a moment to process (recording finalization can take a few seconds)
      console.log('[Cloudflare] Waiting for Cloudflare to process recording...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Then notify the backend
      const { data, error } = await supabase.functions.invoke('end-cloudflare-stream', {
        body: { liveId, streamUid, saveRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      console.log('[Cloudflare] Stream ended successfully:', data);
      setStream(null);
      return { success: true, recordingId: data.recordingId };
    } catch (err: any) {
      console.error('[Cloudflare] Error ending stream:', err);
      toast.error('Error al finalizar transmisión');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPlaybackUrl = useCallback(async (
    videoUid: string,
    type: 'live' | 'recording' = 'recording'
  ): Promise<string | null> => {
    const directLiveUrl = `https://customer-3afz9zesalmyroc9.cloudflarestream.com/${videoUid}/manifest/video.m3u8`;

    try {
      const { data, error } = await supabase.functions.invoke('get-cloudflare-playback', {
        body: {
          videoUid: type === 'recording' ? videoUid : undefined,
          liveInputUid: type === 'live' ? videoUid : undefined,
          type,
        },
      });

      if (error) throw error;

      if (!data.success) {
        if (type === 'live') {
          if (data.status === 'disconnected' || data.status === 'offline') {
            return null;
          }
          return directLiveUrl;
        }
        if (data.status === 'processing') {
          return null;
        }
        throw new Error(data.error);
      }

      return data.playbackUrl || (type === 'live' ? directLiveUrl : null);
    } catch (err: any) {
      console.error('[Cloudflare] Error getting playback URL:', err);
      return null;
    }
  }, []);

  return {
    isLoading,
    stream,
    error,
    createStream,
    endStream,
    getPlaybackUrl,
    setStream,
  };
}
