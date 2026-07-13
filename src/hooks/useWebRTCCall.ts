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
  // Grace timer used to tolerate brief remote disconnects (wifi blip)
  // before tearing down the call. Cleared if the remote rejoins.
  const remoteLeftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest consultationId reachable from the unmount cleanup.
  const consultationIdRef = useRef(consultationId);
  consultationIdRef.current = consultationId;

  // Cleanup on unmount. If a call was active and the user closed the tab or
  // navigated away WITHOUT hanging up, also end the Daily room so it doesn't
  // linger until its 24h expiry. end-daily-room validates ownership server-side,
  // so only the doctor (room owner) actually closes it; the patient side is a no-op.
  useEffect(() => {
    return () => {
      const hadActiveCall = !!callObjectRef.current;
      const cid = consultationIdRef.current;
      doCleanup();
      if (hadActiveCall && cid) {
        (async () => {
          try {
            const { data } = await supabase
              .from('consultations').select('video_room_name').eq('id', cid).maybeSingle();
            if (data?.video_room_name) {
              await supabase.functions.invoke('end-daily-room', { body: { roomName: data.video_room_name } });
            }
          } catch { /* best effort */ }
        })();
      }
    };
  }, []);

  const doCleanup = useCallback(async () => {
    console.log('[Daily] 🧹 Cleanup');
    isCleanedUpRef.current = true;
    if (remoteLeftTimerRef.current) {
      clearTimeout(remoteLeftTimerRef.current);
      remoteLeftTimerRef.current = null;
    }
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

  // Poll for room to be ready (patient side). 30 × 1.5s = up to 45s, which
  // forgives a slow doctor-side `create-daily-room` round-trip (Daily API +
  // edge function cold-start can take 5-15s on first call).
  const waitForRoom = useCallback(async (consultationId: string, maxAttempts = 30): Promise<{ roomName: string; roomUrl: string }> => {
    for (let i = 0; i < maxAttempts; i++) {
      console.log(`[Daily] Polling for room... attempt ${i + 1}/${maxAttempts}`);
      const { data } = await supabase
        .from('consultations')
        .select('video_room_name, video_room_url')
        .eq('id', consultationId)
        .maybeSingle();

      if (data?.video_room_name && data?.video_room_url) {
        return { roomName: data.video_room_name, roomUrl: data.video_room_url };
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error('La sala de videollamada no está lista. El doctor debe iniciar la llamada primero.');
  }, []);

  const initDailyCall = useCallback(async (isDoctor: boolean) => {
    if (!consultationId || !userId) return;

    // Guard against concurrent calls
    if (isInitializingRef.current) {
      console.warn('[Daily] ⚠️ Already initializing, skipping duplicate call');
      return;
    }
    isInitializingRef.current = true;

    console.log('[Daily] 🚀 Starting call, isDoctor:', isDoctor);
    isCleanedUpRef.current = false;
    setCallState('connecting');

    try {
      // Destroy any existing call object before creating a new one
      const existingCo = callObjectRef.current;
      if (existingCo) {
        console.log('[Daily] 🧹 Destroying previous call object before re-init');
        try {
          await existingCo.leave();
          existingCo.destroy();
        } catch (e) {
          console.warn('[Daily] cleanup previous error:', e);
        }
        callObjectRef.current = null;
        setCallObject(null);
      }

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

      co.on('participant-joined', (event: any) => {
        console.log('[Daily] 👤 Participant joined');
        // If a remote rejoined while a grace timer was pending, cancel the
        // pending teardown — this was just a brief wifi blip.
        if (event?.participant && !event.participant.local && remoteLeftTimerRef.current) {
          console.log('[Daily] Remote rejoined within grace window — cancelling teardown');
          clearTimeout(remoteLeftTimerRef.current);
          remoteLeftTimerRef.current = null;
        }
      });

      co.on('participant-left', (event: any) => {
        console.log('[Daily] 👤 Participant left');
        if (!event?.participant || event.participant.local) return;
        if (isCleanedUpRef.current) return;
        // Grace window: tolerate brief reconnects (network flap, app
        // backgrounded). If the remote does not return in 10s, tear down.
        if (remoteLeftTimerRef.current) clearTimeout(remoteLeftTimerRef.current);
        remoteLeftTimerRef.current = setTimeout(async () => {
          remoteLeftTimerRef.current = null;
          if (isCleanedUpRef.current) return;
          console.log('[Daily] Remote did not return — ending call');
          setCallState('ended');
          if (consultationId) {
            await supabase.from('consultations').update({
              video_room_name: null,
              video_room_url: null,
            }).eq('id', consultationId);
          }
          doCleanup();
        }, 10000);
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
    } finally {
      isInitializingRef.current = false;
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
        .maybeSingle();

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

  // Cycle front/back camera on devices that support it (mobile, mostly).
  const switchCamera = useCallback(async () => {
    const co: any = callObjectRef.current;
    if (!co) return;
    try {
      if (typeof co.cycleCamera === 'function') {
        await co.cycleCamera();
        return;
      }
      // Fallback: enumerate devices and pick the other camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      if (cameras.length < 2) return;
      const current = await co.getInputDevices?.();
      const currentId = current?.camera?.deviceId;
      const other = cameras.find((c) => c.deviceId !== currentId);
      if (other) {
        await co.setInputDevicesAsync({ videoDeviceId: other.deviceId });
      }
    } catch (e) {
      console.warn('[Daily] camera switch failed:', e);
    }
  }, []);

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
    switchCamera,
    callObject,
  };
}
