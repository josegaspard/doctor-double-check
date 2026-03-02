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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Upload,
  Video,
  FileText,
  Image,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Clock,
  Users,
} from 'lucide-react';
import { AudienceSelector, ContentAudience } from '@/components/content/AudienceSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CONTENT_CATEGORIES = [
  'Cardiología',
  'Medicina Interna',
  'Pediatría',
  'Neurología',
  'Dermatología',
  'Oftalmología',
  'Neumología',
  'Endocrinología',
  'Psiquiatría',
  'Otro',
];

interface UploadedContent {
  id: string;
  type: 'video' | 'pdf' | 'image';
  title: string;
  description: string;
  category: string;
  isPublic: boolean;
  audienceType: ContentAudience;
  uploadedAt: Date;
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

  // Load existing content from Supabase
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
        })));
      }
    };

    loadContent();
  }, [user?.id]);

  // Redirect non-doctors
  React.useEffect(() => {
    if (role !== 'doctor') {
      navigate('/lives');
    }
  }, [role, navigate]);

  if (role !== 'doctor') {
    return null;
  }

  const isApproved = user?.doctorProfile?.status === 'approved';

  const getFileType = (file: File): 'video' | 'pdf' | 'image' => {
    if (file.type.includes('video')) return 'video';
    if (file.type.includes('pdf')) return 'pdf';
    return 'image';
  };

  const getFileIcon = (type: 'video' | 'pdf' | 'image') => {
    switch (type) {
      case 'video': return <Video className="w-6 h-6 text-live" />;
      case 'pdf': return <FileText className="w-6 h-6 text-primary" />;
      case 'image': return <Image className="w-6 h-6 text-info" />;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !category || !user?.id) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Simulate progress since Supabase JS doesn't support onUploadProgress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('doctor-content')
        .upload(fileName, selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      // Get signed URL for the file
      const { data: urlData } = await supabase.storage
        .from('doctor-content')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      // Save content metadata to database
      const { data: contentData, error: dbError } = await supabase
        .from('doctor_content')
        .insert({
          creator_id: user.id,
          type: getFileType(selectedFile),
          title: title.trim(),
          description: description.trim() || null,
          category,
          is_public: isPublic,
          audience_type: audienceType,
          file_url: fileName,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newContent: UploadedContent = {
        id: contentData.id,
        type: getFileType(selectedFile),
        title,
        description,
        category,
        isPublic,
        audienceType,
        uploadedAt: new Date(),
      };

      setUploadedContent(prev => [newContent, ...prev]);
      setShowSuccess(true);
      
      // Notify subscribers if content is public
      if (isPublic) {
        // Send in-app notifications
        await supabase.rpc('notify_subscribers', {
          p_doctor_id: user.id,
          p_notification_type: 'new_content',
          p_title: `Nuevo contenido: ${title}`,
          p_message: `${user.name} ha subido nuevo contenido en ${category}`,
          p_data: { content_id: contentData.id, type: getFileType(selectedFile) },
        });

        // Send email notifications to subscribers
        supabase.functions.invoke('send-content-notification-email', {
          body: {
            doctorId: user.id,
            doctorName: user.name,
            contentId: contentData.id,
            contentTitle: title.trim(),
            contentType: getFileType(selectedFile),
            category,
          },
        }).catch(err => console.error('Error sending email notifications:', err));
      }

      toast({
        title: 'Contenido subido',
        description: isPublic ? 'Se notificó a tus suscriptores' : 'Guardado como privado',
      });
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setCategory('');
      setIsPublic(true);
      setAudienceType('all');
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error al subir',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Panel
        </Button>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Upload className="w-6 h-6 text-primary" />
          Subir Contenido
        </h1>

        {/* Verification Warning */}
        {!isApproved && (
          <Card className="mb-6 border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Verificación requerida</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No puedes subir contenido hasta que tu cuenta esté verificada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Form */}
        <Card className={!isApproved ? 'opacity-50 pointer-events-none' : ''}>
          <CardHeader>
            <CardTitle className="text-lg">Nuevo Contenido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection */}
            <div className="space-y-2">
              <Label>Archivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.pdf,image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={!isApproved}
              />
              
              {selectedFile ? (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  {getFileIcon(getFileType(selectedFile))}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Haz clic para seleccionar un archivo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Video, PDF o imagen (máx. 100MB)
                  </p>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ej: Interpretación de ECG - Clase 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isApproved}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe el contenido..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!isApproved}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory} disabled={!isApproved}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audience Type */}
            <AudienceSelector
              value={audienceType}
              onChange={setAudienceType}
              disabled={!isApproved}
            />

            {/* Public/Private */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Contenido Público</Label>
                <p className="text-xs text-muted-foreground">
                  El contenido público aparece en tu perfil y notifica a suscriptores
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={!isApproved} />
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subiendo...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Success Message */}
            {showSuccess && (
              <div className="flex items-center gap-2 text-success text-sm bg-success/10 p-3 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                Contenido subido exitosamente
              </div>
            )}

            {/* Submit Button */}
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!isApproved || !selectedFile || !title || !category || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Contenido
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Uploaded Content */}
        {uploadedContent.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Mi Contenido ({uploadedContent.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedContent.map(content => (
                  <div key={content.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      {getFileIcon(content.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{content.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{content.category}</Badge>
                        {content.audienceType === 'professionals' && (
                          <Badge variant="warning" className="text-xs gap-1">
                            <Users className="w-3 h-3" />
                            Solo profesionales
                          </Badge>
                        )}
                        {content.audienceType === 'patients' && (
                          <Badge variant="info" className="text-xs">
                            Pacientes
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {content.uploadedAt.toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    </div>
                    {content.isPublic ? (
                      <Badge variant="success" className="text-xs">Público</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Privado</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
