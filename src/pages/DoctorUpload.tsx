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
} from 'lucide-react';
import { Doctor } from '@/types';

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
  uploadedAt: Date;
}

export default function DoctorUpload() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedContent, setUploadedContent] = useState<UploadedContent[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  if (role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const doctor = user as Doctor;
  const isApproved = doctor?.status === 'approved';

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
    if (!selectedFile || !title || !category) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setUploadProgress(i);
    }

    const newContent: UploadedContent = {
      id: `content-${Date.now()}`,
      type: getFileType(selectedFile),
      title,
      description,
      category,
      isPublic,
      uploadedAt: new Date(),
    };

    // Save to localStorage
    const stored = JSON.parse(localStorage.getItem(`drDoubleCheck_doctorContent_${doctor.id}`) || '[]');
    stored.unshift(newContent);
    localStorage.setItem(`drDoubleCheck_doctorContent_${doctor.id}`, JSON.stringify(stored));

    setUploadedContent(prev => [newContent, ...prev]);
    setShowSuccess(true);
    
    // Reset form
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setIsPublic(true);
    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setTimeout(() => setShowSuccess(false), 3000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Load existing content
  React.useEffect(() => {
    if (doctor?.id) {
      const stored = JSON.parse(localStorage.getItem(`drDoubleCheck_doctorContent_${doctor.id}`) || '[]');
      setUploadedContent(stored.map((c: any) => ({
        ...c,
        uploadedAt: new Date(c.uploadedAt),
      })));
    }
  }, [doctor?.id]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4">
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

            {/* Public/Private */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Contenido Público</Label>
                <p className="text-xs text-muted-foreground">
                  El contenido público aparece en tu perfil
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
