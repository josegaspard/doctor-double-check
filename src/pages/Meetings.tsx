import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { MeetingCreateDialog } from '@/components/meetings/MeetingCreateDialog';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { MeetingInvitations } from '@/components/meetings/MeetingInvitations';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, CalendarDays, Loader2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteToggles } from '@/hooks/useSiteToggles';

export type MeetingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  specialty: string;
  caseSummary?: string;
  status: MeetingStatus;
  scheduledAt?: Date;
  organizerId: string;
  organizerName?: string;
  meetingNotes?: string;
  meetingSummary?: string;
  dailyRoomUrl?: string;
  dailyRoomName?: string;
  createdAt: Date;
  invitationStatus?: MeetingStatus;
  congressId?: string | null;
}

export default function Meetings({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { toggles } = useSiteToggles();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [invitations, setInvitations] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setShowCreate(true);
  };

  const handleDeleteMeeting = async (meeting: Meeting) => {
    try {
      const { error } = await supabase
        .from('clinical_sessions')
        .delete()
        .eq('id', meeting.id)
        .eq('organizer_id', user?.id || '');
      if (error) throw error;
      toast.success(t('fix20.chat.meetingDeleted'));
      await fetchMeetings();
    } catch (err: any) {
      toast.error(err.message || t('fix20.chat.meetingDeleteError'));
    }
  };

  const allowedRoles = ['doctor', 'resident'];

  const fetchMeetings = useCallback(async () => {
    if (!user?.id || !allowedRoles.includes(role || '')) return;

    try {
      // My organized meetings
      const { data: mySessions } = await supabase
        .from('clinical_sessions')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });

      // My invitations
      const { data: myInvitations } = await supabase
        .from('clinical_session_invitations')
        .select('*, clinical_sessions (*)')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch organizer names
      const organizerIds = new Set<string>();
      mySessions?.forEach(s => organizerIds.add(s.organizer_id));
      myInvitations?.forEach((inv: any) => organizerIds.add(inv.clinical_sessions.organizer_id));

      let profilesMap: Record<string, string> = {};
      if (organizerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(organizerIds));
        profiles?.forEach(p => { profilesMap[p.id] = p.name; });
      }

      if (mySessions) {
        setMeetings(mySessions.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description || undefined,
          specialty: s.specialty,
          caseSummary: s.case_summary || undefined,
          status: s.status as MeetingStatus,
          scheduledAt: s.scheduled_at ? new Date(s.scheduled_at) : undefined,
          organizerId: s.organizer_id,
          organizerName: profilesMap[s.organizer_id] || t('fix20.chat.organizer'),
          meetingNotes: (s as any).meeting_notes || undefined,
          meetingSummary: (s as any).meeting_summary || undefined,
          dailyRoomUrl: (s as any).daily_room_url || undefined,
          dailyRoomName: (s as any).daily_room_name || undefined,
          createdAt: new Date(s.created_at),
          congressId: (s as any).congress_id || null,
        })));
      }

      if (myInvitations) {
        setInvitations(myInvitations.map((inv: any) => ({
          id: inv.clinical_sessions.id,
          title: inv.clinical_sessions.title,
          description: inv.clinical_sessions.description || undefined,
          specialty: inv.clinical_sessions.specialty,
          caseSummary: inv.clinical_sessions.case_summary || undefined,
          status: inv.clinical_sessions.status as MeetingStatus,
          scheduledAt: inv.clinical_sessions.scheduled_at
            ? new Date(inv.clinical_sessions.scheduled_at)
            : undefined,
          organizerId: inv.clinical_sessions.organizer_id,
          organizerName: profilesMap[inv.clinical_sessions.organizer_id] || t('fix20.chat.organizer'),
          dailyRoomUrl: inv.clinical_sessions.daily_room_url || undefined,
          dailyRoomName: inv.clinical_sessions.daily_room_name || undefined,
          createdAt: new Date(inv.clinical_sessions.created_at),
          invitationStatus: inv.status as MeetingStatus,
        })));
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, role]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  if (!allowedRoles.includes(role || '')) {
    return embedded ? null : <Navigate to="/lives" replace />;
  }

  const handleRespond = async (sessionId: string, accept: boolean) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('clinical_session_invitations')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .eq('doctor_id', user.id);

      if (error) throw error;
      toast.success(accept ? t('meetings.invitationAccepted') : t('meetings.invitationRejected'));
      await fetchMeetings();
    } catch (error: any) {
      toast.error(error.message || t('meetings.respondError'));
    }
  };

  const handleStartCall = async (meeting: Meeting) => {
    if (!user?.id) return;

    // Video calls disabled by admin toggle → don't dead-end on /video-call.
    if (!toggles.enable_video_calls) {
      toast.error(t('featureUnavailable.title') || 'Esta función no está disponible en este momento.');
      return;
    }

    // If room already exists, join it
    if (meeting.dailyRoomUrl) {
      navigate(`/video-call?room=${meeting.dailyRoomName}&url=${encodeURIComponent(meeting.dailyRoomUrl)}&meetingId=${meeting.id}`);
      return;
    }

    // Create a new Daily room
    try {
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: {
          liveId: meeting.id,
          title: meeting.title,
          mode: 'consultation',
          enableRecording: false,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create room');

      // Save room info
      await supabase
        .from('clinical_sessions')
        .update({
          daily_room_name: data.room.name,
          daily_room_url: data.room.url,
          status: 'accepted',
        } as any)
        .eq('id', meeting.id);

      navigate(`/video-call?room=${data.room.name}&url=${encodeURIComponent(data.room.url)}&meetingId=${meeting.id}&token=${data.room.ownerToken}`);
    } catch (err: any) {
      toast.error(err.message || t('meetings.createRoomError'));
    }
  };

  const handleSaveNotes = async (meetingId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('clinical_sessions')
        .update({ meeting_notes: notes, status: 'completed' } as any)
        .eq('id', meetingId);

      if (error) throw error;
      toast.success(t('meetings.notesSaved'));
      await fetchMeetings();
    } catch (err: any) {
      toast.error(err.message || t('meetings.notesSaveError'));
    }
  };

  const pendingInvitations = invitations.filter(i => i.invitationStatus === 'pending');
  const upcomingMeetings = [...meetings, ...invitations.filter(i => i.invitationStatus === 'accepted')]
    .filter(m => m.status !== 'completed' && m.status !== 'cancelled')
    .sort((a, b) => (a.scheduledAt?.getTime() || 0) - (b.scheduledAt?.getTime() || 0));
  const pastMeetings = [...meetings, ...invitations.filter(i => i.invitationStatus === 'accepted')]
    .filter(m => m.status === 'completed')
    .sort((a, b) => (b.createdAt.getTime()) - (a.createdAt.getTime()));

  const Wrapper = embedded ? React.Fragment : MainLayout;
  return (
    <Wrapper>
      <div className={embedded ? '' : 'container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl'}>
        <div className="flex items-center justify-between mb-5">
          {!embedded && (
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Video className="w-6 h-6 text-primary" />
                {t('meetings.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('meetings.subtitle')}
              </p>
            </div>
          )}
          <Button onClick={() => setShowCreate(true)} className={`gap-2${embedded ? ' bg-live hover:bg-live/90 text-white' : ''}`} size="sm">
            <Plus className="w-4 h-4" />
            {t('meetings.newMeeting')}
          </Button>
        </div>

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <MeetingInvitations
            invitations={pendingInvitations}
            onRespond={handleRespond}
          />
        )}

        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming" className="gap-2">
              <CalendarDays className="w-4 h-4" />
              {t('meetings.upcoming')}
              {upcomingMeetings.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{upcomingMeetings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">{t('meetings.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : upcomingMeetings.length > 0 ? (
              upcomingMeetings.map(m => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  isOrganizer={m.organizerId === user?.id}
                  onStartCall={handleStartCall}
                  onSaveNotes={handleSaveNotes}
                  onEdit={handleEditMeeting}
                  onDelete={handleDeleteMeeting}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t('meetings.noUpcoming')}</p>
                <Button variant={embedded ? 'default' : 'outline'} className={`mt-4 gap-2${embedded ? ' bg-live hover:bg-live/90 text-white' : ''}`} onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4" />
                  {t('meetings.schedule')}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {pastMeetings.length > 0 ? (
              pastMeetings.map(m => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  isOrganizer={m.organizerId === user?.id}
                  onStartCall={handleStartCall}
                  onSaveNotes={handleSaveNotes}
                  onDelete={handleDeleteMeeting}
                  isPast
                />
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">
                {t('meetings.noHistory')}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <MeetingCreateDialog
          open={showCreate}
          onOpenChange={(o) => { setShowCreate(o); if (!o) setEditingMeeting(null); }}
          onCreated={fetchMeetings}
          editing={editingMeeting ? {
            id: editingMeeting.id,
            title: editingMeeting.title,
            description: editingMeeting.description,
            specialty: editingMeeting.specialty,
            caseSummary: editingMeeting.caseSummary,
            scheduledAt: editingMeeting.scheduledAt,
            meetingType: undefined,
            congressId: editingMeeting.congressId,
          } : null}
        />
      </div>
    </Wrapper>
  );
}
