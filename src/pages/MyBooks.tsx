import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePurchases } from '@/hooks/usePurchases';
import { downloadBookPdf } from '@/components/doctor/DoctorBooks';
import { ArrowLeft, BookOpen, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Biblioteca de libros/cursos PDF comprados por el usuario (cliente 2026-07-08).
// Es el "lugar de descarga" post-compra: Stripe redirige aquí con
// ?book_paid=success y el wallet enlaza desde el perfil del doctor.

interface PurchasedBook {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  creator_id: string;
  creatorName?: string;
  purchasedAt: Date;
  amount: number;
}

export default function MyBooks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { purchases, isLoading: purchasesLoading, refresh } = usePurchases();
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState<PurchasedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('book_paid') === 'success') {
      toast.success(t('doctorBooks.purchaseSuccess'));
      // El webhook de Stripe registra la compra; puede tardar unos segundos
      const timer = setTimeout(() => refresh(), 4000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (purchasesLoading) return;
      const contentPurchases = purchases.filter(p => p.contentId);
      if (contentPurchases.length === 0) {
        if (!cancelled) { setBooks([]); setLoading(false); }
        return;
      }
      const ids = contentPurchases.map(p => p.contentId!) as string[];
      const { data: contents } = await (supabase as any)
        .from('doctor_content')
        .select('id, title, description, file_url, thumbnail_url, creator_id')
        .in('id', ids);
      const rows = (contents as any[]) || [];
      const creatorIds = [...new Set(rows.map(r => r.creator_id))];
      const { data: profiles } = creatorIds.length
        ? await (supabase as any).from('profiles_public').select('id, name').in('id', creatorIds)
        : { data: [] };
      const nameMap = new Map(((profiles as any[]) || []).map(p => [p.id, p.name]));
      if (cancelled) return;
      setBooks(rows.map(r => {
        const purchase = contentPurchases.find(p => p.contentId === r.id);
        return {
          ...r,
          creatorName: nameMap.get(r.creator_id),
          purchasedAt: purchase?.createdAt || new Date(),
          amount: purchase?.amount || 0,
        } as PurchasedBook;
      }).sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime()));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [purchases, purchasesLoading]);

  const handleDownload = async (book: PurchasedBook) => {
    setDownloading(book.id);
    try {
      await downloadBookPdf(book);
      toast.success(t('doctorBooks.downloadStarted'));
    } catch (e: any) {
      toast.error(e.message || t('doctorBooks.downloadError'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <Button variant="back" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('doctorDashboardPage.back')}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {t('doctorBooks.myBooksTitle')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('doctorBooks.myBooksSubtitle')}</p>
        </div>

        {!user ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">{t('doctorBooks.loginToSee')}</p>
              <Button onClick={() => navigate('/login')}>{t('nav.login')}</Button>
            </CardContent>
          </Card>
        ) : loading || purchasesLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">{t('doctorBooks.noPurchases')}</p>
              <Button variant="outline" onClick={() => navigate('/doctors')}>{t('doctorBooks.exploreDoctors')}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {books.map(book => (
              <Card key={book.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-md overflow-hidden bg-gradient-to-br from-[#163a83] to-[#227787] flex-shrink-0 flex items-center justify-center">
                    {book.thumbnail_url ? (
                      <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <BookOpen className="w-7 h-7 text-white/70" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base leading-snug">{book.title}</h3>
                      <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] uppercase rounded-sm">PDF</Badge>
                    </div>
                    {book.creatorName && (
                      <button
                        className="text-xs text-primary hover:underline mt-0.5"
                        onClick={() => navigate(`/doctor/${book.creator_id}`)}
                      >
                        {book.creatorName}
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t('doctorBooks.purchasedOn')} {book.purchasedAt.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {book.amount > 0 && ` · $${Number(book.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`}
                    </p>
                    <Button
                      className="mt-3 gap-2 font-bold w-full sm:w-auto"
                      disabled={downloading === book.id}
                      onClick={() => handleDownload(book)}
                    >
                      {downloading === book.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {t('doctorBooks.downloadNow')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
