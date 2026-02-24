import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';
import { motion } from 'framer-motion';

interface CallWaitingBannerProps {
  doctorName: string;
  consultationId: string;
}

export function CallWaitingBanner({ doctorName, consultationId }: CallWaitingBannerProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mx-3 mt-3 rounded-xl bg-gradient-to-r from-primary/15 to-success/15 border border-primary/20 p-3 flex items-center gap-3"
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
          <Video className="w-5 h-5 text-success" />
        </div>
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse border-2 border-background" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {doctorName} te está esperando
        </p>
        <p className="text-xs text-muted-foreground">
          Videollamada activa — únete ahora
        </p>
      </div>

      <Button
        size="sm"
        className="gap-1.5 bg-success hover:bg-success/90 text-white flex-shrink-0"
        onClick={() => navigate(`/video-call?consultation=${consultationId}`)}
      >
        <Phone className="w-4 h-4" />
        Unirse
      </Button>
    </motion.div>
  );
}
