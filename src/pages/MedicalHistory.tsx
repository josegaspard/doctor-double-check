import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
} from 'lucide-react';
import { VaultFilePreviewModal } from '@/components/vault/VaultFilePreviewModal';
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
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
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
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Redirect non-patients using declarative Navigate
  if (role !== 'patient') {
    return <Navigate to="/lives" replace />;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !formData.title || !formData.category) {
      toast.error(t('medicalHistory.requiredFields'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

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
        toast.success(t('medicalHistory.uploadSuccess'));
        setFormData({ title: '', description: '', category: '', dateOfStudy: '' });
        setSelectedFile(null);
        setTimeout(() => setUploadProgress(0), 1000);
      } else {
        toast.error(result.error || t('medicalHistory.uploadError'));
        setUploadProgress(0);
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(t('medicalHistory.uploadError'));
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
    return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const handlePreviewStudy = (item: any) => {
    setPreviewFile({
      id: item.id,
      name: item.title,
      type: item.fileType === 'image' ? 'image' : 'pdf',
      category: item.category,
      size: item.fileSize,
      fileUrl: item.fileUrl,
      description: item.description,
      uploadedAt: item.createdAt,
    });
    setIsPreviewOpen(true);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground">
                {t('medicalHistory.title')}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t('medicalHistory.subtitle')}
              </p>
            </div>
          </div>
        </div>
          
          {medicalHistory.length > 0 && (
            <Button variant="outline" onClick={handleExportPDF} className="gap-2 w-full sm:w-auto">
              <Download className="w-4 h-4" />
              {t('medicalHistory.exportPdf')}
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                {t('medicalHistory.uploadTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('medicalHistory.studyTitle')} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('medicalHistory.studyTitlePlaceholder')}
                />
              </div>

              <div>
                <Label>{t('medicalHistory.category')} *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('medicalHistory.selectCategory')} />
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
                <Label>{t('medicalHistory.studyDate')}</Label>
                <Input
                  type="date"
                  value={formData.dateOfStudy}
                  onChange={(e) => setFormData({ ...formData, dateOfStudy: e.target.value })}
                />
              </div>

              <div>
                <Label>{t('medicalHistory.description')}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('medicalHistory.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div>
                <Label>{t('medicalHistory.file')} *</Label>
                <div className="mt-1">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 cursor-pointer hover:border-primary/50 transition-colors">
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
                          {t('medicalHistory.selectFile')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('medicalHistory.fileTypes')}
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
                    {uploadProgress < 100 ? t('medicalHistory.uploading') : t('medicalHistory.completed')}
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
                {t('medicalHistory.uploadButton')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="w-5 h-5" />
                {t('medicalHistory.myStudies')} ({medicalHistory.length})
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
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted active:scale-[0.98] transition-all"
                      onClick={() => handlePreviewStudy(item)}
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
                    {t('medicalHistory.noStudies')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-info" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">
                  {t('medicalHistory.privacyTitle')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('medicalHistory.privacyDescription')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <VaultFilePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewFile(null);
          }}
          file={previewFile}
        />
      </div>
    </MainLayout>
  );
}
