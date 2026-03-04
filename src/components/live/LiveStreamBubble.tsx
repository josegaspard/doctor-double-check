import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveStream } from '@/contexts/ActiveStreamContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Maximize2, StopCircle, Mic, MicOff } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LiveStreamBubble() {
  const navigate = useNavigate();
  const { isLive, isMinimized, liveData, elapsedTime, viewerCount, attachVideo, maximizeStream, isMuted, toggleMute } = useActiveStream();
  const videoRef = useRef<HTMLDivElement>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  useEffect(() => {
    if (isLive && isMinimized && videoRef.current) {
      attachVideo(videoRef.current);
    }
  }, [isLive, isMinimized, attachVideo]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExpand = () => {
    maximizeStream();
    navigate('/doctor/go-live');
  };

  if (!isLive || !isMinimized) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="fixed bottom-20 right-4 z-50 w-44 rounded-xl overflow-hidden shadow-2xl border-2 border-destructive/50 bg-black cursor-pointer"
          onClick={handleExpand}
        >
          {/* Mini video */}
          <div ref={videoRef} className="w-full h-24 bg-black relative overflow-hidden">
            {/* Fallback if no video */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10">
              <span className="text-white/60 text-xs">Vista previa</span>
            </div>
          </div>

          {/* Info bar */}
          <div className="px-2.5 py-1.5 bg-background/95 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge variant="live" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                VIVO
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                {isMuted ? <MicOff className="w-3 h-3 text-destructive" /> : <Mic className="w-3 h-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand();
                }}
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar transmisión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu transmisión en vivo se detendrá para todos los espectadores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
