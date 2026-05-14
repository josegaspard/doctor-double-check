import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Lock, ShoppingCart, Loader2, Wallet, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { EmptyState } from '@/components/chat/EmptyState';
import { CallWaitingBanner } from '@/components/videocall/CallWaitingBanner';
import { ConsultationRefundBanner } from '@/components/chat/ConsultationRefundBanner';
import { ConsultationSummaryCard } from '@/components/chat/ConsultationSummaryCard';
import { ChatSession } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SessionDisplayInfo {
  name: string;
  specialty?: string;
  avatar?: string;
  type: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName?: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
}

interface Props {
  session: ChatSession | undefined;
  messages: ChatMessage[];
  userId?: string;
  userRole: string;
  newMessage: string;
  isClosed: boolean;
  isClosing: boolean;
  otherUserTyping: string | null;
  activeTab: 'active' | 'history';
  consultationId: string | null;
  isMobile: boolean;
  hidden?: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: (replyToId?: string) => void;
  onCloseSession: () => void;
  onBack?: () => void;
  onFileUploaded: (url: string, name: string, type: string) => void;
  getDoctorId: (session: ChatSession) => string | null;
  getDisplayInfo: (session: ChatSession) => SessionDisplayInfo;
  formatOfficeHours: (session: ChatSession) => string | null;
  isWithinOfficeHours: (session: ChatSession) => boolean;
  onDoctorProfileClick: (e: React.MouseEvent, session: ChatSession) => void;
}

export function ChatMessagesPanel({
  session,
  messages,
  userId,
  userRole,
  newMessage,
  isClosed,
  isClosing,
  otherUserTyping,
  activeTab,
  consultationId,
  isMobile,
  hidden = false,
  onInputChange,
  onSend,
  onCloseSession,
  onBack,
  onFileUploaded,
  getDoctorId,
  getDisplayInfo,
  formatOfficeHours,
  isWithinOfficeHours,
  onDoctorProfileClick,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [activeVideoRoom, setActiveVideoRoom] = useState<boolean>(false);
  const [hasChatEntitlement, setHasChatEntitlement] = useState<boolean>(true);
  const [entitlementChecked, setEntitlementChecked] = useState(false);
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProcessing, setPaywallProcessing] = useState(false);
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const { t } = useLanguage();
  const { user } = useAuth();
  const { balance, canAfford } = useWallet();

  const otherDoctorId = session
    ? session.participant1Id === userId
      ? session.participant2Type === 'doctor' ? session.participant2Id : null
      : session.participant1Type === 'doctor' ? session.participant1Id : null
    : null;

  // Check chat entitlement for patients chatting with doctors + fetch consultation fee
  useEffect(() => {
    if (!session || !userId || userRole !== 'patient') {
      setHasChatEntitlement(true);
      setEntitlementChecked(true);
      return;
    }
    const otherType = session.participant1Id === userId ? session.participant2Type : session.participant1Type;
    if (otherType !== 'doctor') {
      setHasChatEntitlement(true);
      setEntitlementChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const otherId = session.participant1Id === userId ? session.participant2Id : session.participant1Id;
      const [entRes, doctorRes] = await Promise.all([
        supabase
          .from('entitlements')
          .select('is_active, expires_at')
          .eq('user_id', userId)
          .eq('type', 'chat')
          .maybeSingle(),
        supabase
          .from('doctor_profiles')
          .select('consultation_fee')
          .eq('user_id', otherId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const data = entRes.data;
      const valid = !!data?.is_active && (!data.expires_at || new Date(data.expires_at) > new Date());
      setHasChatEntitlement(valid);
      setEntitlementChecked(true);
      setConsultationFee(Number(doctorRes.data?.consultation_fee) || 0);
    })();
    return () => { cancelled = true; };
  }, [session?.id, userId, userRole]);

  const refetchEntitlement = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('entitlements')
      .select('is_active, expires_at')
      .eq('user_id', userId)
      .eq('type', 'chat')
      .maybeSingle();
    const valid = !!data?.is_active && (!data.expires_at || new Date(data.expires_at) > new Date());
    setHasChatEntitlement(valid);
    return valid;
  };

  const handleWalletPurchase = async () => {
    if (!otherDoctorId || consultationFee <= 0) return;
    setPaywallProcessing(true);
    setPaywallError(null);
    try {
      const { data, error } = await supabase.rpc('process_consultation_purchase', {
        p_doctor_id: otherDoctorId,
        p_amount: consultationFee,
        p_patient_name: user?.name || 'Paciente',
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        setPaywallError(result?.error || 'No se pudo procesar el pago');
        return;
      }
      const ok = await refetchEntitlement();
      if (ok) {
        toast.success('Consulta activada');
        setPaywallOpen(false);
      }
    } catch (e: any) {
      setPaywallError(e?.message || 'Error inesperado');
    } finally {
      setPaywallProcessing(false);
    }
  };

  const handleStripePurchase = async () => {
    if (!otherDoctorId) return;
    setPaywallProcessing(true);
    setPaywallError(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-consultation-checkout', {
        body: { doctorId: otherDoctorId },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setPaywallError('No se pudo iniciar el checkout');
    } catch (e: any) {
      setPaywallError(e?.message || 'Error iniciando checkout');
    } finally {
      setPaywallProcessing(false);
    }
  };

  // Solo aplicar paywall si el doctor cobra consulta (fee > 0). Si la consulta
  // es gratis (fee === 0) el paciente puede chatear libremente sin entitlement.
  const isChatGated =
    userRole === 'patient' && entitlementChecked && !hasChatEntitlement && !!otherDoctorId && consultationFee > 0;

  const handleSendIntercept = () => {
    if (isChatGated) {
      setPaywallOpen(true);
      return;
    }
    onSend(replyTo?.id);
    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift+Enter = newline (allowed, never blocks)
    if (e.key === 'Enter' && e.shiftKey) return;

    // Enter, Ctrl+Enter, Cmd+Enter → attempt send / open paywall when gated
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendIntercept();
      return;
    }

    // Ctrl+K / Cmd+K → if gated, open paywall instead of any command palette behavior
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (isChatGated) {
        e.preventDefault();
        setPaywallOpen(true);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isChatGated) {
      e.preventDefault();
      setPaywallOpen(true);
    }
  };

  // Restore focus to chat input after paywall closes
  useEffect(() => {
    if (!paywallOpen) {
      // Defer to allow Dialog unmount/focus-trap teardown
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [paywallOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  // Check if there's an active video room for this consultation
  useEffect(() => {
    if (!consultationId || isClosed) {
      setActiveVideoRoom(false);
      return;
    }

    const checkVideoRoom = async () => {
      const { data } = await supabase
        .from('consultations')
        .select('video_room_name')
        .eq('id', consultationId)
        .single();

      if (data?.video_room_name) {
        // Verify the Daily room actually exists (not stale from a previous call)
        try {
          const { data: tokenData } = await supabase.functions.invoke('get-daily-token', {
            body: { roomName: data.video_room_name, isOwner: false },
          });
          if (tokenData?.success) {
            setActiveVideoRoom(true);
          } else {
            // Room is dead/stale — clear the field
            await supabase.from('consultations').update({
              video_room_name: null,
              video_room_url: null,
            }).eq('id', consultationId);
            setActiveVideoRoom(false);
          }
        } catch {
          setActiveVideoRoom(false);
        }
      } else {
        setActiveVideoRoom(false);
      }
    };

    checkVideoRoom();

    // Subscribe to changes on this consultation
    const channel = supabase
      .channel(`video-room-${consultationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultations',
          filter: `id=eq.${consultationId}`,
        },
        (payload: any) => {
          if (payload.new?.video_room_name) {
            // New room set — it's fresh, show banner immediately
            setActiveVideoRoom(true);
          } else {
            setActiveVideoRoom(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [consultationId, isClosed]);

  return (
    <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-card w-full max-w-full ${hidden ? 'hidden md:flex' : 'flex'}`}>
      {session ? (
        <>
          <ChatHeader
            session={session}
            displayInfo={getDisplayInfo(session)}
            officeHours={formatOfficeHours(session)}
            isAvailable={isWithinOfficeHours(session)}
            isClosed={isClosed}
            isClosing={isClosing}
            userRole={userRole}
            canOpenDoctorProfile={userRole === 'patient' && getDoctorId(session) !== null}
            onDoctorProfileClick={(e) => onDoctorProfileClick(e, session)}
            onCloseSession={onCloseSession}
            onBack={isMobile ? onBack : undefined}
            consultationId={consultationId}
          />

          <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden bg-card">
            {/* Active video call banner */}
            {activeVideoRoom && !isClosed && userRole === 'patient' && consultationId && (
              <CallWaitingBanner
                doctorName={getDisplayInfo(session).name}
                consultationId={consultationId}
              />
            )}

            {/* No-show refund banner — patient can refund after 24h without doctor reply */}
            {!isClosed && userRole === 'patient' && consultationId && getDoctorId(session) && (
              <ConsultationRefundBanner
                consultationId={consultationId}
                patientId={userId || ''}
                doctorId={getDoctorId(session) as string}
                currentUserId={userId}
                userRole={userRole}
                sessionCreatedAt={(session as any).createdAt || (session as any).created_at}
                messages={messages}
              />
            )}
            <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4 py-4">
              <div className="space-y-4">
                {messages.map(msg => (
                  <ChatMessageBubble
                    key={msg.id}
                    message={msg as any}
                    isOwn={msg.senderId === userId}
                    isSessionClosed={isClosed}
                    onReply={isClosed ? undefined : (m) => setReplyTo(m as any)}
                  />
                ))}
                {otherUserTyping && !isClosed && (
                  <div className="flex justify-start">
                    <TypingIndicator userName={otherUserTyping} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {isClosed ? (
              <div className="p-3 sm:p-4 border-t bg-muted/30 flex-shrink-0 space-y-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                {consultationId && <ConsultationSummaryCard consultationId={consultationId} />}
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <p className="text-sm">{t('chat.sessionClosed')}</p>
                </div>
              </div>
            ) : (
              <div className="p-2 sm:p-4 border-t bg-card flex-shrink-0 space-y-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                {/* Chat gate banner — patient without entitlement */}
                {userRole === 'patient' && entitlementChecked && !hasChatEntitlement && otherDoctorId && consultationFee > 0 && (
                  <button
                    type="button"
                    data-testid="chat-paywall-banner"
                    onClick={() => setPaywallOpen(true)}
                    className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 hover:bg-warning/15 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Lock className="w-4 h-4 text-warning flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {consultationFee > 0
                            ? `Necesitas una consulta activa — $${consultationFee.toLocaleString('es-MX')} MXN`
                            : 'Necesitas una consulta activa para enviar mensajes'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {consultationFee > 0
                            ? 'Acceso de 30 días tras la compra'
                            : 'Consulta el precio con el doctor'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1 flex-shrink-0">
                      <ShoppingCart className="w-3 h-3" />
                      {consultationFee > 0
                        ? `Comprar ($${consultationFee.toLocaleString('es-MX')})`
                        : 'Comprar'}
                    </Badge>
                  </button>
                )}

                {replyTo && (
                  <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/60 border-l-2 border-primary">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-primary">
                        Respondiendo a {replyTo.senderName || 'mensaje'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{replyTo.content.slice(0, 160)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancelar respuesta"
                      className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-muted"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    placeholder={
                      isChatGated
                        ? 'Compra una consulta para enviar mensajes'
                        : t('chat.writeMessage')
                    }
                    value={newMessage}
                    onChange={onInputChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onDrop={(e) => {
                      if (isChatGated) {
                        e.preventDefault();
                        setPaywallOpen(true);
                      }
                    }}
                    disabled={isChatGated}
                    aria-disabled={isChatGated}
                    data-testid="chat-input"
                    className="flex-1 h-12 text-base bg-muted/50 border-0 focus-visible:ring-1"
                  />
                  <Button
                    onClick={handleSendIntercept}
                    size="icon"
                    disabled={!newMessage.trim() || isChatGated}
                    data-testid="chat-send-button"
                    className="h-12 w-12 rounded-xl flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </>
      ) : (
        <EmptyState type="no-selection" activeTab={activeTab} />
      )}

      {/* Paywall Dialog — chat consultation purchase */}
      <Dialog open={paywallOpen} onOpenChange={(o) => !o && setPaywallOpen(false)}>
        <DialogContent className="sm:max-w-md" data-testid="chat-paywall-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Compra una consulta
            </DialogTitle>
            <DialogDescription>
              Activa tu chat con este doctor por 30 días.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-center py-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">Precio único</p>
              <p className="text-3xl font-bold text-foreground mt-1">
                ${consultationFee.toLocaleString()}{' '}
                <span className="text-sm font-normal text-muted-foreground">MXN</span>
              </p>
            </div>

            {paywallError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
                {paywallError}
              </div>
            )}

            <div className="space-y-2">
              <Button
                className="w-full h-11 gap-2"
                onClick={handleWalletPurchase}
                disabled={paywallProcessing || consultationFee <= 0 || !canAfford(consultationFee)}
                data-testid="chat-paywall-wallet"
              >
                {paywallProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4" />
                )}
                {canAfford(consultationFee)
                  ? `Pagar con Wallet — $${consultationFee.toFixed(0)} MXN`
                  : `Saldo insuficiente ($${balance.toLocaleString()})`}
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                onClick={handleStripePurchase}
                disabled={paywallProcessing || consultationFee <= 0}
                data-testid="chat-paywall-stripe"
              >
                <CreditCard className="w-4 h-4" />
                Pagar con Tarjeta
              </Button>
              {!canAfford(consultationFee) && (
                <Button
                  variant="ghost"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setPaywallOpen(false);
                    navigate('/wallet');
                  }}
                >
                  Recargar Wallet
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaywallOpen(false)} className="w-full">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
