import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice-candidate' | 'ready' | 'end-call';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  senderId: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const CONNECTION_TIMEOUT_MS = 30000;
const READY_INTERVAL_MS = 2000;

export function useWebRTCCall(consultationId: string | null, userId: string | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // All mutable state lives in refs to avoid stale closures
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const isCallerRef = useRef(false);
  const remoteTracksRef = useRef<MediaStream>(new MediaStream());
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCreatedOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const userIdRef = useRef<string | null>(null);
  const isCleanedUpRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { doCleanup(); };
  }, []);

  const doCleanup = useCallback(() => {
    console.log('[WebRTC] 🧹 Full cleanup');
    isCleanedUpRef.current = true;
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (readyIntervalRef.current) {
      clearInterval(readyIntervalRef.current);
      readyIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingCandidatesRef.current = [];
    hasCreatedOfferRef.current = false;
    remoteTracksRef.current = new MediaStream();
  }, []);

  // ── Get user media ──
  const getMedia = useCallback(async (): Promise<MediaStream> => {
    console.log('[WebRTC] 🎥 Requesting getUserMedia...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const trackInfo = stream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ');
    console.log('[WebRTC] ✅ getUserMedia OK — tracks:', trackInfo);
    setLocalStream(stream);
    localStreamRef.current = stream;
    return stream;
  }, []);

  // ── Send signal (fire and forget) ──
  const sendSignal = useCallback((payload: SignalPayload) => {
    const ch = channelRef.current;
    if (!ch) {
      console.warn('[WebRTC] ⚠️ Cannot send signal, no channel:', payload.type);
      return;
    }
    console.log('[WebRTC] 📤 Sending:', payload.type);
    ch.send({
      type: 'broadcast',
      event: 'signal',
      payload,
    });
  }, []);

  // ── Stop ready interval ──
  const stopReadyInterval = useCallback(() => {
    if (readyIntervalRef.current) {
      clearInterval(readyIntervalRef.current);
      readyIntervalRef.current = null;
    }
  }, []);

  // ── Create peer connection ──
  const createPeerConnection = useCallback((stream: MediaStream): RTCPeerConnection => {
    console.log('[WebRTC] 🔌 Creating RTCPeerConnection with', ICE_SERVERS.length, 'ICE servers');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => {
      console.log('[WebRTC] ➕ Adding local track:', track.kind, track.id.slice(0, 8));
      pc.addTrack(track, stream);
    });

    remoteTracksRef.current = new MediaStream();

    pc.ontrack = (event) => {
      const track = event.track;
      console.log('[WebRTC] 📥 ontrack:', track.kind, 'readyState:', track.readyState, 'id:', track.id.slice(0, 8));
      
      const existing = remoteTracksRef.current.getTracks();
      if (!existing.find(t => t.id === track.id)) {
        remoteTracksRef.current.addTrack(track);
        console.log('[WebRTC] ✅ Added remote track. Total remote tracks:', remoteTracksRef.current.getTracks().length);
      }
      
      // Also listen for track unmuting (important for some browsers)
      track.onunmute = () => {
        console.log('[WebRTC] 🔊 Remote track unmuted:', track.kind);
        setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
      };
      
      // Create new MediaStream so React detects the change
      setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && userIdRef.current) {
        console.log('[WebRTC] 🧊 ICE candidate:', event.candidate.candidate.slice(0, 50));
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          senderId: userIdRef.current,
        });
      } else if (!event.candidate) {
        console.log('[WebRTC] 🧊 ICE gathering complete');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC] 🔗 ICE connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('[WebRTC] ✅✅ CONNECTED! Call is live!');
        setCallState('connected');
        stopReadyInterval();
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      } else if (state === 'failed') {
        console.error('[WebRTC] ❌ ICE connection FAILED');
        // Try ICE restart once
        try {
          pc.restartIce();
          console.log('[WebRTC] 🔄 ICE restart triggered');
        } catch (e) {
          console.error('[WebRTC] ICE restart failed:', e);
          setCallState('error');
        }
      } else if (state === 'disconnected') {
        console.log('[WebRTC] ⚠️ ICE disconnected — waiting for recovery...');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] 🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'failed') {
        console.error('[WebRTC] ❌ Connection state FAILED');
        setCallState('error');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [sendSignal, stopReadyInterval]);

  // ── Handle incoming signal ──
  // This is called via a ref so it always has the latest closure
  const handleSignal = useCallback(async (signal: SignalPayload) => {
    const pc = pcRef.current;
    const uid = userIdRef.current;
    
    if (!pc) {
      console.warn('[WebRTC] ⚠️ Received signal but no peer connection:', signal.type);
      return;
    }
    if (!uid) {
      console.warn('[WebRTC] ⚠️ Received signal but no userId');
      return;
    }

    console.log('[WebRTC] 📩 Received signal:', signal.type, 'from:', signal.senderId.slice(0, 8));

    try {
      // ── END CALL ──
      if (signal.type === 'end-call') {
        console.log('[WebRTC] 📞 Remote party ended the call');
        setTimeout(() => {
          doCleanup();
          setLocalStream(null);
          setRemoteStream(null);
          setCallState('ended');
          setIsMuted(false);
          setIsCameraOff(false);
          setIsScreenSharing(false);
        }, 0);
        return;
      }

      // ── READY ──
      if (signal.type === 'ready') {
        if (isCallerRef.current && !hasCreatedOfferRef.current) {
          // I'm the caller and the other party is ready → create offer NOW
          hasCreatedOfferRef.current = true;
          stopReadyInterval(); // stop sending ready
          
          console.log('[WebRTC] 🎯 Other party is ready! Creating offer...');
          const offer = await pc.createOffer();
          console.log('[WebRTC] 📝 Offer created, setting local description...');
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] ✅ Local description set. Sending offer...');
          sendSignal({ type: 'offer', sdp: offer.sdp, senderId: uid });
          console.log('[WebRTC] 📤 Offer sent! Waiting for answer...');
        } else if (!isCallerRef.current) {
          // I'm the joiner and the caller is ready — echo back
          console.log('[WebRTC] 👋 Echoing ready back to caller');
          sendSignal({ type: 'ready', senderId: uid });
        }
        return;
      }

      // ── OFFER ──
      if (signal.type === 'offer') {
        stopReadyInterval(); // stop sending ready
        console.log('[WebRTC] 📝 Setting remote description (offer)...');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        console.log('[WebRTC] ✅ Remote description set.');
        
        // Flush pending ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
          console.log('[WebRTC] 🧊 Flushing', pendingCandidatesRef.current.length, 'pending ICE candidates');
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current = [];
        }
        
        // Create and send answer
        console.log('[WebRTC] 📝 Creating answer...');
        const answer = await pc.createAnswer();
        console.log('[WebRTC] 📝 Setting local description (answer)...');
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] ✅ Local description set. Sending answer...');
        sendSignal({ type: 'answer', sdp: answer.sdp, senderId: uid });
        console.log('[WebRTC] 📤 Answer sent! Waiting for ICE to connect...');
        return;
      }

      // ── ANSWER ──
      if (signal.type === 'answer') {
        console.log('[WebRTC] 📝 Setting remote description (answer)...');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        console.log('[WebRTC] ✅ Remote description set. Waiting for ICE to connect...');
        
        // Flush pending ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
          console.log('[WebRTC] 🧊 Flushing', pendingCandidatesRef.current.length, 'pending ICE candidates');
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current = [];
        }
        return;
      }

      // ── ICE CANDIDATE ──
      if (signal.type === 'ice-candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          console.log('[WebRTC] 🧊 Adding ICE candidate');
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          console.log('[WebRTC] 🧊 Queuing ICE candidate (no remote description yet)');
          pendingCandidatesRef.current.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTC] ❌ Signal handling error:', err);
    }
  }, [sendSignal, stopReadyInterval, doCleanup]);

  // Keep ref in sync so channel listener always calls latest handler
  const handleSignalRef = useRef(handleSignal);
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  // ── Set up signaling channel ──
  const setupSignaling = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!consultationId || !userIdRef.current) {
        reject(new Error('No consultationId or userId'));
        return;
      }
      
      const channelName = `call-signal-${consultationId}`;
      console.log('[WebRTC] 📡 Subscribing to channel:', channelName);
      
      const myUserId = userIdRef.current;

      const channel = supabase
        .channel(channelName, {
          config: { broadcast: { self: false, ack: true } },
        })
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const signal = payload as SignalPayload;
          if (signal.senderId === myUserId) return; // shouldn't happen with self:false, but guard
          handleSignalRef.current(signal);
        })
        .subscribe((status) => {
          console.log('[WebRTC] 📡 Channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('[WebRTC] ✅ Channel SUBSCRIBED');
            channelRef.current = channel;
            // Small delay to ensure server-side channel is fully active
            setTimeout(() => resolve(), 500);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('[WebRTC] ❌ Channel error:', status);
            reject(new Error(`Channel failed: ${status}`));
          }
        });

      setTimeout(() => reject(new Error('Channel subscription timed out')), 10000);
    });
  }, [consultationId]);

  // ── Start ready interval (sends "ready" every 2s until stopped) ──
  const startReadyInterval = useCallback(() => {
    if (!userIdRef.current) return;
    
    const uid = userIdRef.current;
    
    // Send immediately
    console.log('[WebRTC] 👋 Sending first ready signal');
    sendSignal({ type: 'ready', senderId: uid });
    
    // Then every 2 seconds
    readyIntervalRef.current = setInterval(() => {
      if (hasCreatedOfferRef.current && isCallerRef.current) {
        // Already created offer, stop
        stopReadyInterval();
        return;
      }
      console.log('[WebRTC] 👋 Sending ready signal (retry)');
      sendSignal({ type: 'ready', senderId: uid });
    }, READY_INTERVAL_MS);
  }, [sendSignal, stopReadyInterval]);

  // ── Connection timeout ──
  const startConnectionTimeout = useCallback(() => {
    connectionTimeoutRef.current = setTimeout(() => {
      const iceState = pcRef.current?.iceConnectionState;
      const connState = pcRef.current?.connectionState;
      console.error('[WebRTC] ⏰ Connection timed out! ICE:', iceState, 'Connection:', connState);
      if (iceState !== 'connected' && iceState !== 'completed') {
        setCallState('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  // ══════════════════════════════════════════
  //  DOCTOR: startCall
  // ══════════════════════════════════════════
  const startCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    console.log('[WebRTC] 🚀 === START CALL (Doctor/Caller) ===');
    console.log('[WebRTC] consultationId:', consultationId);
    console.log('[WebRTC] userId:', userId);
    
    isCleanedUpRef.current = false;
    setCallState('connecting');
    isCallerRef.current = true;
    hasCreatedOfferRef.current = false;

    try {
      const stream = await getMedia();
      createPeerConnection(stream);
      await setupSignaling();
      
      console.log('[WebRTC] ✅ All set up. Starting ready signal interval...');
      startReadyInterval();
      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] ❌ startCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, startReadyInterval, startConnectionTimeout]);

  // ══════════════════════════════════════════
  //  PATIENT: joinCall
  // ══════════════════════════════════════════
  const joinCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    console.log('[WebRTC] 🚀 === JOIN CALL (Patient/Joiner) ===');
    console.log('[WebRTC] consultationId:', consultationId);
    console.log('[WebRTC] userId:', userId);
    
    isCleanedUpRef.current = false;
    setCallState('connecting');
    isCallerRef.current = false;
    hasCreatedOfferRef.current = false;

    try {
      const stream = await getMedia();
      createPeerConnection(stream);
      await setupSignaling();
      
      console.log('[WebRTC] ✅ All set up. Starting ready signal interval...');
      startReadyInterval();
      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] ❌ joinCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, startReadyInterval, startConnectionTimeout]);

  // ── End call ──
  const endCall = useCallback(() => {
    console.log('[WebRTC] 📞 Ending call');
    if (channelRef.current && userIdRef.current) {
      sendSignal({ type: 'end-call', senderId: userIdRef.current });
    }
    doCleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [doCleanup, sendSignal]);

  // ── Reset to idle (for retry) ──
  const resetCall = useCallback(() => {
    console.log('[WebRTC] 🔄 Resetting call to idle');
    doCleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [doCleanup]);

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
  }, [isMuted]);

  // ── Toggle camera ──
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isCameraOff; });
    setIsCameraOff(!isCameraOff);
  }, [isCameraOff]);

  // ── Toggle screen share ──
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => {
          if (sender && originalVideoTrackRef.current) {
            sender.replaceTrack(originalVideoTrackRef.current);
          }
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } else {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && originalVideoTrackRef.current) {
          await sender.replaceTrack(originalVideoTrackRef.current);
        }
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('[WebRTC] Screen share error:', err);
    }
  }, [isScreenSharing]);

  return {
    callState,
    localStream,
    remoteStream,
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
  };
}
