import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User } from 'lucide-react';

interface ChatMessage {
  id: string;
  userName: string;
  content: string;
  elapsedSeconds: number;
}

interface RecordingChatReplayProps {
  /** The live_id associated with this recording */
  liveId: string;
}

export function RecordingChatReplay({ liveId }: RecordingChatReplayProps) {
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('id, user_name, content, elapsed_seconds')
        .eq('live_id', liveId)
        .order('elapsed_seconds', { ascending: true });

      if (data) {
        setAllMessages(data.map(m => ({
          id: m.id,
          userName: m.user_name,
          content: m.content,
          elapsedSeconds: m.elapsed_seconds,
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
    <div className="flex flex-col bg-card rounded-lg border overflow-hidden" style={{ maxHeight: 400 }}>
      <div className="p-2 sm:p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="font-medium text-xs sm:text-sm">Chat de la transmisión</span>
        </div>
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {visibleMessages.length}/{allMessages.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0 p-2 sm:p-3">
        <div className="space-y-2">
          {visibleMessages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-2.5 h-2.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="font-medium text-[10px] sm:text-xs text-foreground truncate max-w-[120px]">
                    {msg.userName}
                  </span>
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
