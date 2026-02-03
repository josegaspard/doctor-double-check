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

// Cloudflare Stream ingest commonly expects H.264 for video. Browsers often prefer VP8.
// SDP "munging" here prioritizes H.264 payload types in the m=video line.
const preferH264InSdp = (sdp: string) => {
  try {
    const lines = sdp.split(/\r?\n/);
    const mLineIndex = lines.findIndex((l) => l.startsWith('m=video '));
    if (mLineIndex === -1) return sdp;

    const h264Pts = new Set<string>();
    for (const l of lines) {
      // a=rtpmap:96 H264/90000
      if (l.startsWith('a=rtpmap:') && l.toUpperCase().includes(' H264/90000')) {
        const pt = l.split(':')[1]?.split(' ')[0];
        if (pt) h264Pts.add(pt.trim());
      }
    }

    if (h264Pts.size === 0) return sdp;

    const mLineParts = lines[mLineIndex].trim().split(' ');
    // m=video <port> <proto> <fmt list...>
    const header = mLineParts.slice(0, 3);
    const payloads = mLineParts.slice(3);
    if (payloads.length === 0) return sdp;

    const preferred = payloads.filter((pt) => h264Pts.has(pt));
    const rest = payloads.filter((pt) => !h264Pts.has(pt));
    const nextPayloads = [...preferred, ...rest];

    // Only rewrite if it actually changes ordering
    if (nextPayloads.join(' ') !== payloads.join(' ')) {
      lines[mLineIndex] = [...header, ...nextPayloads].join(' ');
    }

    return lines.join('\r\n');
  } catch {
    return sdp;
  }
};

export function useCloudflareStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<CloudflareStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  // WHIP spec: server responds with a resource URL (Location). Deleting it signals end-of-publish.
  const whipResourceUrlRef = useRef<string | null>(null);

  const createStream = useCallback(async (liveId: string, title: string, enableRecording = true): Promise<CloudflareStream | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Cloudflare] Creating stream...', { liveId, title, enableRecording });
      
      const { data, error } = await supabase.functions.invoke('create-cloudflare-stream', {
        body: { liveId, title, enableRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      console.log('[Cloudflare] Stream created:', data.stream);
      setStream(data.stream);
      return data.stream;
    } catch (err: any) {
      console.error('[Cloudflare] Error creating stream:', err);
      setError(err.message || 'Error al crear transmisión');
      toast.error('Error al crear sala de transmisión');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startBroadcast = useCallback(async (webRTCUrl: string): Promise<boolean> => {
    try {
      console.log('[Cloudflare] Starting broadcast to:', webRTCUrl);

      // Reset any previous WHIP resource
      whipResourceUrlRef.current = null;
      
      // Request camera and microphone access
      console.log('[Cloudflare] Requesting media devices...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('[Cloudflare] Media stream obtained:', {
        videoTracks: mediaStream.getVideoTracks().length,
        audioTracks: mediaStream.getAudioTracks().length,
        videoSettings: mediaStream.getVideoTracks()[0]?.getSettings(),
      });

      mediaStreamRef.current = mediaStream;

      // Create RTCPeerConnection for WHIP
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      peerConnectionRef.current = pc;

      // Monitor bytes sent to verify data is flowing
      let lastBytesSent = 0;
      const statsInterval = setInterval(async () => {
        if (!pc || pc.connectionState === 'closed') {
          clearInterval(statsInterval);
          return;
        }
        try {
          const stats = await pc.getStats();
          let totalBytesSent = 0;
          stats.forEach((report) => {
            if (report.type === 'outbound-rtp') {
              totalBytesSent += report.bytesSent || 0;
            }
          });
          const bytesPerSecond = totalBytesSent - lastBytesSent;
          if (bytesPerSecond > 0) {
            console.log(`[Cloudflare] 📊 Data flowing: ${(bytesPerSecond / 1024).toFixed(1)} KB/s sent (total: ${(totalBytesSent / 1024 / 1024).toFixed(2)} MB)`);
          } else if (pc.connectionState === 'connected') {
            console.warn('[Cloudflare] ⚠️ Connection says connected but NO DATA being sent!');
          }
          lastBytesSent = totalBytesSent;
        } catch (e) {
          // Stats not available yet
        }
      }, 2000);

      // Monitor connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[Cloudflare] Connection state:', pc.connectionState);
        setConnectionState(pc.connectionState);
        
        if (pc.connectionState === 'failed') {
          clearInterval(statsInterval);
          console.error('[Cloudflare] ❌ Connection FAILED! Media never reached Cloudflare.');
          toast.error('La conexión con el servidor de streaming falló');
        } else if (pc.connectionState === 'connected') {
          console.log('[Cloudflare] ✅ Connected! Now verifying data is flowing...');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          clearInterval(statsInterval);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Cloudflare] ICE connection state:', pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'failed') {
          console.error('[Cloudflare] ❌ ICE connection failed - network issue');
          pc.restartIce();
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn('[Cloudflare] ⚠️ ICE disconnected - may reconnect...');
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log('[Cloudflare] ICE gathering state:', pc.iceGatheringState);
      };

      // Add all tracks to the peer connection with proper transceivers
      mediaStream.getTracks().forEach(track => {
        console.log('[Cloudflare] Adding track:', track.kind, track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, mediaStream);
      });

      // Create offer with specific options for better compatibility
      console.log('[Cloudflare] Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      console.log('[Cloudflare] Setting local description...');
      const mungedSdp = offer.sdp ? preferH264InSdp(offer.sdp) : offer.sdp;
      if (offer.sdp && mungedSdp !== offer.sdp) {
        console.log('[Cloudflare] SDP munged: prioritizing H.264');
      }
      await pc.setLocalDescription({ type: 'offer', sdp: mungedSdp });

      // Wait for ICE gathering to complete with timeout
      console.log('[Cloudflare] Waiting for ICE gathering...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn('[Cloudflare] ICE gathering timeout, proceeding anyway');
          resolve();
        }, 5000);

        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });

      console.log('[Cloudflare] ICE candidates gathered, sending to WHIP endpoint...');
      console.log('[Cloudflare] SDP offer length:', pc.localDescription?.sdp?.length);

      // IMPORTANT: In browsers, the WHIP Location header is often NOT readable due to CORS.
      // We proxy WHIP through a backend function so we can capture Location and later DELETE it.
      const { data: whipData, error: whipError } = await supabase.functions.invoke('cloudflare-whip', {
        body: {
          action: 'post',
          url: webRTCUrl,
          sdp: pc.localDescription?.sdp,
        },
      });

      if (whipError) throw whipError;
      if (!whipData?.success) {
        const status = whipData?.status;
        const errorBody = whipData?.errorBody;
        throw new Error(`WHIP error: ${status ?? 'unknown'} - ${errorBody ? String(errorBody).slice(0, 200) : (whipData?.error || 'unknown')}`);
      }

      if (whipData?.resourceUrl) {
        whipResourceUrlRef.current = whipData.resourceUrl;
        console.log('[Cloudflare] WHIP resource saved (from backend):', whipData.resourceUrl);
      } else {
        console.warn('[Cloudflare] WHIP resource URL missing (recording finalization may fail).');
      }

      // Set remote description from Cloudflare's answer
      const answerSdp = whipData.answerSdp as string;
      console.log('[Cloudflare] Answer SDP received, length:', answerSdp.length);
      
      // Log negotiated video codec from answer SDP
      const videoCodecMatch = answerSdp.match(/a=rtpmap:\d+ (H264|VP8|VP9|AV1)/i);
      const negotiatedCodec = videoCodecMatch ? videoCodecMatch[1].toUpperCase() : 'unknown';
      console.log('[Cloudflare] 🎥 Negotiated video codec:', negotiatedCodec);
      if (negotiatedCodec !== 'H264') {
        console.warn('[Cloudflare] ⚠️ WARNING: Cloudflare VOD requires H.264! Current codec:', negotiatedCodec);
      }
      
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      console.log('[Cloudflare] ✅ WebRTC broadcast setup complete!');
      console.log('[Cloudflare] Current connection state:', pc.connectionState);
      console.log('[Cloudflare] Current ICE state:', pc.iceConnectionState);
      
      // Verify tracks are sending
      const senders = pc.getSenders();
      console.log('[Cloudflare] Active senders:', senders.map(s => ({
        kind: s.track?.kind,
        enabled: s.track?.enabled,
        readyState: s.track?.readyState,
      })));

      toast.success('¡Conexión establecida! Transmitiendo...');
      return true;
    } catch (err: any) {
      console.error('[Cloudflare] Error starting broadcast:', err);
      setError(err.message || 'Error al iniciar transmisión');
      
      // Clean up on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      toast.error('Error al iniciar transmisión: ' + (err.message || 'Error desconocido'));
      return false;
    }
  }, []);

  const stopBroadcast = useCallback(async () => {
    console.log('[Cloudflare] Stopping broadcast...');

    // CRITICAL: Send WHIP DELETE BEFORE closing local connection!
    // Cloudflare needs the session to still exist to finalize the recording.
    const whipResourceUrl = whipResourceUrlRef.current;
    if (whipResourceUrl) {
      console.log('[Cloudflare] Sending WHIP DELETE to finalize recording (waiting for response)...');
      try {
        const { data, error } = await supabase.functions.invoke('cloudflare-whip', {
          body: { action: 'delete', url: whipResourceUrl },
        });
        if (error) {
          console.warn('[Cloudflare] WHIP DELETE error:', error);
        } else {
          console.log('[Cloudflare] WHIP DELETE result:', data?.status, data?.success);
        }
      } catch (e) {
        console.warn('[Cloudflare] WHIP DELETE failed:', e);
      } finally {
        whipResourceUrlRef.current = null;
      }
    }

    // Now it's safe to close local resources
    // Stop all media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        console.log('[Cloudflare] Stopping track:', track.kind);
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      console.log('[Cloudflare] Closing peer connection, state:', peerConnectionRef.current.connectionState);
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setConnectionState('closed');
  }, []);

  const endStream = useCallback(async (liveId: string, streamUid?: string, saveRecording = true): Promise<{ success: boolean; recordingId?: string }> => {
    setIsLoading(true);
    
    try {
      console.log('[Cloudflare] Ending stream...', { liveId, streamUid, saveRecording });
      
      // First stop the broadcast (now async - waits for WHIP DELETE)
      await stopBroadcast();

      // Give Cloudflare a moment to process (recording finalization can take a few seconds)
      console.log('[Cloudflare] Waiting for Cloudflare to process recording...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Then notify the backend
      const { data, error } = await supabase.functions.invoke('end-cloudflare-stream', {
        body: { liveId, streamUid, saveRecording },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      console.log('[Cloudflare] Stream ended successfully:', data);
      setStream(null);
      return { success: true, recordingId: data.recordingId };
    } catch (err: any) {
      console.error('[Cloudflare] Error ending stream:', err);
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
      console.error('[Cloudflare] Error getting playback URL:', err);
      return null;
    }
  }, []);

  const toggleMute = useCallback((muted: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
        console.log('[Cloudflare] Audio track enabled:', track.enabled);
      });
    }
  }, []);

  const toggleVideo = useCallback((videoOff: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !videoOff;
        console.log('[Cloudflare] Video track enabled:', track.enabled);
      });
    }
  }, []);

  const getLocalStream = useCallback(() => {
    return mediaStreamRef.current;
  }, []);

  const getConnectionState = useCallback(() => {
    return peerConnectionRef.current?.connectionState || connectionState;
  }, [connectionState]);

  return {
    isLoading,
    stream,
    error,
    connectionState,
    createStream,
    startBroadcast,
    stopBroadcast,
    endStream,
    getPlaybackUrl,
    toggleMute,
    toggleVideo,
    getLocalStream,
    getConnectionState,
  };
}
