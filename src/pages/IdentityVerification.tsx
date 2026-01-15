import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

interface VerificationRecord {
  id: string;
  status: VerificationStatus;
  created_at: string;
  verified_at: string | null;
  metadata: {
    document_type?: string;
    front_url?: string;
    back_url?: string;
    selfie_url?: string;
  } | null;
}

export default function IdentityVerification() {
  const navigate = useNavigate();
  const { user, role, refreshUser } = useAuth();
  const { language } = useLanguage();
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch existing verification
  useEffect(() => {
    const fetchVerification = async () => {
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
          setVerification(data as VerificationRecord);
        }
      } catch (error) {
        // No verification found
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerification();
  }, [user?.id]);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error(language === 'es' ? 'Solo se permiten imágenes o PDF' : 'Only images or PDF allowed');
      return;
    }

    // Validate file size (max 10MB)
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
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    
    if (!frontFile) {
      toast.error(language === 'es' ? 'El frente del documento es obligatorio' : 'Front of document is required');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const timestamp = Date.now();
      const metadata: Record<string, string> = {
        document_type: 'official_id',
      };

      // Upload front
      setUploadProgress(10);
      const frontExt = frontFile.name.split('.').pop();
      const frontPath = `${user.id}/${timestamp}_front.${frontExt}`;
      await uploadFile(frontFile, frontPath);
      metadata.front_url = frontPath;
      setUploadProgress(40);

      // Upload back if provided
      if (backFile) {
        const backExt = backFile.name.split('.').pop();
        const backPath = `${user.id}/${timestamp}_back.${backExt}`;
        await uploadFile(backFile, backPath);
        metadata.back_url = backPath;
      }
      setUploadProgress(70);

      // Upload selfie if provided
      if (selfieFile) {
        const selfieExt = selfieFile.name.split('.').pop();
        const selfiePath = `${user.id}/${timestamp}_selfie.${selfieExt}`;
        await uploadFile(selfieFile, selfiePath);
        metadata.selfie_url = selfiePath;
      }
      setUploadProgress(90);

      // Create verification record
      const { data: insertedData, error } = await supabase
        .from('identity_verifications')
        .insert({
          user_id: user.id,
          provider: 'manual',
          status: 'pending',
          metadata: metadata,
        })
        .select()
        .single();

      if (error) throw error;

      // Send verification email notification
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { user_id: user.id, status: 'pending' },
        });
      } catch (emailError) {
        console.warn('Failed to send verification email:', emailError);
      }

      setUploadProgress(100);
      toast.success(
        language === 'es' 
          ? 'Documentos enviados para verificación' 
          : 'Documents submitted for verification'
      );
      
      // Refresh verification status
      const { data: newVerification } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (newVerification) {
        setVerification(newVerification as VerificationRecord);
      }

      // Clear files
      setFrontFile(null);
      setFrontPreview(null);
      setBackFile(null);
      setBackPreview(null);
      setSelfieFile(null);
      setSelfiePreview(null);
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
        icon: Clock,
        color: 'text-warning',
        bg: 'bg-warning/10',
        badge: 'warning' as const,
        title: language === 'es' ? 'Verificación en proceso' : 'Verification in progress',
        description: language === 'es' 
          ? 'Estamos revisando tus documentos. Este proceso puede tomar 24-48 horas.'
          : 'We are reviewing your documents. This process may take 24-48 hours.',
      },
      approved: {
        icon: CheckCircle,
        color: 'text-success',
        bg: 'bg-success/10',
        badge: 'success' as const,
        title: language === 'es' ? 'Identidad verificada' : 'Identity verified',
        description: language === 'es' 
          ? 'Tu identidad ha sido verificada exitosamente.'
          : 'Your identity has been successfully verified.',
      },
      rejected: {
        icon: XCircle,
        color: 'text-destructive',
        bg: 'bg-destructive/10',
        badge: 'destructive' as const,
        title: language === 'es' ? 'Verificación rechazada' : 'Verification rejected',
        description: language === 'es' 
          ? 'Tu solicitud fue rechazada. Por favor, intenta nuevamente con documentos claros.'
          : 'Your request was rejected. Please try again with clear documents.',
      },
      expired: {
        icon: AlertCircle,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        badge: 'secondary' as const,
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

  const canSubmitNewVerification = !verification || verification.status === 'rejected' || verification.status === 'expired';
  const statusConfig = verification ? getStatusConfig(verification.status) : null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
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
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${statusConfig.bg} flex items-center justify-center`}>
                  <statusConfig.icon className={`w-6 h-6 ${statusConfig.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{statusConfig.title}</h3>
                    <Badge variant={statusConfig.badge}>
                      {verification.status === 'pending' && (language === 'es' ? 'Pendiente' : 'Pending')}
                      {verification.status === 'approved' && (language === 'es' ? 'Aprobado' : 'Approved')}
                      {verification.status === 'rejected' && (language === 'es' ? 'Rechazado' : 'Rejected')}
                      {verification.status === 'expired' && (language === 'es' ? 'Expirado' : 'Expired')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
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
        {canSubmitNewVerification && (
          <>
            {/* Info Alert */}
            <Alert className="mb-6">
              <Info className="w-4 h-4" />
              <AlertTitle>{language === 'es' ? 'Documentos aceptados' : 'Accepted documents'}</AlertTitle>
              <AlertDescription>
                {language === 'es' 
                  ? 'INE/IFE, Pasaporte, Licencia de conducir u otro documento oficial con fotografía.'
                  : 'Government ID, Passport, Driver\'s license or other official photo ID.'}
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  {language === 'es' ? 'Sube tu documento' : 'Upload your document'}
                </CardTitle>
                <CardDescription>
                  {language === 'es' 
                    ? 'Asegúrate de que el documento sea legible y esté completo'
                    : 'Make sure the document is readable and complete'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Front of document */}
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
                  <input
                    ref={frontInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileSelect(e, setFrontFile, setFrontPreview)}
                    className="hidden"
                  />
                </div>

                {/* Back of document */}
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
                  <input
                    ref={backInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileSelect(e, setBackFile, setBackPreview)}
                    className="hidden"
                  />
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
                          {language === 'es' 
                            ? 'Tómate una foto sosteniendo tu documento' 
                            : 'Take a photo holding your document'}
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={selfieInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, setSelfieFile, setSelfiePreview)}
                    className="hidden"
                  />
                </div>

                {/* Upload Progress */}
                {isSubmitting && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{language === 'es' ? 'Subiendo documentos...' : 'Uploading documents...'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Submit Button */}
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!frontFile || isSubmitting}
                >
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

                {/* Privacy Notice */}
                <p className="text-xs text-center text-muted-foreground">
                  {language === 'es' 
                    ? 'Tus documentos se almacenan de forma segura y solo se usan para verificar tu identidad.'
                    : 'Your documents are stored securely and only used to verify your identity.'}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Already verified message */}
        {verification?.status === 'approved' && (
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
