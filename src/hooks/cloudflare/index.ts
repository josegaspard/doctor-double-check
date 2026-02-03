import { useCloudflareAPI } from './useCloudflareAPI';
import { useCloudflareWebRTC } from './useCloudflareWebRTC';
import { useLocalRecording } from './useLocalRecording';
import { checkH264Support, CloudflareStream, CodecSupportResult } from './useCloudflareStream';

export { checkH264Support, useLocalRecording };
export type { CloudflareStream, CodecSupportResult };

/**
 * Combined hook for Cloudflare Stream functionality
 * Handles both API calls and WebRTC broadcasting
 */
export function useCloudflareStream() {
  const api = useCloudflareAPI();
  const webrtc = useCloudflareWebRTC();

  const endStream = async (
    liveId: string, 
    streamUid?: string, 
    saveRecording = true
  ): Promise<{ success: boolean; recordingId?: string }> => {
    return api.endStream(liveId, streamUid, saveRecording, webrtc.stopBroadcast);
  };

  return {
    // API state
    isLoading: api.isLoading,
    stream: api.stream,
    error: api.error,
    
    // WebRTC state
    connectionState: webrtc.connectionState,
    negotiatedCodec: webrtc.negotiatedCodec,
    
    // API methods
    createStream: api.createStream,
    endStream,
    getPlaybackUrl: api.getPlaybackUrl,
    
    // WebRTC methods
    startBroadcast: webrtc.startBroadcast,
    stopBroadcast: webrtc.stopBroadcast,
    toggleMute: webrtc.toggleMute,
    toggleVideo: webrtc.toggleVideo,
    getLocalStream: webrtc.getLocalStream,
    getConnectionState: webrtc.getConnectionState,
  };
}
