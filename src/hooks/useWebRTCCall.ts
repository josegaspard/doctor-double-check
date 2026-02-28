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

export function useWebRTCCall(consultationId: string | null, userId: string | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const isCallerRef = useRef(false);
  const remoteTracksRef = useRef<MediaStream>(new MediaStream());
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasCreatedOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  // handleSignalRef pattern: channel listener always calls latest handler
  const handleSignalRef = useRef<(signal: SignalPayload) => void>(() => {});

  // Keep localStreamRef in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupEverything(); };
  }, []);

  const cleanupEverything = useCallback(() => {
    console.log('[WebRTC] Full cleanup');
    // Clear connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    // Clear ready-retry timers
    readyRetryTimersRef.current.forEach(t => clearTimeout(t));
    readyRetryTimersRef.current = [];
    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    // Remove signaling channel
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
    console.log('[WebRTC] Requesting getUserMedia...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    console.log('[WebRTC] getUserMedia OK — tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
    setLocalStream(stream);
    localStreamRef.current = stream;
    return stream;
  }, []);

  // ── Send signal via broadcast channel ──
  const sendSignal = useCallback((payload: SignalPayload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload,
      });
    }
  }, []);

  // ── Create peer connection (NO onnegotiationneeded initially) ──
  const createPeerConnection = useCallback((stream: MediaStream) => {
    console.log('[WebRTC] Creating RTCPeerConnection');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => {
      console.log('[WebRTC] Adding local track:', track.kind);
      pc.addTrack(track, stream);
    });

    remoteTracksRef.current = new MediaStream();

    pc.ontrack = (event) => {
      const track = event.track;
      console.log('[WebRTC] ontrack:', track.kind, 'readyState:', track.readyState);
      const existing = remoteTracksRef.current.getTracks();
      if (!existing.find(t => t.id === track.id)) {
        remoteTracksRef.current.addTrack(track);
      }
      // New MediaStream so React detects the state change
      setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && userId) {
        console.log('[WebRTC] Sending ICE candidate');
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          senderId: userId,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected');
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        // Clear retry timers
        readyRetryTimersRef.current.forEach(t => clearTimeout(t));
        readyRetryTimersRef.current = [];
      } else if (pc.iceConnectionState === 'failed') {
        console.error('[WebRTC] ICE failed — restarting');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        console.log('[WebRTC] ICE disconnected — waiting for recovery');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'failed') {
        console.error('[WebRTC] Connection failed');
        setCallState('error');
      }
    };

    // NOTE: onnegotiationneeded is NOT set here.
    // The initial offer is created explicitly. Renegotiation (screen share) uses replaceTrack.

    pcRef.current = pc;
    return pc;
  }, [userId, sendSignal]);

  // ── Handle incoming signals ──
  const handleSignal = useCallback(async (signal: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc || !userId) return;

    try {
      if (signal.type === 'end-call') {
        console.log('[WebRTC] Received end-call');
        // Use a timeout to avoid calling endCall during render
        setTimeout(() => {
          cleanupEverything();
          setLocalStream(null);
          setRemoteStream(null);
          setCallState('ended');
          setIsMuted(false);
          setIsCameraOff(false);
          setIsScreenSharing(false);
        }, 0);
        return;
      }

      if (signal.type === 'ready') {
        console.log('[WebRTC] Received ready from', signal.senderId);

        if (isCallerRef.current && !hasCreatedOfferRef.current) {
          // CALLER: The other side is listening → NOW create the offer
          hasCreatedOfferRef.current = true;
          console.log('[WebRTC] Creating offer (other party is listening)');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: 'offer', sdp: offer.sdp, senderId: userId });
        } else if (!isCallerRef.current) {
          // NON-CALLER received caller's ready → echo our own ready back
          sendSignal({ type: 'ready', senderId: userId });
        }
        return;
      }

      if (signal.type === 'offer') {
        console.log('[WebRTC] Received offer');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        // Flush pending ICE candidates
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Sending answer');
        sendSignal({ type: 'answer', sdp: answer.sdp, senderId: userId });
        return;
      }

      if (signal.type === 'answer') {
        console.log('[WebRTC] Received answer');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        // Flush pending ICE candidates
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
        return;
      }

      if (signal.type === 'ice-candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          pendingCandidatesRef.current.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTC] Signal handling error:', err);
    }
  }, [userId, sendSignal, cleanupEverything]);

  // Keep handleSignalRef in sync
  useEffect(() => {
    handleSignalRef.current = handleSignal;
  }, [handleSignal]);

  // ── Set up signaling channel ──
  const setupSignaling = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!consultationId) { reject(new Error('No consultationId')); return; }

      const channel = supabase
        .channel(`call-signal-${consultationId}`)
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const signal = payload as SignalPayload;
          if (signal.senderId === userId) return; // ignore own signals
          // Use ref to always call the latest handler
          handleSignalRef.current(signal);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[WebRTC] Signaling channel SUBSCRIBED');
            channelRef.current = channel;
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            reject(new Error(`Channel failed: ${status}`));
          }
        });

      setTimeout(() => reject(new Error('Channel subscription timed out')), 10000);
    });
  }, [consultationId, userId]);

  // ── Send "ready" signal with retries at 0s, 2s, 4s ──
  const sendReadyWithRetry = useCallback(() => {
    if (!userId) return;
    const send = () => {
      console.log('[WebRTC] Sending ready signal');
      sendSignal({ type: 'ready', senderId: userId });
    };

    send(); // immediate
    const t1 = setTimeout(send, 2000);
    const t2 = setTimeout(send, 4000);
    readyRetryTimersRef.current.push(t1, t2);
  }, [userId, sendSignal]);

  // ── Connection timeout ──
  const startConnectionTimeout = useCallback(() => {
    connectionTimeoutRef.current = setTimeout(() => {
      const state = pcRef.current?.iceConnectionState;
      if (state !== 'connected' && state !== 'completed') {
        console.error('[WebRTC] Connection timed out after', CONNECTION_TIMEOUT_MS, 'ms');
        setCallState('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  // ══════════════════════════════════════════
  //  Doctor initiates the call
  //  - Subscribe to channel
  //  - Send "ready" (do NOT create offer yet)
  //  - Wait for patient's "ready" → then create offer
  // ══════════════════════════════════════════
  const startCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');
    isCallerRef.current = true;
    hasCreatedOfferRef.current = false;

    try {
      const stream = await getMedia();
      createPeerConnection(stream);
      await setupSignaling();

      // Send "ready" — do NOT create offer yet
      // The offer is created in handleSignal when we receive the patient's "ready"
      sendReadyWithRetry();
      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, sendReadyWithRetry, startConnectionTimeout]);

  // ══════════════════════════════════════════
  //  Patient joins the call
  //  - Subscribe to channel
  //  - Send "ready" signal (doctor will create offer when it receives this)
  // ══════════════════════════════════════════
  const joinCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');
    isCallerRef.current = false;
    hasCreatedOfferRef.current = false;

    try {
      const stream = await getMedia();
      createPeerConnection(stream);
      await setupSignaling();

      // Send "ready" — the doctor is waiting for this to create the offer
      sendReadyWithRetry();
      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] joinCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, sendReadyWithRetry, startConnectionTimeout]);

  // ── End call ──
  const endCall = useCallback(() => {
    if (channelRef.current && userId) {
      sendSignal({ type: 'end-call', senderId: userId });
    }
    cleanupEverything();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [cleanupEverything, userId, sendSignal]);

  // ── Reset to idle (for retry) ──
  const resetCall = useCallback(() => {
    cleanupEverything();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [cleanupEverything]);

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

  // ── Toggle screen share (uses replaceTrack — no renegotiation needed) ──
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
