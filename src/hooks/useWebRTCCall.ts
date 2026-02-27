import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice-candidate' | 'ready';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  senderId: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

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

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup');
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach(t => t.stop());
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingCandidatesRef.current = [];
    storedOfferRef.current = null;
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

  const sendOffer = useCallback(() => {
    if (storedOfferRef.current && channelRef.current && userId) {
      console.log('[WebRTC] Sending offer');
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'offer',
          sdp: storedOfferRef.current.sdp,
          senderId: userId,
        } as SignalPayload,
      });
    }
  }, [userId]);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => {
      console.log('[WebRTC] Adding local track:', track.kind);
      pc.addTrack(track, stream);
    });

    // Use a ref to accumulate remote tracks and create fresh MediaStream for React
    remoteTracksRef.current = new MediaStream();

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack:', event.track.kind, 'readyState:', event.track.readyState);
      event.streams[0]?.getTracks().forEach(track => {
        remoteTracksRef.current.addTrack(track);
      });
      // Create a NEW MediaStream to trigger React re-render
      setRemoteStream(new MediaStream(remoteTracksRef.current.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && userId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
            senderId: userId,
          } as SignalPayload,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
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

    pc.onnegotiationneeded = async () => {
      if (!isCallerRef.current) return;
      try {
        console.log('[WebRTC] Negotiation needed — creating offer');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        storedOfferRef.current = offer;
        sendOffer();
      } catch (err) {
        console.error('[WebRTC] negotiationneeded error:', err);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [userId, sendOffer]);

  const handleSignal = useCallback(async (signal: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
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

        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'answer',
            sdp: answer.sdp,
            senderId: userId,
          } as SignalPayload,
        });
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
  }, [userId, sendOffer]);

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

  /** Doctor initiates the call (creates offer) */
  const startCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');
    isCallerRef.current = true;

    try {
      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      await setupSignaling(handleSignal);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      storedOfferRef.current = offer;
      sendOffer();
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, handleSignal, sendOffer]);

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
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'ready',
          senderId: userId,
        } as SignalPayload,
      });
    } catch (err) {
      console.error('[WebRTC] joinCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, handleSignal]);

  const endCall = useCallback(() => {
    cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [cleanup]);

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
