import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Trash2, X, CheckSquare } from 'lucide-react';
import { ChatSessionItem } from '@/components/chat/ChatSessionItem';
import { EmptyState } from '@/components/chat/EmptyState';
import { ChatSession, useChat } from '@/contexts/ChatContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

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
  const { deleteSession, deleteSessions } = useChat();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleDeleteSession = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteSession(deleteConfirmId);
    if (result.success) {
      toast.success('Chat eliminado');
    } else {
      toast.error(result.error || 'Error al eliminar');
    }
    setDeleteConfirmId(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === closedSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(closedSessions.map(s => s.id)));
    }
  };

  const exitSelectionMode = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    const result = await deleteSessions(Array.from(selectedIds));
    if (result.success) {
      toast.success(`${selectedIds.size} chat(s) eliminado(s)`);
      exitSelectionMode();
    } else {
      toast.error(result.error || 'Error al eliminar');
    }
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
  };

  return (
    <>
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

        {/* Selection mode toolbar for history */}
        {activeTab === 'history' && closedSessions.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            {isSelecting ? (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size === closedSessions.length && closedSessions.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} seleccionado(s)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={exitSelectionMode} className="h-7 px-2 text-xs gap-1">
                  <X className="w-3 h-3" />
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelecting(true)}
                className="h-7 px-2 text-xs gap-1 ml-auto"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Seleccionar
              </Button>
            )}
          </div>
        )}
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
                    onDelete={!isSelecting && session.status === 'closed' ? (e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(session.id);
                    } : undefined}
                    isSelecting={isSelecting && activeTab === 'history'}
                    isChecked={selectedIds.has(session.id)}
                    onCheckChange={() => toggleSelect(session.id)}
                  />
                );
              })
            ) : (
              <EmptyState type="no-sessions" activeTab={activeTab} />
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Floating bulk delete bar */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="p-2 border-t bg-background/95 backdrop-blur-sm">
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4" />
            Eliminar ({selectedIds.size})
          </Button>
        </div>
      )}
    </Card>

    {/* Single delete confirmation */}
    <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este chat?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán todos los mensajes de esta conversación. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Bulk delete confirmation */}
    <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {selectedIds.size} chat(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán todos los mensajes de las conversaciones seleccionadas. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isBulkDeleting ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
