import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Calendar,
  DollarSign,
  Download,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Invoice {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  amount: number;
  file_url: string;
  file_name: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function AdminInvoiceReview() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; invoice: Invoice | null; action: 'approve' | 'reject' | null }>({ open: false, invoice: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role !== 'admin') { navigate('/'); return; }
    loadInvoices();
  }, [role]);

  useEffect(() => {
    setSelectedInvoiceIds(new Set());
  }, [activeTab]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('doctor_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const doctorIds = [...new Set(data.map(i => i.doctor_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', doctorIds);
        const nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

        setInvoices(data.map(i => ({ ...i, doctor_name: nameMap.get(i.doctor_id) || 'Doctor' })));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewDialog.invoice || !reviewDialog.action) return;
    setIsProcessing(true);
    try {
      const newStatus = reviewDialog.action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase.from('doctor_invoices').update({
        status: newStatus,
        admin_notes: adminNotes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reviewDialog.invoice.id);

      if (error) throw error;

      // Notify doctor
      await supabase.from('notifications').insert({
        user_id: reviewDialog.invoice.doctor_id,
        type: 'system',
        title: newStatus === 'approved' ? '✅ Factura aprobada' : '❌ Factura rechazada',
        message: newStatus === 'approved'
          ? `Tu factura ${reviewDialog.invoice.invoice_number} ha sido aprobada`
          : `Tu factura ${reviewDialog.invoice.invoice_number} fue rechazada${adminNotes ? `: ${adminNotes}` : ''}`,
        data: { invoice_id: reviewDialog.invoice.id, status: newStatus },
      });

      toast.success(language === 'es' ? `Factura ${newStatus === 'approved' ? 'aprobada' : 'rechazada'}` : `Invoice ${newStatus}`);
      setReviewDialog({ open: false, invoice: null, action: null });
      setAdminNotes('');
      await loadInvoices();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const extractStoragePath = (fileUrl: string): string => {
    if (!fileUrl) return '';
    const decoded = decodeURIComponent(fileUrl.trim());
    if (decoded.startsWith('http')) {
      const match = decoded.match(/\/(?:object\/(?:public|sign)\/)?doctor-invoices\/(.+?)(?:\?|$)/);
      if (match?.[1]) return decodeURIComponent(match[1]);
      const parts = decoded.split('/doctor-invoices/');
      if (parts.length > 1) return decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    }
    return decoded.replace(/^doctor-invoices\//, '');
  };

  const getSignedUrl = async (invoice: Invoice): Promise<string | null> => {
    try {
      // First try the edge function (uses service role, more reliable for admins)
      const { data, error } = await supabase.functions.invoke('admin-invoice-file-url', {
        body: { invoiceId: invoice.id },
      });

      if (!error && data?.signedUrl) return data.signedUrl;

      // Fallback: try direct signed URL with extracted path
      console.warn('Edge function failed, trying direct signed URL');
      const filePath = extractStoragePath(invoice.file_url);
      if (!filePath) return null;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('doctor-invoices')
        .createSignedUrl(filePath, 3600);

      if (!signedError && signedData?.signedUrl) return signedData.signedUrl;

      return null;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      const url = await getSignedUrl(invoice);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = invoice.file_name || `factura-${invoice.invoice_number}.pdf`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error('Could not generate download URL');
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error(language === 'es' ? 'Error al descargar factura' : 'Error downloading invoice');
    }
  };

  const handleDownloadAll = async () => {
    const invoicesToDownload = filtered.length > 0 ? filtered : invoices;
    for (const invoice of invoicesToDownload) {
      await handleDownload(invoice);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const handlePreview = async (invoice: Invoice) => {
    try {
      const url = await getSignedUrl(invoice);
      if (url) {
        setPreviewUrl(url);
      } else {
        throw new Error('Could not generate preview URL');
      }
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast.error(language === 'es' ? 'Error al cargar vista previa' : 'Error loading preview');
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filtered.map(invoice => invoice.id);
    const areAllSelected = filteredIds.every(id => selectedInvoiceIds.has(id));

    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (areAllSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const selectedIds = filtered
      .filter(invoice => selectedInvoiceIds.has(invoice.id))
      .map(invoice => invoice.id);

    if (selectedIds.length === 0) {
      toast.error(language === 'es' ? 'No hay facturas seleccionadas' : 'No selected invoices');
      return;
    }

    const confirmed = window.confirm(
      language === 'es'
        ? `¿Eliminar ${selectedIds.length} factura(s) seleccionada(s)? Esta acción no se puede deshacer.`
        : `Delete ${selectedIds.length} selected invoice(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('doctor_invoices')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(
        language === 'es'
          ? `${selectedIds.length} factura(s) eliminada(s)`
          : `${selectedIds.length} invoice(s) deleted`
      );
      setSelectedInvoiceIds(new Set());
      await loadInvoices();
    } catch (error: any) {
      toast.error(error.message || (language === 'es' ? 'Error al eliminar facturas' : 'Error deleting invoices'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{language === 'es' ? 'Aprobada' : 'Approved'}</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{language === 'es' ? 'Rechazada' : 'Rejected'}</Badge>;
      default: return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{language === 'es' ? 'Pendiente' : 'Pending'}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const filtered = invoices.filter(i => {
    if (activeTab === 'pending') return i.status === 'pending';
    if (activeTab === 'approved') return i.status === 'approved';
    if (activeTab === 'rejected') return i.status === 'rejected';
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const selectedFilteredCount = filtered.filter(invoice => selectedInvoiceIds.has(invoice.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {language === 'es' ? 'Volver al panel' : 'Back to panel'}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" />
            {language === 'es' ? 'Revisión de Facturas' : 'Invoice Review'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' ? 'Aprueba o rechaza las facturas de los doctores' : 'Approve or reject doctor invoices'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                {language === 'es' ? 'Pendientes' : 'Pending'}
                {pendingCount > 0 && <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">{language === 'es' ? 'Aprobadas' : 'Approved'}</TabsTrigger>
              <TabsTrigger value="rejected">{language === 'es' ? 'Rechazadas' : 'Rejected'}</TabsTrigger>
              <TabsTrigger value="all">{language === 'es' ? 'Todas' : 'All'}</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filtered.length === 0 ? (
                <Card><CardContent className="text-center py-12 text-muted-foreground">
                  {language === 'es' ? 'No hay facturas en esta categoría' : 'No invoices in this category'}
                </CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {/* Download all button */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAllFiltered}
                        aria-label={language === 'es' ? 'Seleccionar todas las facturas visibles' : 'Select all visible invoices'}
                      />
                      <span className="text-sm text-muted-foreground">
                        {language === 'es' ? `${selectedFilteredCount} seleccionada(s)` : `${selectedFilteredCount} selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedFilteredCount > 0 && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleDeleteSelected}
                          disabled={isProcessing}
                          className="gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {language === 'es'
                            ? `Eliminar seleccionadas (${selectedFilteredCount})`
                            : `Delete selected (${selectedFilteredCount})`}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={handleDownloadAll} className="gap-2">
                        <Download className="w-4 h-4" />
                        {language === 'es' ? `Descargar todas (${filtered.length})` : `Download all (${filtered.length})`}
                      </Button>
                    </div>
                  </div>
                  {filtered.map(invoice => (
                    <Card key={invoice.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Checkbox
                              checked={selectedInvoiceIds.has(invoice.id)}
                              onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                              className="mt-1"
                              aria-label={language === 'es' ? `Seleccionar factura ${invoice.invoice_number}` : `Select invoice ${invoice.invoice_number}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="font-semibold">{invoice.invoice_number}</span>
                                {getStatusBadge(invoice.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                <strong>{invoice.doctor_name}</strong>
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(invoice.period_start), 'dd/MM/yy')} - {format(new Date(invoice.period_end), 'dd/MM/yy')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {formatCurrency(invoice.amount)}
                                </span>
                                <span>{format(new Date(invoice.created_at), 'dd MMM yyyy, HH:mm', { locale })}</span>
                              </div>
                              {invoice.admin_notes && (
                                <p className="text-xs mt-2 p-2 bg-muted rounded">{invoice.admin_notes}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-shrink-0 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handlePreview(invoice)}>
                              <Eye className="w-4 h-4 mr-1" />{language === 'es' ? 'Ver' : 'View'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDownload(invoice)}>
                              <Download className="w-4 h-4 mr-1" />{language === 'es' ? 'Descargar' : 'Download'}
                            </Button>
                            {invoice.status === 'pending' && (
                              <>
                                <Button size="sm" variant="default" onClick={() => { setReviewDialog({ open: true, invoice, action: 'approve' }); setAdminNotes(''); }}>
                                  <CheckCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Aprobar' : 'Approve'}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setReviewDialog({ open: true, invoice, action: 'reject' }); setAdminNotes(''); }}>
                                  <XCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Rechazar' : 'Reject'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Review Dialog */}
        <Dialog open={reviewDialog.open} onOpenChange={(open) => !isProcessing && setReviewDialog({ ...reviewDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewDialog.action === 'approve' 
                  ? (language === 'es' ? '✅ Aprobar Factura' : '✅ Approve Invoice')
                  : (language === 'es' ? '❌ Rechazar Factura' : '❌ Reject Invoice')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><strong>{language === 'es' ? 'Factura:' : 'Invoice:'}</strong> {reviewDialog.invoice?.invoice_number}</p>
                <p><strong>{language === 'es' ? 'Doctor:' : 'Doctor:'}</strong> {reviewDialog.invoice?.doctor_name}</p>
                <p><strong>{language === 'es' ? 'Monto:' : 'Amount:'}</strong> {formatCurrency(reviewDialog.invoice?.amount || 0)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{language === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}</label>
                <Textarea
                  placeholder={reviewDialog.action === 'reject' 
                    ? (language === 'es' ? 'Motivo del rechazo...' : 'Rejection reason...') 
                    : (language === 'es' ? 'Notas adicionales...' : 'Additional notes...')}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, invoice: null, action: null })} disabled={isProcessing}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button
                variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'}
                onClick={handleReview}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {reviewDialog.action === 'approve' 
                  ? (language === 'es' ? 'Confirmar Aprobación' : 'Confirm Approval')
                  : (language === 'es' ? 'Confirmar Rechazo' : 'Confirm Rejection')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{language === 'es' ? 'Vista Previa de Factura' : 'Invoice Preview'}</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded border" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
