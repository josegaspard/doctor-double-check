import { useEffect, useRef, useState } from 'react';
import { useAdCreative } from '@/hooks/useAds';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface AdBannerProps {
  placementName: string;
  className?: string;
  disableAutoSticky?: boolean;
}

export function AdBanner({ placementName, className, disableAutoSticky }: AdBannerProps) {
  const { creative, isActive, trackImpression, trackClick } = useAdCreative(placementName);
  const { t } = useLanguage();
  const prevCreativeId = useRef<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [fading, setFading] = useState(false);

  // Track impression on each creative change
  useEffect(() => {
    if (creative && creative.id !== prevCreativeId.current) {
      // Fade transition
      setFading(true);
      const fadeTimer = setTimeout(() => {
        prevCreativeId.current = creative.id;
        setImgError(false);
        trackImpression();
        setFading(false);
      }, 200);
      return () => clearTimeout(fadeTimer);
    }
  }, [creative, trackImpression]);

  if (!isActive || !creative) return null;

  const handleClick = () => {
    trackClick();
    if (creative.click_url) {
      window.open(creative.click_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isVideo = creative.media_type === 'video';
  const format = creative.placement_format;
  const isVertical = format === 'vertical' || format === 'sidebar';
  const isInline = creative.placement_name?.includes('inline');

  const mediaClasses = cn(
    'w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]',
    isVertical
      ? 'max-h-[400px] sm:max-h-[500px] lg:max-h-none'
      : isInline
        ? 'max-h-[120px] sm:max-h-[140px]'
        : 'max-h-[160px] sm:max-h-[220px] lg:max-h-[280px]'
  );

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden cursor-pointer group border border-border/50 bg-muted/30',
        'w-full transition-opacity duration-300',
        fading ? 'opacity-0' : 'opacity-100',
        isVertical && !disableAutoSticky && 'lg:sticky lg:top-4',
        className
      )}
      onClick={handleClick}
      role="banner"
      aria-label={creative.alt_text || t('ads.adLabel')}
    >
      {imgError ? (
        <div className={cn(
          'flex items-center justify-center bg-primary/10 text-primary font-medium text-sm',
          isVertical ? 'min-h-[200px]' : 'min-h-[80px]'
        )}>
          {t('ads.adLabel')}
        </div>
      ) : isVideo ? (
        <video
          src={creative.media_url}
          className={mediaClasses}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          src={creative.media_url}
          alt={creative.alt_text || t('ads.adLabel')}
          className={mediaClasses}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      )}

      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-background/70 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
        {t('ads.adLabel')}
      </span>
    </div>
  );
}
