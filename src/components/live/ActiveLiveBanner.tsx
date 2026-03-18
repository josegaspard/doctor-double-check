import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveLive } from '@/contexts/ActiveLiveContext';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function ActiveLiveBanner() {
  const { session } = useActiveLive();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnGoLivePage = location.pathname === '/doctor/go-live';
  const show = !!session && !isOnGoLivePage;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md"
        >
          <button
            onClick={() => navigate('/doctor/go-live')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 hover:bg-destructive/90 transition-colors"
          >
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground/60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive-foreground" />
            </span>
            <Radio className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-semibold truncate flex-1 text-left">
              EN VIVO: {session?.title}
            </span>
            <span className="text-xs font-medium bg-destructive-foreground/20 px-2 py-0.5 rounded-full flex-shrink-0">
              Volver
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
