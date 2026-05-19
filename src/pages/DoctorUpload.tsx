import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload, Video, FileText, Image, ArrowLeft, CheckCircle, AlertTriangle,
  Loader2, X, Clock, Users, Trash2, Settings2, CheckSquare, Stethoscope,
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

interface MasterclassSession {
  session_number: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
}

interface UploadedContent {
  id: string;
  type: 'video' | 'pdf' | 'image' | 'presentation';
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
  audienceType: ContentAudience;
  uploadedAt: Date;
  fileUrl?: string;
  thumbnailUrl?: string;
  isMasterclass?: boolean;
}

export default function DoctorUpload() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [audienceType, setAudienceType] = useState<ContentAudience>('all');
  const [contentTarget, setContentTarget] = useState<'medical' | 'patients' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedContent, setUploadedContent] = useState<UploadedContent[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Masterclass state
  const [isMasterclass, setIsMasterclass] = useState(false);
  const [masterclassSessions, setMasterclassSessions] = useState<MasterclassSession[]>([
    { session_number: 1, title: '', scheduled_at: '', duration_minutes: 60 },
  ]);

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // null = bulk
  const [isDeleting, setIsDeleting] = useState(false);

  // Load existing content
  React.useEffect(() => {
    const loadContent = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('doctor_content')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setUploadedContent(data.map(c => ({
          id: c.id,
          type: c.type as 'video' | 'pdf' | 'image',
          title: c.title,
          description: c.description || '',
          category: c.category || '',
          isPublic: c.is_public,
          audienceType: c.audience_type as ContentAudience,
          uploadedAt: new Date(c.created_at),
          fileUrl: c.file_url,
          thumbnailUrl: c.thumbnail_url || undefined,
        })));
      }
    };
    loadContent();
  }, [user?.id]);

  // Redirect non-doctors
  React.useEffect(() => {
    if (role !== 'doctor') navigate('/lives');
  }, [role, navigate]);

  if (role !== 'doctor') return null;

  const isApproved = user?.doctorProfile?.status === 'approved';

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

  const extractStoragePath = (url: string): string | null => {
    if (!url) return null;
    // If it's already a relative path (not a URL)
    if (!url.startsWith('http')) return url;
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/object\/(?:public|sign)\/([^?]+)/);
    return match ? match[1] : null;
  };

  const deleteContentItems = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      const itemsToDelete = uploadedContent.filter(c => ids.includes(c.id));

      // Delete from DB first
      const { error } = await supabase.from('doctor_content').delete().in('id', ids);
      if (error) throw error;

      // Delete storage files
      for (const item of itemsToDelete) {
        if (item.fileUrl) {
          const path = extractStoragePath(item.fileUrl);
          if (path) {
            // path might be "bucket/folder/file" or just "folder/file"
            const storagePath = path.startsWith('doctor-content/') ? path.replace('doctor-content/', '') : path;
            await supabase.storage.from('doctor-content').remove([storagePath]);
          }
        }
        if (item.thumbnailUrl) {
          const thumbPath = extractStoragePath(item.thumbnailUrl);
          if (thumbPath) {
            const storagePath = thumbPath.startsWith('thumbnails/') ? thumbPath.replace('thumbnails/', '') : thumbPath;
            await supabase.storage.from('thumbnails').remove([storagePath]);
          }
        }
      }

      setUploadedContent(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedIds(new Set());
      setManageMode(false);
      toast({ title: ids.length > 1 ? t('doctorUploadPage.toastDeletedPlural').replace('{count}', String(ids.length)) : t('doctorUploadPage.toastDeletedSingular') });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: t('doctorUploadPage.toastDeleteError'), description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteContentItems([deleteTarget]);
    } else {
      deleteContentItems(Array.from(selectedIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === uploadedContent.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uploadedContent.map(c => c.id)));
    }
  };

  const handleUpload = async () => {
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
      if (isMasterclass) {
        insertPayload.is_masterclass = true;
        insertPayload.masterclass_sessions = masterclassSessions.filter(s => s.title.trim());
      }

      const { data: contentData, error: dbError } = await supabase
        .from('doctor_content')
        .insert(insertPayload)
        .select().single();
      if (dbError) throw dbError;

      setUploadedContent(prev => [{ id: contentData.id, type: getFileType(selectedFile), title, description, category, isPublic, audienceType, uploadedAt: new Date(), fileUrl: fileName }, ...prev]);
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

  const deleteCount = deleteTarget ? 1 : selectedIds.size;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />{t('doctorUploadPage.backToPanel')}
        </Button>

        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
          <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />{t('doctorUploadPage.pageTitle')}
        </h1>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            

            {/* Masterclass toggle */}
            <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border">
              <div className="min-w-0 flex-1"><Label>{t('doctorUploadPage.masterclassLabel')}</Label><p className="text-xs text-muted-foreground mt-0.5">{t('doctorUploadPage.masterclassDescription')}</p></div>
              <Switch checked={isMasterclass} onCheckedChange={v => { setIsMasterclass(v); if (v && masterclassSessions.length === 0) setMasterclassSessions([{ session_number: 1, title: '', scheduled_at: '', duration_minutes: 60 }]); }} disabled={!isApproved} className="flex-shrink-0" />
            </div>

            {isMasterclass && (
              <div className="space-y-3 border border-border rounded-lg p-3 sm:p-4 bg-muted/30">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-medium">{t('doctorUploadPage.sessionsCount').replace('{count}', String(masterclassSessions.length))}</Label>
                  <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setMasterclassSessions(prev => [...prev, { session_number: prev.length + 1, title: '', scheduled_at: '', duration_minutes: 60 }])}>
                    {t('doctorUploadPage.addSession')}
                  </Button>
                </div>
                {masterclassSessions.map((session, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">{t('doctorUploadPage.sessionNumber').replace('{n}', String(i + 1))}</span>
                      {masterclassSessions.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 px-2 -mr-2" onClick={() => {
                          setMasterclassSessions(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, session_number: idx + 1 })));
                        }}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('doctorUploadPage.sessionTitleLabel')}</Label>
                      <Input placeholder={t('doctorUploadPage.sessionNumber').replace('{n}', String(i + 1))} value={session.title} onChange={e => {
                        setMasterclassSessions(prev => prev.map((s, idx) => idx === i ? { ...s, title: e.target.value } : s));
                      }} className="text-sm" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('doctorUploadPage.sessionDateTimeLabel')}</Label>
                        <Input type="datetime-local" value={session.scheduled_at} onChange={e => {
                          setMasterclassSessions(prev => prev.map((s, idx) => idx === i ? { ...s, scheduled_at: e.target.value } : s));
                        }} className="text-sm w-full sm:w-48" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('doctorUploadPage.sessionMinutesLabel')}</Label>
                        <Input type="number" value={session.duration_minutes} onChange={e => {
                          setMasterclassSessions(prev => prev.map((s, idx) => idx === i ? { ...s, duration_minutes: parseInt(e.target.value) || 60 } : s));
                        }} className="text-sm w-full sm:w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

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

        {/* Uploaded Content with manage mode */}
        {uploadedContent.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('doctorUploadPage.myContentTitle').replace('{count}', String(uploadedContent.length))}</CardTitle>
                <div className="flex items-center gap-2">
                  {manageMode && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {selectedIds.size === uploadedContent.length ? t('doctorUploadPage.deselectAll') : t('doctorUploadPage.selectAll')}
                    </Button>
                  )}
                  <Button
                    variant={manageMode ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => { setManageMode(!manageMode); setSelectedIds(new Set()); }}
                    className="text-xs gap-1.5"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {manageMode ? t('doctorUploadPage.cancelButton') : t('doctorUploadPage.manageButton')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedContent.map(content => (
                  <div key={content.id} className={`p-3 rounded-lg transition-colors ${manageMode && selectedIds.has(content.id) ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted/50'}`}>
                    {/* Mobile: stacked layout / Desktop: row layout */}
                    <div className="flex items-start sm:items-center gap-3">
                      {manageMode && (
                        <Checkbox
                          checked={selectedIds.has(content.id)}
                          onCheckedChange={() => toggleSelect(content.id)}
                          className="mt-1 sm:mt-0"
                        />
                      )}
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-background flex items-center justify-center shrink-0">
                        {getFileIcon(content.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{content.title}</p>
                        {/* Badges row - wraps on mobile */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5">{content.category}</Badge>
                          {content.audienceType === 'professionals' && <Badge variant="warning" className="text-[10px] sm:text-xs gap-1 px-1.5"><Users className="w-3 h-3" /><span className="hidden sm:inline">{t('doctorUploadPage.audienceOnly')} </span>{t('doctorUploadPage.audienceProfShort')}</Badge>}
                          {content.audienceType === 'patients' && <Badge variant="info" className="text-[10px] sm:text-xs px-1.5">{t('doctorUploadPage.audiencePatients')}</Badge>}
                          {content.isPublic ? <Badge variant="success" className="text-[10px] sm:text-xs px-1.5">{t('doctorUploadPage.badgePublic')}</Badge> : <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5">{t('doctorUploadPage.badgePrivate')}</Badge>}
                        </div>
                        {/* Date on its own line on mobile */}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{content.uploadedAt.toLocaleDateString('es-MX')}</span>
                      </div>
                      {/* Delete button - always visible */}
                      {!manageMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => { setDeleteTarget(content.id); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk action floating bar */}
        {manageMode && selectedIds.size > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-xl border border-border rounded-2xl shadow-xl px-5 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selectedIds.size > 1 ? t('doctorUploadPage.selectedCountPlural').replace('{count}', String(selectedIds.size)) : t('doctorUploadPage.selectedCountSingular').replace('{count}', String(selectedIds.size))}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDeleteTarget(null); setDeleteDialogOpen(true); }}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />{t('doctorUploadPage.deleteButton')}
            </Button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteCount > 1 ? t('doctorUploadPage.deleteConfirmTitlePlural').replace('{count}', String(deleteCount)) : t('doctorUploadPage.deleteConfirmTitleSingular')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('doctorUploadPage.deleteConfirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{t('doctorUploadPage.cancelButton')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {t('doctorUploadPage.deleteButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
