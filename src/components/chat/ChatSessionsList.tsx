import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { MessageSquare, History, Trash2, X, Info, Search } from 'lucide-react';
import { ChatSessionItem } from '@/components/chat/ChatSessionItem';
import { EmptyState } from '@/components/chat/EmptyState';
import { ChatSession, useChat } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteSession = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteSession(deleteConfirmId);
    if (result.success) {
      toast.success(t('fix20.chat.chatDeleted'));
    } else {
      toast.error(result.error || t('fix20.chat.deleteError'));
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
      toast.success(`${selectedIds.size} chat(s) eliminado(s)`); // interpolated — skipped per i18n rules
      exitSelectionMode();
    } else {
      toast.error(result.error || t('fix20.chat.deleteError'));
    }
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
  };

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const info = getDisplayInfo(session);
    if (info.name.toLowerCase().includes(query)) return true;
    if (info.specialty?.toLowerCase().includes(query)) return true;
    if (session.lastMessage?.toLowerCase().includes(query)) return true;
    return false;
  });

  return (
    <>
    <Card className={`flex flex-col min-h-0 max-h-full overflow-hidden border-0 shadow-lg bg-card ${hidden ? 'hidden md:flex' : 'flex'}`}>
      <CardHeader className="pb-3 pt-4 px-3 flex-shrink-0 space-y-3">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'active' | 'history')} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-12">
            <TabsTrigger value="active" className="gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>{t('chat.active')}</span>
              {activeSessions.length > 0 && (
                <Badge className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {activeSessions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="w-4 h-4" />
              <span>{t('chat.history')}</span>
              {closedSessions.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {closedSessions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('fix20.chat.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 text-base"
          />
        </div>

        {/* Selection mode toolbar for history */}
        {activeTab === 'history' && closedSessions.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1">
            {isSelecting ? (
              <div className="space-y-2 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.size === closedSessions.length && closedSessions.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="h-4 w-4"
                    />
                    <span className="text-xs font-medium">
                      {selectedIds.size > 0
                        ? `${selectedIds.size} ${t('chat.selected')}`
                        : t('chat.selectAll')}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={exitSelectionMode} className="h-7 px-2 text-xs gap-1">
                    <X className="w-3 h-3" />
                    {t('common.cancel')}
                  </Button>
                </div>
                {selectedIds.size === 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 rounded-md px-2.5 py-1.5">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    {t('chat.selectHint')}
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelecting(true)}
                className="h-7 px-2.5 text-xs gap-1.5 ml-auto text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('chat.selectToDelete')}
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-2 flex-1 min-h-0 overflow-hidden">
        {/* Scroll NATIVO: el ScrollArea de Radix envuelve el contenido en un div
            display:table que ignora min-w-0/truncate — las filas se desbordaban
            de la tarjeta en móvil (hora y preview cortados fuera del borde). */}
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="space-y-1 pr-1 sm:pr-2">
            {filteredSessions.length > 0 ? (
              filteredSessions.map(session => {
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
            ) : searchQuery.trim() ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{t('fix20.chat.noSearchResults')} "{searchQuery}"</p>
              </div>
            ) : (
              <EmptyState type="no-sessions" activeTab={activeTab} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Single delete confirmation */}
    <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('chat.deleteChat')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('chat.deleteChatDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Floating bulk delete bar */}
    {isSelecting && selectedIds.size > 0 && (
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
        <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl p-3">
          <Button
            variant="destructive"
            className="w-full gap-2 h-11 text-sm font-medium"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete')} ({selectedIds.size})
          </Button>
        </div>
      </div>
    )}

    {/* Bulk delete confirmation */}
    <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('chat.deleteBulkTitle')} ({selectedIds.size})</AlertDialogTitle>
          <AlertDialogDescription>
            {t('chat.deleteBulkDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isBulkDeleting ? t('chat.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
