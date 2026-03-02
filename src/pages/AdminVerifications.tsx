import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  // Redirect non-admins
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

      // Fetch user profiles for each verification
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

      // Update verification status
      const { error } = await supabase
        .from('identity_verifications')
        .update(updateData)
        .eq('id', selectedVerification.id);

      if (error) throw error;

      // Update user profile is_identity_verified flag
      if (actionType === 'approve') {
        await supabase
          .from('profiles')
          .update({ is_identity_verified: true })
          .eq('id', selectedVerification.user_id);
      }

      // Send email notification
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
      <Badge variant={config.variant} className="flex items-center gap-1">
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

  if (role !== 'admin') {
    return null;
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="hidden sm:flex">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              {language === 'es' ? 'Verificaciones de Identidad' : 'Identity Verifications'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' 
                ? 'Gestiona las solicitudes de verificación de usuarios' 
                : 'Manage user verification requests'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchVerifications} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-warning">
                {verifications.filter(v => v.status === 'pending' || v.status === 'in_progress').length}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'es' ? 'Pendientes' : 'Pending'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">
                {verifications.filter(v => v.status === 'verified').length}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'es' ? 'Verificados' : 'Verified'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">
                {verifications.filter(v => v.status === 'failed').length}
              </div>
              <div className="text-sm text-muted-foreground">
                {language === 'es' ? 'Rechazados' : 'Rejected'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {language === 'es' ? 'Pendientes' : 'Pending'}
            </TabsTrigger>
            <TabsTrigger value="verified" className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {language === 'es' ? 'Verificados' : 'Verified'}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              {language === 'es' ? 'Rechazados' : 'Rejected'}
            </TabsTrigger>
            <TabsTrigger value="all">
              {language === 'es' ? 'Todos' : 'All'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-full" />
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
                <CardContent className="p-12 text-center">
                  <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {language === 'es' 
                      ? 'No hay verificaciones en esta categoría' 
                      : 'No verifications in this category'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredVerifications.map(verification => (
                  <Card key={verification.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={verification.user?.avatar_url || ''} />
                          <AvatarFallback>
                            <User className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {verification.user?.name || 'Usuario'}
                            </span>
                            {getStatusBadge(verification.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {verification.user?.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(verification.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setSelectedVerification(verification);
                              // Preload document URLs
                              if (verification.metadata?.front_url) {
                                getDocumentUrl(verification.metadata.front_url);
                              }
                              if (verification.metadata?.back_url) {
                                getDocumentUrl(verification.metadata.back_url);
                              }
                              if (verification.metadata?.selfie_url) {
                                getDocumentUrl(verification.metadata.selfie_url);
                              }
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {language === 'es' ? 'Ver' : 'View'}
                          </Button>

                          {(verification.status === 'pending' || verification.status === 'in_progress') && (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => openActionDialog(verification, 'approve')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {language === 'es' ? 'Aprobar' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openActionDialog(verification, 'reject')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {language === 'es' ? 'Rechazar' : 'Reject'}
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
                {/* Document Type */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedVerification.metadata?.document_type || (language === 'es' ? 'ID oficial' : 'Official ID')}
                  </Badge>
                  {getStatusBadge(selectedVerification.status)}
                </div>

                {/* Front Document */}
                {selectedVerification.metadata?.front_url && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {language === 'es' ? 'Frente del documento' : 'Document Front'}
                    </h4>
                    <div className="border rounded-lg overflow-hidden bg-muted p-2">
                      {documentUrls[selectedVerification.metadata.front_url] ? (
                        <img
                          src={documentUrls[selectedVerification.metadata.front_url]}
                          alt="Front"
                          className="max-h-64 mx-auto object-contain rounded"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Back Document */}
                {selectedVerification.metadata?.back_url && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {language === 'es' ? 'Reverso del documento' : 'Document Back'}
                    </h4>
                    <div className="border rounded-lg overflow-hidden bg-muted p-2">
                      {documentUrls[selectedVerification.metadata.back_url] ? (
                        <img
                          src={documentUrls[selectedVerification.metadata.back_url]}
                          alt="Back"
                          className="max-h-64 mx-auto object-contain rounded"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selfie */}
                {selectedVerification.metadata?.selfie_url && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {language === 'es' ? 'Selfie con documento' : 'Selfie with document'}
                    </h4>
                    <div className="border rounded-lg overflow-hidden bg-muted p-2">
                      {documentUrls[selectedVerification.metadata.selfie_url] ? (
                        <img
                          src={documentUrls[selectedVerification.metadata.selfie_url]}
                          alt="Selfie"
                          className="max-h-64 mx-auto object-contain rounded"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Reason if exists */}
                {selectedVerification.metadata?.rejection_reason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <h4 className="font-medium text-destructive mb-1">
                      {language === 'es' ? 'Razón del rechazo' : 'Rejection Reason'}
                    </h4>
                    <p className="text-sm">{selectedVerification.metadata.rejection_reason}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                {(selectedVerification.status === 'pending' || selectedVerification.status === 'in_progress') && (
                  <div className="flex gap-2 w-full">
                    <Button
                      className="flex-1"
                      variant="success"
                      onClick={() => {
                        setSelectedVerification(null);
                        setTimeout(() => openActionDialog(selectedVerification, 'approve'), 100);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {language === 'es' ? 'Aprobar' : 'Approve'}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={() => {
                        setSelectedVerification(null);
                        setTimeout(() => openActionDialog(selectedVerification, 'reject'), 100);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
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
                {actionType === 'approve'
                  ? (language === 'es' 
                      ? 'El usuario recibirá un email confirmando que su identidad ha sido verificada.' 
                      : 'The user will receive an email confirming their identity has been verified.')
                  : (language === 'es' 
                      ? 'Por favor, proporciona una razón para el rechazo.' 
                      : 'Please provide a reason for rejection.')}
              </DialogDescription>
            </DialogHeader>

            {actionType === 'reject' && (
              <Textarea
                placeholder={language === 'es' 
                  ? 'Razón del rechazo (ej: documento ilegible, información no coincide, etc.)' 
                  : 'Rejection reason (e.g., illegible document, information mismatch, etc.)'}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} disabled={isProcessing}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                variant={actionType === 'approve' ? 'success' : 'destructive'}
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'approve'
                  ? (language === 'es' ? 'Confirmar aprobación' : 'Confirm approval')
                  : (language === 'es' ? 'Confirmar rechazo' : 'Confirm rejection')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
