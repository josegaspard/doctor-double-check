import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice-candidate';
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach(t => t.stop());
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingCandidatesRef.current = [];
  }, [localStream]);

  const getMedia = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle remote tracks
    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remote.addTrack(track);
      });
      // Force re-render
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    // Send ICE candidates via signaling
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[WebRTC] Connection state:', pc.connectionState);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [userId]);

  const setupSignaling = useCallback((onSignal: (payload: SignalPayload) => void) => {
    if (!consultationId) return;

    const channel = supabase
      .channel(`call-signal-${consultationId}`)
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const signal = payload as SignalPayload;
        // Ignore own signals
        if (signal.senderId === userId) return;
        onSignal(signal);
      })
      .subscribe();

    channelRef.current = channel;
  }, [consultationId, userId]);

  const handleSignal = useCallback(async (signal: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        // Flush pending candidates
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

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
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        // Flush pending candidates
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
  }, [userId]);

  /** Doctor initiates the call (creates offer) */
  const startCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');

    try {
      const stream = await getMedia();
      const pc = createPeerConnection(stream);

      setupSignaling(handleSignal);

      // Small delay to ensure channel is subscribed
      await new Promise(r => setTimeout(r, 500));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          type: 'offer',
          sdp: offer.sdp,
          senderId: userId,
        } as SignalPayload,
      });
    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      setCallState('error');
    }
  }, [consultationId, userId, getMedia, createPeerConnection, setupSignaling, handleSignal]);

  /** Patient joins the call (waits for offer, sends answer) */
  const joinCall = useCallback(async () => {
    if (!consultationId || !userId) return;
    setCallState('connecting');

    try {
      const stream = await getMedia();
      createPeerConnection(stream);
      setupSignaling(handleSignal);
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
          // Revert to camera when screen share stops
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
