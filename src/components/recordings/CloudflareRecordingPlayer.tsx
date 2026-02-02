import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import Hls from 'hls.js';
import {
  PlayCircle,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface CloudflareRecordingPlayerProps {
  videoUrl: string;
  recordingId: string;
  onDurationUpdate?: (duration: number) => void;
}

export function CloudflareRecordingPlayer({
  videoUrl,
  recordingId,
  onDurationUpdate,
}: CloudflareRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchPlaybackUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-cloudflare-playback', {
        body: { 
          videoUid: videoUrl,
          type: 'recording',
          recordingId,
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        if (data.status === 'processing' || data.status === 'queued' || data.status === 'downloading') {
          setIsProcessing(true);
          setError('La grabación aún se está procesando. Esto puede tomar unos minutos.');
          return null;
        }
        throw new Error(data.error);
      }

      setIsProcessing(false);
      
      // If duration was updated, notify parent
      if (data.duration && onDurationUpdate) {
        onDurationUpdate(Math.floor(data.duration));
      }

      return data.playbackUrl;
    } catch (err: any) {
      console.error('Error fetching playback URL:', err);
      setError(err.message || 'Error al cargar el video');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [videoUrl, recordingId, onDurationUpdate]);

  const initPlayer = useCallback(async () => {
    const playbackUrl = await fetchPlaybackUrl();
    if (!playbackUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Cleanup existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if native HLS is supported (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        setDuration(video.duration);
      });
      video.addEventListener('error', () => {
        setError('Error al cargar el video');
        setIsLoading(false);
      });
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        setDuration(data.details.totalduration);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Error de reproducción');
              setIsLoading(false);
              break;
          }
        }
      });
    } else {
      setError('Tu navegador no soporta reproducción de video');
      setIsLoading(false);
    }
  }, [fetchPlaybackUrl]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initPlayer]);

  // Retry mechanism for processing videos
  useEffect(() => {
    if (isProcessing && retryCount < 10) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        initPlayer();
      }, 10000); // Retry every 10 seconds

      return () => clearTimeout(timer);
    }
  }, [isProcessing, retryCount, initPlayer]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
    if (newVolume > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    setRetryCount(0);
    initPlayer();
  };

  if (error && !isProcessing) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <div className="text-center p-6">
          <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold mb-2">Procesando grabación...</h3>
          <p className="text-sm text-muted-foreground mb-4">
            La grabación está siendo procesada. Esto puede tomar unos minutos.
          </p>
          <p className="text-xs text-muted-foreground">
            Reintentando automáticamente... ({retryCount}/10)
          </p>
          <Button onClick={handleRetry} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar ahora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden group"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={handlePlayPause}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      {/* Play button overlay */}
      {!isLoading && !isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={handlePlayPause}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <PlayCircle className="w-10 h-10 text-white" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/70 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20" 
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20" 
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <div className="w-24 hidden sm:block">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
