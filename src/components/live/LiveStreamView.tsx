import React from 'react';
import { Button } from '@/components/ui/button';
import { CloudflareStreamPlayer } from './CloudflareStreamPlayer';
import { LiveChat } from './LiveChat';
import { AnimatedViewerCount } from './AnimatedViewerCount';
import {
  Clock,
  Heart,
  MessageSquare,
  StopCircle,
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
  getLocalStream: () => MediaStream | null;
  onToggleMute: (muted: boolean) => void;
  onToggleVideo: (videoOff: boolean) => void;
}

export function LiveStreamView({
  liveData,
  elapsedTime,
  viewerCount,
  likesCount,
  showChat,
  onToggleChat,
  onEndClick,
  getLocalStream,
  onToggleMute,
  onToggleVideo,
}: LiveStreamViewProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-heading text-lg font-bold">{liveData.title}</h1>
            <p className="text-xs text-muted-foreground">{liveData.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
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

      {/* Video + Chat */}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className={showChat ? 'lg:col-span-3' : 'lg:col-span-4'}>
          <CloudflareStreamPlayer
            localStream={getLocalStream()}
            isOwner={true}
            onToggleMute={onToggleMute}
            onToggleVideo={onToggleVideo}
            onLeave={onEndClick}
            viewerCount={viewerCount || liveData.viewerCount}
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
