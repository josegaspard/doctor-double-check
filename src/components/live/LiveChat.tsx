import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Send, MessageSquare, User, LogIn, Stethoscope, AlertCircle } from 'lucide-react';

interface LiveChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  elapsedSeconds: number;
  isDoctor?: boolean;
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
  const [chatEnabled, setChatEnabled] = useState(true);
  const [maxQuestions, setMaxQuestions] = useState<number | null>(null);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [doctorIds, setDoctorIds] = useState<Set<string>>(new Set());

  // Fetch live interaction settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('lives')
        .select('chat_enabled, max_questions, questions_count')
        .eq('id', liveId)
        .single();
      if (data) {
        setChatEnabled(data.chat_enabled);
        setMaxQuestions(data.max_questions);
        setQuestionsCount(data.questions_count);
      }
    };
    fetchSettings();

    // Subscribe to live updates for real-time chat toggle
    const channel = supabase
      .channel(`live-chat-settings-${liveId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'lives',
        filter: `id=eq.${liveId}`,
      }, (payload) => {
        const d = payload.new as any;
        setChatEnabled(d.chat_enabled);
        setMaxQuestions(d.max_questions);
        setQuestionsCount(d.questions_count);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [liveId]);

  // Load existing persisted messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('live_id', liveId)
        .order('elapsed_seconds', { ascending: true });

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(m => m.user_id))];
        // Check which users are doctors
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds)
          .eq('role', 'doctor');
        const docIds = new Set((roles || []).map(r => r.user_id));
        setDoctorIds(docIds);

        setMessages(data.map(m => ({
          id: m.id,
          userId: m.user_id,
          userName: m.user_name,
          content: m.content,
          createdAt: new Date(m.created_at),
          elapsedSeconds: m.elapsed_seconds,
          isDoctor: docIds.has(m.user_id),
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
        async (payload) => {
          const m = payload.new as any;
          // Check if sender is doctor
          let isDoc = doctorIds.has(m.user_id);
          if (!isDoc) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', m.user_id)
              .eq('role', 'doctor')
              .maybeSingle();
            if (roleData) {
              isDoc = true;
              setDoctorIds(prev => new Set([...prev, m.user_id]));
            }
          }
          setMessages((prev) => {
            if (prev.some(p => p.id === m.id)) return prev;
            return [...prev, {
              id: m.id,
              userId: m.user_id,
              userName: m.user_name,
              content: m.content,
              createdAt: new Date(m.created_at),
              elapsedSeconds: m.elapsed_seconds,
              isDoctor: isDoc,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId, doctorIds]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleToggleChat = async () => {
    const newValue = !chatEnabled;
    setChatEnabled(newValue);
    await supabase.from('lives').update({ chat_enabled: newValue }).eq('id', liveId);
  };

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
        isDoctor: role === 'doctor',
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

      // Increment questions count
      if (!isOwner) {
        await supabase
          .from('lives')
          .update({ questions_count: questionsCount + 1 })
          .eq('id', liveId);
        setQuestionsCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = role === 'visitor' || !user;
  const questionLimitReached = !isOwner && maxQuestions != null && questionsCount >= maxQuestions;
  const chatDisabledForViewers = !isOwner && !chatEnabled;

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-2 sm:p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="font-medium text-xs sm:text-sm">{t('livePlayer.liveChat')}</span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Chat</span>
              <Switch checked={chatEnabled} onCheckedChange={handleToggleChat} className="scale-75" />
            </div>
          )}
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {messages.length} {t('livePlayer.messages')}
          </Badge>
        </div>
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
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.isDoctor ? 'bg-primary/20' : 'bg-primary/10'
                }`}>
                  {msg.isDoctor ? (
                    <Stethoscope className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                  ) : (
                    <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                    <span className={`font-medium text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-[150px] ${
                      msg.isDoctor ? 'text-primary' : 'text-foreground'
                    }`}>
                      {msg.isDoctor ? `Dr. ${msg.userName}` : msg.userName}
                    </span>
                    {msg.isDoctor && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-primary/30 text-primary">
                        Médico
                      </Badge>
                    )}
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
        ) : chatDisabledForViewers ? (
          <div className="flex items-center gap-2 justify-center py-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">El doctor ha desactivado el chat</span>
          </div>
        ) : questionLimitReached ? (
          <div className="flex items-center gap-2 justify-center py-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Se alcanzó el límite de preguntas</span>
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
