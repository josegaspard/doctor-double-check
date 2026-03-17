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
  const { language } = useLanguage();
  
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

    try {
      const { data, error } = await supabase.functions.invoke('create-veriff-session', {
        body: {
          callback_url: window.location.origin + '/verify-identity',
        },
      });

      if (error) throw error;
      if (!data?.session_url) throw new Error('No session URL returned');

      // Navigate directly to Veriff (avoids popup blockers on mobile/WebView)
      toast.info(
        language === 'es'
          ? 'Redirigiendo a la verificación biométrica...'
          : 'Redirecting to biometric verification...'
      );
      window.location.href = data.session_url;

      // Refresh after a short delay
      setTimeout(fetchVerification, 3000);
    } catch (error: any) {
      console.error('Veriff error:', error);
      toast.error(
        language === 'es'
          ? 'Error al iniciar verificación. Puedes usar la verificación manual.'
          : 'Error starting verification. You can use manual verification.'
      );
      setShowManualUpload(true);
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
      toast.error(language === 'es' ? 'Solo se permiten imágenes o PDF' : 'Only images or PDF allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'es' ? 'El archivo no puede superar 10MB' : 'File cannot exceed 10MB');
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
      toast.success(
        language === 'es' ? 'Documentos enviados para verificación' : 'Documents submitted for verification'
      );

      await fetchVerification();
      setFrontFile(null); setFrontPreview(null);
      setBackFile(null); setBackPreview(null);
      setSelfieFile(null); setSelfiePreview(null);
      setShowManualUpload(false);
    } catch (error: any) {
      toast.error(error.message || (language === 'es' ? 'Error al enviar documentos' : 'Error submitting documents'));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const getStatusConfig = (status: VerificationStatus) => {
    const configs = {
      pending: {
        icon: Clock, color: 'text-warning', bg: 'bg-warning/10', badge: 'warning' as const,
        title: language === 'es' ? 'Verificación en proceso' : 'Verification in progress',
        description: language === 'es' 
          ? 'Estamos revisando tus documentos. Este proceso puede tomar 24-48 horas.'
          : 'We are reviewing your documents. This process may take 24-48 hours.',
      },
      in_progress: {
        icon: Clock, color: 'text-info', bg: 'bg-info/10', badge: 'info' as const,
        title: language === 'es' ? 'Verificación en curso' : 'Verification in progress',
        description: language === 'es'
          ? 'Tu verificación biométrica está siendo procesada automáticamente.'
          : 'Your biometric verification is being processed automatically.',
      },
      verified: {
        icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', badge: 'success' as const,
        title: language === 'es' ? 'Identidad verificada' : 'Identity verified',
        description: language === 'es'
          ? 'Tu identidad ha sido verificada exitosamente.'
          : 'Your identity has been successfully verified.',
      },
      failed: {
        icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'destructive' as const,
        title: language === 'es' ? 'Verificación rechazada' : 'Verification rejected',
        description: language === 'es'
          ? 'Tu solicitud fue rechazada. Por favor, intenta nuevamente.'
          : 'Your request was rejected. Please try again.',
      },
      expired: {
        icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', badge: 'secondary' as const,
        title: language === 'es' ? 'Verificación expirada' : 'Verification expired',
        description: language === 'es'
          ? 'Tu verificación ha expirado. Por favor, verifica nuevamente.'
          : 'Your verification has expired. Please verify again.',
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
            {language === 'es' ? 'Cargando...' : 'Loading...'}
          </p>
        </div>
      </MainLayout>
    );
  }

  const canSubmitNew = !verification || verification.status === 'failed' || verification.status === 'expired';
  const statusConfig = verification ? getStatusConfig(verification.status) : null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="hidden sm:flex">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {language === 'es' ? 'Verificación de Identidad' : 'Identity Verification'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' 
                ? 'Verifica tu identidad para mayor seguridad' 
                : 'Verify your identity for enhanced security'}
            </p>
          </div>
        </div>

        {/* Current Status */}
        {verification && statusConfig && (
          <Card className={`mb-6 border-2 ${statusConfig.bg}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                  <statusConfig.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">{statusConfig.title}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-2">
                    <Badge variant={statusConfig.badge} className="text-[10px] sm:text-xs">
                      {verification.status === 'pending' && (language === 'es' ? 'Pendiente' : 'Pending')}
                      {verification.status === 'in_progress' && (language === 'es' ? 'En proceso' : 'In Progress')}
                      {verification.status === 'verified' && (language === 'es' ? 'Verificado' : 'Verified')}
                      {verification.status === 'failed' && (language === 'es' ? 'Rechazado' : 'Rejected')}
                      {verification.status === 'expired' && (language === 'es' ? 'Expirado' : 'Expired')}
                    </Badge>
                    {verification.provider === 'veriff' && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        <Fingerprint className="w-3 h-3 mr-1" />
                        Veriff
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{statusConfig.description}</p>
                  {verification.verified_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {language === 'es' ? 'Verificado el: ' : 'Verified on: '}
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
                {language === 'es' ? 'Verificación biométrica' : 'Biometric Verification'}
              </CardTitle>
              <CardDescription>
                {language === 'es'
                  ? 'Verifica tu identidad de forma rápida y segura con reconocimiento biométrico.'
                  : 'Verify your identity quickly and securely with biometric recognition.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertTitle>{language === 'es' ? 'Proceso rápido' : 'Quick process'}</AlertTitle>
                <AlertDescription>
                  {language === 'es'
                    ? 'Necesitarás tu documento de identidad (INE, pasaporte o licencia) y tu cámara para tomar una selfie. El proceso tarda menos de 2 minutos.'
                    : 'You will need your ID document (government ID, passport or license) and your camera for a selfie. The process takes less than 2 minutes.'}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === 'es' ? '1. Fotografía tu documento' : '1. Photograph your document'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'es' ? 'INE/IFE, Pasaporte o Licencia de conducir' : 'Government ID, Passport or Driver\'s license'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Camera className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === 'es' ? '2. Tómate una selfie' : '2. Take a selfie'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'es' ? 'Verificación facial automática' : 'Automatic facial verification'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {language === 'es' ? '3. Resultado automático' : '3. Automatic result'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'es' ? 'Recibirás el resultado en minutos' : 'You will receive the result in minutes'}
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
                    {language === 'es' ? 'Iniciando...' : 'Starting...'}
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 mr-2" />
                    {language === 'es' ? 'Iniciar verificación biométrica' : 'Start biometric verification'}
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {language === 'es' ? 'o alternativamente' : 'or alternatively'}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowManualUpload(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                {language === 'es' ? 'Subir documentos manualmente' : 'Upload documents manually'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {language === 'es'
                  ? 'Tus datos se procesan de forma segura con Veriff, líder en verificación de identidad.'
                  : 'Your data is securely processed by Veriff, a leader in identity verification.'}
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
                    {language === 'es' ? 'Sube tu documento' : 'Upload your document'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es'
                      ? 'Asegúrate de que el documento sea legible y esté completo'
                      : 'Make sure the document is readable and complete'}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowManualUpload(false)}>
                  {language === 'es' ? 'Usar biométrica' : 'Use biometric'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="mb-4">
                <Info className="w-4 h-4" />
                <AlertTitle>{language === 'es' ? 'Documentos aceptados' : 'Accepted documents'}</AlertTitle>
                <AlertDescription>
                  {language === 'es'
                    ? 'INE/IFE, Pasaporte, Licencia de conducir u otro documento oficial con fotografía.'
                    : 'Government ID, Passport, Driver\'s license or other official photo ID.'}
                </AlertDescription>
              </Alert>

              {/* Front */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  {language === 'es' ? 'Frente del documento *' : 'Front of document *'}
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
                        {language === 'es' ? 'Cargado' : 'Uploaded'}
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
                        {language === 'es' ? 'Haz clic para subir' : 'Click to upload'}
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
                  {language === 'es' ? 'Reverso del documento (opcional)' : 'Back of document (optional)'}
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
                        {language === 'es' ? 'Cargado' : 'Uploaded'}
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
                        {language === 'es' ? 'Haz clic para subir' : 'Click to upload'}
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
                  {language === 'es' ? 'Selfie con documento (opcional)' : 'Selfie with document (optional)'}
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
                        {language === 'es' ? 'Cargado' : 'Uploaded'}
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
                        {language === 'es' ? 'Tómate una foto sosteniendo tu documento' : 'Take a photo holding your document'}
                      </p>
                    </>
                  )}
                </div>
                <input ref={selfieInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setSelfieFile, setSelfiePreview)} className="hidden" />
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{language === 'es' ? 'Subiendo documentos...' : 'Uploading documents...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleManualSubmit} disabled={!frontFile || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === 'es' ? 'Enviando...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {language === 'es' ? 'Enviar para verificación' : 'Submit for verification'}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {language === 'es'
                  ? 'Tus documentos se almacenan de forma segura y solo se usan para verificar tu identidad.'
                  : 'Your documents are stored securely and only used to verify your identity.'}
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
                {language === 'es' ? '¡Ya estás verificado!' : 'You are already verified!'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {language === 'es'
                  ? 'Tu identidad ha sido confirmada. Disfruta de todos los beneficios.'
                  : 'Your identity has been confirmed. Enjoy all the benefits.'}
              </p>
              <Button variant="outline" onClick={() => navigate('/profile')}>
                {language === 'es' ? 'Volver al perfil' : 'Back to profile'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
