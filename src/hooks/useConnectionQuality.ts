import { useState, useEffect, useCallback } from 'react';
import type { DailyCall } from '@daily-co/daily-js';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface NetworkStats {
  quality: ConnectionQuality;
  /** Round-trip time in ms */
  latency: number | null;
  /** Packet loss percentage (0-100) */
  packetLoss: number | null;
  /** Receive bitrate in kbps */
  recvBitrate: number | null;
  /** Send bitrate in kbps */
  sendBitrate: number | null;
}

const INITIAL_STATS: NetworkStats = {
  quality: 'unknown',
  latency: null,
  packetLoss: null,
  recvBitrate: null,
  sendBitrate: null,
};

function deriveQuality(latency: number | null, packetLoss: number | null): ConnectionQuality {
  if (latency === null && packetLoss === null) return 'unknown';
  const lat = latency ?? 0;
  const loss = packetLoss ?? 0;

  if (lat < 100 && loss < 1) return 'excellent';
  if (lat < 200 && loss < 3) return 'good';
  if (lat < 400 && loss < 8) return 'fair';
  return 'poor';
}

export function useConnectionQuality(callObject: DailyCall | null, isConnected: boolean) {
  const [stats, setStats] = useState<NetworkStats>(INITIAL_STATS);

  const pollStats = useCallback(async () => {
    if (!callObject) return;

    try {
      const netStats = await callObject.getNetworkStats();
      
      const latency = netStats?.stats?.latest?.recvBitsPerSecond !== undefined
        ? Math.round((netStats as any)?.stats?.latest?.roundTripTime ?? 0)
        : null;
      
      const threshold = netStats?.threshold;
      const latest = (netStats as any)?.stats?.latest;
      
      const packetLoss = latest?.videoRecvPacketLoss != null
        ? Math.round(latest.videoRecvPacketLoss * 100)
        : null;
      
      const recvBitrate = latest?.recvBitsPerSecond != null
        ? Math.round(latest.recvBitsPerSecond / 1000)
        : null;
      
      const sendBitrate = latest?.sendBitsPerSecond != null
        ? Math.round(latest.sendBitsPerSecond / 1000)
        : null;

      // Daily provides a threshold quality string
      let quality: ConnectionQuality;
      if (threshold === 'good') quality = 'excellent';
      else if (threshold === 'low') quality = 'good';
      else if (threshold === 'very-low') quality = 'fair';
      else quality = deriveQuality(latency, packetLoss);

      setStats({ quality, latency, packetLoss, recvBitrate, sendBitrate });
    } catch (e) {
      // getNetworkStats may not be available on all plans
      console.warn('[ConnectionQuality] Stats unavailable:', e);
    }
  }, [callObject]);

  useEffect(() => {
    if (!isConnected || !callObject) {
      setStats(INITIAL_STATS);
      return;
    }

    // Poll every 3 seconds
    pollStats();
    const interval = setInterval(pollStats, 3000);
    return () => clearInterval(interval);
  }, [isConnected, callObject, pollStats]);

  return stats;
}
