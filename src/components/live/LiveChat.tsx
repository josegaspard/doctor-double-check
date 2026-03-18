import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Send, MessageSquare, User, LogIn, Stethoscope, AlertCircle, Sparkles, Loader2, Wallet, CreditCard, Coins, Pin, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface PaidNotification {
  id: string;
  userName: string;
  amount: number;
}

interface LiveChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  elapsedSeconds: number;
  isDoctor?: boolean;
  isPaid?: boolean;
  highlightUntil?: Date;
}

interface LiveChatProps {
  liveId: string;
  isOwner?: boolean;
  liveStartedAt?: Date;
}

export function LiveChat({ liveId, isOwner = false, liveStartedAt }: LiveChatProps) {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { balance, refreshWallet } = useWallet();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatMode, setChatMode] = useState<string>('free');
  const [chatPrice, setChatPrice] = useState<number>(0);
  const [chatHighlightSeconds, setChatHighlightSeconds] = useState<number>(120);
  const [maxQuestions, setMaxQuestions] = useState<number | null>(null);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [doctorIds, setDoctorIds] = useState<Set<string>>(new Set());
  const [wantHighlight, setWantHighlight] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [paidNotifications, setPaidNotifications] = useState<PaidNotification[]>([]);

  const showPaidNotification = useCallback((userName: string, amount: number) => {
    const id = crypto.randomUUID();
    setPaidNotifications(prev => [...prev, { id, userName, amount }]);
    setTimeout(() => {
      setPaidNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  }, []);

  // Restore draft from sessionStorage (after Stripe redirect)
  useEffect(() => {
    const draft = sessionStorage.getItem(`chat_draft_${liveId}`);
    if (draft) {
      setNewMessage(draft);
      sessionStorage.removeItem(`chat_draft_${liveId}`);
    }
  }, [liveId]);

  // Fetch live interaction settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('lives')
        .select('chat_enabled, max_questions, questions_count, chat_mode, chat_price, chat_highlight_seconds')
        .eq('id', liveId)
        .single();
      if (data) {
        setChatEnabled(data.chat_enabled);
        setMaxQuestions(data.max_questions);
        setQuestionsCount(data.questions_count);
        setChatMode((data as any).chat_mode || 'free');
        setChatPrice(Number((data as any).chat_price) || 0);
        setChatHighlightSeconds(Number((data as any).chat_highlight_seconds) || 120);
      }
    };
    fetchSettings();

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
        setChatMode(d.chat_mode || 'free');
        setChatPrice(Number(d.chat_price) || 0);
        setChatHighlightSeconds(Number(d.chat_highlight_seconds) || 120);
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
          isPaid: m.is_paid || false,
          highlightUntil: m.highlight_until ? new Date(m.highlight_until) : undefined,
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
          const isPaidMsg = m.is_paid || false;
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
              isPaid: isPaidMsg,
              highlightUntil: m.highlight_until ? new Date(m.highlight_until) : undefined,
            }];
          });

          // Show notification to doctor when someone pays for a highlighted message
          if (isPaidMsg && isOwner && m.user_id !== user?.id) {
            showPaidNotification(m.user_name, chatPrice);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId, doctorIds, isOwner, user?.id, chatPrice, showPaidNotification]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleToggleChat = async () => {
    const newValue = !chatEnabled;
    setChatEnabled(newValue);
    await supabase.from('lives').update({ chat_enabled: newValue }).eq('id', liveId);
  };

  const processWalletPayment = async (): Promise<boolean> => {
    if (!user) return false;
    if (balance < chatPrice) {
      toast.error(`Saldo insuficiente. Necesitas $${chatPrice} MXN`);
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('process_wallet_purchase', {
        p_amount: chatPrice,
        p_description: `Chat destacado en live`,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in (data as any)) {
        throw new Error((data as any).error);
      }
      await refreshWallet();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el pago');
      return false;
    }
  };

  const processStripePayment = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      // Save draft so it's visible when the user returns from Stripe
      sessionStorage.setItem(`chat_draft_${liveId}`, newMessage.trim());

      const { data, error } = await supabase.functions.invoke('create-chat-checkout', {
        body: {
          liveId,
          amount: chatPrice,
          messageContent: newMessage.trim(),
          userName: user.name || 'Usuario',
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return false; // Redirect to Stripe — webhook handles message creation
      }
      throw new Error('No checkout URL');
    } catch (err: any) {
      sessionStorage.removeItem(`chat_draft_${liveId}`);
      toast.error(err.message || 'Error al crear el pago');
      return false;
    }
  };

  const handlePayAndSend = async (method: 'wallet' | 'stripe') => {
    setShowPaymentPicker(false);
    setIsProcessingPayment(true);

    let paid = false;
    if (method === 'wallet') {
      paid = await processWalletPayment();
    } else {
      paid = await processStripePayment();
    }
    setIsProcessingPayment(false);

    if (paid) {
      await sendMessage(true);
    }
  };

  const sendMessage = async (isPaidMsg: boolean) => {
    if (!newMessage.trim() || !user) return;

    setIsSending(true);
    try {
      const elapsed = liveStartedAt
        ? Math.max(0, Math.floor((Date.now() - liveStartedAt.getTime()) / 1000))
        : 0;

      const msgId = crypto.randomUUID();
      const highlightUntil = isPaidMsg ? new Date(Date.now() + chatHighlightSeconds * 1000) : undefined;

      const message: LiveChatMessage = {
        id: msgId,
        userId: user.id,
        userName: user.name || 'Usuario',
        content: newMessage.trim(),
        createdAt: new Date(),
        elapsedSeconds: elapsed,
        isDoctor: role === 'doctor',
        isPaid: isPaidMsg,
        highlightUntil,
      };

      setMessages((prev) => [...prev, message]);
      const contentToSend = newMessage.trim();
      setNewMessage('');
      setWantHighlight(false);

      await supabase.from('live_chat_messages').insert({
        id: msgId,
        live_id: liveId,
        user_id: user.id,
        user_name: user.name || 'Usuario',
        content: contentToSend,
        elapsed_seconds: elapsed,
        is_paid: isPaidMsg,
        highlight_until: highlightUntil?.toISOString() || null,
      });

      // Increment questions count
      if (!isOwner) {
        await supabase
          .from('lives')
          .update({ questions_count: questionsCount + 1 })
          .eq('id', liveId);
        setQuestionsCount(prev => prev + 1);
      }

      if (isPaidMsg) {
        toast.success(`Mensaje destacado enviado (-$${chatPrice})`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    const needsPayment = !isOwner && (chatMode === 'paid_only' || (chatMode === 'mixed' && wantHighlight));

    if (needsPayment && chatPrice > 0) {
      setShowPaymentPicker(true);
      return;
    }

    await sendMessage(false);
  };

  const isDisabled = role === 'visitor' || !user;
  const questionLimitReached = !isOwner && maxQuestions != null && questionsCount >= maxQuestions;
  const chatDisabledForViewers = !isOwner && !chatEnabled;
  const isPaidOnly = !isOwner && chatMode === 'paid_only';
  const isMixed = !isOwner && chatMode === 'mixed';

  const isHighlighted = (msg: LiveChatMessage) => {
    if (!msg.isPaid) return false;
    if (msg.highlightUntil && new Date() > msg.highlightUntil) return false;
    return true;
  };

  const highlightDurationLabel = chatHighlightSeconds >= 60
    ? `${Math.round(chatHighlightSeconds / 60)} min`
    : `${chatHighlightSeconds}s`;

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-card rounded-lg border overflow-hidden relative">
      {/* Paid chat notification bubbles for doctor */}
      <AnimatePresence>
        {paidNotifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-12 right-2 z-50 max-w-[220px]"
          >
            <div className="bg-warning/15 border border-warning/40 rounded-xl px-3 py-2.5 shadow-lg backdrop-blur-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Coins className="w-4 h-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {notif.userName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Chat destacado · <span className="font-medium text-warning">${notif.amount}</span>
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

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

      {/* Chat mode banner for viewers */}
      {(isPaidOnly || isMixed) && chatPrice > 0 && !isDisabled && (
        <div className="px-2 py-1.5 border-b bg-accent/30 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">
            {isPaidOnly
              ? `Chat de pago: $${chatPrice} MXN · Destacado ${highlightDurationLabel}`
              : `Destaca tu mensaje por $${chatPrice} MXN · ${highlightDurationLabel}`}
          </span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 p-2 sm:p-3">
        <div className="space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
              {t('livePlayer.firstMessage')}
            </div>
          ) : (
            messages.map((msg) => {
              const highlighted = isHighlighted(msg);
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 rounded-lg transition-colors ${
                    highlighted
                      ? 'bg-primary/8 border border-primary/20 p-1.5 -mx-1'
                      : ''
                  }`}
                >
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.isDoctor ? 'bg-primary/20' : highlighted ? 'bg-primary/15' : 'bg-primary/10'
                  }`}>
                    {msg.isDoctor ? (
                      <Stethoscope className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                    ) : highlighted ? (
                      <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
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
                      {highlighted && !msg.isDoctor && (
                        <Badge className="text-[8px] px-1 py-0 h-3.5 bg-primary/10 text-primary border-0">
                          ✨ Destacado
                        </Badge>
                      )}
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                        {msg.createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-xs sm:text-sm break-words ${
                      highlighted ? 'text-foreground font-medium' : 'text-foreground/90'
                    }`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })
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
        ) : showPaymentPicker ? (
          /* Payment method picker */
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Elige cómo pagar <strong>${chatPrice} MXN</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-12 flex-col gap-1 text-xs"
                onClick={() => handlePayAndSend('wallet')}
                disabled={isProcessingPayment || balance < chatPrice}
              >
                {isProcessingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Billetera (${balance.toFixed(0)})</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-12 flex-col gap-1 text-xs"
                onClick={() => handlePayAndSend('stripe')}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Tarjeta</span>
                  </>
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[10px]"
              onClick={() => setShowPaymentPicker(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Highlight toggle for mixed mode */}
            {isMixed && chatPrice > 0 && (
              <label className="flex items-center gap-2 cursor-pointer px-1">
                <Switch checked={wantHighlight} onCheckedChange={setWantHighlight} className="scale-75" />
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Destacar por ${chatPrice} · {highlightDurationLabel}
                </span>
              </label>
            )}
            <div className="flex gap-1 sm:gap-2">
              <Input
                placeholder={
                  isPaidOnly && chatPrice > 0
                    ? `Enviar ($${chatPrice} MXN)...`
                    : t('livePlayer.writeMessage')
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSend(); } }}
                disabled={isSending || isProcessingPayment}
                className="text-xs sm:text-sm"
                maxLength={500}
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={isSending || isProcessingPayment || !newMessage.trim()}
                className="flex-shrink-0 h-9 w-9 min-w-[44px]"
              >
                {isProcessingPayment ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
