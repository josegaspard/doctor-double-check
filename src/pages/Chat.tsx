import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat, ChatSession } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatFileUpload } from '@/components/chat/ChatFileUpload';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatSessionItem } from '@/components/chat/ChatSessionItem';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { EmptyState } from '@/components/chat/EmptyState';
import { 
  MessageSquare, 
  Send, 
  History,
  Lock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getSessionsByUser, getSessionMessages, sendMessage, markAsRead, loadMessages, closeSession, createSession, refreshSessions } = useChat();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isClosingSession, setIsClosingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const allSessions = getSessionsByUser();
  const activeSessions = allSessions.filter(s => s.status === 'active');
  const closedSessions = allSessions.filter(s => s.status === 'closed');
  const messages = selectedSession ? getSessionMessages(selectedSession) : [];

  const getDoctorIdForSession = (session: ChatSession): string | null => {
    if (session.participant1Type === 'doctor') return session.participant1Id;
    if (session.participant2Type === 'doctor') return session.participant2Id;
    return null;
  };

  const goToDoctorProfile = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    e.preventDefault();
    const doctorId = getDoctorIdForSession(session);
    if (!doctorId) return;
    navigate(`/doctor/${doctorId}`);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  };

  // Handle consultation success from payment redirect
  useEffect(() => {
    const consultationStatus = searchParams.get('consultation');
    const doctorId = searchParams.get('doctor');
    
    if (consultationStatus === 'success' && doctorId && user?.id && role === 'patient' && !isCreatingSession) {
      setSearchParams({});
      setIsCreatingSession(true);
      
      const initSession = async () => {
        try {
          await refreshSessions();
          const existingSession = allSessions.find(s => 
            (s.participant1Id === doctorId || s.participant2Id === doctorId) && 
            s.status === 'active'
          );
          
          if (existingSession) {
            setSelectedSession(existingSession.id);
            toast.success('Orientación lista - puedes comenzar a chatear');
          } else {
            const result = await createSession(doctorId, 'doctor', false);
            
            if (result.success && result.session) {
              try {
                await supabase.functions.invoke('notify-new-chat', {
                  body: {
                    doctorId: doctorId,
                    patientName: user.name,
                    sessionId: result.session.id,
                    isDoubleCheck: false,
                  },
                });
              } catch (e) {
                console.error('Error notifying doctor:', e);
              }
              
              setSelectedSession(result.session.id);
              toast.success('¡Pago exitoso! Ya puedes chatear con tu médico');
            } else {
              toast.error(result.error || 'Error al crear sesión de chat');
            }
          }
        } catch (error) {
          console.error('Error creating session after payment:', error);
          toast.error('Error al iniciar el chat');
        } finally {
          setIsCreatingSession(false);
        }
      };
      
      initSession();
    }
  }, [searchParams, user?.id, role]);

  const selectedSessionData = allSessions.find(s => s.id === selectedSession);
  const isSessionClosed = selectedSessionData?.status === 'closed';

  // Subscribe to typing indicators
  useEffect(() => {
    if (!selectedSession || !user?.id || isSessionClosed) return;

    const channel = supabase.channel(`typing:${selectedSession}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setOtherUserTyping(payload.payload.userName);
          setTimeout(() => setOtherUserTyping(null), 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession, user?.id, isSessionClosed]);

  const broadcastTyping = useCallback(() => {
    if (!selectedSession || !user || isSessionClosed) return;
    supabase.channel(`typing:${selectedSession}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name || 'Usuario' }
      });
  }, [selectedSession, user, isSessionClosed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && !isSessionClosed) {
      setIsTyping(true);
      broadcastTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
      markAsRead(selectedSession);
    }
  }, [selectedSession, loadMessages, markAsRead]);

  useEffect(() => {
    setSelectedSession(null);
  }, [activeTab]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedSession || isSessionClosed) return;
    await sendMessage(selectedSession, newMessage.trim());
    setNewMessage('');
    setIsTyping(false);
  };

  const handleCloseSession = async () => {
    if (!selectedSession) return;
    
    setIsClosingSession(true);
    const result = await closeSession(selectedSession);
    setIsClosingSession(false);

    if (result.success) {
      toast.success('Orientación cerrada exitosamente');
      setSelectedSession(null);
      setActiveTab('history');
    } else {
      toast.error(result.error || 'Error al cerrar la orientación');
    }
  };

  const handleFileUploaded = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!selectedSession || isSessionClosed) return;
    
    const fileMessage = fileType.startsWith('image/') 
      ? `📷 [Imagen: ${fileName}]\n${fileUrl}`
      : `📎 [Archivo: ${fileName}]\n${fileUrl}`;
    
    await sendMessage(selectedSession, fileMessage);
  };

  const getSessionDisplayInfo = (session: ChatSession) => {
    if (role === 'patient') {
      return {
        name: session.participant2Name || 'Médico',
        specialty: session.participant2Specialty,
        avatar: session.participant2Avatar,
        type: session.participant2Type,
      };
    }
    return {
      name: session.participant1Name || 'Paciente',
      specialty: session.participant1Specialty,
      avatar: session.participant1Avatar,
      type: session.participant1Type,
    };
  };

  const formatOfficeHours = (session: ChatSession) => {
    if (!session.officeHoursStart || !session.officeHoursEnd) return null;
    
    const startHour = session.officeHoursStart.slice(0, 5);
    const endHour = session.officeHoursEnd.slice(0, 5);
    
    const dayNames: Record<string, string> = {
      monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
      thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
    };
    
    const days = session.officeDays?.map(d => dayNames[d] || d).join(', ') || 'Lun-Vie';
    return `${startHour} - ${endHour} | ${days}`;
  };

  const isWithinOfficeHours = (session: ChatSession) => {
    if (!session.officeHoursStart || !session.officeHoursEnd) return true;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    
    if (session.officeDays && !session.officeDays.includes(currentDay)) {
      return false;
    }
    
    const startParts = session.officeHoursStart.split(':');
    const endParts = session.officeHoursEnd.split(':');
    
    const startHour = parseInt(startParts[0]);
    const endHour = parseInt(endParts[0]);
    
    const currentTime = currentHour * 60 + currentMinute;
    const startTime = startHour * 60;
    const endTime = endHour * 60;
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  // Show loading
  if (role === undefined || role === null) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando...</p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Block unauthorized
  if (role !== 'patient' && role !== 'doctor') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Chat 1:1</h2>
            <p className="text-muted-foreground mb-6">
              {role === 'visitor' 
                ? 'Inicia sesión para acceder al chat con médicos.'
                : 'El chat está disponible solo para pacientes y médicos.'}
            </p>
            <Button onClick={() => navigate(role === 'visitor' ? '/login' : '/lives')}>
              {role === 'visitor' ? 'Iniciar Sesión' : 'Ir a Lives'}
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Check entitlement
  const hasEntitlement = role === 'doctor' || 
    user?.entitlements?.some(e => e.type === 'chat' && e.isActive) ||
    activeSessions.length > 0 ||
    isCreatingSession;

  if (role === 'patient' && !hasEntitlement) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-premium/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-premium" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Activa el Chat 1:1</h2>
            <p className="text-muted-foreground mb-6">
              El chat con médicos es un servicio premium. Adquiere el servicio para comunicarte directamente con profesionales de la salud.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/wallet')}>Ver Opciones</Button>
              <Button variant="outline" onClick={() => navigate('/lives')}>Ir a Lives</Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Mobile: show only list or chat
  const showMobileChat = isMobile && selectedSession;
  const showMobileList = isMobile && !selectedSession;

  return (
    <MainLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-6xl flex flex-col h-[calc(100vh-theme(spacing.14)-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.14)-theme(spacing.24))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0 px-2 sm:px-0">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <span>Chat 1:1</span>
          </h1>
          
          {/* Stats */}
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {activeSessions.length} activa{activeSessions.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-[340px,1fr] gap-3 sm:gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Sessions List */}
          <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-gradient-to-b from-primary/[0.03] to-transparent ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
            <CardHeader className="pb-3 pt-4 px-3 flex-shrink-0 space-y-3">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'history')} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-11">
                  <TabsTrigger value="active" className="gap-1.5 data-[state=active]:shadow-sm">
                    <MessageSquare className="w-4 h-4" />
                    <span>Activas</span>
                    {activeSessions.length > 0 && (
                      <Badge className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                        {activeSessions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5 data-[state=active]:shadow-sm">
                    <History className="w-4 h-4" />
                    <span>Historial</span>
                    {closedSessions.length > 0 && (
                      <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                        {closedSessions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent className="p-2 flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1 pr-2">
                  {activeTab === 'active' ? (
                    activeSessions.length > 0 ? (
                      activeSessions.map(session => {
                        const displayInfo = getSessionDisplayInfo(session);
                        const officeHours = formatOfficeHours(session);
                        const isAvailable = isWithinOfficeHours(session);
                        const canOpenDoctorProfile = role === 'patient' && getDoctorIdForSession(session) !== null;
                        
                        return (
                          <ChatSessionItem
                            key={session.id}
                            session={session}
                            isSelected={selectedSession === session.id}
                            displayInfo={displayInfo}
                            officeHours={officeHours}
                            isAvailable={isAvailable}
                            canOpenDoctorProfile={canOpenDoctorProfile}
                            userRole={role}
                            onClick={() => setSelectedSession(session.id)}
                            onDoctorProfileClick={(e) => goToDoctorProfile(e, session)}
                          />
                        );
                      })
                    ) : (
                      <EmptyState type="no-sessions" activeTab="active" />
                    )
                  ) : (
                    closedSessions.length > 0 ? (
                      closedSessions.map(session => {
                        const displayInfo = getSessionDisplayInfo(session);
                        const officeHours = formatOfficeHours(session);
                        const isAvailable = isWithinOfficeHours(session);
                        const canOpenDoctorProfile = role === 'patient' && getDoctorIdForSession(session) !== null;
                        
                        return (
                          <ChatSessionItem
                            key={session.id}
                            session={session}
                            isSelected={selectedSession === session.id}
                            displayInfo={displayInfo}
                            officeHours={officeHours}
                            isAvailable={isAvailable}
                            canOpenDoctorProfile={canOpenDoctorProfile}
                            userRole={role}
                            onClick={() => setSelectedSession(session.id)}
                            onDoctorProfileClick={(e) => goToDoctorProfile(e, session)}
                          />
                        );
                      })
                    ) : (
                      <EmptyState type="no-sessions" activeTab="history" />
                    )
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages Panel */}
          <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-gradient-to-b from-primary/[0.02] to-secondary/[0.02] ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
            {selectedSession && selectedSessionData ? (
              <>
                <ChatHeader
                  session={selectedSessionData}
                  displayInfo={getSessionDisplayInfo(selectedSessionData)}
                  officeHours={formatOfficeHours(selectedSessionData)}
                  isAvailable={isWithinOfficeHours(selectedSessionData)}
                  isClosed={isSessionClosed || false}
                  isClosing={isClosingSession}
                  userRole={role}
                  canOpenDoctorProfile={role === 'patient' && getDoctorIdForSession(selectedSessionData) !== null}
                  onDoctorProfileClick={(e) => goToDoctorProfile(e, selectedSessionData)}
                  onCloseSession={handleCloseSession}
                  onBack={isMobile ? () => setSelectedSession(null) : undefined}
                />
                
                <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden bg-gradient-to-b from-primary/5 via-secondary/3 to-primary/5">
                  <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4 py-4">
                    <div className="space-y-3">
                      {messages.map(msg => (
                        <ChatMessageBubble
                          key={msg.id}
                          message={msg}
                          isOwn={msg.senderId === user?.id}
                          isSessionClosed={isSessionClosed || false}
                        />
                      ))}
                      
                      {otherUserTyping && !isSessionClosed && (
                        <div className="flex justify-start">
                          <TypingIndicator userName={otherUserTyping} />
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Input area */}
                  {isSessionClosed ? (
                    <div className="p-4 border-t bg-muted/30 flex-shrink-0">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                        <p className="text-sm">Esta orientación ha sido cerrada</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 border-t bg-card flex-shrink-0">
                      <div className="flex gap-2 items-center">
                        <ChatFileUpload 
                          sessionId={selectedSession} 
                          onFileUploaded={handleFileUploaded}
                        />
                        <Input
                          placeholder="Escribe un mensaje..."
                          value={newMessage}
                          onChange={handleInputChange}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                          className="flex-1 h-11 bg-muted/50 border-0 focus-visible:ring-1"
                        />
                        <Button 
                          onClick={handleSend} 
                          size="icon" 
                          disabled={!newMessage.trim()} 
                          className="h-11 w-11 rounded-xl flex-shrink-0"
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
        </div>
      </div>
    </MainLayout>
  );
}
