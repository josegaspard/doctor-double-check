import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';

interface ChatMessage {
  id: string;
  userName: string;
  content: string;
  elapsedSeconds: number;
  isPaid: boolean;
  highlightUntil: string | null;
}

interface RecordingChatReplayProps {
  /** The live_id associated with this recording */
  liveId: string;
}

export function RecordingChatReplay({ liveId }: RecordingChatReplayProps) {
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  // Stable per-replay watermark sessionId for the optional video preview
  const previewSessionId = useMemo(
    () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `replay-${liveId}-${Math.random().toString(36).slice(2, 10)}`),
    [liveId]
  );

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('id, user_name, content, elapsed_seconds, is_paid, highlight_until')
        .eq('live_id', liveId)
        .order('elapsed_seconds', { ascending: true });

      if (data) {
        setAllMessages(data.map(m => ({
          id: m.id,
          userName: m.user_name,
          content: m.content,
          elapsedSeconds: m.elapsed_seconds,
          isPaid: m.is_paid || false,
          highlightUntil: m.highlight_until,
        })));
      }
      setIsLoading(false);
    };
    load();
  }, [liveId]);

  // Show all messages immediately
  const visibleMessages = allMessages;

  useEffect(() => {
    const viewport = bottomRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [visibleMessages.length]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-4 text-center text-muted-foreground text-sm">
        Cargando chat...
      </div>
    );
  }

  if (allMessages.length === 0) {
    return null; // Don't render anything if no chat was recorded
  }

  return (
    <div className="flex flex-col h-[400px] bg-card rounded-lg border overflow-hidden">
      <div className="p-2 sm:p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="font-medium text-xs sm:text-sm">Chat de la transmisión</span>
        </div>
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {visibleMessages.length}/{allMessages.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 h-full min-h-0 p-2 sm:p-3">
        <div className="space-y-2">
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 rounded-lg px-1.5 py-1 ${
                msg.isPaid
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : ''
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.isPaid ? 'bg-amber-500/20' : 'bg-primary/10'
              }`}>
                <User className={`w-2.5 h-2.5 ${msg.isPaid ? 'text-amber-600' : 'text-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className={`font-medium text-[10px] sm:text-xs truncate max-w-[120px] ${
                    msg.isPaid ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                  }`}>
                    {msg.userName}
                  </span>
                  {msg.isPaid && (
                    <Badge variant="outline" className="h-3.5 px-1 text-[8px] border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                      ⭐ Destacado
                    </Badge>
                  )}
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatTime(msg.elapsedSeconds)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground/90 break-words">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
