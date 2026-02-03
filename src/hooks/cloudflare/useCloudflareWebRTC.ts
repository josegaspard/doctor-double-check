import { useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { preferH264InSdp, getNegotiatedCodec } from './useCloudflareStream';

export function useCloudflareWebRTC() {
  const [connectionState, setConnectionState] = useState<string>('new');
  const [negotiatedCodec, setNegotiatedCodec] = useState<string | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceUrlRef = useRef<string | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startBroadcast = useCallback(async (webRTCUrl: string): Promise<boolean> => {
    try {
      console.log('[Cloudflare] Starting broadcast to:', webRTCUrl);

      // Reset any previous WHIP resource
      whipResourceUrlRef.current = null;
      setNegotiatedCodec(null);
      
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
      statsIntervalRef.current = setInterval(async () => {
        if (!pc || pc.connectionState === 'closed') {
          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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
          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
          console.error('[Cloudflare] ❌ Connection FAILED! Media never reached Cloudflare.');
          toast.error('La conexión con el servidor de streaming falló');
        } else if (pc.connectionState === 'connected') {
          console.log('[Cloudflare] ✅ Connected! Now verifying data is flowing...');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

      // Add all tracks to the peer connection
      mediaStream.getTracks().forEach(track => {
        console.log('[Cloudflare] Adding track:', track.kind, track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
        pc.addTrack(track, mediaStream);
      });

      // Create offer
      console.log('[Cloudflare] Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      // Prioritize H.264 in SDP
      console.log('[Cloudflare] Setting local description...');
      const mungedSdp = offer.sdp ? preferH264InSdp(offer.sdp) : offer.sdp;
      if (offer.sdp && mungedSdp !== offer.sdp) {
        console.log('[Cloudflare] SDP munged: prioritizing H.264');
      }
      await pc.setLocalDescription({ type: 'offer', sdp: mungedSdp });

      // Wait for ICE gathering to complete with timeout
      console.log('[Cloudflare] Waiting for ICE gathering...');
      await new Promise<void>((resolve) => {
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

      // Send to WHIP via backend proxy (to capture Location header)
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
      const codec = getNegotiatedCodec(answerSdp);
      setNegotiatedCodec(codec);
      console.log('[Cloudflare] 🎥 Negotiated video codec:', codec);
      
      if (codec !== 'H264') {
        console.warn('[Cloudflare] ⚠️ WARNING: Cloudflare VOD requires H.264! Current codec:', codec);
        toast.warning(`Códec negociado: ${codec}. La grabación puede no funcionar.`, {
          description: 'Cloudflare requiere H.264. Considera usar OBS con RTMPS.',
          duration: 10000,
        });
      } else {
        console.log('[Cloudflare] ✅ H.264 codec confirmed - recording should work!');
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
      
      // Clean up on error
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

    // Clear stats interval
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // CRITICAL: Send WHIP DELETE BEFORE closing local connection!
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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        console.log('[Cloudflare] Stopping track:', track.kind);
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      console.log('[Cloudflare] Closing peer connection, state:', peerConnectionRef.current.connectionState);
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setConnectionState('closed');
    setNegotiatedCodec(null);
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
    connectionState,
    negotiatedCodec,
    startBroadcast,
    stopBroadcast,
    toggleMute,
    toggleVideo,
    getLocalStream,
    getConnectionState,
  };
}
