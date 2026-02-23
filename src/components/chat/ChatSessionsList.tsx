import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History } from 'lucide-react';
import { ChatSessionItem } from '@/components/chat/ChatSessionItem';
import { EmptyState } from '@/components/chat/EmptyState';
import { ChatSession } from '@/contexts/ChatContext';

interface SessionDisplayInfo {
  name: string;
  specialty?: string;
  avatar?: string;
  type: string;
}

interface Props {
  activeSessions: ChatSession[];
  closedSessions: ChatSession[];
  selectedSession: string | null;
  activeTab: 'active' | 'history';
  userRole: string;
  onTabChange: (tab: 'active' | 'history') => void;
  onSelectSession: (id: string) => void;
  getDisplayInfo: (session: ChatSession) => SessionDisplayInfo;
  formatOfficeHours: (session: ChatSession) => string | null;
  isWithinOfficeHours: (session: ChatSession) => boolean;
  getDoctorId: (session: ChatSession) => string | null;
  onDoctorProfileClick: (e: React.MouseEvent, session: ChatSession) => void;
  hidden?: boolean;
}

export function ChatSessionsList({
  activeSessions,
  closedSessions,
  selectedSession,
  activeTab,
  userRole,
  onTabChange,
  onSelectSession,
  getDisplayInfo,
  formatOfficeHours,
  isWithinOfficeHours,
  getDoctorId,
  onDoctorProfileClick,
  hidden = false,
}: Props) {
  const sessions = activeTab === 'active' ? activeSessions : closedSessions;

  return (
    <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-gradient-to-b from-blue-50/70 to-sky-50/30 dark:from-primary/[0.06] dark:to-transparent ${hidden ? 'hidden md:flex' : 'flex'}`}>
      <CardHeader className="pb-3 pt-4 px-3 flex-shrink-0 space-y-3">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'active' | 'history')} className="w-full">
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
            {sessions.length > 0 ? (
              sessions.map(session => {
                const displayInfo = getDisplayInfo(session);
                const officeHours = formatOfficeHours(session);
                const isAvailable = isWithinOfficeHours(session);
                const canOpenDoctorProfile = userRole === 'patient' && getDoctorId(session) !== null;

                return (
                  <ChatSessionItem
                    key={session.id}
                    session={session}
                    isSelected={selectedSession === session.id}
                    displayInfo={displayInfo}
                    officeHours={officeHours}
                    isAvailable={isAvailable}
                    canOpenDoctorProfile={canOpenDoctorProfile}
                    userRole={userRole}
                    onClick={() => onSelectSession(session.id)}
                    onDoctorProfileClick={(e) => onDoctorProfileClick(e, session)}
                  />
                );
              })
            ) : (
              <EmptyState type="no-sessions" activeTab={activeTab} />
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
