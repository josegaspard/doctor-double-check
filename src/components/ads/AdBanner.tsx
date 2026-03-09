import { useEffect, useRef } from 'react';
import { useAdCreative } from '@/hooks/useAds';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface AdBannerProps {
  placementName: string;
  className?: string;
}

export function AdBanner({ placementName, className }: AdBannerProps) {
  const { creative, isActive, trackImpression, trackClick } = useAdCreative(placementName);
  const { t } = useLanguage();
  const impressionSent = useRef(false);

  useEffect(() => {
    if (creative && !impressionSent.current) {
      impressionSent.current = true;
      trackImpression();
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

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden cursor-pointer group border border-border/50 bg-muted/30',
        'w-full',
        className
      )}
      onClick={handleClick}
      role="banner"
      aria-label={creative.alt_text || t('ads.adLabel')}
    >
      {isVideo ? (
        <video
          src={creative.media_url}
          className="w-full h-auto object-cover max-h-[160px] sm:max-h-[220px] lg:max-h-[280px]"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          src={creative.media_url}
          alt={creative.alt_text || t('ads.adLabel')}
          className="w-full h-auto object-cover max-h-[160px] sm:max-h-[220px] lg:max-h-[280px] transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      )}

      {/* App Store compliance label */}
      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-background/70 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
        {t('ads.adLabel')}
      </span>
    </div>
  );
}
