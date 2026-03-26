import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChat, ChatSession } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatSessionsList } from '@/components/chat/ChatSessionsList';
import { ChatMessagesPanel } from '@/components/chat/ChatMessagesPanel';
import { MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PostConsultationSummaryDialog } from '@/components/chat/PostConsultationSummaryDialog';

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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'patients' | 'doctors'>('all');
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  const allSessions = getSessionsByUser();

  // Filter sessions by chatFilter (for doctors/residents with dual windows)
  const filterByType = (sessions: typeof allSessions) => {
    if (chatFilter === 'all') return sessions;
    return sessions.filter(s => {
      // Determine the "other" participant type
      const otherType = s.participant1Id === user?.id ? s.participant2Type : s.participant1Type;
      if (chatFilter === 'patients') return otherType === 'patient';
      if (chatFilter === 'doctors') return otherType === 'doctor' || otherType === 'resident';
      return true;
    });
  };

  const activeSessions = filterByType(allSessions.filter(s => s.status === 'active'));
  const closedSessions = filterByType(allSessions.filter(s => s.status === 'closed'));
  const messages = selectedSession ? getSessionMessages(selectedSession) : [];
  const selectedSessionData = allSessions.find(s => s.id === selectedSession);
  const isSessionClosed = selectedSessionData?.status === 'closed';

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
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };

  // Handle consultation success from payment redirect
  // Handle ?session= param (wallet payment redirect)
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam && user?.id) {
      setSearchParams({});
      refreshSessions().then(() => {
        setSelectedSession(sessionParam);
        setActiveTab('active');
      });
    }
  }, [searchParams, user?.id]);

  // Handle Stripe redirect: ?consultation=success&doctor=X
  useEffect(() => {
    const consultationStatus = searchParams.get('consultation');
    const doctorId = searchParams.get('doctor');
    if (consultationStatus === 'success' && doctorId && user?.id && role === 'patient' && !isCreatingSession) {
      setSearchParams({});
      setIsCreatingSession(true);
      const initSession = async () => {
        try {
          // Query DB directly instead of relying on stale allSessions
          const { data: sessionData } = await supabase
            .from('chat_sessions')
            .select('id')
            .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${doctorId}),and(participant1_id.eq.${doctorId},participant2_id.eq.${user.id})`)
            .eq('status', 'active')
            .eq('is_double_check', false)
            .maybeSingle();

          await refreshSessions();

          if (sessionData) {
            setSelectedSession(sessionData.id);
            toast.success(t('doctorProfile.paymentSuccess'));
          } else {
            const result = await createSession(doctorId, 'doctor', false);
            if (result.success && result.session) {
              try {
                await supabase.functions.invoke('notify-new-chat', {
                  body: { doctorId, patientName: user.name, sessionId: result.session.id, isDoubleCheck: false },
                });
              } catch (e) { console.error('Error notifying doctor:', e); }
              setSelectedSession(result.session.id);
              toast.success(t('doctorProfile.paymentSuccess'));
            } else {
              toast.error(result.error || t('doctorProfile.chatError'));
            }
          }
        } catch (error) {
          console.error('Error creating session after payment:', error);
          toast.error(t('doctorProfile.chatError'));
        } finally {
          setIsCreatingSession(false);
        }
      };
      initSession();
    }
  }, [searchParams, user?.id, role]);

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
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession, user?.id, isSessionClosed]);

  const broadcastTyping = useCallback(() => {
    if (!selectedSession || !user || isSessionClosed) return;
    supabase.channel(`typing:${selectedSession}`)
      .send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, userName: user.name || 'Usuario' } });
  }, [selectedSession, user, isSessionClosed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping && !isSessionClosed) {
      setIsTyping(true);
      broadcastTyping();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
  };

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
      markAsRead(selectedSession);
      const fetchOrCreateConsultation = async () => {
        // First try to find an existing consultation for this session
        const { data } = await supabase
          .from('consultations')
          .select('id')
          .eq('chat_session_id', selectedSession)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.id) {
          setConsultationId(data.id);
          return;
        }

        // No consultation exists — auto-create one for active sessions
        const session = allSessions.find(s => s.id === selectedSession);
        if (!session || session.status !== 'active') {
          setConsultationId(null);
          return;
        }

        // Determine doctor and patient IDs
        const doctorId = session.participant1Type === 'doctor' ? session.participant1Id
          : session.participant2Type === 'doctor' ? session.participant2Id : null;
        const patientId = session.participant1Type === 'patient' ? session.participant1Id
          : session.participant2Type === 'patient' ? session.participant2Id : null;

        if (!doctorId || !patientId) {
          setConsultationId(null);
          return;
        }

        const { data: newConsultation, error } = await supabase
          .from('consultations')
          .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            chat_session_id: selectedSession,
            status: 'active',
          })
          .select('id')
          .single();

        if (!error && newConsultation) {
          setConsultationId(newConsultation.id);
        } else {
          console.error('Error creating consultation:', error);
          setConsultationId(null);
        }
      };
      fetchOrCreateConsultation();
    } else {
      setConsultationId(null);
    }
  }, [selectedSession, loadMessages, markAsRead]);

  useEffect(() => { setSelectedSession(null); }, [activeTab]);

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
      // If doctor, show post-consultation summary dialog
      if (role === 'doctor' && consultationId) {
        setShowSummaryDialog(true);
      } else {
        toast.success(t('chat.sessionClosed'));
        setSelectedSession(null);
        setActiveTab('history');
      }
    } else {
      toast.error(result.error || t('doctorProfile.chatError'));
    }
  };

  const handleSummaryComplete = () => {
    toast.success(t('chat.sessionClosed'));
    setSelectedSession(null);
    setActiveTab('history');
    setShowSummaryDialog(false);
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
      return { name: session.participant2Name || t('chat.doctor'), specialty: session.participant2Specialty, avatar: session.participant2Avatar, type: session.participant2Type };
    }
    return { name: session.participant1Name || t('chat.patient'), specialty: session.participant1Specialty, avatar: session.participant1Avatar, type: session.participant1Type };
  };

  const formatOfficeHours = (session: ChatSession) => {
    if (!session.officeHoursStart || !session.officeHoursEnd) return null;
    const dayNames: Record<string, string> = language === 'en' 
      ? { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
      : { monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom' };
    const days = session.officeDays?.map(d => dayNames[d] || d).join(', ') || (language === 'en' ? 'Mon-Fri' : 'Lun-Vie');
    return `${session.officeHoursStart.slice(0, 5)} - ${session.officeHoursEnd.slice(0, 5)} | ${days}`;
  };

  const isWithinOfficeHours = (session: ChatSession) => {
    if (!session.officeHoursStart || !session.officeHoursEnd) return true;
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    if (session.officeDays && !session.officeDays.includes(currentDay)) return false;
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = parseInt(session.officeHoursStart.split(':')[0]) * 60;
    const endTime = parseInt(session.officeHoursEnd.split(':')[0]) * 60;
    return currentTime >= startTime && currentTime <= endTime;
  };

  // Loading state
  if (role === undefined || role === null) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Block unauthorized
  if (role !== 'patient' && role !== 'doctor' && role !== 'resident') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">{t('chat.oneOnOne')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('chat.chatUnavailable')}
            </p>
            <Button onClick={() => navigate(role === 'visitor' ? '/login' : '/lives')}>
              {role === 'visitor' ? t('nav.login') : t('chat.goToLives')}
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Patient can access chat if they have active sessions, closed history, or are being redirected after payment
  const allSessionsUnfiltered = getSessionsByUser();
  const hasEntitlement = role === 'doctor' || role === 'resident' || allSessionsUnfiltered.filter(s => s.status === 'active').length > 0 || allSessionsUnfiltered.filter(s => s.status === 'closed').length > 0 || isCreatingSession;
  if (role === 'patient' && !hasEntitlement) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-premium/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-premium" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">{t('chat.activateChat')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('chat.premiumService')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/wallet')}>{t('chat.viewOptions')}</Button>
              <Button variant="outline" onClick={() => navigate('/lives')}>{t('chat.goToLives')}</Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const showMobileChat = isMobile && !!selectedSession;
  const showMobileList = isMobile && !selectedSession;

  return (
    <MainLayout>
      <div className="container mx-auto px-1 sm:px-4 py-2 sm:py-6 max-w-6xl flex flex-col h-[calc(100dvh-56px-72px)] sm:h-[calc(100vh-56px-96px)] overflow-hidden">
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0 px-2 sm:px-0">
          <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <span>Chat 1:1</span>
          </h1>
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {activeSessions.length} {t('chat.active').toLowerCase()}{activeSessions.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-[340px,1fr] gap-2 sm:gap-4 flex-1 min-h-0 overflow-hidden w-full max-w-full">
          <ChatSessionsList
            activeSessions={activeSessions}
            closedSessions={closedSessions}
            selectedSession={selectedSession}
            activeTab={activeTab}
            userRole={role}
            onTabChange={setActiveTab}
            onSelectSession={setSelectedSession}
            getDisplayInfo={getSessionDisplayInfo}
            formatOfficeHours={formatOfficeHours}
            isWithinOfficeHours={isWithinOfficeHours}
            getDoctorId={getDoctorIdForSession}
            onDoctorProfileClick={goToDoctorProfile}
            hidden={showMobileChat}
          />

          <ChatMessagesPanel
            session={selectedSessionData}
            messages={messages}
            userId={user?.id}
            userRole={role}
            newMessage={newMessage}
            isClosed={isSessionClosed || false}
            isClosing={isClosingSession}
            otherUserTyping={otherUserTyping}
            activeTab={activeTab}
            consultationId={consultationId}
            isMobile={isMobile}
            hidden={showMobileList}
            onInputChange={handleInputChange}
            onSend={handleSend}
            onCloseSession={handleCloseSession}
            onBack={() => setSelectedSession(null)}
            onFileUploaded={handleFileUploaded}
            getDoctorId={getDoctorIdForSession}
            getDisplayInfo={getSessionDisplayInfo}
            formatOfficeHours={formatOfficeHours}
            isWithinOfficeHours={isWithinOfficeHours}
            onDoctorProfileClick={goToDoctorProfile}
          />
        </div>
      </div>
    </MainLayout>
  );
}
