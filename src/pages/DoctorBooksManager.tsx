import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { downloadBookPdf, DoctorBook } from '@/components/doctor/DoctorBooks';
import { ArrowLeft, BookOpen, Download, Loader2, Trash2, Upload, Eye, FileText, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

// Panel del doctor para sus libros/cursos PDF de pago (cliente 2026-07-08).
// El PDF va al bucket privado doctor-content (solo compradores/creador/admin
// pueden leerlo vía RLS); la portada al bucket público thumbnails.

const MAX_PDF_MB = 50; // límite global de Supabase Storage por archivo

interface ManagedBook extends DoctorBook {
  moderation_status: 'pending' | 'approved' | 'rejected';
}

export default function DoctorBooksManager() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [books, setBooks] = useState<ManagedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const fetchBooks = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('doctor_content')
      .select('id, title, description, file_url, thumbnail_url, price, original_price, created_at, moderation_status')
      .eq('creator_id', user.id)
      .eq('is_book', true)
      .order('created_at', { ascending: false });
    setBooks((data as ManagedBook[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  if (role !== 'doctor' && role !== 'admin') {
    return <Navigate to="/lives" replace />;
  }

  const resetForm = () => {
    setTitle(''); setDescription(''); setPrice(''); setOriginalPrice('');
    setPdfFile(null); setCoverFile(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !pdfFile) return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t('doctorBooks.invalidPrice'));
      return;
    }
    const originalNum = originalPrice ? parseFloat(originalPrice) : null;
    if (originalNum !== null && (isNaN(originalNum) || originalNum <= priceNum)) {
      toast.error(t('doctorBooks.invalidOriginalPrice'));
      return;
    }
    if (pdfFile.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(t('doctorBooks.fileTooBig').replace('{max}', String(MAX_PDF_MB)));
      return;
    }

    setUploading(true);
    try {
      // 1) PDF al bucket privado (carpeta = user.id, clave para la RLS de storage)
      const pdfPath = `${user.id}/books/${Date.now()}.pdf`;
      const { error: pdfError } = await supabase.storage
        .from('doctor-content')
        .upload(pdfPath, pdfFile, { contentType: 'application/pdf' });
      if (pdfError) throw pdfError;

      // 2) Portada (opcional) al bucket público de thumbnails
      let thumbnailUrl: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const coverPath = `${user.id}/book-covers/${Date.now()}.${ext}`;
        const { error: coverError } = await supabase.storage
          .from('thumbnails')
          .upload(coverPath, coverFile);
        if (coverError) throw coverError;
        thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(coverPath).data.publicUrl;
      }

      // 3) Registro (is_book=true lo separa del resto de doctor_content)
      const { error: insertError } = await (supabase as any)
        .from('doctor_content')
        .insert({
          creator_id: user.id,
          type: 'pdf',
          title: title.trim(),
          description: description.trim() || null,
          category: 'Libros',
          is_public: true,
          audience_type: 'all',
          file_url: pdfPath,
          thumbnail_url: thumbnailUrl,
          price: priceNum,
          original_price: originalNum,
          is_book: true,
        });
      if (insertError) throw insertError;

      toast.success(t('doctorBooks.uploadSuccess'));
      resetForm();
      await fetchBooks();
    } catch (err: any) {
      toast.error(err.message || t('doctorBooks.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (book: ManagedBook) => {
    if (!window.confirm(t('doctorBooks.deleteConfirm').replace('{title}', book.title))) return;
    setDeleting(book.id);
    try {
      await supabase.storage.from('doctor-content').remove([book.file_url]);
      const { error } = await (supabase as any)
        .from('doctor_content')
        .delete()
        .eq('id', book.id)
        .eq('creator_id', user!.id);
      if (error) throw error;
      toast.success(t('doctorBooks.deleteSuccess'));
      await fetchBooks();
    } catch (err: any) {
      toast.error(err.message || t('doctorBooks.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (book: ManagedBook) => {
    setDownloading(book.id);
    try {
      await downloadBookPdf(book);
    } catch (e: any) {
      toast.error(e.message || t('doctorBooks.downloadError'));
    } finally {
      setDownloading(null);
    }
  };

  const moderationBadge = (status: ManagedBook['moderation_status']) => {
    if (status === 'approved') return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">{t('doctorBooks.statusApproved')}</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-[10px]">{t('doctorBooks.statusRejected')}</Badge>;
    return <Badge variant="outline" className="text-[10px]">{t('doctorBooks.statusPending')}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button variant="back" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('doctorDashboardPage.back')}
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('doctorBooks.managerTitle')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t('doctorBooks.managerSubtitle')}</p>
          </div>
          {user?.id && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/doctor/${user.id}`)}>
              <Eye className="w-4 h-4" />
              {t('doctorBooks.viewOnProfile')}
            </Button>
          )}
        </div>

        {/* Formulario de subida */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              {t('doctorBooks.uploadTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="book-title">{t('doctorBooks.fieldTitle')} *</Label>
                  <Input
                    id="book-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t('doctorBooks.fieldTitlePlaceholder')}
                    required
                    maxLength={140}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="book-desc">{t('doctorBooks.fieldDescription')}</Label>
                  <Textarea
                    id="book-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('doctorBooks.fieldDescriptionPlaceholder')}
                    rows={3}
                    maxLength={600}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-price">{t('doctorBooks.fieldPrice')} *</Label>
                  <Input
                    id="book-price"
                    type="number"
                    min="1"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="990.00"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-original">{t('doctorBooks.fieldOriginalPrice')}</Label>
                  <Input
                    id="book-original"
                    type="number"
                    min="1"
                    step="0.01"
                    value={originalPrice}
                    onChange={e => setOriginalPrice(e.target.value)}
                    placeholder="1990.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-pdf" className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {t('doctorBooks.fieldPdf')} *
                  </Label>
                  <Input
                    id="book-pdf"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={e => setPdfFile(e.target.files?.[0] || null)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">{t('doctorBooks.fieldPdfHint').replace('{max}', String(MAX_PDF_MB))}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-cover" className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> {t('doctorBooks.fieldCover')}
                  </Label>
                  <Input
                    id="book-cover"
                    type="file"
                    accept="image/*"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-[11px] text-muted-foreground">{t('doctorBooks.fieldCoverHint')}</p>
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto gap-2 font-semibold" disabled={uploading || !pdfFile || !title.trim()}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? t('doctorBooks.uploading') : t('doctorBooks.publishBook')}
              </Button>
              <p className="text-[11px] text-muted-foreground">{t('doctorBooks.moderationNote')}</p>
            </form>
          </CardContent>
        </Card>

        {/* Lista de libros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {t('doctorBooks.myBooksList')}
              <Badge variant="outline" className="text-[10px] h-5 ml-1">{books.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : books.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('doctorBooks.noBooks')}</p>
            ) : (
              <div className="space-y-3">
                {books.map(book => (
                  <div key={book.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className="w-16 h-20 rounded-md overflow-hidden bg-gradient-to-br from-[#163a83] to-[#227787] flex-shrink-0 flex items-center justify-center">
                      {book.thumbnail_url ? (
                        <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-6 h-6 text-white/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{book.title}</p>
                        {moderationBadge(book.moderation_status)}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        {book.original_price && (
                          <span className="text-xs text-muted-foreground line-through">${Number(book.original_price).toLocaleString('es-MX')}</span>
                        )}
                        <span className="text-sm font-bold text-emerald-600">${Number(book.price).toLocaleString('es-MX')} MXN</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(book.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        disabled={downloading === book.id}
                        onClick={() => handleDownload(book)}
                      >
                        {downloading === book.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                        disabled={deleting === book.id}
                        onClick={() => handleDelete(book)}
                      >
                        {deleting === book.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {t('doctorBooks.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
