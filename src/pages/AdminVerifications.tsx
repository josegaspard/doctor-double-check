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
} from 'lucide-react';

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
  const { language } = useLanguage();
  
  const [verifications, setVerifications] = useState<VerificationWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationWithUser | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

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
          .single();

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
    setIsActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedVerification) return;

    setIsProcessing(true);
    try {
      const newStatus: VerificationStatus = actionType === 'approve' ? 'verified' : 'failed';
      
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (actionType === 'approve') {
        updateData.verified_at = new Date().toISOString();
      } else {
        updateData.metadata = {
          ...selectedVerification.metadata,
          rejection_reason: rejectionReason,
        };
      }

      const { error } = await supabase
        .from('identity_verifications')
        .update(updateData)
        .eq('id', selectedVerification.id);

      if (error) throw error;

      if (actionType === 'approve') {
        await supabase
          .from('profiles')
          .update({ is_identity_verified: true })
          .eq('id', selectedVerification.user_id);
      }

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
          ? (language === 'es' ? 'Verificación aprobada' : 'Verification approved')
          : (language === 'es' ? 'Verificación rechazada' : 'Verification rejected')
      );

      setIsActionDialogOpen(false);
      fetchVerifications();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: VerificationStatus) => {
    const configs: Record<VerificationStatus, { variant: any; label: string; icon: React.ElementType }> = {
      pending: { variant: 'warning', label: language === 'es' ? 'Pendiente' : 'Pending', icon: Clock },
      in_progress: { variant: 'info', label: language === 'es' ? 'En proceso' : 'In Progress', icon: RefreshCw },
      verified: { variant: 'success', label: language === 'es' ? 'Verificado' : 'Verified', icon: CheckCircle },
      failed: { variant: 'destructive', label: language === 'es' ? 'Rechazado' : 'Rejected', icon: XCircle },
      expired: { variant: 'secondary', label: language === 'es' ? 'Expirado' : 'Expired', icon: AlertCircle },
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-base sm:text-2xl font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
              <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <span className="truncate">{language === 'es' ? 'Verificaciones de Identidad' : 'Identity Verifications'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {language === 'es' ? 'Gestiona las solicitudes' : 'Manage requests'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchVerifications} disabled={isLoading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-warning">
                {verifications.filter(v => v.status === 'pending' || v.status === 'in_progress').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {language === 'es' ? 'Pendientes' : 'Pending'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-success">
                {verifications.filter(v => v.status === 'verified').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {language === 'es' ? 'Verificados' : 'Verified'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <div className="text-lg sm:text-2xl font-bold text-destructive">
                {verifications.filter(v => v.status === 'failed').length}
              </div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">
                {language === 'es' ? 'Rechazados' : 'Rejected'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4 h-9">
            <TabsTrigger value="pending" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <Clock className="w-3 h-3 hidden sm:block" />
              {language === 'es' ? 'Pendientes' : 'Pending'}
            </TabsTrigger>
            <TabsTrigger value="verified" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <CheckCircle className="w-3 h-3 hidden sm:block" />
              {language === 'es' ? 'Verificados' : 'Verified'}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-[10px] sm:text-xs gap-1 px-1 sm:px-3">
              <XCircle className="w-3 h-3 hidden sm:block" />
              {language === 'es' ? 'Rechazados' : 'Rejected'}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-[10px] sm:text-xs px-1 sm:px-3">
              {language === 'es' ? 'Todos' : 'All'}
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
                    {language === 'es' ? 'No hay verificaciones en esta categoría' : 'No verifications in this category'}
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
                                {verification.user?.name || 'Usuario'}
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
                            {language === 'es' ? 'Ver' : 'View'}
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
                                <span className="hidden sm:inline">{language === 'es' ? 'Aprobar' : 'Approve'}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs flex-1 sm:flex-none"
                                onClick={() => openActionDialog(verification, 'reject')}
                              >
                                <XCircle className="w-3.5 h-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">{language === 'es' ? 'Rechazar' : 'Reject'}</span>
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

        {/* Document Viewer Dialog */}
        {selectedVerification && !isActionDialogOpen && (
          <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  {language === 'es' ? 'Documentos de Verificación' : 'Verification Documents'}
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
                      {language === 'es' ? 'Frente del documento' : 'Document front'}
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
                      {language === 'es' ? 'Reverso del documento' : 'Document back'}
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
                      {language === 'es' ? 'Selfie de verificación' : 'Verification selfie'}
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
                      {language === 'es' ? 'Motivo de rechazo' : 'Rejection reason'}
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
                      {language === 'es' ? 'Aprobar' : 'Approve'}
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
                      {language === 'es' ? 'Rechazar' : 'Reject'}
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
                  ? (language === 'es' ? '¿Aprobar verificación?' : 'Approve verification?')
                  : (language === 'es' ? '¿Rechazar verificación?' : 'Reject verification?')}
              </DialogTitle>
              <DialogDescription>
                {selectedVerification?.user?.name} - {selectedVerification?.user?.email}
              </DialogDescription>
            </DialogHeader>

            {actionType === 'reject' && (
              <div>
                <label className="text-sm font-medium">
                  {language === 'es' ? 'Motivo del rechazo' : 'Rejection reason'}
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={language === 'es' ? 'Explica el motivo...' : 'Explain the reason...'}
                  className="mt-2"
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                variant={actionType === 'approve' ? 'success' : 'destructive'}
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'approve'
                  ? (language === 'es' ? 'Aprobar' : 'Approve')
                  : (language === 'es' ? 'Rechazar' : 'Reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
