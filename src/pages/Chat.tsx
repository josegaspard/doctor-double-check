import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatFileUpload } from '@/components/chat/ChatFileUpload';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { MessageSquare, Send, User, Stethoscope, FileText, Image } from 'lucide-react';

export default function Chat() {
  const navigate = useNavigate();
  const { getSessionsByUser, getSessionMessages, sendMessage, markAsRead, loadMessages } = useChat();
  const { user, role } = useAuth();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sessions = getSessionsByUser();
  const messages = selectedSession ? getSessionMessages(selectedSession) : [];

  // Get the other participant's name for the selected session
  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  const otherUserName = selectedSessionData 
    ? (role === 'patient' ? selectedSessionData.participant2Name : selectedSessionData.participant1Name)
    : null;

  // Subscribe to typing indicators via Supabase Realtime
  useEffect(() => {
    if (!selectedSession || !user?.id) return;

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
  }, [selectedSession, user?.id]);

  // Broadcast typing status
  const broadcastTyping = useCallback(() => {
    if (!selectedSession || !user) return;

    supabase.channel(`typing:${selectedSession}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name || 'Usuario' }
      });
  }, [selectedSession, user]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
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

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedSession) return;
    await sendMessage(selectedSession, newMessage.trim());
    setNewMessage('');
    setIsTyping(false);
  };

  // Handle file upload - send as a message with file info
  const handleFileUploaded = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!selectedSession) return;
    
    const fileMessage = fileType.startsWith('image/') 
      ? `📷 [Imagen: ${fileName}]\n${fileUrl}`
      : `📎 [Archivo: ${fileName}]\n${fileUrl}`;
    
    await sendMessage(selectedSession, fileMessage);
  };

  // Get display name for session
  const getSessionDisplayName = (session: any) => {
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

  // Block unauthorized roles
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
              El chat está disponible solo para pacientes y médicos registrados.
            </p>
            <Button onClick={() => navigate('/login')}>
              Iniciar Sesión
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
          {/* Sessions List */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[400px]">
                {sessions.length > 0 ? sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session.id)}
                    className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                      selectedSession === session.id ? 'bg-accent' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {role === 'patient' ? <Stethoscope className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getSessionDisplayName(session)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{session.lastMessage}</p>
                      </div>
                      {session.unreadCount > 0 && <Badge variant="destructive" className="text-xs">{session.unreadCount}</Badge>}
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">No hay conversaciones</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="md:col-span-2 flex flex-col">
            {selectedSession ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm">
                    {getSessionDisplayName(sessions.find(s => s.id === selectedSession))}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-lg ${
                            msg.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            {renderMessageContent(msg.content)}
                            <p className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Typing Indicator */}
                      {otherUserTyping && (
                        <div className="flex justify-start">
                          <TypingIndicator userName={otherUserTyping} />
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Input area with file upload */}
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
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Selecciona una conversación
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
