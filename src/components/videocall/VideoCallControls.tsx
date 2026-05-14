import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface VideoCallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  timeElapsed: string;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onEndCall: () => void;
  onSwitchCamera?: () => void;
  showChat: boolean;
  isDoctor?: boolean;
  /** Mensajes no leídos del chat de la llamada — badge rojo sobre el icono */
  unreadChatCount?: number;
}

export function VideoCallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  timeElapsed,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onEndCall,
  onSwitchCamera,
  showChat,
  isDoctor = false,
  unreadChatCount = 0,
}: VideoCallControlsProps) {
  const isMobile = useIsMobile();
  // Botón base con tamaño consistent y touch-target ≥44px (iOS HIG)
  const btnBase = 'rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-colors touch-manipulation flex-shrink-0';

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pt-3 pb-3 sm:px-6 sm:pt-4 sm:pb-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Timer */}
      <div className="flex justify-center mb-2 sm:mb-3">
        <Badge
          variant="secondary"
          className="bg-black/60 text-white border-0 gap-1.5 px-3 py-1 text-sm font-mono"
        >
          <Clock className="w-3.5 h-3.5" />
          {timeElapsed}
        </Badge>
      </div>

      {/* Controls — flex wrap en mobile evita squeezing, gap consistente */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
        <Button
          variant="ghost"
          size="lg"
          className={`${btnBase} ${
            isMuted
              ? 'bg-destructive/85 hover:bg-destructive text-white'
              : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
          onClick={onToggleMute}
          title={isMuted ? 'Activar micrófono' : 'Silenciar'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className={`${btnBase} ${
            isCameraOff
              ? 'bg-destructive/85 hover:bg-destructive text-white'
              : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
          onClick={onToggleCamera}
          title={isCameraOff ? 'Activar cámara' : 'Desactivar cámara'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </Button>

        {isMobile && onSwitchCamera && !isCameraOff && (
          <Button
            variant="ghost"
            size="lg"
            className={`${btnBase} bg-white/15 hover:bg-white/25 text-white`}
            onClick={onSwitchCamera}
            title="Cambiar cámara"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        )}

        {/* Screen share: solo doctor + desktop (mobile no soporta bien getDisplayMedia en Safari iOS) */}
        {isDoctor && !isMobile && (
          <Button
            variant="ghost"
            size="lg"
            className={`${btnBase} ${
              isScreenSharing
                ? 'bg-primary/85 hover:bg-primary text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </Button>
        )}

        {/* Chat con badge de mensajes no leídos */}
        <div className="relative flex-shrink-0">
          <Button
            variant="ghost"
            size="lg"
            className={`${btnBase} ${
              showChat
                ? 'bg-primary/85 hover:bg-primary text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            onClick={onToggleChat}
            title="Chat en llamada"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          {unreadChatCount > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-black/40 animate-pulse">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </div>

        <Button
          variant="destructive"
          size="lg"
          className={`${btnBase} shadow-lg shadow-destructive/40`}
          onClick={onEndCall}
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
