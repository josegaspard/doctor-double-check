import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  User,
  Mail,
  Calendar,
  FileCheck,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { MedicalCredentialsReview } from '@/components/admin/MedicalCredentialsReview';

type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'failed' | 'expired';

interface VerificationWithUser {
  id: string;
  user_id: string;
  status: VerificationStatus;
  provider: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  metadata: {
    document_type?: string;
    front_url?: string;
    back_url?: string;
    selfie_url?: string;
    rejection_reason?: string;
  } | null;
  user: {
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function AdminVerifications() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();

  const [verifications, setVerifications] = useState<VerificationWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationWithUser | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  // Distintivo/medalla que el super-admin asigna en el MISMO paso de verificación (cliente 2026-06-30).
  const [badgeChoice, setBadgeChoice] = useState<'gold' | 'verified' | 'none'>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(t('adminVerifications.accessDenied'));
    }
  }, [role, navigate]);

  const fetchVerifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('identity_verifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const verificationsWithUsers: VerificationWithUser[] = [];
      
      for (const v of data || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, avatar_url')
          .eq('id', v.user_id)
          .maybeSingle();

        verificationsWithUsers.push({
          ...v,
          status: v.status as VerificationStatus,
          metadata: v.metadata as VerificationWithUser['metadata'],
          user: profile,
        });
      }

      setVerifications(verificationsWithUsers);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchVerifications();
    }
  }, [role]);

  const getDocumentUrl = async (path: string): Promise<string> => {
    if (documentUrls[path]) return documentUrls[path];

    const { data } = await supabase.storage
      .from('identity-documents')
      .createSignedUrl(path, 3600);

    if (data?.signedUrl) {
      setDocumentUrls(prev => ({ ...prev, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return '';
  };

  const openActionDialog = (verification: VerificationWithUser, action: 'approve' | 'reject') => {
    setSelectedVerification(verification);
    setActionType(action);
    setRejectionReason('');
    setBadgeChoice('none');
    setIsActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedVerification) return;

    setIsProcessing(true);
    try {
      const newStatus: VerificationStatus = actionType === 'approve' ? 'verified' : 'failed';

      // Verificación ATÓMICA vía RPC: identidad + is_identity_verified + badge en un
      // solo commit, con chequeo de admin y errores propagados. Antes eran 3 writes
      // sueltos que se tragaban el error → dejaba el estado a medias y hacía reaparecer
      // la ventana de verificación aunque ya se hubiera "verificado".
      const { error } = await (supabase as any).rpc('admin_review_identity_verification', {
        p_id: selectedVerification.id,
        p_approve: actionType === 'approve',
        p_badge: actionType === 'approve' ? badgeChoice : 'none',
        p_reason: actionType === 'reject' ? rejectionReason : null,
      });

      if (error) throw error;

      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            user_id: selectedVerification.user_id,
            status: newStatus,
            user_email: selectedVerification.user?.email,
            user_name: selectedVerification.user?.name,
          },
        });
      } catch (emailError) {
        console.warn('Failed to send email:', emailError);
      }

      toast.success(
        actionType === 'approve'
          ? t('adminVerifications.verificationApproved')
          : t('adminVerifications.verificationRejected')
      );

      setIsActionDialogOpen(false);
      setSelectedVerification(null);
      setBadgeChoice('none');
      setRejectionReason('');
      await fetchVerifications();
    } catch (error: any) {
      toast.error(error.message || t('adminVerifications.actionError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: VerificationStatus) => {
    const configs: Record<VerificationStatus, { variant: any; label: string; icon: React.ElementType }> = {
      pending: { variant: 'warning', label: t('adminVerifications.badgePending'), icon: Clock },
      in_progress: { variant: 'info', label: t('adminVerifications.badgeInProgress'), icon: RefreshCw },
      verified: { variant: 'success', label: t('adminVerifications.badgeVerified'), icon: CheckCircle },
      failed: { variant: 'destructive', label: t('adminVerifications.badgeRejected'), icon: XCircle },
      expired: { variant: 'secondary', label: t('adminVerifications.badgeExpired'), icon: AlertCircle },
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-[10px] sm:text-xs">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredVerifications = verifications.filter(v => {
    if (activeTab === 'pending') return v.status === 'pending' || v.status === 'in_progress';
    if (activeTab === 'verified') return v.status === 'verified';
    if (activeTab === 'rejected') return v.status === 'failed' || v.status === 'expired';
    return true;
  });

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-base sm:text-2xl font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
              <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <span className="truncate">{t('adminVerifications.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('adminVerifications.subtitle')}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchVerifications} disabled={isLoading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Top-level tabs: Identity vs Medical credentials */}
        <Tabs defaultValue="identity" className="mb-4">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="identity" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="w-3.5 h-3.5" />
              {t('adminVerifications.identity')}
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('adminVerifications.medicalCredentials')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="mt-4">
            <MedicalCredentialsReview />
          </TabsContent>

          <TabsContent value="identity" className="mt-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-warning">
                {verifications.filter(v => v.status === 'pending' || v.status === 'in_progress').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {t('adminVerifications.statPending')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-success">
                {verifications.filter(v => v.status === 'verified').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {t('adminVerifications.statVerified')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-destructive">
                {verifications.filter(v => v.status === 'failed').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {t('adminVerifications.statRejected')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4 h-9">
            <TabsTrigger value="pending" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <Clock className="w-3 h-3 hidden sm:block" />
              {t('adminVerifications.statPending')}
            </TabsTrigger>
            <TabsTrigger value="verified" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <CheckCircle className="w-3 h-3 hidden sm:block" />
              {t('adminVerifications.statVerified')}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <XCircle className="w-3 h-3 hidden sm:block" />
              {t('adminVerifications.statRejected')}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-[10px] sm:text-xs px-1 sm:px-3">
              {t('adminVerifications.tabAll')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredVerifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 sm:p-12 text-center">
                  <FileCheck className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('adminVerifications.noVerifications')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredVerifications.map(verification => (
                  <Card key={verification.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      {/* Mobile: stacked layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Avatar + Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarImage src={verification.user?.avatar_url || ''} />
                            <AvatarFallback>
                              <User className="w-4 h-4" />
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {verification.user?.name || t('adminVerifications.userFallback')}
                              </span>
                              {getStatusBadge(verification.status)}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{verification.user?.email}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(verification.created_at).toLocaleDateString()}
                              </span>
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {verification.provider === 'veriff' ? '🔐 Veriff' : '📄 Manual'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 sm:flex-shrink-0 sm:ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex-1 sm:flex-none"
                            onClick={async () => {
                              setSelectedVerification(verification);
                              if (verification.metadata?.front_url) getDocumentUrl(verification.metadata.front_url);
                              if (verification.metadata?.back_url) getDocumentUrl(verification.metadata.back_url);
                              if (verification.metadata?.selfie_url) getDocumentUrl(verification.metadata.selfie_url);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            {t('adminVerifications.view')}
                          </Button>

                          {(verification.status === 'pending' || verification.status === 'in_progress') && (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                className="h-8 text-xs flex-1 sm:flex-none"
                                onClick={() => openActionDialog(verification, 'approve')}
                              >
                                <CheckCircle className="w-3.5 h-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">{t('adminVerifications.approve')}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs flex-1 sm:flex-none"
                                onClick={() => openActionDialog(verification, 'reject')}
                              >
                                <XCircle className="w-3.5 h-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">{t('adminVerifications.reject')}</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
          </TabsContent>
        </Tabs>

        {/* Document Viewer Dialog */}
        {selectedVerification && !isActionDialogOpen && (
          <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {t('adminVerifications.verificationDocuments')}
                </DialogTitle>
                <DialogDescription>
                  {selectedVerification.user?.name} - {selectedVerification.user?.email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedVerification.metadata?.document_type || 'ID'}
                  </Badge>
                  {getStatusBadge(selectedVerification.status)}
                </div>

                {selectedVerification.metadata?.front_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {t('adminVerifications.documentFront')}
                    </p>
                    {documentUrls[selectedVerification.metadata.front_url] ? (
                      <img
                        src={documentUrls[selectedVerification.metadata.front_url]}
                        alt="Document front"
                        className="rounded-lg border max-h-64 object-contain"
                      />
                    ) : (
                      <Skeleton className="h-48 w-full rounded-lg" />
                    )}
                  </div>
                )}

                {selectedVerification.metadata?.back_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {t('adminVerifications.documentBack')}
                    </p>
                    {documentUrls[selectedVerification.metadata.back_url] ? (
                      <img
                        src={documentUrls[selectedVerification.metadata.back_url]}
                        alt="Document back"
                        className="rounded-lg border max-h-64 object-contain"
                      />
                    ) : (
                      <Skeleton className="h-48 w-full rounded-lg" />
                    )}
                  </div>
                )}

                {selectedVerification.metadata?.selfie_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {t('adminVerifications.verificationSelfie')}
                    </p>
                    {documentUrls[selectedVerification.metadata.selfie_url] ? (
                      <img
                        src={documentUrls[selectedVerification.metadata.selfie_url]}
                        alt="Selfie"
                        className="rounded-lg border max-h-64 object-contain"
                      />
                    ) : (
                      <Skeleton className="h-48 w-full rounded-lg" />
                    )}
                  </div>
                )}

                {selectedVerification.metadata?.rejection_reason && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive mb-1">
                      {t('adminVerifications.rejectionReason')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVerification.metadata.rejection_reason}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                {(selectedVerification.status === 'pending' || selectedVerification.status === 'in_progress') && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="success"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setSelectedVerification(null);
                        openActionDialog(selectedVerification, 'approve');
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('adminVerifications.approve')}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setSelectedVerification(null);
                        openActionDialog(selectedVerification, 'reject');
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('adminVerifications.reject')}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Action Confirmation Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve'
                  ? t('adminVerifications.approveQuestion')
                  : t('adminVerifications.rejectQuestion')}
              </DialogTitle>
              <DialogDescription>
                {selectedVerification?.user?.name} - {selectedVerification?.user?.email}
              </DialogDescription>
            </DialogHeader>

            {actionType === 'reject' && (
              <div>
                <label className="text-sm font-medium">
                  {t('adminVerifications.rejectionReasonLabel')}
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('adminVerifications.rejectionReasonPlaceholder')}
                  className="mt-2"
                />
              </div>
            )}

            {/* Distintivo/medalla en el mismo paso de verificación (cliente 2026-06-30):
                el super-admin elige aquí qué medallita poner — o ninguna. */}
            {actionType === 'approve' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  {t('adminDoctorsPage.manualBadge.assignOnVerify')}
                </label>
                <Select value={badgeChoice} onValueChange={(v) => setBadgeChoice(v as 'gold' | 'verified' | 'none')}>
                  <SelectTrigger className="mt-2 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('adminDoctorsPage.manualBadge.none')}</SelectItem>
                    <SelectItem value="gold">🥇 {t('adminDoctorsPage.manualBadge.gold')}</SelectItem>
                    <SelectItem value="verified">✔️ {t('adminDoctorsPage.manualBadge.verified')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                {t('adminVerifications.cancel')}
              </Button>
              <Button
                variant={actionType === 'approve' ? 'success' : 'destructive'}
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'approve'
                  ? t('adminVerifications.approve')
                  : t('adminVerifications.reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
