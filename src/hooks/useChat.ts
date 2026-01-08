import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatSession, ChatMessage, ChatParticipantType } from '@/types/database';

export function useChat(userId: string | undefined, userRole: string | undefined) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch chat sessions
  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching sessions:', error);
      } else {
        // Enrich with participant data
        const enrichedSessions = await Promise.all(
          (data || []).map(async (session) => {
            const { data: p1 } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.participant1_id)
              .single();
            
            const { data: p2 } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.participant2_id)
              .single();

            return {
              ...session,
              participant1: p1 || undefined,
              participant2: p2 || undefined,
            } as ChatSession;
          })
        );
        setSessions(enrichedSessions);
      }
    } catch (error) {
      console.error('Error in fetchSessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();

    // Subscribe to realtime updates
    if (userId) {
      const channel = supabase
        .channel('chat-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_sessions' },
          () => {
            fetchSessions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchSessions, userId]);

  // Get messages for a session
  const getMessages = async (sessionId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    // Enrich with sender data
    const enrichedMessages = await Promise.all(
      (data || []).map(async (msg) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', msg.sender_id)
          .single();

        return {
          ...msg,
          sender: sender || undefined,
        } as ChatMessage;
      })
    );

    return enrichedMessages;
  };

  // Create a new session
  const createSession = async (
    participant2Id: string,
    participant1Type: ChatParticipantType,
    participant2Type: ChatParticipantType,
    isDoubleCheck: boolean = false,
    originalConsultationId?: string
  ): Promise<{ success: boolean; session?: ChatSession; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };

    // Check for restriction: No patient-resident chat
    if (
      (participant1Type === 'patient' && participant2Type === 'resident') ||
      (participant1Type === 'resident' && participant2Type === 'patient')
    ) {
      return { success: false, error: 'No se permite chat entre pacientes y residentes' };
    }

    try {
      // Check if session already exists
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('*')
        .or(`and(participant1_id.eq.${userId},participant2_id.eq.${participant2Id}),and(participant1_id.eq.${participant2Id},participant2_id.eq.${userId})`)
        .eq('is_double_check', isDoubleCheck)
        .single();

      if (existing) {
        return { success: true, session: existing as ChatSession };
      }

      // Create new session
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          participant1_id: userId,
          participant1_type: participant1Type,
          participant2_id: participant2Id,
          participant2_type: participant2Type,
          is_double_check: isDoubleCheck,
          original_consultation_id: originalConsultationId,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await fetchSessions();
      return { success: true, session: data as ChatSession };
    } catch (error) {
      return { success: false, error: 'Error al crear sesión' };
    }
  };

  // Send a message
  const sendMessage = async (sessionId: string, content: string): Promise<{ success: boolean }> => {
    if (!userId) return { success: false };

    try {
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_id: userId,
          content,
        });

      if (msgError) {
        console.error('Error sending message:', msgError);
        return { success: false };
      }

      // Update session last message
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const isParticipant1 = session.participant1_id === userId;
        
        await supabase
          .from('chat_sessions')
          .update({
            last_message: content,
            last_message_at: new Date().toISOString(),
            ...(isParticipant1 
              ? { unread_count_2: session.unread_count_2 + 1 }
              : { unread_count_1: session.unread_count_1 + 1 }
            ),
          })
          .eq('id', sessionId);
      }

      await fetchSessions();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  // Mark messages as read
  const markAsRead = async (sessionId: string): Promise<void> => {
    if (!userId) return;

    try {
      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('session_id', sessionId)
        .neq('sender_id', userId);

      // Reset unread count
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const isParticipant1 = session.participant1_id === userId;
        
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

  // Get session by ID
  const getSession = (sessionId: string): ChatSession | undefined => {
    return sessions.find(s => s.id === sessionId);
  };

  // Subscribe to messages in a session (realtime)
  const subscribeToMessages = (sessionId: string, callback: (message: ChatMessage) => void) => {
    const channel = supabase
      .channel(`messages-${sessionId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          // Fetch the complete message with sender info
          const { data: msg } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('id', (payload.new as any).id)
            .single();

          if (msg) {
            const { data: sender } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', msg.sender_id)
              .single();

            callback({
              ...msg,
              sender: sender || undefined,
            } as ChatMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    sessions,
    isLoading,
    createSession,
    sendMessage,
    markAsRead,
    getSession,
    getMessages,
    subscribeToMessages,
    refresh: fetchSessions,
  };
}
