import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Video, Calendar, Clock, CheckCircle, XCircle,
  FileText, ChevronDown, ChevronUp, User, Pencil, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Meeting, MeetingStatus } from '@/pages/Meetings';

interface MeetingCardProps {
  meeting: Meeting;
  isOrganizer: boolean;
  onStartCall: (meeting: Meeting) => void;
  onSaveNotes: (meetingId: string, notes: string) => void;
  onEdit?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
  isPast?: boolean;
}

export function MeetingCard({ meeting, isOrganizer, onStartCall, onSaveNotes, onEdit, onDelete, isPast }: MeetingCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { language, t } = useLanguage();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(meeting.meetingNotes || '');

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusBadge = (status: MeetingStatus) => {
    const map: Record<MeetingStatus, { variant: any; icon: any; label: string }> = {
      pending: { variant: 'warning', icon: Clock, label: t('meetingCard.status.pending') },
      accepted: { variant: 'verified', icon: CheckCircle, label: t('meetingCard.status.accepted') },
      rejected: { variant: 'destructive', icon: XCircle, label: t('meetingCard.status.rejected') },
      completed: { variant: 'secondary', icon: CheckCircle, label: t('meetingCard.status.completed') },
      cancelled: { variant: 'outline', icon: XCircle, label: t('meetingCard.status.cancelled') },
    };
    const { variant, icon: Icon, label } = map[status] || map.pending;
    return (
      <Badge variant={variant} className="gap-1 text-[10px]">
        <Icon className="w-3 h-3" />{label}
      </Badge>
    );
  };

  const isCallable = !isPast && (meeting.status === 'accepted' || meeting.status === 'pending');

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h3 className="font-semibold text-sm truncate">{meeting.title}</h3>
              {getStatusBadge(meeting.status)}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-2">
              <Badge variant="outline" className="text-[10px]">{meeting.specialty}</Badge>
              {!isOrganizer && meeting.organizerName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {meeting.organizerName}
                </span>
              )}
            </div>

            {meeting.scheduledAt && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <Calendar className="w-3 h-3 text-primary" />
                {formatDate(meeting.scheduledAt)}
              </p>
            )}

            {meeting.caseSummary && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {meeting.caseSummary}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {isCallable && isOrganizer && (
              <Button size="sm" className="gap-1.5" onClick={() => onStartCall(meeting)}>
                <Video className="w-3.5 h-3.5" />
                {t('meetingCard.actions.start')}
              </Button>
            )}
            {isCallable && !isOrganizer && meeting.dailyRoomUrl && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onStartCall(meeting)}>
                <Video className="w-3.5 h-3.5" />
                {t('meetingCard.actions.join')}
              </Button>
            )}
            {isOrganizer && !isPast && onEdit && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => onEdit(meeting)}>
                <Pencil className="w-3.5 h-3.5" />
                {t('meetingCard.actions.edit')}
              </Button>
            )}
            {isOrganizer && onDelete && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('meetingCard.actions.delete')}
              </Button>
            )}
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('meetingCard.deleteDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{meeting.title}</strong><br />
                {t('meetingCard.deleteDialog.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('meetingCard.deleteDialog.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { onDelete?.(meeting); setConfirmDelete(false); }}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('meetingCard.deleteDialog.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Notes section */}
        {(isOrganizer || meeting.meetingNotes) && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="w-3 h-3" />
              {meeting.meetingNotes ? t('meetingCard.notes.view') : t('meetingCard.notes.add')}
              {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showNotes && (
              <div className="mt-2 space-y-2">
                {isOrganizer ? (
                  <>
                    <Textarea
                      placeholder={t('meetingCard.notes.placeholder')}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSaveNotes(meeting.id, notes)}
                      className="text-xs"
                    >
                      {t('meetingCard.notes.save')}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    {meeting.meetingNotes || t('meetingCard.notes.empty')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
