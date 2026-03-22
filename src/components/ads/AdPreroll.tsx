import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdCreative } from '@/hooks/useAds';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { SkipForward } from 'lucide-react';

const SKIP_AFTER_SECONDS = 6;

interface AdPrerollProps {
  onComplete: () => void;
  placementName?: string;
}

export function AdPreroll({ onComplete, placementName = 'live_preroll' }: AdPrerollProps) {
  const { creative, isActive, isLoading, trackImpression, trackClick } = useAdCreative(placementName);
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && (!isActive || !creative)) {
      onComplete();
    }
  }, [isLoading, isActive, creative, onComplete]);

  useEffect(() => {
    if (creative && !trackedRef.current) {
      trackedRef.current = true;
      trackImpression();
    }
  }, [creative, trackImpression]);

  useEffect(() => {
    if (!creative || !loaded) return;
    startedRef.current = true;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= SKIP_AFTER_SECONDS) setCanSkip(true);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [creative, loaded]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleVideoEnd = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleClick = useCallback(() => {
    if (!creative?.click_url) return;
    trackClick();
    window.open(creative.click_url, '_blank', 'noopener,noreferrer');
  }, [creative, trackClick]);

  const attemptAutoplayWithAudio = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      await videoRef.current.play();
    } catch (error) {
      console.warn('[AdPreroll] autoplay with audio blocked', error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
        <span className="text-sm font-medium text-foreground">{t('ads.adLabel')}</span>
      </div>
    );
  }

  if (!isActive || !creative) return null;

  const remainingSkip = Math.max(0, SKIP_AFTER_SECONDS - elapsed);
  const progressPct = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
      {creative.media_type === 'video' ? (
        <video
          ref={videoRef}
          src={creative.media_url}
          className="h-full w-full cursor-pointer object-contain"
          autoPlay
          playsInline
          preload="auto"
          onClick={handleClick}
          onLoadedMetadata={(e) => {
            setDuration(Math.ceil(e.currentTarget.duration));
            setLoaded(true);
            void attemptAutoplayWithAudio();
          }}
          onCanPlay={() => {
            void attemptAutoplayWithAudio();
          }}
          onEnded={handleVideoEnd}
        />
      ) : (
        <img
          src={creative.media_url}
          alt={creative.alt_text || t('ads.adLabel')}
          className="h-full w-full cursor-pointer object-contain"
          onClick={handleClick}
          onLoad={() => {
            setDuration(15);
            setLoaded(true);
          }}
        />
      )}

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          {t('ads.adLabel')}
        </span>
        {!canSkip && loaded && (
          <span className="rounded bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {t('ads.adCountdown').replace('{seconds}', String(remainingSkip))}
          </span>
        )}
      </div>

      <div className="absolute bottom-4 right-4">
        {canSkip ? (
          <Button
            onClick={handleSkip}
            variant="secondary"
            size="sm"
            className="gap-2 font-semibold shadow-lg"
          >
            {t('ads.skipAd')}
            <SkipForward className="w-4 h-4" />
          </Button>
        ) : loaded ? (
          <span className="rounded bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm">
            {t('ads.adEndsIn').replace('{seconds}', String(remainingSkip))}
          </span>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
