import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from 'lucide-react';
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

export default function DoctorInvoices() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/');
      return;
    }
    fetchInvoices();
  }, [role, navigate]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('doctor_invoices')
        .select('*')
        .eq('doctor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
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
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('doctor-invoices')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('doctor-invoices')
        .getPublicUrl(fileName);

      // Create invoice record
      const { error: insertError } = await supabase
        .from('doctor_invoices')
        .insert({
          doctor_id: user?.id,
          invoice_number: invoiceNumber,
          period_start: periodStart,
          period_end: periodEnd,
          amount: parseFloat(amount),
          file_url: urlData.publicUrl,
          file_name: selectedFile.name,
          status: 'pending',
        });

      if (insertError) throw insertError;

      toast.success(language === 'es' ? 'Factura subida exitosamente' : 'Invoice uploaded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchInvoices();
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
      fetchInvoices();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{language === 'es' ? 'Aprobada' : 'Approved'}</Badge>;
      case 'pending':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{language === 'es' ? 'Pendiente' : 'Pending'}</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{language === 'es' ? 'Rechazada' : 'Rejected'}</Badge>;
      default:
        return null;
    }
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {language === 'es' ? 'Mis Facturas' : 'My Invoices'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'es' 
                ? 'Sube tus facturas para recibir tus pagos' 
                : 'Upload your invoices to receive payments'}
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            {language === 'es' ? 'Subir Factura' : 'Upload Invoice'}
          </Button>
        </div>

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
              <Button onClick={() => setIsDialogOpen(true)} variant="outline">
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
                          ${invoice.amount.toLocaleString()} MXN
                        </div>
                      </div>
                      {invoice.admin_notes && invoice.status === 'rejected' && (
                        <p className="text-sm text-destructive mt-2">{invoice.admin_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(invoice.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
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

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'es' ? 'Subir Nueva Factura' : 'Upload New Invoice'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Número de factura' : 'Invoice number'}</Label>
                <Input
                  placeholder="F-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Desde' : 'From'}</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Hasta' : 'To'}</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Monto (MXN)' : 'Amount (MXN)'}</Label>
                <Input
                  type="number"
                  placeholder="1000.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Archivo (PDF o imagen)' : 'File (PDF or image)'}</Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Subiendo...' : 'Uploading...'}</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />{language === 'es' ? 'Subir' : 'Upload'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
