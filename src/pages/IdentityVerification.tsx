import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Shield,
  Upload,
  FileCheck,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Camera,
  CreditCard,
  Loader2,
  Info,
  Eye,
  ExternalLink,
  Fingerprint,
} from 'lucide-react';

type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'failed' | 'expired';

interface VerificationRecord {
  id: string;
  status: VerificationStatus;
  provider: string;
  created_at: string;
  verified_at: string | null;
  metadata: {
    document_type?: string;
    front_url?: string;
    back_url?: string;
    selfie_url?: string;
    session_url?: string;
  } | null;
}

export default function IdentityVerification() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();

  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingVeriff, setIsStartingVeriff] = useState(false);
  
  // Manual upload fallback state
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [showManualUpload, setShowManualUpload] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch existing verification
  const fetchVerification = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setVerification(data as unknown as VerificationRecord);
      }
    } catch {
      // No verification found
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  // Poll for status updates when pending/in_progress
  useEffect(() => {
    if (!verification || !['pending', 'in_progress'].includes(verification.status)) return;
    
    const interval = setInterval(fetchVerification, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [verification?.status, fetchVerification]);

  const handleStartVeriff = async () => {
    if (!user?.id) return;
    setIsStartingVeriff(true);

    // Try Veriff first (paid, primary provider). If it fails because the
    // subscription is paused (503 from edge function), fall back to Didit
    // (free tier alternative). When Veriff is reactivated, this fallback
    // automatically goes dormant.
    try {
      const { data, error } = await supabase.functions.invoke('create-veriff-session', {
        body: {
          callback_url: window.location.origin + '/verify-identity',
        },
      });

      if (!error && data?.session_url) {
        toast.info(t('identityVerification.redirectingBiometric'));
        window.location.href = data.session_url;
        setTimeout(fetchVerification, 3000);
        return;
      }
      throw error ?? new Error('Veriff unavailable');
    } catch (veriffErr) {
      console.warn('Veriff unavailable, trying Didit fallback:', veriffErr);

      try {
        const { data: dData, error: dErr } = await supabase.functions.invoke('kyc-didit-start', {});
        if (dErr) throw dErr;
        if (!dData?.verification_url) throw new Error('No Didit verification URL');

        toast.info(t('identityVerification.startingBiometric'));
        window.location.href = dData.verification_url;
        setTimeout(fetchVerification, 3000);
        return;
      } catch (diditErr: any) {
        console.error('Both Veriff and Didit failed:', diditErr);
        toast.error(t('identityVerification.couldNotStartAuto'));
        setShowManualUpload(true);
      }
    } finally {
      setIsStartingVeriff(false);
    }
  };

  // Manual upload handlers (fallback)
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error(t('identityVerification.onlyImagesOrPdf'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('identityVerification.fileTooLarge'));
      return;
    }

    setFile(file);
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const { error } = await supabase.storage
      .from('identity-documents')
      .upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    return path;
  };

  const handleManualSubmit = async () => {
    if (!user?.id || !frontFile) return;
    
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const timestamp = Date.now();
      const metadata: Record<string, string> = { document_type: 'official_id' };

      setUploadProgress(10);
      const frontExt = frontFile.name.split('.').pop();
      await uploadFile(frontFile, `${user.id}/${timestamp}_front.${frontExt}`);
      metadata.front_url = `${user.id}/${timestamp}_front.${frontExt}`;
      setUploadProgress(40);

      if (backFile) {
        const backExt = backFile.name.split('.').pop();
        await uploadFile(backFile, `${user.id}/${timestamp}_back.${backExt}`);
        metadata.back_url = `${user.id}/${timestamp}_back.${backExt}`;
      }
      setUploadProgress(70);

      if (selfieFile) {
        const selfieExt = selfieFile.name.split('.').pop();
        await uploadFile(selfieFile, `${user.id}/${timestamp}_selfie.${selfieExt}`);
        metadata.selfie_url = `${user.id}/${timestamp}_selfie.${selfieExt}`;
      }
      setUploadProgress(90);

      const { error } = await supabase
        .from('identity_verifications')
        .insert({
          user_id: user.id,
          provider: 'manual',
          status: 'pending',
          metadata,
        });

      if (error) throw error;

      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { user_id: user.id, status: 'pending' },
        });
      } catch {
        // ignore email error
      }

      setUploadProgress(100);
      toast.success(t('identityVerification.documentsSubmitted'));

      await fetchVerification();
      setFrontFile(null); setFrontPreview(null);
      setBackFile(null); setBackPreview(null);
      setSelfieFile(null); setSelfiePreview(null);
      setShowManualUpload(false);
    } catch (error: any) {
      toast.error(error.message || t('identityVerification.errorSubmitting'));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const getStatusConfig = (status: VerificationStatus) => {
    const configs = {
      pending: {
        icon: Clock, color: 'text-warning', bg: 'bg-warning/15', ring: 'ring-warning/30', stripe: 'before:bg-warning', badge: 'warning' as const,
        title: t('identityVerification.statusPendingTitle'),
        description: t('identityVerification.statusPendingDesc'),
      },
      in_progress: {
        icon: Clock, color: 'text-info', bg: 'bg-info/15', ring: 'ring-info/30', stripe: 'before:bg-info', badge: 'info' as const,
        title: t('identityVerification.statusInProgressTitle'),
        description: t('identityVerification.statusInProgressDesc'),
      },
      verified: {
        icon: CheckCircle, color: 'text-success', bg: 'bg-success/15', ring: 'ring-success/30', stripe: 'before:bg-success', badge: 'success' as const,
        title: t('identityVerification.statusVerifiedTitle'),
        description: t('identityVerification.statusVerifiedDesc'),
      },
      failed: {
        icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/15', ring: 'ring-destructive/30', stripe: 'before:bg-destructive', badge: 'destructive' as const,
        title: t('identityVerification.statusFailedTitle'),
        description: t('identityVerification.statusFailedDesc'),
      },
      expired: {
        icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', ring: 'ring-border', stripe: 'before:bg-muted-foreground/40', badge: 'secondary' as const,
        title: t('identityVerification.statusExpiredTitle'),
        description: t('identityVerification.statusExpiredDesc'),
      },
    };
    return configs[status];
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('identityVerification.loading')}
          </p>
        </div>
      </MainLayout>
    );
  }

  const canSubmitNew = !verification || ['failed', 'expired', 'pending'].includes(verification.status);
  const statusConfig = verification ? getStatusConfig(verification.status) : null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/profile')} className="hidden sm:flex">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {t('identityVerification.pageTitle')}
            </h1>
            <p className="text-muted-foreground">
              {t('identityVerification.pageSubtitle')}
            </p>
          </div>
        </div>

        {/* Current Status */}
        {verification && statusConfig && (
          <Card
            className={`mb-6 relative overflow-hidden bg-card border border-border shadow-md ring-1 ${statusConfig.ring} before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${statusConfig.stripe}`}
          >
            <CardContent className="p-4 sm:p-6 pl-5 sm:pl-7">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                  <statusConfig.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-card-foreground">{statusConfig.title}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-2">
                    <Badge variant={statusConfig.badge} className="text-[10px] sm:text-xs">
                      {verification.status === 'pending' && t('identityVerification.badgePending')}
                      {verification.status === 'in_progress' && t('identityVerification.badgeInProgress')}
                      {verification.status === 'verified' && t('identityVerification.badgeVerified')}
                      {verification.status === 'failed' && t('identityVerification.badgeRejected')}
                      {verification.status === 'expired' && t('identityVerification.badgeExpired')}
                    </Badge>
                    {verification.provider === 'veriff' && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-card">
                        <Fingerprint className="w-3 h-3 mr-1" />
                        Veriff
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{statusConfig.description}</p>
                  {verification.verified_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('identityVerification.verifiedOn')}
                      {new Date(verification.verified_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Form */}
        {canSubmitNew && !showManualUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                {t('identityVerification.biometricTitle')}
              </CardTitle>
              <CardDescription>
                {t('identityVerification.biometricDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle>{t('identityVerification.quickProcess')}</AlertTitle>
                <AlertDescription>
                  {t('identityVerification.quickProcessDesc')}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {t('identityVerification.step1Title')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('identityVerification.step1Desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Camera className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {t('identityVerification.step2Title')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('identityVerification.step2Desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {t('identityVerification.step3Title')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('identityVerification.step3Desc')}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full min-h-[44px]"
                size="lg"
                onClick={handleStartVeriff}
                disabled={isStartingVeriff}
              >
                {isStartingVeriff ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('identityVerification.starting')}
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 mr-2" />
                    {t('identityVerification.startBiometric')}
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t('identityVerification.orAlternatively')}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full min-h-[44px]"
                onClick={() => setShowManualUpload(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('identityVerification.uploadManually')}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t('identityVerification.secureNoteVeriff')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Manual Upload Fallback */}
        {canSubmitNew && showManualUpload && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {t('identityVerification.uploadDocument')}
                  </CardTitle>
                  <CardDescription>
                    {t('identityVerification.uploadDocumentDesc')}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowManualUpload(false)}>
                  {t('identityVerification.useBiometric')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="mb-4">
                <Info className="w-4 h-4" />
                <AlertTitle>{t('identityVerification.acceptedDocuments')}</AlertTitle>
                <AlertDescription>
                  {t('identityVerification.acceptedDocumentsDesc')}
                </AlertDescription>
              </Alert>

              {/* Front */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  {t('identityVerification.frontOfDocument')}
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${frontPreview ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                  onClick={() => frontInputRef.current?.click()}
                >
                  {frontPreview ? (
                    <div className="relative">
                      <img src={frontPreview} alt="Front" className="max-h-48 mx-auto rounded" />
                      <Badge className="absolute top-2 right-2" variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {t('identityVerification.uploaded')}
                      </Badge>
                    </div>
                  ) : frontFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileCheck className="w-8 h-8 text-primary" />
                      <span className="font-medium">{frontFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('identityVerification.clickToUpload')}
                      </p>
                    </>
                  )}
                </div>
                <input ref={frontInputRef} type="file" accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, setFrontFile, setFrontPreview)} className="hidden" />
              </div>

              {/* Back */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  {t('identityVerification.backOfDocument')}
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${backPreview ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                  onClick={() => backInputRef.current?.click()}
                >
                  {backPreview ? (
                    <div className="relative">
                      <img src={backPreview} alt="Back" className="max-h-48 mx-auto rounded" />
                      <Badge className="absolute top-2 right-2" variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {t('identityVerification.uploaded')}
                      </Badge>
                    </div>
                  ) : backFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileCheck className="w-8 h-8 text-primary" />
                      <span className="font-medium">{backFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('identityVerification.clickToUpload')}
                      </p>
                    </>
                  )}
                </div>
                <input ref={backInputRef} type="file" accept="image/*,.pdf" onChange={(e) => handleFileSelect(e, setBackFile, setBackPreview)} className="hidden" />
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {t('identityVerification.selfieWithDocument')}
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${selfiePreview ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                  onClick={() => selfieInputRef.current?.click()}
                >
                  {selfiePreview ? (
                    <div className="relative">
                      <img src={selfiePreview} alt="Selfie" className="max-h-48 mx-auto rounded" />
                      <Badge className="absolute top-2 right-2" variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {t('identityVerification.uploaded')}
                      </Badge>
                    </div>
                  ) : selfieFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileCheck className="w-8 h-8 text-primary" />
                      <span className="font-medium">{selfieFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('identityVerification.takeSelfieHolding')}
                      </p>
                    </>
                  )}
                </div>
                <input ref={selfieInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setSelfieFile, setSelfiePreview)} className="hidden" />
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('identityVerification.uploadingDocuments')}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleManualSubmit} disabled={!frontFile || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('identityVerification.submitting')}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {t('identityVerification.submitForVerification')}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t('identityVerification.secureNoteDocs')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Already verified */}
        {verification?.status === 'verified' && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t('identityVerification.alreadyVerifiedTitle')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('identityVerification.alreadyVerifiedDesc')}
              </p>
              <Button variant="outline" onClick={() => navigate('/profile')}>
                {t('identityVerification.backToProfile')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
