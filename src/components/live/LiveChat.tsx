import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, User } from 'lucide-react';

interface LiveChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

interface LiveChatProps {
  liveId: string;
  isOwner?: boolean;
}

export function LiveChat({ liveId, isOwner = false }: LiveChatProps) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to live chat messages via realtime
  useEffect(() => {
    // For now, use a simple in-memory chat since we don't have a live_messages table
    // This could be extended to use Supabase Realtime with a dedicated table
    
    const channel = supabase
      .channel(`live-chat-${liveId}`)
      .on('broadcast', { event: 'message' }, (payload) => {
        const msg = payload.payload as LiveChatMessage;
        setMessages((prev) => [...prev, { ...msg, createdAt: new Date(msg.createdAt) }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      const message: LiveChatMessage = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name || 'Usuario',
        content: newMessage.trim(),
        createdAt: new Date(),
      };

      // Broadcast to all subscribers
      await supabase.channel(`live-chat-${liveId}`).send({
        type: 'broadcast',
        event: 'message',
        payload: message,
      });

      // Add to local state
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = role === 'visitor' || !user;

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-2 sm:p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="font-medium text-xs sm:text-sm">Chat en vivo</span>
        </div>
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {messages.length} mensajes
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-2 sm:p-3">
        <div className="space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
              Sé el primero en enviar un mensaje
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                    <span className="font-medium text-[10px] sm:text-xs text-foreground truncate max-w-[100px] sm:max-w-[150px]">
                      {msg.userName}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {msg.createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 sm:p-3 border-t flex-shrink-0">
        {isDisabled ? (
          <div className="text-center text-[10px] sm:text-xs text-muted-foreground py-1 sm:py-2">
            Inicia sesión para participar en el chat
          </div>
        ) : (
          <div className="flex gap-1 sm:gap-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
              className="text-xs sm:text-sm"
              maxLength={500}
            />
            <Button 
              size="icon" 
              onClick={handleSend} 
              disabled={isSending || !newMessage.trim()}
              className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9"
            >
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
