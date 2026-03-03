import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, User, LogIn } from 'lucide-react';

interface LiveChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  elapsedSeconds: number;
}

interface LiveChatProps {
  liveId: string;
  isOwner?: boolean;
  liveStartedAt?: Date;
}

export function LiveChat({ liveId, isOwner = false, liveStartedAt }: LiveChatProps) {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing persisted messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('live_id', liveId)
        .order('elapsed_seconds', { ascending: true });

      if (data && data.length > 0) {
        setMessages(data.map(m => ({
          id: m.id,
          userId: m.user_id,
          userName: m.user_name,
          content: m.content,
          createdAt: new Date(m.created_at),
          elapsedSeconds: m.elapsed_seconds,
        })));
      }
    };
    loadMessages();
  }, [liveId]);

  // Subscribe to new messages via realtime
  useEffect(() => {
    const channel = supabase
      .channel(`live-chat-db-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `live_id=eq.${liveId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => {
            if (prev.some(p => p.id === m.id)) return prev;
            return [...prev, {
              id: m.id,
              userId: m.user_id,
              userName: m.user_name,
              content: m.content,
              createdAt: new Date(m.created_at),
              elapsedSeconds: m.elapsed_seconds,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      const elapsed = liveStartedAt
        ? Math.max(0, Math.floor((Date.now() - liveStartedAt.getTime()) / 1000))
        : 0;

      const msgId = crypto.randomUUID();

      const message: LiveChatMessage = {
        id: msgId,
        userId: user.id,
        userName: user.name || 'Usuario',
        content: newMessage.trim(),
        createdAt: new Date(),
        elapsedSeconds: elapsed,
      };

      setMessages((prev) => [...prev, message]);
      setNewMessage('');

      await supabase.from('live_chat_messages').insert({
        id: msgId,
        live_id: liveId,
        user_id: user.id,
        user_name: user.name || 'Usuario',
        content: newMessage.trim(),
        elapsed_seconds: elapsed,
      });
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
          <span className="font-medium text-xs sm:text-sm">{t('livePlayer.liveChat')}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {messages.length} {t('livePlayer.messages')}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-2 sm:p-3">
        <div className="space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
              {t('livePlayer.firstMessage')}
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
          <div className="text-center py-2 sm:py-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">
              {t('livePlayer.loginToChat')}
            </p>
            <Link to="/login">
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs min-w-[44px]">
                <LogIn className="w-3 h-3" />
                {t('livePlayer.loginButton')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-1 sm:gap-2">
            <Input
              placeholder={t('livePlayer.writeMessage')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSend(); } }}
              disabled={isSending}
              className="text-xs sm:text-sm"
              maxLength={500}
            />
            <Button 
              size="icon" 
              onClick={handleSend} 
              disabled={isSending || !newMessage.trim()}
              className="flex-shrink-0 h-9 w-9 min-w-[44px]"
            >
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}