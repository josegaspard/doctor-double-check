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

const CONNECTION_TIMEOUT_MS = 15000;

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
  const storedOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const isCallerRef = useRef(false);
  const remoteTracksRef = useRef<MediaStream>(new MediaStream());
  const isNegotiatingRef = useRef(false);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endCallRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup');
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach(t => t.stop());
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingCandidatesRef.current = [];
    storedOfferRef.current = null;
    isNegotiatingRef.current = false;
    remoteTracksRef.current = new MediaStream();
  }, [localStream]);

  const getMedia = useCallback(async (): Promise<MediaStream> => {
    console.log('[WebRTC] Requesting getUserMedia...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    console.log('[WebRTC] getUserMedia OK — tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
    setLocalStream(stream);
    return stream;
  }, []);

  const sendSignal = useCallback((payload: SignalPayload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload,
      });
    }
  }, []);

  const sendOffer = useCallback(() => {
    if (storedOfferRef.current && userId) {
      console.log('[WebRTC] Sending offer');
      sendSignal({
        type: 'offer',
        sdp: storedOfferRef.current.sdp,
        senderId: userId,
      });
    }
  }, [userId, sendSignal]);

  /**
   * Create peer connection WITHOUT onnegotiationneeded.
   * The initial offer is created explicitly in startCall().
   * onnegotiationneeded is attached AFTER the connection is established
   * (for screen-share renegotiation).
   */
  const createPeerConnection = useCallback((stream: MediaStream) => {
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
      // Create a new MediaStream so React detects the change
      setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && userId) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          senderId: userId,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected');
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        // NOW attach onnegotiationneeded for future renegotiations (screen share)
        pc.onnegotiationneeded = async () => {
          if (!isCallerRef.current) return;
          if (isNegotiatingRef.current) return;
          isNegotiatingRef.current = true;
          try {
            console.log('[WebRTC] Renegotiation needed — creating offer');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            storedOfferRef.current = offer;
            sendOffer();
          } catch (err) {
            console.error('[WebRTC] renegotiation error:', err);
          } finally {
            isNegotiatingRef.current = false;
          }
        };
      } else if (pc.iceConnectionState === 'failed') {
        console.log('[WebRTC] ICE failed — attempting restart');
        pc.restartIce();
        pc.createOffer({ iceRestart: true }).then(async (o) => {
          await pc.setLocalDescription(o);
          storedOfferRef.current = o;
          sendOffer();
        }).catch(() => {
          setCallState('error');
        });
      } else if (pc.iceConnectionState === 'disconnected') {
        console.log('[WebRTC] ICE disconnected — waiting for recovery...');
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

    // NOTE: onnegotiationneeded is NOT set here. It's set after ICE connects.

    pcRef.current = pc;
    return pc;
  }, [userId, sendSignal, sendOffer]);

  const handleSignal = useCallback(async (signal: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (signal.type === 'end-call') {
        console.log('[WebRTC] Received end-call signal');
        endCallRef.current();
        return;
      }

      if (signal.type === 'ready') {
        console.log('[WebRTC] Received ready signal');
        if (isCallerRef.current) {
          sendOffer();
        }
      } else if (signal.type === 'offer') {
        console.log('[WebRTC] Received offer');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Sending answer');

        if (userId) {
          sendSignal({
            type: 'answer',
            sdp: answer.sdp,
            senderId: userId,
          });
        }
      } else if (signal.type === 'answer') {
        console.log('[WebRTC] Received answer');
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          pendingCandidatesRef.current.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTC] Signal handling error:', err);
    }
  }, [userId, sendOffer, sendSignal]);

  const setupSignaling = useCallback((onSignal: (payload: SignalPayload) => void): Promise<ReturnType<typeof supabase.channel>> => {
    return new Promise((resolve, reject) => {
      if (!consultationId) { reject(new Error('No consultationId')); return; }

      const channel = supabase
        .channel(`call-signal-${consultationId}`)
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const signal = payload as SignalPayload;
          if (signal.senderId === userId) return;
          onSignal(signal);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[WebRTC] Signaling channel SUBSCRIBED');
            channelRef.current = channel;
            resolve(channel);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            reject(new Error(`Channel failed: ${status}`));
          }
        });

      setTimeout(() => reject(new Error('Channel subscription timed out')), 8000);
    });
  }, [consultationId, userId]);

  const startConnectionTimeout = useCallback(() => {
    connectionTimeoutRef.current = setTimeout(() => {
      const state = pcRef.current?.iceConnectionState;
      if (state !== 'connected' && state !== 'completed') {
        console.error('[WebRTC] Connection timed out after', CONNECTION_TIMEOUT_MS, 'ms');
        setCallState('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  /** Doctor initiates the call (creates offer) */
  const startCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');
    isCallerRef.current = true;

    try {
      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      await setupSignaling(handleSignal);

      // Explicit offer — no race with onnegotiationneeded (it's not set yet)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      storedOfferRef.current = offer;
      sendOffer();

      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, handleSignal, sendOffer, startConnectionTimeout]);

  /** Patient joins the call (waits for offer, sends answer) */
  const joinCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');
    isCallerRef.current = false;

    try {
      const stream = await getMedia();
      createPeerConnection(stream);

      await setupSignaling(handleSignal);

      console.log('[WebRTC] Sending ready signal');
      sendSignal({
        type: 'ready',
        senderId: userId,
      });

      startConnectionTimeout();
    } catch (err) {
      console.error('[WebRTC] joinCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, handleSignal, sendSignal, startConnectionTimeout]);

  const endCall = useCallback(() => {
    // Broadcast end-call signal to the other party
    if (channelRef.current && userId) {
      sendSignal({ type: 'end-call', senderId: userId });
    }
    cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [cleanup, userId, sendSignal]);

  // Keep endCallRef in sync so handleSignal can call it without circular deps
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(!isMuted);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => { t.enabled = isCameraOff; });
    setIsCameraOff(!isCameraOff);
  }, [localStream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStream) return;

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
  }, [localStream, isScreenSharing]);

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
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
