import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { tContext } from '@/lib/i18n-context';

export type ChatParticipantType = 'patient' | 'doctor' | 'resident';
export type ChatStatus = 'active' | 'closed';

export interface ChatSession {
  id: string;
  participant1Id: string;
  participant1Type: ChatParticipantType;
  participant1Name?: string;
  participant1Specialty?: string;
  participant1Avatar?: string;
  participant2Id: string;
  participant2Type: ChatParticipantType;
  participant2Name?: string;
  participant2Specialty?: string;
  participant2Avatar?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  status: ChatStatus;
  isDoubleCheck: boolean;
  originalConsultationId?: string;
  createdAt: Date;
  // Office hours (from doctor)
  officeHoursStart?: string;
  officeHoursEnd?: string;
  officeDays?: string[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName?: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

interface ChatContextType {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
  isLoading: boolean;
  createSession: (
    participantId: string,
    participantType: ChatParticipantType,
    isDoubleCheck?: boolean,
    originalConsultationId?: string
  ) => Promise<{ success: boolean; session?: ChatSession; error?: string }>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  getSession: (sessionId: string) => ChatSession | undefined;
  getSessionMessages: (sessionId: string) => ChatMessage[];
  getSessionsByUser: () => ChatSession[];
  markAsRead: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const fetchingRef = useRef(false);

  const getUserType = (): ChatParticipantType | null => {
    if (!user) return null;
    if (user.role === 'patient') return 'patient';
    if (user.role === 'doctor') return 'doctor';
    if (user.role === 'resident') return 'resident';
    return null;
  };

  const fetchSessions = useCallback(async () => {
    if (!user?.id || user.role === 'visitor' || fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const { data: sessionsData, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (sessionsData) {
        // Single bulk RPC call to fetch all session details at once (eliminates N+1)
        const sessionIds = sessionsData.map(s => s.id);
        
        const detailsMap = new Map<string, any>();
        if (sessionIds.length > 0) {
          const { data: bulkDetails, error: bulkError } = await supabase.rpc(
            'get_chat_sessions_details_bulk' as any,
            { p_session_ids: sessionIds }
          );
          
          if (!bulkError && bulkDetails) {
            const detailsArr = Array.isArray(bulkDetails) ? bulkDetails : [bulkDetails];
            detailsArr.forEach((d: any) => {
              if (d?.session_id) {
                detailsMap.set(d.session_id, d);
              }
            });
          }
        }

        // Collect participant IDs that need fallback profile data
        const needsFallbackIds = new Set<string>();
        sessionsData.forEach(s => {
          const details = detailsMap.get(s.id);
          if (!details?.participant1_name) needsFallbackIds.add(s.participant1_id);
          if (!details?.participant2_name) needsFallbackIds.add(s.participant2_id);
        });

        // Batch fetch fallback profiles
        let fallbackProfileMap = new Map<string, { name: string | null; avatar: string | null }>();
        if (needsFallbackIds.size > 0) {
          const { data: profilesPublic } = await supabase
            .from('profiles_public')
            .select('id, name, avatar_url')
            .in('id', Array.from(needsFallbackIds));
          
          (profilesPublic || []).forEach((p: any) => {
            fallbackProfileMap.set(p.id, { name: p.name, avatar: p.avatar_url });
          });
        }

        // Batch fetch doctor profiles for office hours (only for sessions missing details)
        const doctorIdsForHours = new Set<string>();
        sessionsData.forEach(s => {
          const details = detailsMap.get(s.id);
          if (!details?.doctor_office_hours_start) {
            const doctorId = s.participant1_type === 'doctor' ? s.participant1_id
              : s.participant2_type === 'doctor' ? s.participant2_id : null;
            if (doctorId) doctorIdsForHours.add(doctorId);
          }
        });

        let doctorProfileMap = new Map<string, any>();
        if (doctorIdsForHours.size > 0) {
          const docResults = await Promise.all(
            Array.from(doctorIdsForHours).map(id => supabase.rpc('get_doctor_public_profile', { p_user_id: id }))
          );
          Array.from(doctorIdsForHours).forEach((id, i) => {
            const data = docResults[i].data;
            const doc = Array.isArray(data) ? data[0] : data;
            if (doc) doctorProfileMap.set(id, doc);
          });
        }

        const enrichedSessions = sessionsData.map((s): ChatSession => {
          const details = detailsMap.get(s.id);
          const fb1 = fallbackProfileMap.get(s.participant1_id);
          const fb2 = fallbackProfileMap.get(s.participant2_id);
          
          const doctorId = s.participant1_type === 'doctor' ? s.participant1_id
            : s.participant2_type === 'doctor' ? s.participant2_id : null;
          const doc = doctorId ? doctorProfileMap.get(doctorId) : null;

          return {
            id: s.id,
            participant1Id: s.participant1_id,
            participant1Type: s.participant1_type as ChatParticipantType,
            participant1Name: details?.participant1_name || fb1?.name || (s.participant1_type === 'doctor' ? doc?.name : undefined) || undefined,
            participant1Specialty: details?.participant1_specialty || (s.participant1_type === 'doctor' ? doc?.specialty : undefined) || undefined,
            participant1Avatar: details?.participant1_avatar || fb1?.avatar || (s.participant1_type === 'doctor' ? doc?.avatar_url : undefined) || undefined,
            participant2Id: s.participant2_id,
            participant2Type: s.participant2_type as ChatParticipantType,
            participant2Name: details?.participant2_name || fb2?.name || (s.participant2_type === 'doctor' ? doc?.name : undefined) || undefined,
            participant2Specialty: details?.participant2_specialty || (s.participant2_type === 'doctor' ? doc?.specialty : undefined) || undefined,
            participant2Avatar: details?.participant2_avatar || fb2?.avatar || (s.participant2_type === 'doctor' ? doc?.avatar_url : undefined) || undefined,
            lastMessage: s.last_message || undefined,
            lastMessageAt: s.last_message_at ? new Date(s.last_message_at) : undefined,
            unreadCount: s.participant1_id === user.id ? s.unread_count_1 : s.unread_count_2,
            status: s.status as ChatStatus,
            isDoubleCheck: s.is_double_check,
            originalConsultationId: s.original_consultation_id || undefined,
            createdAt: new Date(s.created_at),
            officeHoursStart: details?.doctor_office_hours_start ?? doc?.office_hours_start ?? undefined,
            officeHoursEnd: details?.doctor_office_hours_end ?? doc?.office_hours_end ?? undefined,
            officeDays: details?.doctor_office_days ?? doc?.office_days ?? undefined,
          };
        });
        setSessions(enrichedSessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [user?.id, user?.role]);

  const loadMessages = useCallback(async (sessionId: string) => {
    if (!user?.id) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (messagesData) {
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name')
          .in('id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

        setMessages(prev => ({
          ...prev,
          [sessionId]: messagesData.map(m => ({
            id: m.id,
            sessionId: m.session_id,
            senderId: m.sender_id,
            senderName: profileMap.get(m.sender_id),
            content: m.content,
            isRead: m.is_read,
            createdAt: new Date(m.created_at),
          })),
        }));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || user.role === 'visitor') return;

    fetchSessions();

    // Set up realtime subscription
    const channel = supabase
      .channel(`chat-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_sessions' },
        () => {
          fetchSessions();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMessage = payload.new as { id: string; session_id: string; sender_id: string; content: string; is_read: boolean; created_at: string };
          
          // Fetch sender name for the new message
          let senderName: string | undefined;
          try {
            const { data: senderProfile } = await supabase
              .from('profiles_public')
              .select('name')
              .eq('id', newMessage.sender_id)
              .single();
            senderName = senderProfile?.name ?? undefined;
          } catch {}

          setMessages(prev => {
            const existing = prev[newMessage.session_id] || [];
            // Avoid duplicates
            if (existing.some(m => m.id === newMessage.id)) return prev;
            return {
              ...prev,
              [newMessage.session_id]: [...existing, {
                id: newMessage.id,
                sessionId: newMessage.session_id,
                senderId: newMessage.sender_id,
                senderName,
                content: newMessage.content,
                isRead: newMessage.is_read,
                createdAt: new Date(newMessage.created_at),
              }],
            };
          });
          fetchSessions(); // Update session with latest message
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user?.id, user?.role, fetchSessions]);

  const createSession = async (
    participantId: string,
    participantType: ChatParticipantType,
    isDoubleCheck = false,
    originalConsultationId?: string
  ): Promise<{ success: boolean; session?: ChatSession; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    const userType = getUserType();
    if (!userType) return { success: false, error: tContext('contextErrors.invalidUserType') };

    // CRITICAL: Block patient-resident chat
    if (
      (userType === 'patient' && participantType === 'resident') ||
      (userType === 'resident' && participantType === 'patient')
    ) {
      return { success: false, error: tContext('contextErrors.patientResidentBlocked') };
    }

    try {
      // Check if session already exists
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('*')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${participantId}),and(participant1_id.eq.${participantId},participant2_id.eq.${user.id})`)
        .eq('status', 'active')
        .eq('is_double_check', isDoubleCheck)
        .maybeSingle();

      if (existing) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', [existing.participant1_id, existing.participant2_id]);

        const profileMap = new Map(profiles?.map(p => [p.id, { name: p.name, avatar: p.avatar_url }]) || []);

        return {
          success: true,
          session: {
            id: existing.id,
            participant1Id: existing.participant1_id,
            participant1Type: existing.participant1_type as ChatParticipantType,
            participant1Name: profileMap.get(existing.participant1_id)?.name,
            participant1Avatar: profileMap.get(existing.participant1_id)?.avatar,
            participant2Id: existing.participant2_id,
            participant2Type: existing.participant2_type as ChatParticipantType,
            participant2Name: profileMap.get(existing.participant2_id)?.name,
            participant2Avatar: profileMap.get(existing.participant2_id)?.avatar,
            lastMessage: existing.last_message || undefined,
            lastMessageAt: existing.last_message_at ? new Date(existing.last_message_at) : undefined,
            unreadCount: existing.participant1_id === user.id ? existing.unread_count_1 : existing.unread_count_2,
            status: existing.status as ChatStatus,
            isDoubleCheck: existing.is_double_check,
            originalConsultationId: existing.original_consultation_id || undefined,
            createdAt: new Date(existing.created_at),
          },
        };
      }

      // Create new session
      const { data: newSession, error } = await supabase
        .from('chat_sessions')
        .insert({
          participant1_id: user.id,
          participant1_type: userType,
          participant2_id: participantId,
          participant2_type: participantType,
          is_double_check: isDoubleCheck,
          original_consultation_id: originalConsultationId,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchSessions();

      return {
        success: true,
        session: {
          id: newSession.id,
          participant1Id: newSession.participant1_id,
          participant1Type: newSession.participant1_type as ChatParticipantType,
          participant2Id: newSession.participant2_id,
          participant2Type: newSession.participant2_type as ChatParticipantType,
          lastMessage: undefined,
          lastMessageAt: undefined,
          unreadCount: 0,
          status: newSession.status as ChatStatus,
          isDoubleCheck: newSession.is_double_check,
          createdAt: new Date(newSession.created_at),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.sessionCreateError') };
    }
  };

  const sendMessage = async (sessionId: string, content: string) => {
    if (!user?.id) return;

    // Validate message content
    const trimmed = content.trim();
    if (!trimmed || trimmed.length === 0) return;
    
    // Limit message length to prevent DoS (matches server-side trigger)
    const MAX_MESSAGE_LENGTH = 10000;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      console.error(`Message too long: ${trimmed.length} characters (max ${MAX_MESSAGE_LENGTH})`);
      return;
    }

    try {
      await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_id: user.id,
          content: trimmed,
        });

      // Update session last message (truncate for preview)
      const previewMessage = trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed;
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const isParticipant1 = session.participant1Id === user.id;
        
        // Get current unread counts from DB to ensure accuracy
        const { data: currentSession } = await supabase
          .from('chat_sessions')
          .select('unread_count_1, unread_count_2')
          .eq('id', sessionId)
          .single();
        
        const unread1 = currentSession?.unread_count_1 || 0;
        const unread2 = currentSession?.unread_count_2 || 0;
        
        await supabase
          .from('chat_sessions')
          .update({
            last_message: previewMessage,
            last_message_at: new Date().toISOString(),
            // Increment the OTHER participant's unread count
            ...(isParticipant1 
              ? { unread_count_2: unread2 + 1 }
              : { unread_count_1: unread1 + 1 }
            ),
          })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getSession = (sessionId: string): ChatSession | undefined => {
    return sessions.find(s => s.id === sessionId);
  };

  const getSessionMessages = (sessionId: string): ChatMessage[] => {
    return messages[sessionId] || [];
  };

  const getSessionsByUser = (): ChatSession[] => {
    return sessions;
  };

  const markAsRead = async (sessionId: string) => {
    if (!user?.id) return;

    try {
      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('session_id', sessionId)
        .neq('sender_id', user.id);

      // Update session unread count
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const isParticipant1 = session.participant1Id === user.id;
        await supabase
          .from('chat_sessions')
          .update(isParticipant1 ? { unread_count_1: 0 } : { unread_count_2: 0 })
          .eq('id', sessionId);
      }

      await fetchSessions();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const refreshSessions = async () => {
    await fetchSessions();
  };

  const closeSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return { success: false, error: tContext('contextErrors.sessionNotFound') };

      // Only allow doctors to close sessions
      const userType = getUserType();
      if (userType !== 'doctor') {
        return { success: false, error: tContext('contextErrors.onlyDoctorsClose') };
      }

      // Verify user is participant
      if (session.participant1Id !== user.id && session.participant2Id !== user.id) {
        return { success: false, error: tContext('contextErrors.noPermissionClose') };
      }

      const { error } = await supabase
        .from('chat_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);

      if (error) throw error;

      // Also close related consultations so the rating popup triggers
      await supabase
        .from('consultations')
        .update({ ended_at: new Date().toISOString(), status: 'completed' })
        .eq('chat_session_id', sessionId)
        .is('ended_at', null);

      // Send notification to the patient so they can rate
      const patientId = session.participant1Id === user.id ? session.participant2Id : session.participant1Id;
      const doctorName = session.participant1Id === user.id 
        ? (session.participant1Name || tContext('roles.doctor'))
        : (session.participant2Name || tContext('roles.doctor'));
      
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: patientId,
        type: 'rating_request',
        title: tContext('contextErrors.rateOrientation'),
        message: `${doctorName} ${tContext('contextErrors.rateOrientationMsg')}`,
        data: { sessionId, type: 'consultation_ended', url: '/chat' },
      });
      
      if (notifError) {
        console.error('Error sending rating notification:', notifError);
      }

      await fetchSessions();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.sessionCloseError') };
    }
  };

  return (
    <ChatContext.Provider
      value={{
        sessions,
        messages,
        isLoading,
        createSession,
        sendMessage,
        getSession,
        getSessionMessages,
        getSessionsByUser,
        markAsRead,
        refreshSessions,
        loadMessages,
        closeSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

const CHAT_DEFAULTS: ChatContextType = {
  sessions: [],
  messages: {},
  isLoading: false,
  createSession: async () => ({ success: false, error: 'Context not ready' }),
  sendMessage: async () => {},
  getSession: () => undefined,
  getSessionMessages: () => [],
  getSessionsByUser: () => [],
  markAsRead: async () => {},
  refreshSessions: async () => {},
  loadMessages: async () => {},
  closeSession: async () => ({ success: false, error: 'Context not ready' }),
};

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    console.warn('useChat called outside ChatProvider – returning defaults');
    return CHAT_DEFAULTS;
  }
  return context;
}