import React, { useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatSession, useChat } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
import { formatMessagePreview } from '@/lib/utils';
import {
  Search, MessageSquare, Trash2, X, MoreVertical, Archive, ArchiveRestore,
  SlidersHorizontal, Check, Info,
} from 'lucide-react';
import { initialsOf, fill, dayLabel, fmtTime } from '@/lib/proFormat';

export type ConvSort = 'recent' | 'unread' | 'priority' | 'name';

interface DisplayInfo { name: string; specialty?: string; avatar?: string; type: string; userId: string }

interface Props {
  sessions: ChatSession[];
  selectedSession: string | null;
  query: string;
  sort: ConvSort;
  archivedIds: Set<string>;
  showingArchived: boolean;
  onQueryChange: (q: string) => void;
  onSortChange: (s: ConvSort) => void;
  onSelect: (id: string) => void;
  onToggleArchive: (id: string) => void;
  getDisplayInfo: (s: ChatSession) => DisplayInfo;
  isWithinOfficeHours: (s: ChatSession) => boolean;
  emptyLabel: string;
}

/**
 * Lista de conversaciones — diseño PRO, 2.ª tanda (8-sep-2026).
 *
 * Reemplaza a `ChatSessionsList` en la pantalla nueva conservando TODO lo que
 * aquella hacía: buscador, borrado de una conversación, modo selección con
 * borrado múltiple de las finalizadas, y el aviso de disponibilidad.
 * Añade lo que pedía la maqueta: etiqueta de relación, estado y archivo.
 */
export function ProChatList({
  sessions, selectedSession, query, sort, archivedIds, showingArchived,
  onQueryChange, onSortChange, onSelect, onToggleArchive,
  getDisplayInfo, isWithinOfficeHours, emptyLabel,
}: Props) {
  const { t, language } = useLanguage();
  const { deleteSession, deleteSessions } = useChat();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const closedOnes = sessions.filter(s => s.status === 'closed');

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === closedOnes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(closedOnes.map(s => s.id)));
  };
  const exitSelection = () => { setIsSelecting(false); setSelectedIds(new Set()); };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const result = await deleteSession(deleteConfirmId);
    if (result.success) toast.success(t('fix20.chat.chatDeleted'));
    else toast.error(result.error || t('fix20.chat.deleteError'));
    setDeleteConfirmId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    const result = await deleteSessions(Array.from(selectedIds));
    if (result.success) { toast.success(t('fix20.chat.chatDeleted')); exitSelection(); }
    else toast.error(result.error || t('fix20.chat.deleteError'));
    setIsBulkDeleting(false);
    setShowBulkConfirm(false);
  };

  const tagOf = (s: ChatSession, info: DisplayInfo) => {
    if (s.isDoubleCheck) return { label: t('pro.chatPro.tagOrientation'), cls: 'pro-tag-orientation' };
    if (s.marketplaceInterestId) return { label: t('pro.chatPro.tagProvider'), cls: 'pro-tag-provider' };
    if (info.type === 'patient') return { label: t('pro.chatPro.tagPatient'), cls: 'pro-tag-patient' };
    return { label: t('pro.chatPro.tagDoctor'), cls: 'pro-tag-doctor' };
  };

  const stateOf = (s: ChatSession) => {
    if (s.status === 'closed') return { label: t('pro.chatPro.statusClosed'), cls: 'pro-mini-muted' };
    if (s.unreadCount > 0) return { label: t('pro.chatPro.statusPending'), cls: 'pro-mini-warn' };
    if (s.isDoubleCheck) return { label: t('pro.chatPro.statusOngoing'), cls: 'pro-mini-info' };
    return { label: t('pro.chatPro.statusFollowUp'), cls: 'pro-mini-ok' };
  };

  const sortLabel = sort === 'unread' ? t('pro.chatPro.sortUnread')
    : sort === 'priority' ? t('pro.chatPro.sortPriority')
    : sort === 'name' ? t('pro.chatPro.sortName')
    : t('pro.chatPro.sortRecent');

  return (
    <>
      <div className="flex items-center gap-2 p-2.5 pb-2">
        <label className="pro-search flex-1">
          <Search />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={t('pro.chatPro.searchPlaceholder')}
            aria-label={t('pro.chatPro.searchPlaceholder')}
          />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" aria-label={t('pro.chatPro.filters')} title={sortLabel}>
              <SlidersHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSortChange('recent')}>{t('pro.chatPro.sortRecent')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('unread')}>{t('pro.chatPro.sortUnread')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('priority')}>{t('pro.chatPro.sortPriority')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('name')}>{t('pro.chatPro.sortName')}</DropdownMenuItem>
            {closedOnes.length > 0 && !isSelecting && (
              <DropdownMenuItem onClick={() => setIsSelecting(true)}>{t('pro.chatPro.selectToDelete')}</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isSelecting && (
        <div className="px-2.5 pb-2">
          <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2" style={{ background: '#f5fafb', border: '1px solid #e3ecf0' }}>
            <label className="flex items-center gap-2 text-[12px] font-semibold pro-ink-2 min-w-0">
              <Checkbox
                checked={selectedIds.size === closedOnes.length && closedOnes.length > 0}
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4 bg-white"
              />
              <span className="truncate">
                {selectedIds.size > 0 ? `${selectedIds.size} ${t('chat.selected')}` : t('chat.selectAll')}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={exitSelection}><X /> {t('common.cancel')}</button>
              <button type="button" className="pro-btn pro-btn-live pro-btn-xs" disabled={selectedIds.size === 0} onClick={() => setShowBulkConfirm(true)}>
                <Trash2 /> {selectedIds.size}
              </button>
            </div>
          </div>
          {selectedIds.size === 0 && (
            <p className="text-[11px] pro-muted mt-1.5 flex items-center gap-1.5"><Info className="w-3 h-3" /> {t('chat.selectHint')}</p>
          )}
        </div>
      )}

      <div className="pro-scroll flex-1 px-1.5 pb-2">
        {sessions.length === 0 ? (
          <div className="text-center py-10 px-3">
            <span className="pro-icon-box mx-auto mb-2"><MessageSquare /></span>
            <p className="text-[13px] pro-muted">{query.trim() ? fill(t('pro.chatPro.noResults'), { q: query.trim() }) : emptyLabel}</p>
          </div>
        ) : sessions.map(s => {
          const info = getDisplayInfo(s);
          const tag = tagOf(s, info);
          const state = stateOf(s);
          const isArchived = archivedIds.has(s.id);
          const available = isWithinOfficeHours(s);
          return (
            <div key={s.id} className={`pro-conv ${selectedSession === s.id ? 'is-active' : ''}`}>
              {isSelecting && s.status === 'closed' && (
                <span className="pt-1" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} className="h-4 w-4 bg-white" />
                </span>
              )}
              <button type="button" className="flex gap-2.5 flex-1 min-w-0 text-left" onClick={() => isSelecting && s.status === 'closed' ? toggleSelect(s.id) : onSelect(s.id)}>
                <span className="pro-initials relative" style={{ width: 44, height: 44, fontSize: 14 }}>
                  {info.avatar ? <img src={info.avatar} alt="" /> : initialsOf(info.name)}
                </span>
                <span className="body">
                  <span className="top">
                    <span className="name">{info.name}</span>
                    {/* La insignia del médico se veía en la lista antes del rediseño */}
                    {info.type !== 'patient' && <DoctorBadgeIcon userId={info.userId} size="sm" className="flex-shrink-0" />}
                    <span className={`pro-tag ${tag.cls}`}>{tag.label}</span>
                    <span className="time">
                      {/* Con el idioma del usuario, no con «es» a fuego. Si es hoy
                          solo va la hora; el resto de días, día + hora. */}
                      {s.lastMessageAt ? (() => {
                        const d = new Date(s.lastMessageAt);
                        const hoy = new Date();
                        const mismoDia = d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
                        return mismoDia ? fmtTime(d, language) : `${dayLabel(d, language, t)} ${fmtTime(d, language)}`;
                      })() : ''}
                    </span>
                  </span>
                  {info.specialty && <span className="sub block">{info.specialty}</span>}
                  {/* `formatMessagePreview` convierte «📷 [Imagen: x.jpg] https://…»
                      en «📷 Foto» (y «📋 Receta médica»), como en la campana. */}
                  <span className="prev block">
                    {s.lastMessage ? formatMessagePreview(s.lastMessage, 80) : t('chat.noConversations')}
                  </span>
                  <span className="foot">
                    <span className={`pro-mini ${state.cls}`}>{state.label}</span>
                    {info.type !== 'patient' && (
                      <span className={`pro-mini ${available ? 'pro-mini-ok' : 'pro-mini-muted'}`}>
                        {available ? t('pro.chatPro.ctxAvailable') : t('pro.chatPro.ctxOutside')}
                      </span>
                    )}
                    {isArchived && <span className="pro-tag">{t('pro.chatPro.railArchived')}</span>}
                    {s.unreadCount > 0 && <span className="unread ml-auto">{s.unreadCount}</span>}
                  </span>
                </span>
              </button>
              {!isSelecting && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="pro-kebab self-start" aria-label={t('pro.chatPro.filters')}><MoreVertical /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onToggleArchive(s.id)}>
                      {isArchived ? <><ArchiveRestore className="w-4 h-4 mr-2" />{t('pro.chatPro.unarchive')}</> : <><Archive className="w-4 h-4 mr-2" />{t('pro.chatPro.archive')}</>}
                    </DropdownMenuItem>
                    {s.status === 'closed' && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(s.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />{t('common.delete')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {showingArchived && sessions.length > 0 && (
          <p className="text-[11px] pro-muted px-2.5 py-2">{t('pro.chatPro.archiveHint')}</p>
        )}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteChat')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.deleteChatDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteBulkTitle')} ({selectedIds.size})</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.deleteBulkDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isBulkDeleting ? t('chat.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
