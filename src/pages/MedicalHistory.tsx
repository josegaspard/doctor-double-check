import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Upload,
  Calendar,
  Folder,
  Loader2,
  Trash2,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { exportMedicalHistoryToPDF } from '@/lib/exportMedicalHistoryPDF';
import { toast } from 'sonner';

const CATEGORIES = [
  'Laboratorios',
  'Radiografías',
  'Resonancias',
  'Tomografías',
  'Ultrasonidos',
  'Electrocardiogramas',
  'Recetas',
  'Notas médicas',
  'Otros',
];

export default function MedicalHistory() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { medicalHistory, uploadMedicalHistory, isLoading } = useVault();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    dateOfStudy: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Redirect non-patients
  if (role !== 'patient') {
    navigate('/lives');
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !formData.title || !formData.category) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMedicalHistory(
        selectedFile,
        formData.title,
        formData.category,
        formData.description || undefined,
        formData.dateOfStudy ? new Date(formData.dateOfStudy) : undefined
      );

      clearInterval(progressInterval);

      if (result.success) {
        setUploadProgress(100);
        toast.success('Estudio subido exitosamente');
        setFormData({ title: '', description: '', category: '', dateOfStudy: '' });
        setSelectedFile(null);
        setTimeout(() => setUploadProgress(0), 1000);
      } else {
        toast.error(result.error || 'Error al subir el archivo');
        setUploadProgress(0);
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error('Error al subir el archivo');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-destructive" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-info" />;
      default:
        return <FileSpreadsheet className="w-5 h-5 text-primary" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

const handleExportPDF = () => {
    if (medicalHistory.length === 0) {
      toast.error('No hay estudios para exportar');
      return;
    }

    exportMedicalHistoryToPDF(
      medicalHistory.map(item => ({
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        dateOfStudy: item.dateOfStudy,
        fileType: item.fileType,
        fileSize: item.fileSize,
        createdAt: item.createdAt,
      })),
      {
        name: user?.name || 'Paciente',
        email: user?.email || '',
      }
    );
    toast.success('Generando PDF...');
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Historial Médico
              </h1>
              <p className="text-muted-foreground text-sm">
                Almacena tus estudios clínicos de forma segura
              </p>
            </div>
          </div>
          
          {/* Export Button */}
          {medicalHistory.length > 0 && (
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Subir Estudio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título del estudio *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Análisis de sangre general"
                />
              </div>

              <div>
                <Label>Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fecha del estudio</Label>
                <Input
                  type="date"
                  value={formData.dateOfStudy}
                  onChange={(e) => setFormData({ ...formData, dateOfStudy: e.target.value })}
                />
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notas adicionales sobre el estudio..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Archivo *</Label>
                <div className="mt-1">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {selectedFile ? (
                      <div className="text-center">
                        <FileText className="w-8 h-8 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(selectedFile.size)}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Haz clic para seleccionar un archivo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF, imagen o estudio DICOM
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.dcm"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-xs text-center text-muted-foreground">
                    {uploadProgress < 100 ? 'Subiendo...' : '¡Completado!'}
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !formData.title || !formData.category}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Subir Estudio
              </Button>
            </CardContent>
          </Card>

          {/* History List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Mis Estudios ({medicalHistory.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : medicalHistory.length > 0 ? (
                <div className="space-y-3">
                  {medicalHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                        {getFileIcon(item.fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          {item.dateOfStudy && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(item.dateOfStudy)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatSize(item.fileSize)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No tienes estudios guardados
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="mt-6 bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-info" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  Tu historial es privado
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo tú puedes ver estos archivos. Cuando tengas una consulta, puedes
                  compartir archivos específicos con tu médico desde la sección Vault.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
