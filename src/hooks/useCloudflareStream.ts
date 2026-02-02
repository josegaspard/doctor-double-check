import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CloudflareStream {
  uid: string;
  webRTCUrl: string;
  rtmpsUrl: string;
  rtmpsStreamKey: string;
  playbackUrl: string;
  iframeUrl: string;
}

export function useCloudflareStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<CloudflareStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const createStream = useCallback(async (liveId: string, title: string, enableRecording = true): Promise<CloudflareStream | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-cloudflare-stream', {
        body: { liveId, title, enableRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setStream(data.stream);
      return data.stream;
    } catch (err: any) {
      console.error('Error creating Cloudflare stream:', err);
      setError(err.message || 'Error al crear transmisión');
      toast.error('Error al crear sala de transmisión');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startBroadcast = useCallback(async (webRTCUrl: string): Promise<boolean> => {
    try {
      // Request camera and microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = mediaStream;

      // Create RTCPeerConnection for WHIP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });

      peerConnectionRef.current = pc;

      // Add all tracks to the peer connection
      mediaStream.getTracks().forEach(track => {
        pc.addTrack(track, mediaStream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });

      // Send offer to Cloudflare's WHIP endpoint
      const response = await fetch(webRTCUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHIP error: ${response.status}`);
      }

      // Set remote description from Cloudflare's answer
      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('WebRTC broadcast started successfully');
      return true;
    } catch (err: any) {
      console.error('Error starting broadcast:', err);
      setError(err.message || 'Error al iniciar transmisión');
      toast.error('Error al acceder a cámara/micrófono');
      return false;
    }
  }, []);

  const stopBroadcast = useCallback(() => {
    // Stop all media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const endStream = useCallback(async (liveId: string, streamUid?: string, saveRecording = true): Promise<{ success: boolean; recordingId?: string }> => {
    setIsLoading(true);
    
    try {
      // First stop the broadcast
      stopBroadcast();

      // Then notify the backend
      const { data, error } = await supabase.functions.invoke('end-cloudflare-stream', {
        body: { liveId, streamUid, saveRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setStream(null);
      return { success: true, recordingId: data.recordingId };
    } catch (err: any) {
      console.error('Error ending stream:', err);
      toast.error('Error al finalizar transmisión');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [stopBroadcast]);

  const getPlaybackUrl = useCallback(async (videoUid: string, type: 'live' | 'recording' = 'recording'): Promise<string | null> => {
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
        if (data.status === 'processing') {
          return null; // Still processing
        }
        throw new Error(data.error);
      }

      return data.playbackUrl;
    } catch (err: any) {
      console.error('Error getting playback URL:', err);
      return null;
    }
  }, []);

  const toggleMute = useCallback((muted: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }, []);

  const toggleVideo = useCallback((videoOff: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !videoOff;
      });
    }
  }, []);

  const getLocalStream = useCallback(() => {
    return mediaStreamRef.current;
  }, []);

  return {
    isLoading,
    stream,
    error,
    createStream,
    startBroadcast,
    stopBroadcast,
    endStream,
    getPlaybackUrl,
    toggleMute,
    toggleVideo,
    getLocalStream,
  };
}
