import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Plus,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

import { SPECIALTIES_LIST as SPECIALTIES } from '@/lib/specialties';
import { SearchableFilter } from '@/components/filters/SearchableFilter';

type SessionStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

interface ClinicalSession {
  id: string;
  title: string;
  description?: string;
  specialty: string;
  caseSummary?: string;
  status: SessionStatus;
  scheduledAt?: Date;
  organizerId: string;
  organizerName?: string;
  createdAt: Date;
  invitationStatus?: SessionStatus;
}

export default function ClinicalSessions() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [sessions, setSessions] = useState<ClinicalSession[]>([]);
  const [invitations, setInvitations] = useState<ClinicalSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    specialty: '',
    caseSummary: '',
    scheduledAt: '',
  });

  const isApproved = role === 'doctor' && user?.doctorProfile?.status === 'approved';

  const fetchSessions = useCallback(async () => {
    if (!user?.id || role !== 'doctor') return;

    try {
      const { data: mySessions } = await supabase
        .from('clinical_sessions')
        .select('*')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });

      const { data: myInvitations } = await supabase
        .from('clinical_session_invitations')
        .select('*, clinical_sessions (*)')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (mySessions) {
        setSessions(mySessions.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description || undefined,
          specialty: s.specialty,
          caseSummary: s.case_summary || undefined,
          status: s.status as SessionStatus,
          scheduledAt: s.scheduled_at ? new Date(s.scheduled_at) : undefined,
          organizerId: s.organizer_id,
          createdAt: new Date(s.created_at),
        })));
      }

      if (myInvitations) {
        setInvitations(myInvitations.map((inv: any) => ({
          id: inv.clinical_sessions.id,
          title: inv.clinical_sessions.title,
          description: inv.clinical_sessions.description || undefined,
          specialty: inv.clinical_sessions.specialty,
          caseSummary: inv.clinical_sessions.case_summary || undefined,
          status: inv.clinical_sessions.status as SessionStatus,
          scheduledAt: inv.clinical_sessions.scheduled_at 
            ? new Date(inv.clinical_sessions.scheduled_at) 
            : undefined,
          organizerId: inv.clinical_sessions.organizer_id,
          createdAt: new Date(inv.clinical_sessions.created_at),
          invitationStatus: inv.status as SessionStatus,
        })));
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, role]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Redirect non-doctors using declarative Navigate
  if (role !== 'doctor') {
    return <Navigate to="/lives" replace />;
  }

  const handleCreateSession = async () => {
    if (!newSession.title.trim() || !newSession.specialty || !user?.id) return;

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('clinical_sessions')
        .insert({
          title: newSession.title,
          description: newSession.description || null,
          specialty: newSession.specialty,
          case_summary: newSession.caseSummary || null,
          scheduled_at: newSession.scheduledAt || null,
          organizer_id: user.id,
        });

      if (error) throw error;

      toast.success(t('clinicalSessions.created'));
      setShowCreateDialog(false);
      setNewSession({ title: '', description: '', specialty: '', caseSummary: '', scheduledAt: '' });
      await fetchSessions();
    } catch (error: any) {
      toast.error(error.message || t('clinicalSessions.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRespondToInvitation = async (sessionId: string, accept: boolean) => {
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

      toast.success(accept ? t('clinicalSessions.accepted') : t('clinicalSessions.rejected'));
      await fetchSessions();
    } catch (error: any) {
      toast.error(error.message || t('clinicalSessions.respondError'));
    }
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{t('clinicalSessions.statusPending')}</Badge>;
      case 'accepted':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{t('clinicalSessions.statusAccepted')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('clinicalSessions.statusRejected')}</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3" />{t('clinicalSessions.statusCompleted')}</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" />{t('clinicalSessions.statusCancelled')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {t('clinicalSessions.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('clinicalSessions.subtitle')}
            </p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!isApproved}>
                <Plus className="w-4 h-4" />
                {t('clinicalSessions.newSession')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('clinicalSessions.createTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">{t('clinicalSessions.sessionTitle')} *</label>
                  <Input
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder={t('autoI18n.clClinicalSess1')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('clinicalSessions.requiredSpecialty')} *</label>
                  <SearchableFilter
                    options={SPECIALTIES}
                    value={newSession.specialty}
                    onChange={(value) => setNewSession({ ...newSession, specialty: value })}
                    placeholder={t('clinicalSessions.selectSpecialty')}
                    searchPlaceholder={t('autoI18n.clClinicalSess2')}
                    icon={Stethoscope}
                    allLabel=""
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('clinicalSessions.caseSummary')}</label>
                  <Textarea
                    value={newSession.caseSummary}
                    onChange={(e) => setNewSession({ ...newSession, caseSummary: e.target.value })}
                    placeholder={t('clinicalSessions.caseSummaryPlaceholder')}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('clinicalSessions.scheduledDate')}</label>
                  <Input
                    type="datetime-local"
                    value={newSession.scheduledAt}
                    onChange={(e) => setNewSession({ ...newSession, scheduledAt: e.target.value })}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateSession}
                  disabled={isCreating || !newSession.title.trim() || !newSession.specialty}
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('clinicalSessions.createButton')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!isApproved && (
          <Card className="mb-6 border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t('clinicalSessions.verificationRequired')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {invitations.filter(i => i.invitationStatus === 'pending').length > 0 && (
          <Card className="mb-6 border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                {t('clinicalSessions.pendingInvitations')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitations
                .filter(i => i.invitationStatus === 'pending')
                .map((inv) => (
                  <div key={inv.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold">{inv.title}</h4>
                        <Badge variant="outline" className="mt-1">{inv.specialty}</Badge>
                        {inv.scheduledAt && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(inv.scheduledAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRespondToInvitation(inv.id, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t('clinicalSessions.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespondToInvitation(inv.id, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t('clinicalSessions.reject')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('clinicalSessions.mySessions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{session.title}</h4>
                          {getStatusBadge(session.status)}
                        </div>
                        <Badge variant="outline">{session.specialty}</Badge>
                        {session.caseSummary && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {session.caseSummary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('clinicalSessions.created2')} {formatDate(session.createdAt)}
                          </span>
                          {session.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t('clinicalSessions.scheduled')} {formatDate(session.scheduledAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t('clinicalSessions.noSessions')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
