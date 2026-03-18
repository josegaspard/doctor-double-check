import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveLiveSession {
  liveId: string;
  title: string;
  dailyRoomUrl: string;
  dailyOwnerToken: string;
  dailyRoomName: string;
  enableRecording: boolean;
  tags: string[];
  recordingPrice: number;
  liveStartedAt: Date;
  specialty: string;
  description: string;
}

interface ActiveLiveContextType {
  session: ActiveLiveSession | null;
  setSession: (session: ActiveLiveSession) => void;
  clearSession: () => void;
}

const ActiveLiveContext = createContext<ActiveLiveContextType>({
  session: null,
  setSession: () => {},
  clearSession: () => {},
});

export function ActiveLiveProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<ActiveLiveSession | null>(null);

  const setSession = useCallback((s: ActiveLiveSession) => setSessionState(s), []);
  const clearSession = useCallback(() => setSessionState(null), []);

  return (
    <ActiveLiveContext.Provider value={{ session, setSession, clearSession }}>
      {children}
    </ActiveLiveContext.Provider>
  );
}

export function useActiveLive() {
  return useContext(ActiveLiveContext);
}
