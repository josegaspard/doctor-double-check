import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat, ChatSession } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatFileUpload } from '@/components/chat/ChatFileUpload';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  MessageSquare, 
  Send, 
  User, 
  Stethoscope, 
  FileText, 
  Image, 
  History,
  CheckCheck,
  Lock,
  Clock,
  XCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Chat() {
  const navigate = useNavigate();
  const { getSessionsByUser, getSessionMessages, sendMessage, markAsRead, loadMessages, closeSession } = useChat();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isClosingSession, setIsClosingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateLocale = language === 'es' ? es : enUS;

  const allSessions = getSessionsByUser();
  const activeSessions = allSessions.filter(s => s.status === 'active');
  const closedSessions = allSessions.filter(s => s.status === 'closed');
  const messages = selectedSession ? getSessionMessages(selectedSession) : [];

  // Get the selected session data
  const selectedSessionData = allSessions.find(s => s.id === selectedSession);
  const isSessionClosed = selectedSessionData?.status === 'closed';

  // Get the other participant's name for the selected session
  const otherUserName = selectedSessionData 
    ? (role === 'patient' ? selectedSessionData.participant2Name : selectedSessionData.participant1Name)
    : null;

  // Subscribe to typing indicators via Supabase Realtime
  useEffect(() => {
    if (!selectedSession || !user?.id || isSessionClosed) return;

    const channel = supabase.channel(`typing:${selectedSession}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setOtherUserTyping(payload.payload.userName);
          // Clear after 3 seconds
          setTimeout(() => setOtherUserTyping(null), 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession, user?.id, isSessionClosed]);

  // Broadcast typing status
  const broadcastTyping = useCallback(() => {
    if (!selectedSession || !user || isSessionClosed) return;

    supabase.channel(`typing:${selectedSession}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name || 'Usuario' }
      });
  }, [selectedSession, user, isSessionClosed]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && !isSessionClosed) {
      setIsTyping(true);
      broadcastTyping();
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
      markAsRead(selectedSession);
    }
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset selected session when changing tabs
  useEffect(() => {
    setSelectedSession(null);
  }, [activeTab]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedSession || isSessionClosed) return;
    await sendMessage(selectedSession, newMessage.trim());
    setNewMessage('');
    setIsTyping(false);
  };

  // Handle closing session
  const handleCloseSession = async () => {
    if (!selectedSession) return;
    
    setIsClosingSession(true);
    const result = await closeSession(selectedSession);
    setIsClosingSession(false);

    if (result.success) {
      toast.success('Consulta cerrada exitosamente');
      setSelectedSession(null);
      setActiveTab('history');
    } else {
      toast.error(result.error || 'Error al cerrar la consulta');
    }
  };

  // Handle file upload - send as a message with file info
  const handleFileUploaded = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!selectedSession || isSessionClosed) return;
    
    const fileMessage = fileType.startsWith('image/') 
      ? `📷 [Imagen: ${fileName}]\n${fileUrl}`
      : `📎 [Archivo: ${fileName}]\n${fileUrl}`;
    
    await sendMessage(selectedSession, fileMessage);
  };

  // Get display name for session
  const getSessionDisplayName = (session: ChatSession) => {
    if (role === 'patient') {
      return session.participant2Name || 'Doctor';
    }
    return session.participant1Name || 'Paciente';
  };

  // Render message content (with file support)
  const renderMessageContent = (content: string) => {
    // Check if it's a file message
    const imageMatch = content.match(/📷 \[Imagen: (.+?)\]\n(https?:\/\/.+)/);
    const fileMatch = content.match(/📎 \[Archivo: (.+?)\]\n(https?:\/\/.+)/);

    if (imageMatch) {
      const [, fileName, url] = imageMatch;
      return (
        <div className="space-y-2">
          <img 
            src={url} 
            alt={fileName} 
            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(url, '_blank')}
          />
          <p className="text-xs opacity-70 flex items-center gap-1">
            <Image className="w-3 h-3" />
            {fileName}
          </p>
        </div>
      );
    }

    if (fileMatch) {
      const [, fileName, url] = fileMatch;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-background/20 rounded-lg hover:bg-background/30 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span className="text-sm underline">{fileName}</span>
        </a>
      );
    }

    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  };

  // Render session item
  const renderSessionItem = (session: ChatSession) => {
    const isClosed = session.status === 'closed';
    
    return (
      <div
        key={session.id}
        onClick={() => setSelectedSession(session.id)}
        className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
          selectedSession === session.id 
            ? 'bg-accent' 
            : isClosed 
              ? 'hover:bg-muted/50 opacity-75' 
              : 'hover:bg-muted'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isClosed ? 'bg-muted' : 'bg-primary/10'
          }`}>
            {role === 'patient' 
              ? <Stethoscope className={`w-4 h-4 ${isClosed ? 'text-muted-foreground' : 'text-primary'}`} /> 
              : <User className={`w-4 h-4 ${isClosed ? 'text-muted-foreground' : 'text-primary'}`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-medium text-sm truncate">
                {getSessionDisplayName(session)}
              </p>
              {session.isDoubleCheck && (
                <Badge variant="outline" className="text-[10px] px-1">
                  <CheckCheck className="w-3 h-3 mr-0.5" />
                  2nd
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{session.lastMessage}</p>
            {isClosed && session.lastMessageAt && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Cerrada {format(session.lastMessageAt, 'dd MMM yyyy', { locale: es })}
              </p>
            )}
          </div>
          {!isClosed && session.unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{session.unreadCount}</Badge>
          )}
          {isClosed && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>
    );
  };

  // Show loading while auth is initializing
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

  // Block unauthorized roles (visitors, residents for patient chat)
  if (role !== 'patient' && role !== 'doctor') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              Chat 1:1
            </h2>
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

  // Check entitlement for patients
  const hasEntitlement = role === 'doctor' || user?.entitlements?.some(e => e.type === 'chat' && e.isActive);

  if (role === 'patient' && !hasEntitlement) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-premium/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-premium" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              Activa el Chat 1:1
            </h2>
            <p className="text-muted-foreground mb-6">
              El chat con médicos es un servicio premium. Adquiere el servicio para comunicarte directamente con profesionales de la salud.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/wallet')}>
                Ver Opciones
              </Button>
              <Button variant="outline" onClick={() => navigate('/lives')}>
                Ir a Lives
              </Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          Chat 1:1
        </h1>

        <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
          {/* Sessions List with Tabs */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'history')}>
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1 gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Activas
                    {activeSessions.length > 0 && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {activeSessions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 gap-1">
                    <History className="w-3 h-3" />
                    Historial
                    {closedSessions.length > 0 && (
                      <Badge variant="outline" className="text-xs ml-1">
                        {closedSessions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[400px]">
                {activeTab === 'active' ? (
                  activeSessions.length > 0 ? (
                    activeSessions.map(session => renderSessionItem(session))
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No hay conversaciones activas</p>
                    </div>
                  )
                ) : (
                  closedSessions.length > 0 ? (
                    closedSessions.map(session => renderSessionItem(session))
                  ) : (
                    <div className="text-center py-8">
                      <History className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No hay consultas anteriores</p>
                    </div>
                  )
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="md:col-span-2 flex flex-col">
            {selectedSession && selectedSessionData ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">
                        {getSessionDisplayName(selectedSessionData)}
                      </CardTitle>
                      {selectedSessionData.isDoubleCheck && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCheck className="w-3 h-3 mr-1" />
                          Double Check
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSessionClosed ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          Consulta cerrada
                        </Badge>
                      ) : (
                        role === 'doctor' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive">
                                <XCircle className="w-4 h-4" />
                                Cerrar consulta
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cerrar esta consulta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Al cerrar la consulta, el paciente ya no podrá enviar más mensajes. 
                                  El historial de la conversación se mantendrá disponible para ambas partes.
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={handleCloseSession}
                                  disabled={isClosingSession}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isClosingSession ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Cerrando...
                                    </>
                                  ) : (
                                    'Sí, cerrar consulta'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )
                      )}
                    </div>
                  </div>
                  {isSessionClosed && selectedSessionData.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Consulta del {format(selectedSessionData.createdAt, 'dd MMMM yyyy', { locale: es })}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-lg ${
                            msg.senderId === user?.id 
                              ? isSessionClosed 
                                ? 'bg-primary/70 text-primary-foreground' 
                                : 'bg-primary text-primary-foreground' 
                              : isSessionClosed 
                                ? 'bg-muted/70' 
                                : 'bg-muted'
                          }`}>
                            {renderMessageContent(msg.content)}
                            <p className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(msg.createdAt, 'dd MMM, HH:mm', { locale: es })}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Typing Indicator */}
                      {otherUserTyping && !isSessionClosed && (
                        <div className="flex justify-start">
                          <TypingIndicator userName={otherUserTyping} />
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Input area with file upload - only for active sessions */}
                  {isSessionClosed ? (
                    <div className="p-4 border-t bg-muted/30">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                        <p className="text-sm">Esta consulta ha sido cerrada. Solo puedes ver el historial.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-t space-y-2">
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
                          className="flex-1"
                        />
                        <Button onClick={handleSend} size="icon" disabled={!newMessage.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                {activeTab === 'active' ? (
                  <>
                    <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-center">Selecciona una conversación para comenzar</p>
                  </>
                ) : (
                  <>
                    <History className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-center">Selecciona una consulta anterior para ver el historial</p>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
