import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OtpFloatingBannerProps {
  isVisible: boolean;
  patientName: string;
  secondsLeft: number;
  onReopen: () => void;
}

export function OtpFloatingBanner({ isVisible, patientName, secondsLeft, onReopen }: OtpFloatingBannerProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;
  const isUrgent = secondsLeft <= 30;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-20 left-4 right-4 z-[60] sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs"
        >
          <button
            onClick={onReopen}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-colors ${
              isUrgent
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-primary/10 border-primary/30 text-primary'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              isUrgent ? 'bg-destructive/20' : 'bg-warning/20'
            }`}>
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold truncate">OTP pendiente: {patientName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Timer className="w-3 h-3" />
                <span className={`text-sm font-mono font-bold ${isUrgent ? 'text-destructive' : ''}`}>
                  {timeStr}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">restante</span>
              </div>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-background/80 text-foreground">
              Abrir
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
