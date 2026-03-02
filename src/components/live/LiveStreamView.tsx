import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DailyVideoPlayer } from './DailyVideoPlayer';
import { LiveChat } from './LiveChat';
import { AnimatedViewerCount } from './AnimatedViewerCount';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Clock,
  Heart,
  MessageSquare,
  StopCircle,
  X,
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  SwitchCamera,
} from 'lucide-react';

interface LiveStreamViewProps {
  liveData: {
    id: string;
    title: string;
    specialty: string;
    viewerCount: number;
    likesCount: number;
    startedAt: Date;
  };
  elapsedTime: number;
  viewerCount: number;
  likesCount: number;
  showChat: boolean;
  onToggleChat: () => void;
  onEndClick: () => void;
  roomUrl: string;
  ownerToken: string;
}

export function LiveStreamView({
  liveData,
  elapsedTime,
  viewerCount,
  likesCount,
  showChat,
  onToggleChat,
  onEndClick,
  roomUrl,
  ownerToken,
}: LiveStreamViewProps) {
  const isMobile = useIsMobile();
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: '100dvh' }}>
        {/* Header overlay with safe area */}
        <div
          className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {/* LIVE badge */}
              <span className="flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                EN VIVO
              </span>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{liveData.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/80 shrink-0">
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatTime(elapsedTime)}
              </span>
              <AnimatedViewerCount count={viewerCount || liveData.viewerCount} variant="inline" />
              <span className="flex items-center gap-0.5">
                <Heart className="w-3 h-3" />
                {likesCount || liveData.likesCount}
              </span>
            </div>
          </div>
        </div>

        {/* Video fills the screen */}
        <div className="flex-1 relative">
          <DailyVideoPlayer
            roomUrl={roomUrl}
            token={ownerToken}
            isOwner={true}
            onLeave={onEndClick}
            onParticipantCountChange={() => {}}
          />
        </div>

        {/* Bottom controls - larger touch targets */}
        <div
          className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-2 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className={`h-11 w-11 rounded-full border-white/20 text-white ${isMuted ? 'bg-destructive/60 hover:bg-destructive/80' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`h-11 w-11 rounded-full border-white/20 text-white ${isVideoOff ? 'bg-destructive/60 hover:bg-destructive/80' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileChatOpen(true)}
            className="h-11 w-11 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={onEndClick}
            className="h-11 gap-1.5 rounded-full px-5"
          >
            <StopCircle className="w-5 h-5" />
            Finalizar
          </Button>
        </div>

        {/* Mobile chat overlay */}
        {mobileChatOpen && (
          <div className="absolute inset-x-0 bottom-0 z-40 h-[60dvh] bg-background rounded-t-2xl shadow-2xl flex flex-col animate-slide-in-bottom">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="font-semibold text-sm">Chat en vivo</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileChatOpen(false)} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LiveChat liveId={liveData.id} isOwner={true} liveStartedAt={liveData.startedAt} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold truncate">{liveData.title}</h1>
            <p className="text-xs text-muted-foreground">{liveData.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(elapsedTime)}
            </span>
            <AnimatedViewerCount count={viewerCount || liveData.viewerCount} variant="inline" />
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {likesCount || liveData.likesCount}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={onToggleChat} className="gap-1">
            <MessageSquare className="w-4 h-4" />
            {showChat ? 'Ocultar' : 'Chat'}
          </Button>

          <Button variant="destructive" size="sm" onClick={onEndClick} className="gap-1">
            <StopCircle className="w-4 h-4" />
            Finalizar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className={showChat ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <DailyVideoPlayer
            roomUrl={roomUrl}
            token={ownerToken}
            isOwner={true}
            onLeave={onEndClick}
            onParticipantCountChange={() => {}}
          />
        </div>

        {showChat && (
          <div className="lg:col-span-1">
            <LiveChat liveId={liveData.id} isOwner={true} liveStartedAt={liveData.startedAt} />
          </div>
        )}
      </div>
    </div>
  );
}
