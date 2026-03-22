import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdCreative } from '@/hooks/useAds';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { SkipForward } from 'lucide-react';

const SKIP_AFTER_SECONDS = 6;

interface AdPrerollProps {
  onComplete: () => void;
}

export function AdPreroll({ onComplete }: AdPrerollProps) {
  const { creative, isActive, trackImpression, trackClick } = useAdCreative('live_preroll');
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackedRef = useRef(false);
  const startedRef = useRef(false);

  // If no preroll creative, complete immediately
  useEffect(() => {
    if (!isActive || !creative) {
      onComplete();
    }
  }, [isActive, creative, onComplete]);

  // Track impression on mount
  useEffect(() => {
    if (creative && !trackedRef.current) {
      trackedRef.current = true;
      trackImpression();
    }
  }, [creative, trackImpression]);

  // Countdown for skip
  useEffect(() => {
    if (!creative || !loaded) return;
    startedRef.current = true;

    const interval = setInterval(() => {
      setElapsed(prev => {
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

  if (!isActive || !creative) return null;

  const remainingSkip = Math.max(0, SKIP_AFTER_SECONDS - elapsed);
  const progressPct = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  return (
    <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
      {/* Video ad */}
      {creative.media_type === 'video' ? (
        <video
          ref={videoRef}
          src={creative.media_url}
          className="w-full h-full object-contain cursor-pointer"
          autoPlay
          playsInline
          onClick={handleClick}
          onLoadedMetadata={(e) => {
            setDuration(Math.ceil(e.currentTarget.duration));
            setLoaded(true);
          }}
          onEnded={handleVideoEnd}
        />
      ) : (
        <img
          src={creative.media_url}
          alt={creative.alt_text || t('ads.adLabel')}
          className="w-full h-full object-contain cursor-pointer"
          onClick={handleClick}
          onLoad={() => {
            setDuration(15);
            setLoaded(true);
          }}
        />
      )}

      {/* Top left: Ad badge + countdown */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="px-3 py-1 rounded bg-yellow-500/90 text-black text-xs font-bold">
          {t('ads.adLabel')}
        </span>
        {!canSkip && loaded && (
          <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
            {t('ads.adCountdown').replace('{seconds}', String(remainingSkip))}
          </span>
        )}
      </div>

      {/* Bottom right: Skip button */}
      <div className="absolute bottom-4 right-4">
        {canSkip ? (
          <Button
            onClick={handleSkip}
            variant="secondary"
            size="sm"
            className="gap-2 bg-white/90 text-black hover:bg-white font-semibold shadow-lg"
          >
            {t('ads.skipAd')}
            <SkipForward className="w-4 h-4" />
          </Button>
        ) : loaded ? (
          <span className="px-3 py-1.5 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
            {t('ads.adEndsIn').replace('{seconds}', String(remainingSkip))}
          </span>
        ) : null}
      </div>

      {/* Bottom progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div
          className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
