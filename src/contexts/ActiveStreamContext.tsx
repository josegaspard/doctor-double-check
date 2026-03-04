import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Daily, { DailyCall } from '@daily-co/daily-js';

interface LiveStreamData {
  id: string;
  title: string;
  description: string;
  specialty: string;
  startedAt: Date;
}

interface ActiveStreamContextType {
  isLive: boolean;
  isMinimized: boolean;
  liveData: LiveStreamData | null;
  elapsedTime: number;
  viewerCount: number;
  likesCount: number;
  callObjectRef: React.MutableRefObject<DailyCall | null>;
  startStream: (roomUrl: string, token: string, data: LiveStreamData) => Promise<void>;
  endStream: () => void;
  minimizeStream: () => void;
  maximizeStream: () => void;
  setViewerCount: (count: number) => void;
  setLikesCount: (count: number) => void;
  videoContainerRef: React.RefObject<HTMLDivElement>;
  attachVideo: (container: HTMLDivElement | null) => void;
  isMuted: boolean;
  isVideoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const ActiveStreamContext = createContext<ActiveStreamContextType | undefined>(undefined);

export function ActiveStreamProvider({ children }: { children: ReactNode }) {
  const [isLive, setIsLive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [liveData, setLiveData] = useState<LiveStreamData | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const callObjectRef = useRef<DailyCall | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = useRef<HTMLDivElement | null>(null);

  // Timer
  useEffect(() => {
    if (!isLive || !liveData?.startedAt) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - new Date(liveData.startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, liveData?.startedAt]);

  const updateVideoElements = useCallback((container: HTMLDivElement | null) => {
    if (!container || !callObjectRef.current) return;
    container.innerHTML = '';

    const participants = callObjectRef.current.participants();
    Object.values(participants).forEach((participant) => {
      if (participant.video && participant.videoTrack) {
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.className = 'w-full h-full object-cover';
        const stream = new MediaStream([participant.videoTrack]);
        videoEl.srcObject = stream;
        container.appendChild(videoEl);
      }
    });
  }, []);

  const attachVideo = useCallback((container: HTMLDivElement | null) => {
    activeContainerRef.current = container;
    updateVideoElements(container);
  }, [updateVideoElements]);

  // Re-render video when participants update
  useEffect(() => {
    if (!callObjectRef.current || !isLive) return;
    const call = callObjectRef.current;

    const handleUpdate = () => {
      updateVideoElements(activeContainerRef.current);
    };

    call.on('participant-updated', handleUpdate);
    call.on('participant-joined', handleUpdate);
    call.on('participant-left', handleUpdate);

    return () => {
      call.off('participant-updated', handleUpdate);
      call.off('participant-joined', handleUpdate);
      call.off('participant-left', handleUpdate);
    };
  }, [isLive, updateVideoElements]);

  const startStream = useCallback(async (roomUrl: string, token: string, data: LiveStreamData) => {
    // Destroy any existing call
    try {
      const existing = Daily.getCallInstance();
      if (existing) await existing.destroy();
    } catch { /* no existing */ }

    const call = Daily.createCallObject({
      videoSource: true,
      audioSource: true,
    });

    callObjectRef.current = call;
    
    await call.join({ url: roomUrl, token });

    setLiveData(data);
    setIsLive(true);
    setIsMinimized(false);
    setElapsedTime(0);
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  const endStream = useCallback(() => {
    if (callObjectRef.current) {
      callObjectRef.current.leave().catch(() => {});
      callObjectRef.current.destroy().catch(() => {});
      callObjectRef.current = null;
    }
    setIsLive(false);
    setIsMinimized(false);
    setLiveData(null);
    setElapsedTime(0);
    setViewerCount(0);
    setLikesCount(0);
  }, []);

  const minimizeStream = useCallback(() => {
    if (isLive) setIsMinimized(true);
  }, [isLive]);

  const maximizeStream = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!callObjectRef.current) return;
    const newMuted = !isMuted;
    callObjectRef.current.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (!callObjectRef.current) return;
    const newVideoOff = !isVideoOff;
    callObjectRef.current.setLocalVideo(!newVideoOff);
    setIsVideoOff(newVideoOff);
  }, [isVideoOff]);

  return (
    <ActiveStreamContext.Provider value={{
      isLive,
      isMinimized,
      liveData,
      elapsedTime,
      viewerCount,
      likesCount,
      callObjectRef,
      startStream,
      endStream,
      minimizeStream,
      maximizeStream,
      setViewerCount,
      setLikesCount,
      videoContainerRef,
      attachVideo,
      isMuted,
      isVideoOff,
      toggleMute,
      toggleVideo,
    }}>
      {children}
    </ActiveStreamContext.Provider>
  );
}

export function useActiveStream() {
  const context = useContext(ActiveStreamContext);
  if (!context) {
    throw new Error('useActiveStream must be used within ActiveStreamProvider');
  }
  return context;
}
