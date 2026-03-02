import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Lock } from 'lucide-react';
import { ChatFileUpload } from '@/components/chat/ChatFileUpload';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { EmptyState } from '@/components/chat/EmptyState';
import { CallWaitingBanner } from '@/components/videocall/CallWaitingBanner';
import { ChatSession } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  content: string;
  createdAt: Date;
  isRead: boolean;
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
  onSend: () => void;
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
  const [activeVideoRoom, setActiveVideoRoom] = useState<boolean>(false);
  const { t } = useLanguage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-gradient-to-b from-blue-50/50 to-sky-50/30 dark:from-primary/[0.06] dark:to-secondary/[0.04] w-full max-w-full ${hidden ? 'hidden md:flex' : 'flex'}`}>
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

          <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden bg-gradient-to-b from-sky-100/60 via-blue-50/40 to-sky-100/50 dark:from-primary/15 dark:via-secondary/10 dark:to-primary/15">
            {/* Active video call banner */}
            {activeVideoRoom && !isClosed && userRole === 'patient' && consultationId && (
              <CallWaitingBanner
                doctorName={getDisplayInfo(session).name}
                consultationId={consultationId}
              />
            )}
            <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4 py-4">
              <div className="space-y-3">
                {messages.map(msg => (
                  <ChatMessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === userId}
                    isSessionClosed={isClosed}
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
              <div className="p-3 sm:p-4 border-t bg-muted/30 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <p className="text-sm">{t('chat.sessionClosed')}</p>
                </div>
              </div>
            ) : (
              <div className="p-2 sm:p-4 border-t bg-card flex-shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                <div className="flex gap-2 items-center">
                  <ChatFileUpload
                    sessionId={session.id}
                    onFileUploaded={onFileUploaded}
                  />
                  <Input
                    placeholder={t('chat.writeMessage')}
                    value={newMessage}
                    onChange={onInputChange}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
                    className="flex-1 h-10 sm:h-11 bg-muted/50 border-0 focus-visible:ring-1"
                  />
                  <Button
                    onClick={onSend}
                    size="icon"
                    disabled={!newMessage.trim()}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </>
      ) : (
        <EmptyState type="no-selection" activeTab={activeTab} />
      )}
    </Card>
  );
}
