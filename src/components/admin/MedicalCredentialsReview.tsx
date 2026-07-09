import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, RefreshCw, ShieldCheck, User, Loader2 } from 'lucide-react';
import { InlineFileViewer } from '@/components/content/InlineFileViewer';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type CredStatus = 'pending' | 'approved' | 'rejected';
type CredKind = 'cedula' | 'cofepris';

interface DoctorRow {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  cedula_profesional: string | null;
  cedula_status: CredStatus | null;
  cedula_rejection_reason: string | null;
  cedula_photo_url: string | null;
  cofepris_permit: string | null;
  cofepris_status: CredStatus | null;
  cofepris_rejection_reason: string | null;
}

export function MedicalCredentialsReview() {
  const { t } = useLanguage();

  const STATUS_CONFIG: Record<CredStatus, { label: string; variant: any; icon: React.ElementType }> = {
    pending: { label: t('medicalCredentialsReview.status.pending'), variant: 'warning', icon: Clock },
    approved: { label: t('medicalCredentialsReview.status.approved'), variant: 'success', icon: CheckCircle },
    rejected: { label: t('medicalCredentialsReview.status.rejected'), variant: 'destructive', icon: XCircle },
  };

  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    doctor: DoctorRow | null;
    kind: CredKind;
    action: 'approve' | 'reject';
  }>({ open: false, doctor: null, kind: 'cedula', action: 'approve' });
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmStep, setConfirmStep] = useState<'edit' | 'confirm'>('edit');

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      // cedula_photo_url es columna nueva (2026-07-08), aún no está en los tipos generados
      const { data: profiles, error } = await (supabase as any)
        .from('doctor_profiles')
        .select('user_id, cedula_profesional, cedula_status, cedula_rejection_reason, cedula_photo_url, cofepris_permit, cofepris_status, cofepris_rejection_reason')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const userIds = (profiles || []).map((p: any) => p.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const merged: DoctorRow[] = (profiles || []).map((dp: any) => ({
        user_id: dp.user_id,
        name: profileMap.get(dp.user_id)?.name || t('medicalCredentialsReview.doctorFallback'),
        email: profileMap.get(dp.user_id)?.email || null,
        avatar_url: profileMap.get(dp.user_id)?.avatar_url || null,
        cedula_profesional: dp.cedula_profesional,
        cedula_status: (dp.cedula_status as CredStatus) || null,
        cedula_rejection_reason: dp.cedula_rejection_reason,
        cedula_photo_url: dp.cedula_photo_url || null,
        cofepris_permit: dp.cofepris_permit,
        cofepris_status: (dp.cofepris_status as CredStatus) || null,
        cofepris_rejection_reason: dp.cofepris_rejection_reason,
      }));

      const filtered = merged.filter(
        (d) => (d.cedula_profesional && d.cedula_profesional.trim()) || d.cedula_photo_url || (d.cofepris_permit && d.cofepris_permit.trim())
      );
      setDoctors(filtered);
    } catch (err: any) {
      console.error('[MedicalCredentialsReview] fetch error', err);
      toast.error(err.message || t('medicalCredentialsReview.toast.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const openAction = (doctor: DoctorRow, kind: CredKind, action: 'approve' | 'reject') => {
    setActionDialog({ open: true, doctor, kind, action });
    setReason('');
    setConfirmStep('edit');
  };

  const closeDialog = () => {
    setActionDialog({ ...actionDialog, open: false });
    setConfirmStep('edit');
  };

  const handleAction = async () => {
    if (!actionDialog.doctor) return;
    const { doctor, kind, action } = actionDialog;
    setIsProcessing(true);
    try {
      const newStatus: CredStatus = action === 'approve' ? 'approved' : 'rejected';
      const update: Record<string, any> = {};
      if (kind === 'cedula') {
        update.cedula_status = newStatus;
        update.cedula_rejection_reason = action === 'reject' ? reason.trim() : null;
      } else {
        update.cofepris_status = newStatus;
        update.cofepris_rejection_reason = action === 'reject' ? reason.trim() : null;
      }

      const { error } = await supabase
        .from('doctor_profiles')
        .update(update)
        .eq('user_id', doctor.user_id);
      if (error) throw error;

      const credLabel = kind === 'cedula'
        ? t('medicalCredentialsReview.credential.cedula')
        : t('medicalCredentialsReview.credential.cofepris');
      const trimmedReason = reason.trim();
      const message =
        action === 'approve'
          ? t('medicalCredentialsReview.notification.approvedMessage')
              .replace('{{credLabel}}', credLabel)
              .replace('{{reason}}', trimmedReason)
          : t('medicalCredentialsReview.notification.rejectedMessage')
              .replace('{{credLabel}}', credLabel)
              .replace('{{reason}}', trimmedReason);

      await supabase.from('notifications').insert({
        user_id: doctor.user_id,
        type: 'system',
        title: action === 'approve'
          ? t('medicalCredentialsReview.notification.approvedTitle')
          : t('medicalCredentialsReview.notification.rejectedTitle'),
        message,
        data: { kind, status: newStatus, admin_notes: trimmedReason },
      });

      toast.success(
        action === 'approve'
          ? (kind === 'cedula'
              ? t('medicalCredentialsReview.toast.cedulaApproved')
              : t('medicalCredentialsReview.toast.cofeprisApproved'))
          : (kind === 'cedula'
              ? t('medicalCredentialsReview.toast.cedulaRejected')
              : t('medicalCredentialsReview.toast.cofeprisRejected'))
      );
      setActionDialog({ open: false, doctor: null, kind: 'cedula', action: 'approve' });
      setConfirmStep('edit');
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || t('medicalCredentialsReview.toast.updateError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatusBadge = (status: CredStatus | null) => {
    const c = STATUS_CONFIG[status || 'pending'];
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="gap-1 text-[10px]">
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const matchesTab = (d: DoctorRow): boolean => {
    if (activeTab === 'all') return true;
    const cedulaState = d.cedula_status || 'pending';
    const cofeprisState = d.cofepris_status || 'pending';
    return cedulaState === activeTab || cofeprisState === activeTab;
  };

  const filtered = doctors.filter(matchesTab);

  const counts = {
    pending: doctors.filter((d) => (d.cedula_status || 'pending') === 'pending' || (d.cofepris_status || 'pending') === 'pending').length,
    approved: doctors.filter((d) => d.cedula_status === 'approved' || d.cofepris_status === 'approved').length,
    rejected: doctors.filter((d) => d.cedula_status === 'rejected' || d.cofepris_status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {t('medicalCredentialsReview.header.title')}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('medicalCredentialsReview.header.subtitle')}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchDoctors} disabled={isLoading} className="h-9 w-9">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-warning">{counts.pending}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('medicalCredentialsReview.stats.pending')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-success">{counts.approved}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('medicalCredentialsReview.stats.approved')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-destructive">{counts.rejected}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{t('medicalCredentialsReview.stats.rejected')}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="pending" className="text-[10px] sm:text-xs">{t('medicalCredentialsReview.tabs.pending')}</TabsTrigger>
          <TabsTrigger value="approved" className="text-[10px] sm:text-xs">{t('medicalCredentialsReview.tabs.approved')}</TabsTrigger>
          <TabsTrigger value="rejected" className="text-[10px] sm:text-xs">{t('medicalCredentialsReview.tabs.rejected')}</TabsTrigger>
          <TabsTrigger value="all" className="text-[10px] sm:text-xs">{t('medicalCredentialsReview.tabs.all')}</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t('medicalCredentialsReview.empty')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => (
                <Card key={d.user_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={d.avatar_url || ''} />
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                      </div>
                    </div>

                    {((d.cedula_profesional && d.cedula_profesional.trim()) || d.cedula_photo_url) && (
                      <div className="rounded-lg border border-border/60 p-3 mb-2 bg-muted/20">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{t('medicalCredentialsReview.credential.cedula')}</span>
                              {renderStatusBadge(d.cedula_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">{d.cedula_profesional}</p>
                            {d.cedula_status === 'rejected' && d.cedula_rejection_reason && (
                              <p className="text-[11px] text-destructive mt-1">
                                {t('medicalCredentialsReview.reasonPrefix')} {d.cedula_rejection_reason}
                              </p>
                            )}
                            {/* Foto de la cédula subida en el onboarding (cliente 2026-07-08) */}
                            {d.cedula_photo_url && (
                              <div className="mt-2 max-w-sm">
                                <InlineFileViewer
                                  fileUrl={d.cedula_photo_url}
                                  bucket="doctor-credentials"
                                  className="rounded-md overflow-hidden"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cedula', 'approve')}>
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">{t('medicalCredentialsReview.actions.approve')}</span>
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cedula', 'reject')}>
                              <XCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">{t('medicalCredentialsReview.actions.reject')}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {d.cofepris_permit && d.cofepris_permit.trim() && (
                      <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{t('medicalCredentialsReview.credential.cofepris')}</span>
                              {renderStatusBadge(d.cofepris_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">{d.cofepris_permit}</p>
                            {d.cofepris_status === 'rejected' && d.cofepris_rejection_reason && (
                              <p className="text-[11px] text-destructive mt-1">
                                {t('medicalCredentialsReview.reasonPrefix')} {d.cofepris_rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cofepris', 'approve')}>
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">{t('medicalCredentialsReview.actions.approve')}</span>
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cofepris', 'reject')}>
                              <XCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">{t('medicalCredentialsReview.actions.reject')}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmStep === 'confirm'
                ? actionDialog.action === 'approve'
                  ? t('medicalCredentialsReview.dialog.confirmApproveTitle')
                  : t('medicalCredentialsReview.dialog.confirmRejectTitle')
                : actionDialog.action === 'approve'
                ? t('medicalCredentialsReview.dialog.editApproveTitle')
                : t('medicalCredentialsReview.dialog.editRejectTitle')}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.doctor?.name} —{' '}
              {actionDialog.kind === 'cedula'
                ? t('medicalCredentialsReview.credential.cedula')
                : t('medicalCredentialsReview.credential.cofepris')}
            </DialogDescription>
          </DialogHeader>

          {confirmStep === 'edit' ? (
            <div>
              <label className="text-sm font-medium">
                {actionDialog.action === 'approve'
                  ? t('medicalCredentialsReview.dialog.notesLabel')
                  : t('medicalCredentialsReview.dialog.reasonLabel')}
                <span className="text-destructive ml-1">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  actionDialog.action === 'approve'
                    ? t('medicalCredentialsReview.dialog.notesPlaceholder')
                    : t('medicalCredentialsReview.dialog.reasonPlaceholder')
                }
                className="mt-2"
                rows={4}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {actionDialog.action === 'approve'
                  ? t('medicalCredentialsReview.dialog.notesHelper')
                  : t('medicalCredentialsReview.dialog.reasonHelper')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('medicalCredentialsReview.dialog.summary.doctor')}</span>
                  <span className="font-medium text-foreground text-right">{actionDialog.doctor?.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('medicalCredentialsReview.dialog.summary.credential')}</span>
                  <span className="font-medium text-foreground text-right">
                    {actionDialog.kind === 'cedula'
                      ? t('medicalCredentialsReview.credential.cedula')
                      : t('medicalCredentialsReview.credential.cofepris')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('medicalCredentialsReview.dialog.summary.number')}</span>
                  <span className="font-mono text-xs text-foreground text-right break-all">
                    {actionDialog.kind === 'cedula'
                      ? actionDialog.doctor?.cedula_profesional
                      : actionDialog.doctor?.cofepris_permit}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('medicalCredentialsReview.dialog.summary.action')}</span>
                  <Badge variant={actionDialog.action === 'approve' ? 'success' : 'destructive'} className="text-[10px]">
                    {actionDialog.action === 'approve'
                      ? t('medicalCredentialsReview.dialog.summary.approveBadge')
                      : t('medicalCredentialsReview.dialog.summary.rejectBadge')}
                  </Badge>
                </div>
                <div className="pt-1.5 border-t border-border/60">
                  <span className="text-muted-foreground text-xs">
                    {actionDialog.action === 'approve'
                      ? t('medicalCredentialsReview.dialog.summary.notes')
                      : t('medicalCredentialsReview.dialog.summary.reason')}
                  </span>
                  <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                    {reason.trim().slice(0, 200)}
                    {reason.trim().length > 200 ? '…' : ''}
                  </p>
                </div>
              </div>
              <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-md p-2">
                {t('medicalCredentialsReview.dialog.confirmWarning')}
              </p>
            </div>
          )}

          <DialogFooter>
            {confirmStep === 'edit' ? (
              <>
                <Button variant="outline" onClick={closeDialog}>
                  {t('medicalCredentialsReview.dialog.cancel')}
                </Button>
                <Button
                  variant={actionDialog.action === 'approve' ? 'success' : 'destructive'}
                  onClick={() => setConfirmStep('confirm')}
                  disabled={!reason.trim()}
                >
                  {actionDialog.action === 'approve'
                    ? t('medicalCredentialsReview.actions.approve')
                    : t('medicalCredentialsReview.actions.reject')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmStep('edit')} disabled={isProcessing}>
                  {t('medicalCredentialsReview.dialog.backToEdit')}
                </Button>
                <Button
                  variant={actionDialog.action === 'approve' ? 'success' : 'destructive'}
                  onClick={handleAction}
                  disabled={isProcessing || !reason.trim()}
                >
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('medicalCredentialsReview.dialog.confirmSend')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
