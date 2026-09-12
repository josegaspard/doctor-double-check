import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { doctorHref } from '@/lib/doctorSections';
import {
  Upload, Video, FileText, Image, ArrowLeft, CheckCircle, AlertTriangle,
  Loader2, X, Users, Stethoscope, Globe, ArrowRight, FolderOpen,
} from 'lucide-react';
import { ContentAudience } from '@/components/content/AudienceSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const CONTENT_CATEGORIES = [
  'Alergología', 'Anestesiología', 'Angiología', 'Cardiología', 'Cirugía General',
  'Cirugía Plástica', 'Coloproctología', 'Dermatología', 'Endocrinología',
  'Gastroenterología', 'Geriatría', 'Ginecología', 'Hematología', 'Infectología',
  'Medicina Crítica', 'Medicina de Urgencias', 'Medicina del Deporte', 'Medicina Familiar',
  'Medicina Física y Rehabilitación', 'Medicina General', 'Medicina Interna',
  'Nefrología', 'Neonatología', 'Neumología', 'Neurología', 'Nutriología',
  'Oftalmología', 'Oncología', 'Ortopedia', 'Otorrinolaringología', 'Patología',
  'Pediatría', 'Psiquiatría', 'Radiología', 'Reumatología', 'Traumatología',
  'Urología',
  'Casos Clínicos', 'Explicaciones', 'Procedimientos', 'Conferencias',
  'Otro',
];

export default function DoctorUpload({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [audienceType, setAudienceType] = useState<ContentAudience>('all');
  const [contentTarget, setContentTarget] = useState<'medical' | 'patients' | 'both' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Redirect non-creators (doctores y residentes pueden subir contenido; no cuando va
  // embebido dentro de otra página, p.ej. Educación).
  React.useEffect(() => {
    if (!embedded && role !== 'doctor' && role !== 'resident') navigate('/lives');
  }, [role, navigate, embedded]);

  if (role !== 'doctor' && role !== 'resident') return null;

  const isApproved = user?.doctorProfile?.status === 'approved' || user?.residentProfile?.status === 'approved';

  const getFileType = (file: File): 'video' | 'pdf' | 'image' | 'presentation' => {
    if (file.type.includes('video')) return 'video';
    if (file.type.includes('pdf')) return 'pdf';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['pptx', 'ppt', 'key', 'odp'].includes(ext || '')) return 'presentation';
    if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'presentation';
    return 'image';
  };

  const getFileIcon = (type: 'video' | 'pdf' | 'image' | 'presentation') => {
    switch (type) {
      case 'video': return <Video className="w-6 h-6 text-live" />;
      case 'pdf': return <FileText className="w-6 h-6 text-primary" />;
      case 'presentation': return <FileText className="w-6 h-6 text-warning" />;
      case 'image': return <Image className="w-6 h-6 text-info" />;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  // Publicar (o guardar en privado) es una acción con consecuencias: pasa por
  // el modal de revisión común antes de subir el archivo e insertar en
  // doctor_content — nunca al primer clic (regla del encargo, 11-sep-2026).
  // El "Mi contenido" con borrar/gestionar se quitó de aquí: ya vive completo
  // en Contenido › Publicaciones (DoctorContentLibrary), que es donde se
  // administra lo ya subido.
  const audienceLabel = () => {
    if (audienceType === 'professionals') return t('doctorUploadPage.medicalContentLabel');
    if (audienceType === 'patients') return t('doctorUploadPage.patientsContentLabel');
    return t('doctorUploadPage.bothContentLabel');
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !category || !user?.id) return;
    const ok = await confirm({
      title: t('mm2.content.hub.crear.upload.confirmTitle'),
      description: isPublic
        ? t('mm2.content.hub.crear.upload.confirmDescPublic')
        : t('mm2.content.hub.crear.upload.confirmDescPrivate'),
      details: [
        { label: t('doctorUploadPage.titleLabel'), value: title },
        { label: t('doctorUploadPage.categoryLabel'), value: t(`medical.category.${category}`) },
        { label: t('doctorUploadPage.audienceQuestion'), value: audienceLabel() },
        { label: t('doctorUploadPage.publicContentLabel'), value: isPublic ? t('mm2.content.hub.crear.upload.visPublic') : t('mm2.content.hub.crear.upload.visPrivate') },
      ],
      confirmLabel: t('doctorUploadPage.uploadButton'),
    });
    if (!ok) return;
    await doUpload();
  };

  const doUpload = async () => {
    if (!selectedFile || !title || !category || !user?.id) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const progressInterval = setInterval(() => { setUploadProgress(prev => Math.min(prev + 10, 90)); }, 200);

      const { error: uploadError } = await supabase.storage.from('doctor-content').upload(fileName, selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (uploadError) throw uploadError;

      const insertPayload: any = { creator_id: user.id, type: getFileType(selectedFile), title: title.trim(), description: description.trim() || null, category, is_public: isPublic, audience_type: audienceType, file_url: fileName };

      const { error: dbError } = await supabase
        .from('doctor_content')
        .insert(insertPayload)
        .select().single();
      if (dbError) throw dbError;

      setShowSuccess(true);

      // Public content goes through admin moderation BEFORE notifying subscribers.
      // Subscriber notification + email now fires from AdminContentModeration when approved.

      toast({
        title: t('doctorUploadPage.toastSubmittedTitle'),
        description: isPublic
          ? t('doctorUploadPage.toastSubmittedPublicDescription')
          : t('doctorUploadPage.toastSubmittedPrivateDescription'),
      });
      setSelectedFile(null); setTitle(''); setDescription(''); setCategory(''); setIsPublic(true); setAudienceType('all');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: t('doctorUploadPage.toastUploadError'), description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false); setUploadProgress(0);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const Wrapper = embedded ? React.Fragment : MainLayout;
  return (
    <Wrapper>
      <div className={embedded ? '' : 'container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl'}>
        {!embedded && (
          <Button variant="back" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4 hidden sm:inline-flex">
            <ArrowLeft className="w-4 h-4 mr-2" />{t('doctorUploadPage.backToPanel')}
          </Button>
        )}

        {!embedded && (
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
            <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />{t('doctorUploadPage.pageTitle')}
          </h1>
        )}

        {/* Verification Warning */}
        {!isApproved && (
          <Card className="mb-6 border-l-4 border-l-primary shadow-md bg-card">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base">{t('doctorUploadPage.verificationRequiredTitle')}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {t('doctorUploadPage.verificationRequiredDescription')}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 bg-primary/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-secondary w-1/2 animate-pulse rounded-full" />
                    </div>
                    <span className="text-xs font-medium text-primary whitespace-nowrap">{t('doctorUploadPage.verificationInReview')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Form */}
        <Card className={!isApproved ? 'opacity-50 pointer-events-none' : ''}>
          <CardHeader className="px-4 sm:px-6 pb-3 sm:pb-4"><CardTitle className="text-base sm:text-lg">{t('doctorUploadPage.newContentTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
            {/* Content Target Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">{t('doctorUploadPage.audienceQuestion')}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setContentTarget('medical'); setAudienceType('professionals'); }}
                  className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${contentTarget === 'medical' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contentTarget === 'medical' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm ${contentTarget === 'medical' ? 'text-primary' : 'text-foreground'}`}>{t('doctorUploadPage.medicalContentLabel')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('doctorUploadPage.medicalContentSubtitle')}</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setContentTarget('patients'); setAudienceType('patients'); }}
                  className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${contentTarget === 'patients' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contentTarget === 'patients' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm ${contentTarget === 'patients' ? 'text-primary' : 'text-foreground'}`}>{t('doctorUploadPage.patientsContentLabel')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('doctorUploadPage.patientsContentSubtitle')}</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setContentTarget('both'); setAudienceType('all'); }}
                  className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${contentTarget === 'both' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contentTarget === 'both' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm ${contentTarget === 'both' ? 'text-primary' : 'text-foreground'}`}>{t('doctorUploadPage.bothContentLabel')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('doctorUploadPage.bothContentSubtitle')}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            {/* File Selection */}
            <div className="space-y-2">
              <Label>{t('doctorUploadPage.fileLabel')}</Label>
              <input ref={fileInputRef} type="file" accept="video/*,.pdf,image/*,.pptx,.ppt,.key,.odp" className="hidden" onChange={handleFileSelect} disabled={!isApproved} />
              {selectedFile ? (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  {getFileIcon(getFileType(selectedFile))}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); const file = e.dataTransfer.files?.[0]; if (file) setSelectedFile(file); }}
                >
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">{t('doctorUploadPage.dragDropText')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('doctorUploadPage.dragDropHint')}</p>
                </div>
              )}
            </div>

            <div className="space-y-2"><Label htmlFor="title">{t('doctorUploadPage.titleLabel')}</Label><Input id="title" placeholder={t('doctorUploadPage.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isApproved} /></div>
            <div className="space-y-2"><Label htmlFor="description">{t('doctorUploadPage.descriptionLabel')}</Label><Textarea id="description" placeholder={t('doctorUploadPage.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!isApproved} /></div>
            <div className="space-y-2">
              <Label>{t('doctorUploadPage.categoryLabel')}</Label>
              <Select value={category} onValueChange={setCategory} disabled={!isApproved}>
                <SelectTrigger><SelectValue placeholder={t('doctorUploadPage.categoryPlaceholder')} /></SelectTrigger>
                <SelectContent>{CONTENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{t(`medical.category.${cat}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            

            {/* Masterclass se gestiona ahora en su propia sección de MM Education
                (cliente 2026-07-07) — se quitó el toggle de aquí. */}

            <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border">
              <div className="min-w-0 flex-1"><Label>{t('doctorUploadPage.publicContentLabel')}</Label><p className="text-xs text-muted-foreground mt-0.5">{t('doctorUploadPage.publicContentDescription')}</p></div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={!isApproved} className="flex-shrink-0" />
            </div>
            {isUploading && (<div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{t('doctorUploadPage.uploadingLabel')}</span><span className="font-medium">{uploadProgress}%</span></div><Progress value={uploadProgress} className="h-2" /></div>)}
            {showSuccess && (<div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg"><CheckCircle className="w-4 h-4" />{t('doctorUploadPage.uploadSuccessMessage')}</div>)}
            <Button className="w-full" onClick={handleUpload} disabled={!isApproved || !selectedFile || !title || !category || isUploading}>
              {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorUploadPage.uploadingButton')}</> : <><Upload className="w-4 h-4 mr-2" />{t('doctorUploadPage.uploadButton')}</>}
            </Button>
          </CardContent>
        </Card>

        {/* Lo ya subido (publicar/retirar, borrar, ver estado) se administra en
            Contenido › Publicaciones — aquí ya no se duplica esa lista
            (11-sep-2026): esto es solo el paso de "Crear". */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{t('mm2.content.hub.crear.upload.manageHint')}</span>
          </div>
          <Link to={doctorHref('contenido', { tab: 'publicaciones' })} className="text-sm font-medium text-primary flex items-center gap-1 flex-shrink-0">
            {t('mm2.content.hub.crear.upload.manageGo')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {dialog}
    </Wrapper>
  );
}
