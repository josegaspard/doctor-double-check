import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CloudflareStream {
  uid: string;
  webRTCUrl: string;
  rtmpsUrl: string;
  rtmpsStreamKey: string;
  playbackUrl: string;
  iframeUrl: string;
}

export interface CodecSupportResult {
  h264Supported: boolean;
  availableCodecs: string[];
  recommendation: 'webrtc' | 'rtmps';
}

/**
 * Check if the browser supports H.264 encoding for WebRTC
 * Cloudflare Stream requires H.264 for VOD recording generation
 */
export const checkH264Support = async (): Promise<CodecSupportResult> => {
  const availableCodecs: string[] = [];
  let h264Supported = false;

  try {
    // Check using RTCRtpSender.getCapabilities (modern browsers)
    if ('RTCRtpSender' in window && RTCRtpSender.getCapabilities) {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (capabilities?.codecs) {
        for (const codec of capabilities.codecs) {
          const codecName = codec.mimeType.split('/')[1]?.toUpperCase();
          if (codecName && !availableCodecs.includes(codecName)) {
            availableCodecs.push(codecName);
          }
          if (codec.mimeType.toLowerCase().includes('h264')) {
            h264Supported = true;
          }
        }
      }
    }

    // Fallback: Try to create a test peer connection
    if (availableCodecs.length === 0) {
      const pc = new RTCPeerConnection();
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 640, 480);
      }
      
      const stream = canvas.captureStream(30);
      const track = stream.getVideoTracks()[0];
      
      if (track) {
        pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        
        if (offer.sdp) {
          // Parse SDP for available codecs
          const lines = offer.sdp.split('\n');
          for (const line of lines) {
            if (line.startsWith('a=rtpmap:')) {
              const match = line.match(/a=rtpmap:\d+ (\w+)/);
              if (match && !availableCodecs.includes(match[1].toUpperCase())) {
                availableCodecs.push(match[1].toUpperCase());
              }
              if (line.toUpperCase().includes('H264')) {
                h264Supported = true;
              }
            }
          }
        }
        
        track.stop();
      }
      pc.close();
    }

    console.log('[Cloudflare] Codec check:', { h264Supported, availableCodecs });

  } catch (error) {
    console.warn('[Cloudflare] Error checking codec support:', error);
  }

  return {
    h264Supported,
    availableCodecs,
    recommendation: h264Supported ? 'webrtc' : 'rtmps',
  };
};

/**
 * Prioritize H.264 in SDP offer for Cloudflare compatibility
 * Cloudflare Stream requires H.264 for VOD recording
 */
export const preferH264InSdp = (sdp: string): string => {
  try {
    const lines = sdp.split(/\r?\n/);
    const mLineIndex = lines.findIndex((l) => l.startsWith('m=video '));
    if (mLineIndex === -1) return sdp;

    const h264Pts = new Set<string>();
    for (const l of lines) {
      if (l.startsWith('a=rtpmap:') && l.toUpperCase().includes(' H264/90000')) {
        const pt = l.split(':')[1]?.split(' ')[0];
        if (pt) h264Pts.add(pt.trim());
      }
    }

    if (h264Pts.size === 0) {
      console.warn('[Cloudflare] ⚠️ No H.264 codec found in SDP! Recording may not work.');
      return sdp;
    }

    const mLineParts = lines[mLineIndex].trim().split(' ');
    const header = mLineParts.slice(0, 3);
    const payloads = mLineParts.slice(3);
    if (payloads.length === 0) return sdp;

    const preferred = payloads.filter((pt) => h264Pts.has(pt));
    const rest = payloads.filter((pt) => !h264Pts.has(pt));
    const nextPayloads = [...preferred, ...rest];

    if (nextPayloads.join(' ') !== payloads.join(' ')) {
      lines[mLineIndex] = [...header, ...nextPayloads].join(' ');
      console.log('[Cloudflare] SDP reordered to prioritize H.264');
    }

    return lines.join('\r\n');
  } catch {
    return sdp;
  }
};

/**
 * Extract negotiated video codec from SDP answer
 */
export const getNegotiatedCodec = (sdp: string): string => {
  try {
    const lines = sdp.split(/\r?\n/);
    const mVideoLine = lines.find(l => l.startsWith('m=video'));
    if (!mVideoLine) return 'unknown';

    // Get the first payload type (the preferred/negotiated one)
    const parts = mVideoLine.split(' ');
    const firstPayloadType = parts[3];
    if (!firstPayloadType) return 'unknown';

    // Find the codec for this payload type
    for (const line of lines) {
      if (line.startsWith(`a=rtpmap:${firstPayloadType} `)) {
        const match = line.match(/a=rtpmap:\d+ (\w+)/);
        return match ? match[1].toUpperCase() : 'unknown';
      }
    }
  } catch {
    // ignore
  }
  return 'unknown';
};
