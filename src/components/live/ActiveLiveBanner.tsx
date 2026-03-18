import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveLive } from '@/contexts/ActiveLiveContext';
import { Radio, ArrowLeft } from 'lucide-react';
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
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-sm pb-[env(safe-area-inset-bottom)]"
        >
          <button
            onClick={() => navigate('/doctor/go-live')}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-destructive text-destructive-foreground shadow-xl shadow-destructive/40 hover:bg-destructive/90 active:scale-[0.98] transition-all"
          >
            {/* Pulsing live dot */}
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground/60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive-foreground" />
            </span>

            <Radio className="w-4 h-4 flex-shrink-0" />

            <span className="text-sm font-semibold truncate flex-1 text-left leading-tight">
              EN VIVO: {session?.title}
            </span>

            <span className="flex items-center gap-1 text-xs font-semibold bg-destructive-foreground/20 px-2.5 py-1 rounded-full flex-shrink-0">
              <ArrowLeft className="w-3 h-3" />
              Volver
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
