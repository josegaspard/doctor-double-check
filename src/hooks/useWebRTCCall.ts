import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

export function useWebRTCCall(consultationId: string | null, userId: string | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // State (not ref) so components re-render when call object is set
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  const callObjectRef = useRef<DailyCall | null>(null);
  const isCleanedUpRef = useRef(false);
  const isInitializingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => { doCleanup(); };
  }, []);

  const doCleanup = useCallback(async () => {
    console.log('[Daily] 🧹 Cleanup');
    isCleanedUpRef.current = true;
    const co = callObjectRef.current;
    if (co) {
      try {
        await co.leave();
        co.destroy();
      } catch (e) {
        console.warn('[Daily] cleanup error:', e);
      }
      callObjectRef.current = null;
      setCallObject(null);
    }
  }, []);

  // Poll for room to be ready (patient side)
  const waitForRoom = useCallback(async (consultationId: string, maxAttempts = 10): Promise<{ roomName: string; roomUrl: string }> => {
    for (let i = 0; i < maxAttempts; i++) {
      console.log(`[Daily] Polling for room... attempt ${i + 1}/${maxAttempts}`);
      const { data } = await supabase
        .from('consultations')
        .select('video_room_name, video_room_url')
        .eq('id', consultationId)
        .single();

      if (data?.video_room_name && data?.video_room_url) {
        return { roomName: data.video_room_name, roomUrl: data.video_room_url };
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error('La sala de videollamada no está lista. El doctor debe iniciar la llamada primero.');
  }, []);

  const initDailyCall = useCallback(async (isDoctor: boolean) => {
    if (!consultationId || !userId) return;

    console.log('[Daily] 🚀 Starting call, isDoctor:', isDoctor);
    isCleanedUpRef.current = false;
    setCallState('connecting');

    try {
      let roomUrl: string;
      let token: string;

      if (isDoctor) {
        console.log('[Daily] Creating Daily room...');
        const { data: roomData, error: roomError } = await supabase.functions.invoke('create-daily-room', {
          body: { liveId: consultationId, title: `Consulta ${consultationId.slice(0, 8)}`, mode: 'consultation' },
        });
        if (roomError || !roomData?.success) {
          throw new Error(roomData?.error || roomError?.message || 'Failed to create room');
        }
        roomUrl = roomData.room.url;
        token = roomData.room.ownerToken;

        // Save room info to consultation
        await supabase.from('consultations').update({
          video_room_name: roomData.room.name,
          video_room_url: roomUrl,
        }).eq('id', consultationId);

        console.log('[Daily] Room created:', roomData.room.name);
      } else {
        // Patient: poll until room is ready
        const { roomName, roomUrl: url } = await waitForRoom(consultationId);
        roomUrl = url;

        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-daily-token', {
          body: { roomName, isOwner: false, enableMedia: true },
        });
        if (tokenError || !tokenData?.success) throw new Error('Failed to get token');
        token = tokenData.token;
      }

      // Create Daily call object and join
      console.log('[Daily] Creating call object and joining...');
      const co = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      callObjectRef.current = co;
      setCallObject(co);

      // Listen to events
      co.on('joined-meeting', () => {
        console.log('[Daily] ✅ Joined meeting!');
        if (!isCleanedUpRef.current) {
          setCallState('connected');
        }
      });

      co.on('participant-joined', () => {
        console.log('[Daily] 👤 Participant joined');
      });

      co.on('participant-left', async (event: any) => {
        console.log('[Daily] 👤 Participant left');
        if (event?.participant && !event.participant.local) {
          console.log('[Daily] Remote participant left — ending call');
          if (!isCleanedUpRef.current) {
            setCallState('ended');
            // Clear video room fields so CallWaitingBanner disappears
            if (consultationId) {
              await supabase.from('consultations').update({
                video_room_name: null,
                video_room_url: null,
              }).eq('id', consultationId);
            }
            doCleanup();
          }
        }
      });

      co.on('error', (event) => {
        console.error('[Daily] ❌ Error:', event);
        if (!isCleanedUpRef.current) {
          setCallState('error');
        }
      });

      // Join the room
      await co.join({ url: roomUrl, token });
      console.log('[Daily] ✅ Join successful');
    } catch (err: any) {
      console.error('[Daily] ❌ Error:', err);
      if (!isCleanedUpRef.current) {
        setCallState('error');
      }
    }
  }, [consultationId, userId, doCleanup, waitForRoom]);

  const startCall = useCallback(async () => {
    await initDailyCall(true);
  }, [initDailyCall]);

  const joinCall = useCallback(async () => {
    await initDailyCall(false);
  }, [initDailyCall]);

  const endCall = useCallback(async () => {
    console.log('[Daily] 📞 Ending call');
    setCallState('ended');

    if (consultationId) {
      const { data: consultation } = await supabase
        .from('consultations')
        .select('video_room_name')
        .eq('id', consultationId)
        .single();

      if (consultation?.video_room_name) {
        supabase.functions.invoke('end-daily-room', {
          body: { roomName: consultation.video_room_name },
        }).catch(e => console.warn('[Daily] end-room error:', e));
      }

      // Clear video room fields so the CallWaitingBanner disappears for the patient
      await supabase.from('consultations').update({
        video_room_name: null,
        video_room_url: null,
      }).eq('id', consultationId);
    }

    await doCleanup();
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [consultationId, doCleanup]);

  const resetCall = useCallback(async () => {
    await doCleanup();
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [doCleanup]);

  const toggleMute = useCallback(() => {
    const co = callObjectRef.current;
    if (!co) return;
    const newMuted = !isMuted;
    co.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const co = callObjectRef.current;
    if (!co) return;
    const newOff = !isCameraOff;
    co.setLocalVideo(!newOff);
    setIsCameraOff(newOff);
  }, [isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const co = callObjectRef.current;
    if (!co) return;
    if (isScreenSharing) {
      co.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      try {
        await co.startScreenShare();
        setIsScreenSharing(true);
      } catch (e) {
        console.warn('[Daily] Screen share cancelled or failed:', e);
      }
    }
  }, [isScreenSharing]);

  return {
    callState,
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,
    isMuted,
    isCameraOff,
    isScreenSharing,
    startCall,
    joinCall,
    endCall,
    resetCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    callObject,
  };
}
