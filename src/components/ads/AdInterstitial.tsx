import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdCreative } from '@/hooks/useAds';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DURATION_MS = 3000;
const SESSION_KEY = 'ad_interstitial_shown';

export function AdInterstitial() {
  const isMobile = useIsMobile();
  const placementName = isMobile ? 'lives_interstitial_mobile' : 'lives_interstitial_desktop';
  const { creative, isActive, trackImpression, trackClick } = useAdCreative(placementName);
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(0);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!isActive || !creative) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setVisible(true);
    sessionStorage.setItem(SESSION_KEY, '1');
    startRef.current = Date.now();

    // Track impression
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackImpression();
    }

    // Progress animation
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(pct);
      if (elapsed >= DURATION_MS) {
        clearInterval(timerRef.current);
        setVisible(false);
      }
    }, 30);

    return () => clearInterval(timerRef.current);
  }, [isActive, creative, trackImpression]);

  const handleClose = useCallback(() => {
    clearInterval(timerRef.current);
    setVisible(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!creative?.click_url) return;
    trackClick();
    window.open(creative.click_url, '_blank', 'noopener,noreferrer');
  }, [creative, trackClick]);

  return (
    <AnimatePresence>
      {visible && creative && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            aria-label={t('ads.closeAd')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Ad label */}
          <span className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs font-medium">
            {t('ads.adLabel')}
          </span>

          {/* Content */}
          <div
            className="relative w-full h-full sm:w-auto sm:h-auto sm:max-w-md sm:max-h-[80vh] cursor-pointer flex items-center justify-center"
            onClick={handleClick}
          >
            {creative.media_type === 'video' ? (
              <video
                src={creative.media_url}
                className="w-full h-full object-contain sm:rounded-2xl"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <img
                src={creative.media_url}
                alt={creative.alt_text || t('ads.adLabel')}
                className="w-full h-full object-contain sm:rounded-2xl"
              />
            )}
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-white/80 transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
