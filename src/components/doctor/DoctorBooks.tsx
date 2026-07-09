import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePurchases } from '@/hooks/usePurchases';
import { BookOpen, Download, Wallet, CreditCard, Loader2, CheckCircle2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

// Libros/cursos PDF de pago del doctor en su perfil público (cliente 2026-07-08).
// Tarjeta estilo tienda: portada, badge "Descargable", precio tachado + precio
// de oferta y botón grande de compra/descarga (referencia estheticmed.net).

interface Props {
  doctorId: string;
  isOwner?: boolean;
}

export interface DoctorBook {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  price: number | null;
  original_price: number | null;
  created_at: string;
}

export async function downloadBookPdf(book: { file_url: string; title: string }) {
  const safeName = `${book.title.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '').trim() || 'libro'}.pdf`;
  const { data, error } = await supabase.storage
    .from('doctor-content')
    .createSignedUrl(book.file_url, 300, { download: safeName });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No se pudo generar el enlace de descarga');
  }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DoctorBooks({ doctorId, isOwner = false }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { balance, canAfford } = useWallet();
  const { hasPurchasedContent, isPurchasing, purchaseContentWithWallet, purchaseContentWithStripe } = usePurchases();
  const [books, setBooks] = useState<DoctorBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingBook, setPayingBook] = useState<DoctorBook | null>(null);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('doctor_content')
        .select('id, title, description, file_url, thumbnail_url, price, original_price, created_at')
        .eq('creator_id', doctorId)
        .eq('is_book', true)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setBooks((data as DoctorBook[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [doctorId]);

  if (loading || (books.length === 0 && !isOwner)) return null;

  const handleBuyClick = (book: DoctorBook) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setPayingBook(book);
  };

  const handleDownload = async (book: DoctorBook) => {
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

  const handleWalletPayment = async () => {
    if (!payingBook) return;
    setProcessing(true);
    const result = await purchaseContentWithWallet(payingBook.id);
    setProcessing(false);
    if (result.success) {
      setPayingBook(null);
      toast.success(t('doctorBooks.purchaseSuccess'));
    }
  };

  const handleStripePayment = async () => {
    if (!payingBook) return;
    setProcessing(true);
    const result = await purchaseContentWithStripe(payingBook.id);
    setProcessing(false);
    if (result.success && result.url) {
      window.location.href = result.url;
    }
  };

  const price = payingBook?.price || 0;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          {t('doctorBooks.profileTitle')}
          {books.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 ml-1">{books.length}</Badge>
          )}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5 h-7 text-xs"
              onClick={() => navigate('/doctor/books')}
            >
              <Settings2 className="w-3.5 h-3.5" />
              {t('doctorBooks.manage')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('doctorBooks.ownerEmpty')}</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => {
            const purchased = user ? hasPurchasedContent(book.id) : false;
            const isFree = !book.price || book.price <= 0;
            return (
              <div key={book.id} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Portada estilo tienda */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-[#163a83] to-[#227787]">
                  {book.thumbnail_url ? (
                    <img
                      src={book.thumbnail_url}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-14 h-14 text-white/70" />
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2 bg-red-600 hover:bg-red-600 text-white text-[10px] uppercase tracking-wide rounded-sm">
                    {t('doctorBooks.downloadable')}
                  </Badge>
                  {purchased && (
                    <Badge className="absolute top-2 right-2 bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] gap-1 rounded-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('doctorBooks.owned')}
                    </Badge>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-base sm:text-lg leading-snug text-foreground">{book.title}</h3>
                  {book.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{book.description}</p>
                  )}

                  {/* Precio: tachado + oferta (como la referencia) */}
                  <div className="flex items-baseline gap-2 mt-3 flex-wrap">
                    {book.original_price && book.original_price > (book.price || 0) && (
                      <span className="text-sm sm:text-base text-muted-foreground line-through whitespace-nowrap">
                        ${Number(book.original_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className="text-xl sm:text-2xl font-bold text-emerald-600 whitespace-nowrap">
                      {isFree ? t('doctorBooks.free') : `$${Number(book.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                    </span>
                    {!isFree && <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">MXN</span>}
                  </div>

                  <div className="mt-3 flex-1 flex items-end">
                    {purchased || isFree || isOwner ? (
                      <Button
                        className="w-full font-bold gap-2"
                        size="lg"
                        disabled={downloading === book.id}
                        onClick={() => handleDownload(book)}
                      >
                        {downloading === book.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Download className="w-4 h-4" />}
                        {t('doctorBooks.downloadNow')}
                      </Button>
                    ) : (
                      <Button
                        className="w-full font-bold gap-2"
                        size="lg"
                        onClick={() => handleBuyClick(book)}
                      >
                        <BookOpen className="w-4 h-4" />
                        {t('doctorBooks.buyNow')}
                      </Button>
                    )}
                  </div>
                  {purchased && !isOwner && (
                    <button
                      className="mt-2 text-[11px] text-primary underline-offset-2 hover:underline text-center w-full"
                      onClick={() => navigate('/my-books')}
                    >
                      {t('doctorBooks.viewMyBooks')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </CardContent>

      {/* Modal de pago (wallet / tarjeta) — mismo patrón que el modal de consulta del perfil */}
      <Dialog open={!!payingBook} onOpenChange={(open) => !open && !processing && setPayingBook(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {t('doctorBooks.paymentTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('doctorBooks.paymentDescription')
                .replace('{title}', payingBook?.title || '')
                .replace('{price}', Number(price).toLocaleString('es-MX', { minimumFractionDigits: 2 }))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Card
              className={`cursor-pointer transition-colors ${canAfford(price) ? 'hover:border-primary' : 'opacity-60'}`}
              onClick={() => canAfford(price) && !processing && handleWalletPayment()}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t('doctorProfile.payWithBalance')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('doctorProfile.availableBalance').replace('${balance}', balance.toFixed(2))}
                      </p>
                    </div>
                  </div>
                  {canAfford(price) ? (
                    <Badge variant="secondary">{t('doctorProfile.available')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('doctorProfile.insufficientBalance')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {!canAfford(price) && (
              <Card
                className="cursor-pointer hover:border-primary transition-colors border-dashed"
                onClick={() => { setPayingBook(null); navigate('/wallet'); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{t('doctorProfile.topUpBalance')}</p>
                        <p className="text-sm text-muted-foreground">{t('doctorProfile.topUpBalanceDesc')}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{t('doctorProfile.topUpAction')}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => !processing && handleStripePayment()}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{t('doctorProfile.payWithCard')}</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, AMEX</p>
                    </div>
                  </div>
                  <Badge variant="outline">Stripe</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {(processing || isPurchasing) && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('doctorProfile.processing')}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={processing} onClick={() => setPayingBook(null)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
