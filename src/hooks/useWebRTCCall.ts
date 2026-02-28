import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DailyIframe, { DailyCall, DailyEventObjectParticipant } from '@daily-co/daily-js';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

export function useWebRTCCall(consultationId: string | null, userId: string | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const callObjectRef = useRef<DailyCall | null>(null);
  const isCleanedUpRef = useRef(false);

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
    }
  }, []);

  const initDailyCall = useCallback(async (isDoctor: boolean) => {
    if (!consultationId || !userId) return;

    console.log('[Daily] 🚀 Starting call, isDoctor:', isDoctor);
    isCleanedUpRef.current = false;
    setCallState('connecting');

    try {
      // Step 1: Create room (doctor) or get existing room info
      let roomUrl: string;
      let token: string;

      if (isDoctor) {
        // Doctor creates the room
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
        // Patient: get room info from consultation
        console.log('[Daily] Patient joining, fetching consultation...');
        const { data: consultation } = await supabase
          .from('consultations')
          .select('video_room_name, video_room_url')
          .eq('id', consultationId)
          .single();

        if (!consultation?.video_room_name) {
          // Room not created yet — wait and retry
          console.log('[Daily] Room not ready, waiting...');
          await new Promise(r => setTimeout(r, 2000));
          const { data: retry } = await supabase
            .from('consultations')
            .select('video_room_name, video_room_url')
            .eq('id', consultationId)
            .single();
          if (!retry?.video_room_name) {
            throw new Error('La sala de videollamada aún no está lista. El doctor debe iniciar la llamada primero.');
          }
          roomUrl = retry.video_room_url!;

          // Get token
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-daily-token', {
            body: { roomName: retry.video_room_name, isOwner: false, enableMedia: true },
          });
          if (tokenError || !tokenData?.success) throw new Error('Failed to get token');
          token = tokenData.token;
        } else {
          roomUrl = consultation.video_room_url!;
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-daily-token', {
            body: { roomName: consultation.video_room_name, isOwner: false, enableMedia: true },
          });
          if (tokenError || !tokenData?.success) throw new Error('Failed to get token');
          token = tokenData.token;
        }
      }

      // Step 2: Create Daily call object and join
      console.log('[Daily] Creating call object and joining...');
      const callObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      callObjectRef.current = callObject;

      // Listen to events
      callObject.on('joined-meeting', () => {
        console.log('[Daily] ✅ Joined meeting!');
        if (!isCleanedUpRef.current) {
          setCallState('connected');
        }
      });

      callObject.on('participant-joined', (event?: DailyEventObjectParticipant) => {
        console.log('[Daily] 👤 Participant joined:', event?.participant?.user_name);
      });

      callObject.on('participant-left', (event: any) => {
        console.log('[Daily] 👤 Participant left:', event?.participant?.user_name);
        // If the other person left, end the call
        if (event?.participant && !event.participant.local) {
          console.log('[Daily] Remote participant left — ending call');
          if (!isCleanedUpRef.current) {
            setCallState('ended');
            doCleanup();
          }
        }
      });

      callObject.on('error', (event) => {
        console.error('[Daily] ❌ Error:', event);
        if (!isCleanedUpRef.current) {
          setCallState('error');
        }
      });

      callObject.on('left-meeting', () => {
        console.log('[Daily] Left meeting');
      });

      // Join the room
      await callObject.join({ url: roomUrl, token });
      console.log('[Daily] ✅ Join successful');
    } catch (err: any) {
      console.error('[Daily] ❌ Error:', err);
      if (!isCleanedUpRef.current) {
        setCallState('error');
      }
    }
  }, [consultationId, userId, doCleanup]);

  const startCall = useCallback(async () => {
    await initDailyCall(true);
  }, [initDailyCall]);

  const joinCall = useCallback(async () => {
    await initDailyCall(false);
  }, [initDailyCall]);

  const endCall = useCallback(async () => {
    console.log('[Daily] 📞 Ending call');
    setCallState('ended');

    // Clean up room on the server
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

  // Expose the call object for the iframe approach
  const callObject = callObjectRef.current;

  return {
    callState,
    localStream: null as MediaStream | null,  // Not used with Daily
    remoteStream: null as MediaStream | null,  // Not used with Daily
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
