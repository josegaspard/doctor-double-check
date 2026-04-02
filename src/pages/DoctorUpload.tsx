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
  Loader2, X, Clock, Users, Trash2, Settings2, CheckSquare,
} from 'lucide-react';
import { AudienceSelector, ContentAudience } from '@/components/content/AudienceSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [audienceType, setAudienceType] = useState<ContentAudience>('all');
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
      toast({ title: `${ids.length} contenido${ids.length > 1 ? 's' : ''} eliminado${ids.length > 1 ? 's' : ''}` });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
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

      if (isPublic) {
        await supabase.rpc('notify_subscribers', { p_doctor_id: user.id, p_notification_type: 'new_content', p_title: `Nuevo contenido: ${title}`, p_message: `${user.name} ha subido nuevo contenido en ${category}`, p_data: { content_id: contentData.id, type: getFileType(selectedFile) } });
        supabase.functions.invoke('send-content-notification-email', { body: { doctorId: user.id, doctorName: user.name, contentId: contentData.id, contentTitle: title.trim(), contentType: getFileType(selectedFile), category } }).catch(err => console.error('Error sending email notifications:', err));
      }

      toast({ title: 'Contenido subido', description: isPublic ? 'Se notificó a tus suscriptores' : 'Guardado como privado' });
      setSelectedFile(null); setTitle(''); setDescription(''); setCategory(''); setIsPublic(true); setAudienceType('all');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' });
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />Volver al Panel
        </Button>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Upload className="w-6 h-6 text-primary" />Subir Contenido
        </h1>

        {/* Verification Warning */}
        {!isApproved && (
          <Card className="mb-6 border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Verificación requerida</h3>
                  <p className="text-sm text-muted-foreground mt-1">No puedes subir contenido hasta que tu cuenta esté verificada.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Form */}
        <Card className={!isApproved ? 'opacity-50 pointer-events-none' : ''}>
          <CardHeader><CardTitle className="text-lg">Nuevo Contenido</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection */}
            <div className="space-y-2">
              <Label>Archivo</Label>
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
                  <p className="text-sm text-muted-foreground">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                  <p className="text-xs text-muted-foreground mt-1">Video, PDF, imagen o presentación (máx. 100MB)</p>
                </div>
              )}
            </div>

            <div className="space-y-2"><Label htmlFor="title">Título *</Label><Input id="title" placeholder="Ej: Interpretación de ECG - Clase 1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isApproved} /></div>
            <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Textarea id="description" placeholder="Describe el contenido..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!isApproved} /></div>
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory} disabled={!isApproved}>
                <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>{CONTENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <AudienceSelector value={audienceType} onChange={setAudienceType} disabled={!isApproved} />
            <div className="flex items-center justify-between">
              <div><Label>Contenido Público</Label><p className="text-xs text-muted-foreground">El contenido público aparece en tu perfil y notifica a suscriptores</p></div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={!isApproved} />
            </div>
            {isUploading && (<div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subiendo...</span><span className="font-medium">{uploadProgress}%</span></div><Progress value={uploadProgress} className="h-2" /></div>)}
            {showSuccess && (<div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg"><CheckCircle className="w-4 h-4" />Contenido subido exitosamente</div>)}
            <Button className="w-full" onClick={handleUpload} disabled={!isApproved || !selectedFile || !title || !category || isUploading}>
              {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo...</> : <><Upload className="w-4 h-4 mr-2" />Subir Contenido</>}
            </Button>
          </CardContent>
        </Card>

        {/* Uploaded Content with manage mode */}
        {uploadedContent.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Mi Contenido ({uploadedContent.length})</CardTitle>
                <div className="flex items-center gap-2">
                  {manageMode && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {selectedIds.size === uploadedContent.length ? 'Deseleccionar' : 'Seleccionar todo'}
                    </Button>
                  )}
                  <Button
                    variant={manageMode ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => { setManageMode(!manageMode); setSelectedIds(new Set()); }}
                    className="text-xs gap-1.5"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {manageMode ? 'Cancelar' : 'Gestionar'}
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
                          {content.audienceType === 'professionals' && <Badge variant="warning" className="text-[10px] sm:text-xs gap-1 px-1.5"><Users className="w-3 h-3" /><span className="hidden sm:inline">Solo </span>Prof.</Badge>}
                          {content.audienceType === 'patients' && <Badge variant="info" className="text-[10px] sm:text-xs px-1.5">Pacientes</Badge>}
                          {content.isPublic ? <Badge variant="success" className="text-[10px] sm:text-xs px-1.5">Público</Badge> : <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5">Privado</Badge>}
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
            <span className="text-sm font-medium">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDeleteTarget(null); setDeleteDialogOpen(true); }}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />Eliminar
            </Button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar {deleteCount} contenido{deleteCount > 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminarán los archivos y registros permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
