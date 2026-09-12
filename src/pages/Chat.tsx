import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useChat, ChatSession } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatMessagesPanel } from '@/components/chat/ChatMessagesPanel';
import { BadgeChatPanel } from '@/components/chat/BadgeChatPanel';
import { TriageChat } from '@/components/chat/TriageChat';
import { ProChatList, ConvSort } from '@/components/chat/ProChatList';
import { ChatClinicalContext } from '@/components/chat/ChatClinicalContext';
import {
  MessageSquare, Loader2, Users, User, Stethoscope, Store, Sparkles, CheckCircle2,
  Archive, Plus, ChevronDown, ClipboardList, PanelRightOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { PostConsultationSummaryDialog } from '@/components/chat/PostConsultationSummaryDialog';
import { norm } from '@/lib/proFormat';

/** Secciones del carril izquierdo (relación + archivo) */
type View = 'all' | 'patients' | 'doctors' | 'providers' | 'orientations' | 'badge' | 'closed' | 'archived';

const archiveKey = (userId?: string) => `mm_chat_archived_${userId || 'anon'}`;

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
  const [view, setView] = useState<View>(role === 'resident' ? 'doctors' : 'all');
  // Distintivo del doctor (medalla/palomita) para mostrar acceso a su chat exclusivo.
  const [myBadge, setMyBadge] = useState<'gold' | 'verified' | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ConvSort>('recent');
  const [contextOpen, setContextOpen] = useState(false);

  // Archivo del propio médico: no borra nada ni toca la base, sólo decide qué
  // ve él en su lista. Se guarda en su navegador.
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(archiveKey(user?.id));
      setArchivedIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setArchivedIds(new Set()); }
  }, [user?.id]);
  const toggleArchive = (id: string) => {
    setArchivedIds(prev => {
      const next = new Set(prev);
      const wasArchived = next.has(id);
      if (wasArchived) next.delete(id); else next.add(id);
      try { localStorage.setItem(archiveKey(user?.id), JSON.stringify([...next])); } catch { /* modo privado */ }
      toast.success(wasArchived ? t('pro.chatPro.unarchived') : t('pro.chatPro.archived'));
      if (!wasArchived && selectedSession === id) setSelectedSession(null);
      return next;
    });
  };

  useEffect(() => {
    if (role !== 'doctor' || !user?.id) return;
    supabase.from('doctor_profiles').select('manual_badge').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setMyBadge(((data as any)?.manual_badge as 'gold' | 'verified' | null) ?? null));
  }, [role, user?.id]);

  const allSessions = getSessionsByUser();

  const otherTypeOf = (s: ChatSession) => (s.participant1Id === user?.id ? s.participant2Type : s.participant1Type);
  const matchesRelation = (s: ChatSession, v: View) => {
    const otherType = otherTypeOf(s);
    const isProviderChat = !!s.marketplaceInterestId;
    if (v === 'patients') return otherType === 'patient' && !s.isDoubleCheck;
    if (v === 'doctors') return (otherType === 'doctor' || otherType === 'resident') && !isProviderChat && !s.isDoubleCheck;
    if (v === 'providers') return isProviderChat;
    if (v === 'orientations') return s.isDoubleCheck;
    return true;
  };

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

  // Handle ?session= param — desde notificación click, wallet redirect, etc.
  // Garantiza que la sesión se abra aunque no esté en el cache local (recién
  // creada, en otra tab, etc). Hace fetch directo + carga mensajes.
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam || !user?.id) return;
    // 🚨 El parámetro NO se borra aquí. Si se borra antes de abrir la
    // conversación y el componente se vuelve a montar (la puerta de toggles lo
    // hace en carga en frío), el segundo montaje ya no lo ve y no se abre nada.
    // Se consume al final, cuando la conversación ya está abierta.

    (async () => {
      // Refresh primero para que aparezca en sessions list si recién se creó
      await refreshSessions();

      // Verificar que la sesión existe + el usuario es participante (RLS)
      const { data: session } = await (supabase as any)
        .from('chat_sessions')
        .select('id, status, marketplace_interest_id, is_double_check')
        .eq('id', sessionParam)
        .maybeSingle();

      if (!session) {
        toast.error(t('fix20.chat.sessionNotFound'));
        setSearchParams({}, { replace: true });
        return;
      }

      // Colocar el carril en la sección donde vive esa conversación, para que
      // no quede oculta por el filtro que hubiera puesto antes.
      if (session.status === 'closed') setView('closed');
      else if (session.is_double_check) setView('orientations');
      else if (session.marketplace_interest_id && (role === 'doctor' || role === 'resident')) setView('providers');
      else setView(role === 'resident' ? 'doctors' : 'all');

      setActiveTab(session.status === 'closed' ? 'history' : 'active');
      setSelectedSession(sessionParam);
      // Pre-cargar mensajes para que aparezcan al instante (en vez de empty)
      try { await loadMessages(sessionParam); } catch { /* ignore */ }
      // Ya está abierta: ahora sí se limpia la URL.
      setSearchParams({}, { replace: true });
    })();
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

  // La consulta ya NO se crea sola al abrir el chat (nadie confirmó nada
  // todavía): solo se busca si ya existe. Se crea recién cuando el médico
  // manda su primer mensaje (ver ensureConsultationForSession + handleSend),
  // que es la primera acción real con consecuencias en esta conversación.
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
      markAsRead(selectedSession);
      const fetchConsultation = async () => {
        const { data } = await supabase
          .from('consultations')
          .select('id')
          .eq('chat_session_id', selectedSession)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setConsultationId(data?.id || null);
      };
      fetchConsultation();
    } else {
      setConsultationId(null);
    }
  }, [selectedSession, loadMessages, markAsRead]);

  // Crea la consulta la primera vez que el médico escribe en esta sesión
  // (antes se creaba sola con solo abrir el hilo, la escribiera quien la escribiera).
  const ensureConsultationForSession = async (sessionId: string): Promise<string | null> => {
    if (role !== 'doctor') return consultationId;
    if (consultationId) return consultationId;
    const session = allSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'active') return null;

    const doctorId = session.participant1Type === 'doctor' ? session.participant1Id
      : session.participant2Type === 'doctor' ? session.participant2Id : null;
    const patientId = session.participant1Type === 'patient' ? session.participant1Id
      : session.participant2Type === 'patient' ? session.participant2Id : null;
    if (!doctorId || !patientId) return null;

    const { data: newConsultation, error } = await supabase
      .from('consultations')
      .insert({
        doctor_id: doctorId,
        patient_id: patientId,
        chat_session_id: sessionId,
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !newConsultation) {
      console.error('Error creating consultation:', error);
      return null;
    }
    setConsultationId(newConsultation.id);
    return newConsultation.id;
  };

  // 🚨 La conversación abierta se suelta en el CLIC del carril, no en un efecto
  // sobre `view`. Con el efecto, el deep-link ?session= se pisaba a sí mismo:
  // colocaba el carril en la sección de esa conversación y, en el mismo tick,
  // el efecto la cerraba — el médico llegaba desde la campana o desde Consultas
  // y no se abría nada.
  useEffect(() => { setActiveTab(view === 'closed' ? 'history' : 'active'); }, [view]);

  const handleSend = (replyToId?: string) => {
    if (!newMessage.trim() || !selectedSession || isSessionClosed) return;
    const content = newMessage.trim();
    // Limpiamos input + typing AL INSTANTE; sendMessage hace render optimista.
    setNewMessage('');
    setIsTyping(false);
    const session = selectedSession;
    void ensureConsultationForSession(session).finally(() => {
      void sendMessage(session, content, replyToId);
    });
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
        setView('closed');
      }
    } else {
      toast.error(result.error || t('doctorProfile.chatError'));
    }
  };

  const handleSummaryComplete = () => {
    toast.success(t('chat.sessionClosed'));
    setSelectedSession(null);
    setView('closed');
    setShowSummaryDialog(false);
  };

  const handleFileUploaded = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!selectedSession || isSessionClosed) return;
    // Mantenemos el marcador "[Imagen: ...]" / "[Archivo: ...]" en el cuerpo crudo del
    // mensaje (necesario para que la burbuja del chat detecte el adjunto y lo renderice
    // como imagen/enlace), pero `formatMessagePreview` lo convierte a "📷 Foto" /
    // "📎 nombre" en listas, notificaciones y sesiones para verse estilo redes sociales.
    const fileMessage = fileType.startsWith('image/')
      ? `📷 [Imagen: ${fileName}]\n${fileUrl}`
      : `📎 [Archivo: ${fileName}]\n${fileUrl}`;
    await ensureConsultationForSession(selectedSession);
    await sendMessage(selectedSession, fileMessage);
  };

  const getSessionDisplayInfo = (session: ChatSession) => {
    // Determine the "other" participant based on current user id
    const isParticipant1 = session.participant1Id === user?.id;
    if (isParticipant1) {
      return { name: session.participant2Name || t('chat.doctor'), specialty: session.participant2Specialty, avatar: session.participant2Avatar, type: session.participant2Type, userId: session.participant2Id };
    }
    return { name: session.participant1Name || t('chat.patient'), specialty: session.participant1Specialty, avatar: session.participant1Avatar, type: session.participant1Type, userId: session.participant1Id };
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
    // Respetar horas Y minutos (antes ignoraba los minutos: 09:30 se leía como 09:00).
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':');
      return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
    };
    const startTime = toMin(session.officeHoursStart);
    const endTime = toMin(session.officeHoursEnd);
    return currentTime >= startTime && currentTime <= endTime;
  };

  // ------------------------------------------------------------ carril + lista
  const countFor = useCallback((v: View) => {
    if (v === 'archived') return allSessions.filter(s => archivedIds.has(s.id)).length;
    if (v === 'closed') return allSessions.filter(s => s.status === 'closed' && !archivedIds.has(s.id)).length;
    return allSessions.filter(s => s.status === 'active' && !archivedIds.has(s.id) && matchesRelation(s, v)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessions, archivedIds, user?.id]);

  const visibleSessions = useMemo(() => {
    const q = norm(query.trim());
    let arr = allSessions.filter(s => {
      if (view === 'archived') return archivedIds.has(s.id);
      if (archivedIds.has(s.id)) return false;
      if (view === 'closed') return s.status === 'closed';
      return s.status === 'active' && matchesRelation(s, view);
    });
    if (q) {
      arr = arr.filter(s => {
        const info = getSessionDisplayInfo(s);
        return norm(info.name).includes(q) || norm(info.specialty).includes(q) || norm(s.lastMessage).includes(q);
      });
    }
    const time = (s: ChatSession) => (s.lastMessageAt ? new Date(s.lastMessageAt).getTime() : new Date(s.createdAt).getTime());
    const sorted = [...arr];
    sorted.sort((a, b) => {
      if (sort === 'unread') return (b.unreadCount - a.unreadCount) || (time(b) - time(a));
      if (sort === 'name') return getSessionDisplayInfo(a).name.localeCompare(getSessionDisplayInfo(b).name);
      if (sort === 'priority') {
        const pa = Number(a.priorityScore ?? 0);
        const pb = Number(b.priorityScore ?? 0);
        return (pb - pa) || (b.unreadCount - a.unreadCount) || (time(b) - time(a));
      }
      return time(b) - time(a);
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessions, view, query, sort, archivedIds, user?.id]);

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
        <div className="container mx-auto px-4 py-6 sm:py-10">
          <div className="max-w-2xl mx-auto mb-4 text-center">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1">
              {t('chat.activateChat')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('chat.premiumService')}
            </p>
          </div>
          <TriageChat />
        </div>
      </MainLayout>
    );
  }

  const showMobileChat = isMobile && !!selectedSession;
  const showMobileList = isMobile && !selectedSession;

  // Secciones del carril según el rol: sólo se enseña lo que ese rol usa.
  const relationViews: View[] = role === 'doctor'
    ? ['all', 'patients', 'doctors', 'providers', 'orientations']
    : role === 'resident'
      ? ['doctors', 'providers', 'orientations']
      : ['all', 'orientations'];
  const railIcon: Record<View, React.ElementType> = {
    all: Users, patients: User, doctors: Stethoscope, providers: Store, orientations: Sparkles,
    badge: CheckCircle2, closed: CheckCircle2, archived: Archive,
  };
  const railLabel = (v: View) => ({
    all: t('pro.chatPro.railAll'),
    patients: t('pro.chatPro.railPatients'),
    doctors: t('pro.chatPro.railDoctors'),
    providers: t('pro.chatPro.railProviders'),
    orientations: t('pro.chatPro.railOrientations'),
    badge: t('pro.chatPro.railRoom'),
    closed: t('pro.chatPro.railClosed'),
    archived: t('pro.chatPro.railArchived'),
  }[v]);

  const hasBadgeRoom = myBadge === 'gold' || myBadge === 'verified';
  const activeCount = allSessions.filter(s => s.status === 'active' && !archivedIds.has(s.id)).length;
  const otherInfo = selectedSessionData ? getSessionDisplayInfo(selectedSessionData) : null;

  const railButton = (v: View, withCount = true) => {
    const Icon = railIcon[v];
    const n = withCount ? countFor(v) : 0;
    return (
      <button
        key={v}
        type="button"
        className={`pro-lane-item ${view === v ? 'is-active' : ''}`}
        aria-pressed={view === v}
        onClick={() => { setView(v); setSelectedSession(null); }}
      >
        {v === 'badge' && hasBadgeRoom
          ? <img src={myBadge === 'gold' ? '/badge-gold.png' : '/badge-verified.png'} alt="" aria-hidden="true" className="w-[18px] h-[18px] object-contain flex-shrink-0" />
          : <Icon />}
        <span className="label">{railLabel(v)}</span>
        {withCount && n > 0 && <span className="count">{n}</span>}
      </button>
    );
  };

  const rail = (
    <>
      {relationViews.map(v => railButton(v))}
      {hasBadgeRoom && railButton('badge', false)}
      <span className="pro-lane-sep" />
      {railButton('closed')}
      {railButton('archived')}
      {/* La maqueta repite el botón al pie del carril: es donde acaba la vista */}
      <button
        type="button"
        className="pro-btn pro-btn-live pro-btn-sm mt-2 hidden xl:inline-flex"
        onClick={() => navigate(role === 'doctor' ? '/doctor/patients' : '/doctors')}
      >
        <Plus /> {t('pro.chatPro.newConversation')}
      </button>
    </>
  );

  const newConversation = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="pro-btn pro-btn-live w-full sm:w-auto">
          <Plus /> {t('pro.chatPro.newConversation')} <ChevronDown />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {role === 'doctor' && (
          <DropdownMenuItem onClick={() => navigate('/doctor/patients')}>
            <User className="w-4 h-4 mr-2" /> {t('pro.chatPro.railPatients')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/doctors')}>
          <Stethoscope className="w-4 h-4 mr-2" /> {t('pro.chatPro.railDoctors')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><MessageSquare className="w-7 h-7" /> <span className="truncate">{t('pro.chatPro.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.chatPro.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Indicador en vivo de conversaciones activas: lo tenía la cabecera
                del chat anterior y se había perdido en el rediseño. */}
            {activeCount > 0 && (
              <span className="pro-pill pro-pill-ok pro-pill-plain" style={{ height: 34, paddingInline: 12 }}>
                <span className="relative inline-flex w-2 h-2 mr-1">
                  <span className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ background: 'var(--pro-ok)' }} />
                  <span className="relative w-2 h-2 rounded-full" style={{ background: 'var(--pro-ok)' }} />
                </span>
                {activeCount} {t('chat.active').toLowerCase()}
              </span>
            )}
            {newConversation}
          </div>
        </div>

        <div className="pro-card pro-tall flex flex-col overflow-hidden">
          {/* Carril como fila de chips cuando no cabe de columna */}
          {!showMobileChat && (
            <div className="pro-lane pro-lane-row flex xl:hidden" style={{ borderBottom: '1px solid var(--pro-line)' }}>
              {rail}
            </div>
          )}

          <div className="pro-work pro-work-chat flex-1 min-h-0">
            {/* Columna 1 — carril */}
            <nav className="pro-lane hidden xl:flex" aria-label={t('pro.chatPro.title')}>
              {rail}
            </nav>

            {/* Columna 2 — lista */}
            {view === 'badge' && hasBadgeRoom ? null : (
              <div className={`pro-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
                <ProChatList
                  sessions={visibleSessions}
                  selectedSession={selectedSession}
                  query={query}
                  sort={sort}
                  archivedIds={archivedIds}
                  showingArchived={view === 'archived'}
                  onQueryChange={setQuery}
                  onSortChange={setSort}
                  onSelect={setSelectedSession}
                  onToggleArchive={toggleArchive}
                  getDisplayInfo={getSessionDisplayInfo}
                  isWithinOfficeHours={isWithinOfficeHours}
                  emptyLabel={view === 'archived' ? t('pro.chatPro.emptyArchived') : t('pro.chatPro.empty')}
                />
              </div>
            )}

            {/* Columna 3 — hilo (o sala por insignia) */}
            {view === 'badge' && hasBadgeRoom ? (
              <div className="pro-chat-full min-h-0 overflow-hidden w-full max-w-full">
                <BadgeChatPanel badge={myBadge} />
              </div>
            ) : (
              <div className={`pro-col pro-thread-col min-w-0 ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
                {selectedSessionData && (
                  <div className="flex items-center justify-end gap-2 px-3 pt-2 xl:hidden">
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => setContextOpen(true)}>
                      <PanelRightOpen /> {t('pro.chatPro.showContext')}
                    </button>
                  </div>
                )}
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
            )}

            {/* Columna 4 — contexto clínico */}
            {view !== 'badge' && (
              <aside className="hidden xl:flex pro-col p-3" aria-label={t('pro.chatPro.context')}>
                <h2 className="pro-card-title text-[15px] mb-2"><ClipboardList /> {t('pro.chatPro.context')}</h2>
                {selectedSessionData && otherInfo ? (
                  <ChatClinicalContext
                    session={selectedSessionData}
                    other={otherInfo}
                    officeHours={formatOfficeHours(selectedSessionData)}
                    isAvailable={isWithinOfficeHours(selectedSessionData)}
                  />
                ) : (
                  <p className="text-[12.5px] pro-muted">{t('pro.chatPro.pickHint')}</p>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Contexto clínico en hoja lateral cuando no cabe la columna */}
      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto bg-card">
          <SheetHeader className="mb-3"><SheetTitle className="pro-card-title">{t('pro.chatPro.context')}</SheetTitle></SheetHeader>
          {selectedSessionData && otherInfo && (
            <ChatClinicalContext
              session={selectedSessionData}
              other={otherInfo}
              officeHours={formatOfficeHours(selectedSessionData)}
              isAvailable={isWithinOfficeHours(selectedSessionData)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Post-consultation summary dialog */}
      <PostConsultationSummaryDialog
        open={showSummaryDialog}
        onOpenChange={setShowSummaryDialog}
        consultationId={consultationId}
        onSaved={handleSummaryComplete}
      />
    </MainLayout>
  );
}
