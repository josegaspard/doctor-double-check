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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, FileText, Loader2, CheckCircle, XCircle, Clock, Eye, Calendar,
  DollarSign, Download, Trash2, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, startOfQuarter, endOfQuarter } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Invoice {
  id: string; doctor_id: string; doctor_name?: string; doctor_rfc?: string;
  invoice_number: string; period_start: string; period_end: string;
  amount: number; file_url: string; file_name: string; status: string;
  admin_notes: string | null; created_at: string;
}

type QuickPeriod = 'this_month' | 'last_month' | 'this_week' | 'quarter' | 'all';

export default function AdminInvoiceReview() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('all');
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; invoice: Invoice | null; action: 'approve' | 'reject' | null }>({ open: false, invoice: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role !== 'admin') { navigate('/'); return; }
    loadInvoices();
  }, [role]);

  useEffect(() => { setSelectedInvoiceIds(new Set()); }, [activeTab, quickPeriod]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('doctor_invoices').select('*').order('created_at', { ascending: false });
      if (data) {
        const doctorIds = [...new Set(data.map(i => i.doctor_id))];
        const [{ data: profiles }, { data: banks }] = await Promise.all([
          supabase.from('profiles').select('id, name').in('id', doctorIds),
          supabase.from('doctor_bank_accounts').select('doctor_id, rfc').in('doctor_id', doctorIds),
        ]);
        const nameMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
        const rfcMap = new Map(banks?.map(b => [b.doctor_id, b.rfc]) || []);
        setInvoices(data.map(i => ({ ...i, doctor_name: nameMap.get(i.doctor_id) || t('adminInvoiceReview.fallbacks.doctor'), doctor_rfc: rfcMap.get(i.doctor_id) || '' })));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Period filtering
  const getDateRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (quickPeriod) {
      case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last_month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'quarter': return { from: startOfQuarter(now), to: endOfQuarter(now) };
      default: return { from: null, to: null };
    }
  };

  const handleReview = async () => {
    if (!reviewDialog.invoice || !reviewDialog.action) return;
    setIsProcessing(true);
    try {
      const newStatus = reviewDialog.action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase.from('doctor_invoices').update({
        status: newStatus, admin_notes: adminNotes || null, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', reviewDialog.invoice.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: reviewDialog.invoice.doctor_id, type: 'system' as any,
        title: newStatus === 'approved' ? t('adminInvoiceReview.notifications.approvedTitle') : t('adminInvoiceReview.notifications.rejectedTitle'),
        message: newStatus === 'approved'
          ? `${t('adminInvoiceReview.notifications.approvedMessagePrefix')} ${reviewDialog.invoice.invoice_number} ${t('adminInvoiceReview.notifications.approvedMessageSuffix')}`
          : `${t('adminInvoiceReview.notifications.rejectedMessagePrefix')} ${reviewDialog.invoice.invoice_number} ${t('adminInvoiceReview.notifications.rejectedMessageSuffix')}${adminNotes ? `: ${adminNotes}` : ''}`,
        data: { invoice_id: reviewDialog.invoice.id, status: newStatus },
      });
      toast.success(newStatus === 'approved' ? t('adminInvoiceReview.toasts.approved') : t('adminInvoiceReview.toasts.rejected'));
      setReviewDialog({ open: false, invoice: null, action: null }); setAdminNotes('');
      await loadInvoices();
    } catch (error: any) { toast.error(error.message); } finally { setIsProcessing(false); }
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
      const { data, error } = await supabase.functions.invoke('admin-invoice-file-url', { body: { invoiceId: invoice.id } });
      if (!error && data?.signedUrl) return data.signedUrl;
      const filePath = extractStoragePath(invoice.file_url);
      if (!filePath) return null;
      const { data: signedData } = await supabase.storage.from('doctor-invoices').createSignedUrl(filePath, 3600);
      return signedData?.signedUrl || null;
    } catch { return null; }
  };

  const handleDownload = async (invoice: Invoice) => {
    const url = await getSignedUrl(invoice);
    if (url) { const a = document.createElement('a'); a.href = url; a.download = invoice.file_name || `${t('adminInvoiceReview.fallbacks.invoiceFilePrefix')}-${invoice.invoice_number}.pdf`; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    else toast.error(t('adminInvoiceReview.toasts.downloadError'));
  };

  const handlePreview = async (invoice: Invoice) => {
    const url = await getSignedUrl(invoice);
    if (url) setPreviewUrl(url); else toast.error(t('adminInvoiceReview.toasts.previewError'));
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAllFiltered = () => {
    const ids = filtered.map(i => i.id);
    const allSel = ids.every(id => selectedInvoiceIds.has(id));
    setSelectedInvoiceIds(prev => { const next = new Set(prev); if (allSel) ids.forEach(id => next.delete(id)); else ids.forEach(id => next.add(id)); return next; });
  };

  const handleDeleteSelected = async () => {
    const ids = filtered.filter(i => selectedInvoiceIds.has(i.id)).map(i => i.id);
    if (!ids.length || !confirm(`${t('adminInvoiceReview.confirms.deletePrefix')} ${ids.length} ${t('adminInvoiceReview.confirms.deleteSuffix')}`)) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('doctor_invoices').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} ${t('adminInvoiceReview.toasts.deleted')}`);
      setSelectedInvoiceIds(new Set()); await loadInvoices();
    } catch (error: any) { toast.error(error.message); } finally { setIsProcessing(false); }
  };

  // Excel CSV export
  const handleExportCSV = () => {
    const rows = filtered.map(i => ({
      [t('adminInvoiceReview.csv.invoiceNumber')]: i.invoice_number,
      [t('adminInvoiceReview.csv.doctor')]: i.doctor_name || '',
      [t('adminInvoiceReview.csv.rfc')]: (i as any).doctor_rfc || '',
      [t('adminInvoiceReview.csv.periodStart')]: i.period_start,
      [t('adminInvoiceReview.csv.periodEnd')]: i.period_end,
      [t('adminInvoiceReview.csv.amount')]: i.amount,
      [t('adminInvoiceReview.csv.status')]: i.status,
      [t('adminInvoiceReview.csv.sentDate')]: format(new Date(i.created_at), 'yyyy-MM-dd HH:mm'),
      [t('adminInvoiceReview.csv.adminNotes')]: i.admin_notes || '',
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${t('adminInvoiceReview.csv.fileNamePrefix')}_${quickPeriod}_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('adminInvoiceReview.toasts.excelExported'));
  };

  // PDF export for accountants (hidden iframe to avoid popup blockers)
  const handleExportPDF = () => {
    if (filtered.length === 0) return;
    const periodLabel = quickPeriod === 'this_month' ? t('adminInvoiceReview.periods.thisMonth') : quickPeriod === 'last_month' ? t('adminInvoiceReview.periods.lastMonth') : quickPeriod === 'this_week' ? t('adminInvoiceReview.periods.thisWeek') : quickPeriod === 'quarter' ? t('adminInvoiceReview.periods.quarter') : t('adminInvoiceReview.periods.all');
    const fmtCur = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
    const total = filtered.reduce((s, i) => s + i.amount, 0);
    const approved = filtered.filter(i => i.status === 'approved');
    const pending = filtered.filter(i => i.status === 'pending');

    const byDoctor: Record<string, Invoice[]> = {};
    filtered.forEach(i => { const name = i.doctor_name || t('adminInvoiceReview.fallbacks.noName'); if (!byDoctor[name]) byDoctor[name] = []; byDoctor[name].push(i); });

    const html = `<!DOCTYPE html><html><head><title>${t('adminInvoiceReview.pdf.title')}</title>
    <style>body{font-family:system-ui,sans-serif;padding:30px;color:#333;max-width:1000px;margin:0 auto;font-size:12px}
    h1{font-size:20px;margin-bottom:4px}h2{font-size:16px;margin-top:24px;border-bottom:2px solid #0d9488;padding-bottom:4px}h3{font-size:14px;margin-top:16px}
    .meta{color:#666;font-size:11px;margin-bottom:20px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
    .summary-item{border:1px solid #e5e7eb;border-radius:6px;padding:12px;text-align:center}
    .summary-item .val{font-size:20px;font-weight:700;color:#0d9488}.summary-item .lbl{font-size:10px;color:#666}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#f9fafb;font-weight:600;font-size:11px}
    .text-right{text-align:right}.text-success{color:#0d9488}.text-warning{color:#ca8a04}
    .footer{margin-top:30px;text-align:center;color:#999;font-size:10px;border-top:1px solid #e5e7eb;padding-top:8px}
    .group-total{font-weight:700;background:#f0fdfa}
    @media print{body{padding:15px}}</style></head><body>
    <h1>${t('adminInvoiceReview.pdf.heading')}</h1>
    <p class="meta">${t('adminInvoiceReview.pdf.periodLabel')}: ${periodLabel} · ${t('adminInvoiceReview.pdf.generatedLabel')}: ${format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</p>

    <div class="summary">
      <div class="summary-item"><div class="val">${filtered.length}</div><div class="lbl">${t('adminInvoiceReview.pdf.totalInvoices')}</div></div>
      <div class="summary-item"><div class="val">${fmtCur(total)}</div><div class="lbl">${t('adminInvoiceReview.pdf.totalAmount')}</div></div>
      <div class="summary-item"><div class="val">${approved.length}</div><div class="lbl">${t('adminInvoiceReview.pdf.approvedLabel')} (${fmtCur(approved.reduce((s,i)=>s+i.amount,0))})</div></div>
      <div class="summary-item"><div class="val">${pending.length}</div><div class="lbl">${t('adminInvoiceReview.pdf.pendingLabel')} (${fmtCur(pending.reduce((s,i)=>s+i.amount,0))})</div></div>
    </div>

    <h2>${t('adminInvoiceReview.pdf.fullList')}</h2>
    <table><thead><tr><th>${t('adminInvoiceReview.csv.invoiceNumber')}</th><th>${t('adminInvoiceReview.csv.doctor')}</th><th>${t('adminInvoiceReview.csv.rfc')}</th><th>${t('adminInvoiceReview.pdf.period')}</th><th class="text-right">${t('adminInvoiceReview.csv.amount')}</th><th>${t('adminInvoiceReview.csv.status')}</th><th>${t('adminInvoiceReview.pdf.date')}</th></tr></thead><tbody>
    ${filtered.map(i => `<tr>
      <td>${i.invoice_number}</td><td>${i.doctor_name}</td><td>${(i as any).doctor_rfc || '-'}</td>
      <td>${format(new Date(i.period_start), 'dd/MM/yy')} - ${format(new Date(i.period_end), 'dd/MM/yy')}</td>
      <td class="text-right">${fmtCur(i.amount)}</td>
      <td class="${i.status === 'approved' ? 'text-success' : i.status === 'pending' ? 'text-warning' : ''}">${i.status === 'approved' ? t('adminInvoiceReview.status.approved') : i.status === 'pending' ? t('adminInvoiceReview.status.pending') : t('adminInvoiceReview.status.rejected')}</td>
      <td>${format(new Date(i.created_at), 'dd/MM/yyyy')}</td>
    </tr>`).join('')}
    <tr class="group-total"><td colspan="4">${t('adminInvoiceReview.pdf.totalRow')}</td><td class="text-right text-success">${fmtCur(total)}</td><td colspan="2"></td></tr>
    </tbody></table>

    <h2>${t('adminInvoiceReview.pdf.groupedByDoctor')}</h2>
    ${Object.entries(byDoctor).map(([name, invs]) => `
      <h3>${name} (${invs.length} ${t('adminInvoiceReview.pdf.invoicesSuffix')})</h3>
      <table><thead><tr><th>${t('adminInvoiceReview.csv.invoiceNumber')}</th><th>${t('adminInvoiceReview.pdf.period')}</th><th class="text-right">${t('adminInvoiceReview.csv.amount')}</th><th>${t('adminInvoiceReview.csv.status')}</th></tr></thead><tbody>
      ${invs.map(i => `<tr><td>${i.invoice_number}</td><td>${format(new Date(i.period_start), 'dd/MM/yy')} - ${format(new Date(i.period_end), 'dd/MM/yy')}</td><td class="text-right">${fmtCur(i.amount)}</td><td>${i.status === 'approved' ? t('adminInvoiceReview.status.approved') : i.status === 'pending' ? t('adminInvoiceReview.status.pending') : t('adminInvoiceReview.status.rejected')}</td></tr>`).join('')}
      <tr class="group-total"><td colspan="2">${t('adminInvoiceReview.pdf.subtotal')}</td><td class="text-right text-success">${fmtCur(invs.reduce((s,i)=>s+i.amount,0))}</td><td></td></tr>
      </tbody></table>
    `).join('')}

    <div class="footer">${t('adminInvoiceReview.pdf.footer')} · ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch (e) { console.error('Print failed', e); }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{t('adminInvoiceReview.status.approved')}</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('adminInvoiceReview.status.rejected')}</Badge>;
      default: return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{t('adminInvoiceReview.status.pending')}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  // Apply period + tab filter
  const { from: dateFrom, to: dateTo } = getDateRange();
  const filtered = invoices.filter(i => {
    if (activeTab === 'pending') { if (i.status !== 'pending') return false; }
    else if (activeTab === 'approved') { if (i.status !== 'approved') return false; }
    else if (activeTab === 'rejected') { if (i.status !== 'rejected') return false; }
    if (dateFrom && dateTo) {
      const d = new Date(i.period_start);
      if (d < dateFrom || d > dateTo) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const selectedFilteredCount = filtered.filter(i => selectedInvoiceIds.has(i.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;
  const periodTotal = filtered.reduce((s, i) => s + i.amount, 0);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="hidden sm:inline-flex mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />{t('adminInvoiceReview.header.back')}
        </Button>

        <div className="mb-4 sm:mb-6">
          <h1 className="font-heading text-lg sm:text-2xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <span className="truncate">{t('adminInvoiceReview.header.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('adminInvoiceReview.header.subtitle')}</p>
        </div>

        {/* Period Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">{t('adminInvoiceReview.summary.invoices')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{formatCurrency(periodTotal)}</p>
            <p className="text-xs text-muted-foreground">{t('adminInvoiceReview.summary.totalAmount')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{filtered.filter(i => i.status === 'approved').length}</p>
            <p className="text-xs text-muted-foreground">{t('adminInvoiceReview.summary.approved')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{filtered.filter(i => i.status === 'pending').length}</p>
            <p className="text-xs text-muted-foreground">{t('adminInvoiceReview.summary.pending')}</p>
          </CardContent></Card>
        </div>

        {/* Quick Period Filters */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
          {[
            { key: 'all' as QuickPeriod, label: t('adminInvoiceReview.periods.all') },
            { key: 'this_week' as QuickPeriod, label: t('adminInvoiceReview.periods.thisWeek') },
            { key: 'this_month' as QuickPeriod, label: t('adminInvoiceReview.periods.thisMonth') },
            { key: 'last_month' as QuickPeriod, label: t('adminInvoiceReview.periods.lastMonth') },
            { key: 'quarter' as QuickPeriod, label: t('adminInvoiceReview.periods.quarter') },
          ].map(p => (
            <Button key={p.key} variant={quickPeriod === p.key ? 'default' : 'outline'} size="sm" className="text-xs h-8 flex-shrink-0" onClick={() => setQuickPeriod(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />{t('adminInvoiceReview.tabs.pending')}
                {pendingCount > 0 && <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">{t('adminInvoiceReview.tabs.approved')}</TabsTrigger>
              <TabsTrigger value="rejected">{t('adminInvoiceReview.tabs.rejected')}</TabsTrigger>
              <TabsTrigger value="all">{t('adminInvoiceReview.tabs.all')}</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filtered.length === 0 ? (
                <Card><CardContent className="text-center py-12 text-muted-foreground">{t('adminInvoiceReview.empty.noInvoices')}</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {/* Actions bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAllFiltered} />
                      <span className="text-xs sm:text-sm text-muted-foreground">{selectedFilteredCount} {t('adminInvoiceReview.actions.selected')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {selectedFilteredCount > 0 && (
                        <Button size="sm" variant="destructive" onClick={handleDeleteSelected} disabled={isProcessing} className="gap-1 text-xs h-8">
                          <Trash2 className="w-3.5 h-3.5" />{t('adminInvoiceReview.actions.delete')} ({selectedFilteredCount})
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0} className="gap-1 text-xs h-8">
                        <FileSpreadsheet className="w-3.5 h-3.5" />{t('adminInvoiceReview.actions.excel')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={filtered.length === 0} className="gap-1 text-xs h-8">
                        <Download className="w-3.5 h-3.5" />{t('adminInvoiceReview.actions.pdf')}
                      </Button>
                    </div>
                  </div>

                  {filtered.map(invoice => (
                    <Card key={invoice.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Checkbox checked={selectedInvoiceIds.has(invoice.id)} onCheckedChange={() => toggleInvoiceSelection(invoice.id)} className="mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="font-semibold">{invoice.invoice_number}</span>
                                {getStatusBadge(invoice.status)}
                              </div>
                              <p className="text-sm text-muted-foreground mb-1"><strong>{invoice.doctor_name}</strong></p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(invoice.period_start), 'dd/MM/yy')} - {format(new Date(invoice.period_end), 'dd/MM/yy')}</span>
                                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatCurrency(invoice.amount)}</span>
                                <span>{format(new Date(invoice.created_at), 'dd MMM yyyy', { locale })}</span>
                              </div>
                              {invoice.admin_notes && <p className="text-xs mt-2 p-2 bg-muted rounded">{invoice.admin_notes}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handlePreview(invoice)}><Eye className="w-4 h-4 mr-1" />{t('adminInvoiceReview.actions.view')}</Button>
                            <Button size="sm" variant="outline" onClick={() => handleDownload(invoice)}><Download className="w-4 h-4 mr-1" />{t('adminInvoiceReview.actions.download')}</Button>
                            {invoice.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => { setReviewDialog({ open: true, invoice, action: 'approve' }); setAdminNotes(''); }}><CheckCircle className="w-4 h-4 mr-1" />{t('adminInvoiceReview.actions.approve')}</Button>
                                <Button size="sm" variant="destructive" onClick={() => { setReviewDialog({ open: true, invoice, action: 'reject' }); setAdminNotes(''); }}><XCircle className="w-4 h-4 mr-1" />{t('adminInvoiceReview.actions.reject')}</Button>
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
              <DialogTitle>{reviewDialog.action === 'approve' ? t('adminInvoiceReview.dialog.approveTitle') : t('adminInvoiceReview.dialog.rejectTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><strong>{t('adminInvoiceReview.dialog.invoiceLabel')}:</strong> {reviewDialog.invoice?.invoice_number}</p>
                <p><strong>{t('adminInvoiceReview.dialog.doctorLabel')}:</strong> {reviewDialog.invoice?.doctor_name}</p>
                <p><strong>{t('adminInvoiceReview.dialog.amountLabel')}:</strong> {formatCurrency(reviewDialog.invoice?.amount || 0)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminInvoiceReview.dialog.notesLabel')}</label>
                <Textarea placeholder={reviewDialog.action === 'reject' ? t('adminInvoiceReview.dialog.rejectPlaceholder') : t('adminInvoiceReview.dialog.approvePlaceholder')} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, invoice: null, action: null })} disabled={isProcessing}>{t('adminInvoiceReview.dialog.cancel')}</Button>
              <Button variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'} onClick={handleReview} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {reviewDialog.action === 'approve' ? t('adminInvoiceReview.dialog.confirmApprove') : t('adminInvoiceReview.dialog.confirmReject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader><DialogTitle>{t('adminInvoiceReview.dialog.previewTitle')}</DialogTitle></DialogHeader>
            {previewUrl && <iframe src={previewUrl} className="w-full h-[60vh] rounded border" />}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
