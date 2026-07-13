import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle, 
  Clock, 
  XCircle,
  Calendar,
  DollarSign,
  Trash2,
  Eye,
  TrendingUp,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Info,
  ChevronDown,
} from 'lucide-react';
import { InvoicePreviewModal } from '@/components/invoices/InvoicePreviewModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Invoice {
  id: string;
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

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

interface EarningsSummary {
  pending_earnings: number;
  total_earnings: number;
  payouts_enabled: boolean;
}

export default function DoctorInvoices() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/');
      return;
    }
    fetchData();
  }, [role, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from('doctor_invoices')
        .select('*')
        .eq('doctor_id', user?.id)
        .order('created_at', { ascending: false });

      setInvoices(invoicesData || []);

      // Fetch payouts
      const { data: payoutsData } = await supabase
        .from('doctor_payouts')
        .select('*')
        .eq('doctor_id', user?.id)
        .order('created_at', { ascending: false });

      setPayouts(payoutsData || []);

      // Fetch earnings summary
      const { data: profile } = await supabase
        .from('doctor_profiles')
        .select('pending_earnings, total_earnings, payouts_enabled')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profile) {
        setEarnings({
          pending_earnings: profile.pending_earnings || 0,
          total_earnings: profile.total_earnings || 0,
          payouts_enabled: profile.payouts_enabled || false,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('doctorInvoices.fileTooLarge'));
        return;
      }
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast.error(t('doctorInvoices.onlyPdfOrImages'));
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!invoiceNumber || !periodStart || !periodEnd || !amount || !selectedFile) {
      toast.error(t('doctorInvoices.completeAllFields'));
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('doctor-invoices')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Store only the file path - we'll generate signed URLs when viewing
      const { error: insertError } = await supabase
        .from('doctor_invoices')
        .insert({
          doctor_id: user?.id,
          invoice_number: invoiceNumber,
          period_start: periodStart,
          period_end: periodEnd,
          amount: parseFloat(amount),
          file_url: filePath, // Store path, not signed URL (they expire)
          file_name: selectedFile.name,
          status: 'pending',
        });
      if (insertError) throw insertError;

      toast.success(t('doctorInvoices.invoiceUploaded'));
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast.error(error.message || t('doctorInvoices.errorUploading'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm(t('doctorInvoices.deleteInvoiceConfirm'))) return;

    try {
      const { error } = await supabase
        .from('doctor_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success(t('doctorInvoices.invoiceDeleted'));
      fetchData();
    } catch (error: any) {
      toast.error(error.message || t('doctorInvoices.errorDeleting'));
    }
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setPeriodStart('');
    setPeriodEnd('');
    setAmount('');
    setSelectedFile(null);
  };

  const prefillWithPendingEarnings = () => {
    if (earnings?.pending_earnings) {
      setAmount(earnings.pending_earnings.toFixed(2));
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setPeriodStart(format(firstDay, 'yyyy-MM-dd'));
      setPeriodEnd(format(today, 'yyyy-MM-dd'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{t('doctorInvoices.approved')}</Badge>;
      case 'pending':
      case 'processing':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{t('doctorInvoices.pending')}</Badge>;
      case 'rejected':
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('doctorInvoices.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button
          variant="back"
          size="sm"
          onClick={() => navigate('/doctor/dashboard')}
          className="mb-4 gap-2 hidden sm:inline-flex"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('doctorInvoices.backToDashboard')}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground">
              {t('doctorInvoices.pageTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {t('doctorInvoices.pageSubtitle')}
            </p>
          </div>
          <Button onClick={() => { prefillWithPendingEarnings(); setIsDialogOpen(true); }} className="gap-2 w-full sm:w-auto" size="sm">
            <Upload className="w-4 h-4" />
            {t('doctorInvoices.uploadInvoice')}
          </Button>
        </div>

        {/* Earnings Summary Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:pb-0 mb-6">
          <Card className="border-success/30 bg-success/5 min-w-[200px] snap-center flex-shrink-0 md:min-w-0 md:flex-shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('doctorInvoices.pendingEarnings')}
                  </p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(earnings?.pending_earnings || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5 min-w-[200px] snap-center flex-shrink-0 md:min-w-0 md:flex-shrink">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('doctorInvoices.totalEarned')}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(earnings?.total_earnings || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`min-w-[200px] snap-center flex-shrink-0 md:min-w-0 md:flex-shrink ${earnings?.payouts_enabled ? 'border-success/30' : 'border-warning/30 bg-warning/5'}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${earnings?.payouts_enabled ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <CreditCard className={`w-5 h-5 ${earnings?.payouts_enabled ? 'text-success' : 'text-warning'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {t('doctorInvoices.bankAccount')}
                  </p>
                  {earnings?.payouts_enabled ? (
                    <p className="text-sm font-medium text-success">
                      {t('doctorInvoices.configured')}
                    </p>
                  ) : (
                    <Button
                      variant="link"
                      className="p-0 h-auto text-warning"
                      onClick={() => navigate('/doctor/bank-account')}
                    >
                      {t('doctorInvoices.setUp')} <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        {(earnings?.pending_earnings || 0) > 0 && (
          <Card className="mb-6 border-info/30 bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t('doctorInvoices.pendingEarningsBanner').replace('{amount}', formatCurrency(earnings?.pending_earnings || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('doctorInvoices.pendingEarningsBannerDesc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoicing Guide - Collapsible on mobile */}
        <Collapsible>
          <Card className="mb-6 border-muted">
            <CardContent className="p-3 sm:p-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-sm font-semibold">
                    {t('doctorInvoices.howToInvoice')}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    {t('doctorInvoices.twoOptions')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="font-medium text-foreground text-sm mb-1">
                        {t('doctorInvoices.singleInvoice')}
                      </p>
                      <p>
                        {t('doctorInvoices.singleInvoiceDesc')}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="font-medium text-foreground text-sm mb-1">
                        {t('doctorInvoices.perTypeInvoices')}
                      </p>
                      <p>
                        {t('doctorInvoices.perTypeInvoicesDesc')}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {t('doctorInvoices.accountantTip')}
                  </p>
                </div>
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="w-4 h-4" />
              {t('doctorInvoices.invoices')}
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-1">{invoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <DollarSign className="w-4 h-4" />
              {t('doctorInvoices.paymentHistory')}
              {payouts.length > 0 && (
                <Badge variant="secondary" className="ml-1">{payouts.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : loadError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <FileText className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('common.error')}</p>
                  <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                    <Loader2 className="w-3.5 h-3.5" />
                    {t('common.retry')}
                  </Button>
                </CardContent>
              </Card>
            ) : invoices.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {t('doctorInvoices.noInvoices')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t('doctorInvoices.noInvoicesDesc')}
                  </p>
                  <Button onClick={() => { prefillWithPendingEarnings(); setIsDialogOpen(true); }} variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    {t('doctorInvoices.uploadInvoice')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <Card key={invoice.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                            <span className="font-semibold truncate">{invoice.invoice_number}</span>
                            {getStatusBadge(invoice.status)}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(invoice.period_start), 'dd/MM/yy', { locale: language === 'es' ? es : enUS })} - {format(new Date(invoice.period_end), 'dd/MM/yy', { locale: language === 'es' ? es : enUS })}
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(invoice.amount)}
                            </div>
                            <div className="text-xs">
                              {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: language === 'es' ? es : enUS })}
                            </div>
                          </div>
                          {invoice.admin_notes && invoice.status === 'rejected' && (
                            <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                              <strong>{t('doctorInvoices.reason')}</strong>
                              {invoice.admin_notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewInvoice(invoice)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t('doctorInvoices.view')}
                          </Button>
                          {invoice.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(invoice.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : loadError ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <DollarSign className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('common.error')}</p>
                  <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                    <Loader2 className="w-3.5 h-3.5" />
                    {t('common.retry')}
                  </Button>
                </CardContent>
              </Card>
            ) : payouts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {t('doctorInvoices.noPaymentsYet')}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('doctorInvoices.noPaymentsYetDesc')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <Card key={payout.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            payout.status === 'paid' ? 'bg-success/10' : 'bg-warning/10'
                          }`}>
                            <DollarSign className={`w-5 h-5 ${
                              payout.status === 'paid' ? 'text-success' : 'text-warning'
                            }`} />
                          </div>
                          <div>
                            <p className="font-semibold">{formatCurrency(payout.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {payout.paid_at 
                                ? format(new Date(payout.paid_at), 'dd MMM yyyy', { locale: language === 'es' ? es : enUS })
                                : format(new Date(payout.created_at), 'dd MMM yyyy', { locale: language === 'es' ? es : enUS })}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(payout.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t('doctorInvoices.uploadNewInvoice')}
              </DialogTitle>
              <DialogDescription>
                {t('doctorInvoices.uploadNewInvoiceDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('doctorInvoices.invoiceNumber')} *</Label>
                <Input
                  placeholder="F-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('doctorInvoices.periodFrom')} *</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('doctorInvoices.periodTo')} *</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('doctorInvoices.amountMxn')} *</Label>
                <Input
                  type="number"
                  placeholder="1000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {(earnings?.pending_earnings || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('doctorInvoices.pendingEarningsLabel')}
                    <span className="font-medium text-success">{formatCurrency(earnings?.pending_earnings || 0)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('doctorInvoices.filePdfOrImage')} *</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="invoice-file"
                  />
                  <label htmlFor="invoice-file" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText className="w-5 h-5" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">{t('doctorInvoices.clickToSelect')}</p>
                        <p className="text-xs mt-1">PDF, JPG, PNG (max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                {t('doctorInvoices.cancel')}
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorInvoices.uploading')}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />{t('doctorInvoices.uploadInvoice')}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Preview Modal */}
        <InvoicePreviewModal
          isOpen={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          invoice={previewInvoice}
        />
      </div>
    </MainLayout>
  );
}
