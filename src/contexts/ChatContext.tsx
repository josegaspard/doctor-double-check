import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChatSession, ChatMessage } from '@/types';
import { useAuth } from './AuthContext';

interface ChatContextType {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
  isLoading: boolean;
  createSession: (patientId: string, patientName: string, doctorId: string, doctorName: string) => Promise<ChatSession>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  getSession: (sessionId: string) => ChatSession | undefined;
  getSessionMessages: (sessionId: string) => ChatMessage[];
  getSessionsByUser: () => ChatSession[];
  markAsRead: (sessionId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Mock initial sessions
const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'chat-001',
    patientId: 'patient-001',
    patientName: 'María García',
    doctorId: 'doctor-001',
    doctorName: 'Dr. Carlos Mendoza',
    lastMessage: 'Gracias doctor, seguiré sus indicaciones.',
    lastMessageAt: new Date('2024-03-20T14:30:00'),
    unreadCount: 0,
    status: 'active',
    createdAt: new Date('2024-03-01'),
  },
];

// Mock initial messages
const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  'chat-001': [
    {
      id: 'msg-001',
      sessionId: 'chat-001',
      senderId: 'patient-001',
      senderRole: 'patient',
      content: 'Buenos días doctor, tengo una duda sobre mi tratamiento.',
      timestamp: new Date('2024-03-20T10:00:00'),
      read: true,
    },
    {
      id: 'msg-002',
      sessionId: 'chat-001',
      senderId: 'doctor-001',
      senderRole: 'doctor',
      content: 'Buenos días María, con gusto la ayudo. ¿Cuál es su duda?',
      timestamp: new Date('2024-03-20T10:15:00'),
      read: true,
    },
    {
      id: 'msg-003',
      sessionId: 'chat-001',
      senderId: 'patient-001',
      senderRole: 'patient',
      content: 'El medicamento para la presión, ¿debo tomarlo antes o después del desayuno?',
      timestamp: new Date('2024-03-20T10:20:00'),
      read: true,
    },
    {
      id: 'msg-004',
      sessionId: 'chat-001',
      senderId: 'doctor-001',
      senderRole: 'doctor',
      content: 'Lo ideal es tomarlo en ayunas, 30 minutos antes del desayuno. Esto permite una mejor absorción del medicamento.',
      timestamp: new Date('2024-03-20T14:00:00'),
      read: true,
    },
    {
      id: 'msg-005',
      sessionId: 'chat-001',
      senderId: 'patient-001',
      senderRole: 'patient',
      content: 'Gracias doctor, seguiré sus indicaciones.',
      timestamp: new Date('2024-03-20T14:30:00'),
      read: true,
    },
  ],
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const storedSessions = localStorage.getItem('drDoubleCheck_chatSessions');
    const storedMessages = localStorage.getItem('drDoubleCheck_chatMessages');

    if (storedSessions) {
      const parsed = JSON.parse(storedSessions).map((s: any) => ({
        ...s,
        lastMessageAt: s.lastMessageAt ? new Date(s.lastMessageAt) : undefined,
        createdAt: new Date(s.createdAt),
      }));
      setSessions(parsed);
    } else {
      setSessions(INITIAL_SESSIONS);
      localStorage.setItem('drDoubleCheck_chatSessions', JSON.stringify(INITIAL_SESSIONS));
    }

    if (storedMessages) {
      const parsed: Record<string, ChatMessage[]> = {};
      const data = JSON.parse(storedMessages);
      Object.keys(data).forEach(sessionId => {
        parsed[sessionId] = data[sessionId].map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      });
      setMessages(parsed);
    } else {
      setMessages(INITIAL_MESSAGES);
      localStorage.setItem('drDoubleCheck_chatMessages', JSON.stringify(INITIAL_MESSAGES));
    }
  }, []);

  const saveSessions = (newSessions: ChatSession[]) => {
    localStorage.setItem('drDoubleCheck_chatSessions', JSON.stringify(newSessions));
  };

  const saveMessages = (newMessages: Record<string, ChatMessage[]>) => {
    localStorage.setItem('drDoubleCheck_chatMessages', JSON.stringify(newMessages));
  };

  const createSession = async (
    patientId: string,
    patientName: string,
    doctorId: string,
    doctorName: string
  ): Promise<ChatSession> => {
    // Check if session already exists
    const existing = sessions.find(
      s => s.patientId === patientId && s.doctorId === doctorId && s.status === 'active'
    );
    if (existing) return existing;

    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      patientId,
      patientName,
      doctorId,
      doctorName,
      unreadCount: 0,
      status: 'active',
      createdAt: new Date(),
    };

    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    saveSessions(newSessions);

    return newSession;
  };

  const sendMessage = async (sessionId: string, content: string) => {
    if (!user) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId,
      senderId: user.id,
      senderRole: user.role === 'doctor' ? 'doctor' : 'patient',
      content,
      timestamp: new Date(),
      read: false,
    };

    const sessionMessages = messages[sessionId] || [];
    const newSessionMessages = [...sessionMessages, newMessage];
    const newMessages = { ...messages, [sessionId]: newSessionMessages };
    setMessages(newMessages);
    saveMessages(newMessages);

    // Update session last message
    const newSessions = sessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          lastMessage: content,
          lastMessageAt: new Date(),
          unreadCount: s.unreadCount + 1,
        };
      }
      return s;
    });
    setSessions(newSessions);
    saveSessions(newSessions);
  };

  const getSession = (sessionId: string): ChatSession | undefined => {
    return sessions.find(s => s.id === sessionId);
  };

  const getSessionMessages = (sessionId: string): ChatMessage[] => {
    return messages[sessionId] || [];
  };

  const getSessionsByUser = (): ChatSession[] => {
    if (!user) return [];
    
    if (user.role === 'doctor') {
      return sessions.filter(s => s.doctorId === user.id);
    }
    return sessions.filter(s => s.patientId === user.id);
  };

  const markAsRead = (sessionId: string) => {
    if (!user) return;

    const sessionMsgs = messages[sessionId];
    if (!sessionMsgs) return;

    const updatedMessages = sessionMsgs.map(m => {
      if (m.senderId !== user.id && !m.read) {
        return { ...m, read: true };
      }
      return m;
    });

    const newMessages = { ...messages, [sessionId]: updatedMessages };
    setMessages(newMessages);
    saveMessages(newMessages);

    // Reset unread count
    const newSessions = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, unreadCount: 0 };
      }
      return s;
    });
    setSessions(newSessions);
    saveSessions(newSessions);
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
