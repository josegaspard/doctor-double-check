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
  const { language } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        .single();

      if (profile) {
        setEarnings({
          pending_earnings: profile.pending_earnings || 0,
          total_earnings: profile.total_earnings || 0,
          payouts_enabled: profile.payouts_enabled || false,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'es' ? 'El archivo no debe exceder 10MB' : 'File must not exceed 10MB');
        return;
      }
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast.error(language === 'es' ? 'Solo PDF o imágenes' : 'Only PDF or images allowed');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!invoiceNumber || !periodStart || !periodEnd || !amount || !selectedFile) {
      toast.error(language === 'es' ? 'Completa todos los campos' : 'Complete all fields');
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

      toast.success(language === 'es' ? 'Factura subida exitosamente' : 'Invoice uploaded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast.error(error.message || (language === 'es' ? 'Error al subir factura' : 'Error uploading invoice'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm(language === 'es' ? '¿Eliminar esta factura?' : 'Delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('doctor_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success(language === 'es' ? 'Factura eliminada' : 'Invoice deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || (language === 'es' ? 'Error al eliminar' : 'Error deleting'));
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
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{language === 'es' ? 'Aprobada' : 'Approved'}</Badge>;
      case 'pending':
      case 'processing':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{language === 'es' ? 'Pendiente' : 'Pending'}</Badge>;
      case 'rejected':
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{language === 'es' ? 'Rechazada' : 'Rejected'}</Badge>;
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/doctor/dashboard')}
          className="mb-4 gap-2 hidden sm:inline-flex"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === 'es' ? 'Volver al panel' : 'Back to dashboard'}
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {language === 'es' ? 'Facturas y Pagos' : 'Invoices & Payments'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'es' 
                ? 'Gestiona tus facturas y revisa el historial de pagos' 
                : 'Manage your invoices and review payment history'}
            </p>
          </div>
          <Button onClick={() => { prefillWithPendingEarnings(); setIsDialogOpen(true); }} className="gap-2">
            <Upload className="w-4 h-4" />
            {language === 'es' ? 'Subir Factura' : 'Upload Invoice'}
          </Button>
        </div>

        {/* Earnings Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Ganancias Pendientes' : 'Pending Earnings'}
                  </p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(earnings?.pending_earnings || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Total Ganado' : 'Total Earned'}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(earnings?.total_earnings || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={earnings?.payouts_enabled ? 'border-success/30' : 'border-warning/30 bg-warning/5'}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${earnings?.payouts_enabled ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <CreditCard className={`w-5 h-5 ${earnings?.payouts_enabled ? 'text-success' : 'text-warning'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Cuenta Bancaria' : 'Bank Account'}
                  </p>
                  {earnings?.payouts_enabled ? (
                    <p className="text-sm font-medium text-success">
                      {language === 'es' ? 'Configurada ✓' : 'Configured ✓'}
                    </p>
                  ) : (
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-warning"
                      onClick={() => navigate('/doctor/bank-account')}
                    >
                      {language === 'es' ? 'Configurar' : 'Set up'} <ArrowRight className="w-3 h-3 ml-1" />
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
                    {language === 'es' 
                      ? `Tienes ${formatCurrency(earnings?.pending_earnings || 0)} en ganancias pendientes`
                      : `You have ${formatCurrency(earnings?.pending_earnings || 0)} in pending earnings`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'es'
                      ? 'Sube una factura por este monto para procesar tu pago. Los pagos se procesan automáticamente una vez aprobada la factura.'
                      : 'Upload an invoice for this amount to process your payment. Payments are processed automatically once the invoice is approved.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoicing Guide */}
        <Card className="mb-6 border-muted">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-2">
                  {language === 'es' ? '¿Cómo facturar mis ganancias?' : 'How to invoice my earnings?'}
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    {language === 'es'
                      ? 'Tienes dos opciones flexibles para facturar:'
                      : 'You have two flexible invoicing options:'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="font-medium text-foreground text-sm mb-1">
                        {language === 'es' ? '📄 Factura global' : '📄 Single invoice'}
                      </p>
                      <p>
                        {language === 'es'
                          ? 'Sube una sola factura por el total de tus ganancias pendientes. Ideal si facturas todo bajo un mismo concepto de servicios profesionales.'
                          : 'Upload one invoice for your total pending earnings. Ideal if you invoice everything under a single professional services concept.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="font-medium text-foreground text-sm mb-1">
                        {language === 'es' ? '📑 Facturas por tipo' : '📑 Per-type invoices'}
                      </p>
                      <p>
                        {language === 'es'
                          ? 'Sube facturas separadas por tipo de servicio (orientaciones, grabaciones, suscripciones). Revisa el desglose en la sección "Mis Ganancias" para ver los montos por categoría.'
                          : 'Upload separate invoices per service type (consultations, recordings, subscriptions). Check the breakdown in "My Earnings" to see amounts by category.'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {language === 'es'
                      ? '💡 Tip: Consulta con tu contador cuál opción se adapta mejor a tu régimen fiscal. Ambas son válidas para el procesamiento de tu pago.'
                      : '💡 Tip: Consult with your accountant to determine which option best suits your tax situation. Both are valid for payment processing.'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="w-4 h-4" />
              {language === 'es' ? 'Facturas' : 'Invoices'}
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-1">{invoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <DollarSign className="w-4 h-4" />
              {language === 'es' ? 'Historial de Pagos' : 'Payment History'}
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
            ) : invoices.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {language === 'es' ? 'No hay facturas' : 'No invoices'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {language === 'es' 
                      ? 'Sube tu primera factura para empezar a recibir pagos'
                      : 'Upload your first invoice to start receiving payments'}
                  </p>
                  <Button onClick={() => { prefillWithPendingEarnings(); setIsDialogOpen(true); }} variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    {language === 'es' ? 'Subir Factura' : 'Upload Invoice'}
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
                              <strong>{language === 'es' ? 'Motivo: ' : 'Reason: '}</strong>
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
                            {language === 'es' ? 'Ver' : 'View'}
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
            ) : payouts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {language === 'es' ? 'No hay pagos aún' : 'No payments yet'}
                  </h3>
                  <p className="text-muted-foreground">
                    {language === 'es' 
                      ? 'Los pagos aparecerán aquí una vez procesados'
                      : 'Payments will appear here once processed'}
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
                {language === 'es' ? 'Subir Nueva Factura' : 'Upload New Invoice'}
              </DialogTitle>
              <DialogDescription>
                {language === 'es' 
                  ? 'La factura será revisada por el equipo antes de procesar el pago'
                  : 'The invoice will be reviewed by the team before processing payment'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Número de factura' : 'Invoice number'} *</Label>
                <Input
                  placeholder="F-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Período desde' : 'Period from'} *</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Período hasta' : 'Period to'} *</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Monto (MXN)' : 'Amount (MXN)'} *</Label>
                <Input
                  type="number"
                  placeholder="1000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {(earnings?.pending_earnings || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' ? 'Ganancias pendientes: ' : 'Pending earnings: '}
                    <span className="font-medium text-success">{formatCurrency(earnings?.pending_earnings || 0)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Archivo (PDF o imagen)' : 'File (PDF or image)'} *</Label>
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
                        <p className="text-sm">{language === 'es' ? 'Clic para seleccionar' : 'Click to select'}</p>
                        <p className="text-xs mt-1">PDF, JPG, PNG (max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Subiendo...' : 'Uploading...'}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />{language === 'es' ? 'Subir Factura' : 'Upload Invoice'}</>
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
