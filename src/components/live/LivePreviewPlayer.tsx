import React, { useRef, useEffect, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';
import { Video } from 'lucide-react';

// Global counter to limit concurrent Daily connections
let activePreviewCount = 0;
const MAX_PREVIEWS = 4;

interface LivePreviewPlayerProps {
  dailyRoomName: string | null;
  thumbnailUrl?: string | null;
}

export default function LivePreviewPlayer({ dailyRoomName, thumbnailUrl }: LivePreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [connected, setConnected] = useState(false);
  const [slotAvailable, setSlotAvailable] = useState(false);
  const mountedRef = useRef(true);
  const joinedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (callRef.current) {
      const call = callRef.current;
      callRef.current = null;
      if (joinedRef.current) {
        activePreviewCount = Math.max(0, activePreviewCount - 1);
        joinedRef.current = false;
      }
      call.leave().catch(() => {}).finally(() => {
        call.destroy().catch(() => {});
      });
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // IntersectionObserver: only connect when visible
  useEffect(() => {
    if (!dailyRoomName || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (activePreviewCount < MAX_PREVIEWS) {
            setSlotAvailable(true);
          }
        } else {
          setSlotAvailable(false);
          cleanup();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [dailyRoomName, cleanup]);

  // Connect to Daily when slot available
  useEffect(() => {
    if (!slotAvailable || !dailyRoomName || callRef.current) return;
    if (activePreviewCount >= MAX_PREVIEWS) return;

    let cancelled = false;

    const connect = async () => {
      try {
        // Get viewer token
        const { data, error } = await supabase.functions.invoke('get-daily-token', {
          body: { roomName: dailyRoomName, isOwner: false },
        });

        if (cancelled || !mountedRef.current || error || !data?.success) return;

        const roomUrl = `https://doctores.daily.co/${dailyRoomName}`;

        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
          allowMultipleCallInstances: true,
          dailyConfig: {} as any,
        });

        callRef.current = call;

        // Listen for remote video tracks
        call.on('track-started', (event) => {
          if (!mountedRef.current) return;
          if (event.participant?.local) return;
          if (event.track?.kind === 'video' && videoRef.current) {
            const stream = new MediaStream([event.track]);
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            setConnected(true);
          }
        });

        call.on('track-stopped', (event) => {
          if (event.participant?.local) return;
          if (event.track?.kind === 'video') {
            setConnected(false);
          }
        });

        // Suppress error events during teardown
        call.on('error', () => {});

        activePreviewCount++;
        joinedRef.current = true;

        await call.join({
          url: roomUrl,
          token: data.token,
          userName: 'preview',
          startVideoOff: true,
          startAudioOff: true,
        });

        // Set receive-only settings after joining
        call.setLocalAudio(false);
        call.setLocalVideo(false);

      } catch {
        // Silent fail for previews
        if (joinedRef.current) {
          activePreviewCount = Math.max(0, activePreviewCount - 1);
          joinedRef.current = false;
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
    };
  }, [slotAvailable, dailyRoomName]);

  // Fallback content when not connected
  const fallback = thumbnailUrl ? (
    <img
      src={thumbnailUrl}
      alt=""
      loading="lazy"
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <Video className="w-10 h-10 sm:w-12 sm:h-12 text-primary/40" />
    </div>
  );

  return (
    <div ref={containerRef} className="relative aspect-video bg-gradient-to-br from-primary/20 to-info/20 overflow-hidden">
      {/* Video element always rendered but hidden when not connected */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${connected ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Fallback shown when not connected */}
      {!connected && fallback}
      {/* Loading shimmer when trying to connect */}
      {slotAvailable && !connected && dailyRoomName && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
