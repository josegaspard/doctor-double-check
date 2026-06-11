import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DailyRoom {
  name: string;
  url: string;
  ownerToken?: string;
}

export function useDaily() {
  const [isLoading, setIsLoading] = useState(false);
  const [room, setRoom] = useState<DailyRoom | null>(null);
  const [viewerToken, setViewerToken] = useState<string | null>(null);

  const createRoom = useCallback(async (liveId: string, title: string, mode: 'live' | 'consultation' = 'live'): Promise<DailyRoom | null> => {
    setIsLoading(true);
    // Reintentos: la edge function puede dar un blip transitorio (cold start de
    // Deno, red intermitente, 5xx puntual). Un solo fallo NO debe abortar el
    // go-live, así que reintentamos hasta 3 veces con backoff antes de rendirnos.
    const maxAttempts = 3;
    let lastError: any = null;
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('create-daily-room', {
            body: { liveId, title, mode },
          });

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || 'create-daily-room sin success');
          if (!data.room?.url) throw new Error('create-daily-room sin URL de sala');

          setRoom(data.room);
          return data.room;
        } catch (err: any) {
          lastError = err;
          console.warn(`[useDaily] createRoom intento ${attempt}/${maxAttempts} falló:`, err?.message || err);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, attempt * 800));
          }
        }
      }
      console.error('Error creating Daily room (agotados los reintentos):', lastError);
      toast.error('Error al crear sala de transmisión');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getViewerToken = useCallback(async (roomName: string, isOwner?: boolean): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-token', {
        body: { roomName, isOwner: isOwner || false },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setViewerToken(data.token);
      return data.token;
    } catch (error: any) {
      console.warn('Error getting viewer token (will retry):', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endRoom = useCallback(async (roomName: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('end-daily-room', {
        body: { roomName },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setRoom(null);
      return true;
    } catch (error: any) {
      console.warn('end-daily-room non-fatal:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    room,
    viewerToken,
    createRoom,
    getViewerToken,
    endRoom,
  };
}
