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
} from 'lucide-react';
import { motion } from 'framer-motion';

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
  showChat: boolean;
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
  showChat,
}: VideoCallControlsProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 sm:p-6"
    >
      {/* Timer */}
      <div className="flex justify-center mb-4">
        <Badge
          variant="secondary"
          className="bg-black/60 text-white border-0 gap-1.5 px-3 py-1 text-sm font-mono"
        >
          <Clock className="w-3.5 h-3.5" />
          {timeElapsed}
        </Badge>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {/* Mute */}
        <Button
          variant="ghost"
          size="lg"
          className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 ${
            isMuted
              ? 'bg-destructive/80 hover:bg-destructive text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          onClick={onToggleMute}
          title={isMuted ? 'Activar micrófono' : 'Silenciar'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {/* Camera */}
        <Button
          variant="ghost"
          size="lg"
          className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 ${
            isCameraOff
              ? 'bg-destructive/80 hover:bg-destructive text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          onClick={onToggleCamera}
          title={isCameraOff ? 'Activar cámara' : 'Desactivar cámara'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </Button>

        {/* Screen Share */}
        <Button
          variant="ghost"
          size="lg"
          className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 hidden sm:flex ${
            isScreenSharing
              ? 'bg-primary/80 hover:bg-primary text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>

        {/* Chat */}
        <Button
          variant="ghost"
          size="lg"
          className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 ${
            showChat
              ? 'bg-primary/80 hover:bg-primary text-white'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
          onClick={onToggleChat}
          title="Chat en llamada"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>

        {/* End Call */}
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14 sm:w-16 sm:h-16 shadow-lg shadow-destructive/40"
          onClick={onEndCall}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </motion.div>
  );
}
