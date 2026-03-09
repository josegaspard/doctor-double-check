import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink, Calendar, DollarSign, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

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

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

/**
 * Extracts the storage path from a file_url that may be a full URL or just a path.
 */
function extractStoragePath(fileUrl: string): string {
  if (!fileUrl) return '';
  const decoded = decodeURIComponent(fileUrl.trim());
  
  if (decoded.startsWith('http')) {
    // Match patterns like /doctor-invoices/userId/file.pdf
    const match = decoded.match(/\/(?:object\/(?:public|sign)\/)?doctor-invoices\/(.+?)(?:\?|$)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
    
    const parts = decoded.split('/doctor-invoices/');
    if (parts.length > 1) {
      return decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    }
  }
  
  return decoded.replace(/^doctor-invoices\//, '');
}

export function InvoicePreviewModal({ isOpen, onClose, invoice }: InvoicePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice?.file_url || !isOpen) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    const getSignedUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const filePath = extractStoragePath(invoice.file_url);
        console.log('Invoice file_url:', invoice.file_url, '→ path:', filePath);

        if (!filePath) throw new Error('Invalid file path');

        const { data, error: urlError } = await supabase.storage
          .from('doctor-invoices')
          .createSignedUrl(filePath, 3600); // 1 hour

        if (urlError) throw urlError;
        
        if (!data?.signedUrl) throw new Error('No signed URL returned');
        setSignedUrl(data.signedUrl);
      } catch (err: any) {
        console.error('Error getting signed URL:', err);
        setError('Error al cargar el archivo. Verifica que el archivo existe.');
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    getSignedUrl();
  }, [invoice?.file_url, isOpen]);

  if (!invoice) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />Aprobada</Badge>;
      case 'pending':
      case 'processing':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
      case 'rejected':
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rechazada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isPdf = invoice.file_name?.toLowerCase().endsWith('.pdf');

  const handleOpenNewTab = () => {
    if (signedUrl) window.open(signedUrl, '_blank');
  };

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = invoice.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <DialogTitle>Factura {invoice.invoice_number}</DialogTitle>
            </div>
            {getStatusBadge(invoice.status)}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(invoice.period_start), 'dd/MM/yy', { locale: es })} - {format(new Date(invoice.period_end), 'dd/MM/yy', { locale: es })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {formatCurrency(invoice.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Archivo</p>
              <p className="text-sm font-medium truncate">{invoice.file_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subida</p>
              <p className="text-sm font-medium">
                {format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: es })}
              </p>
            </div>
          </div>

          {/* Admin notes if rejected */}
          {invoice.status === 'rejected' && invoice.admin_notes && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-1">Motivo del rechazo:</p>
              <p className="text-sm text-destructive/80">{invoice.admin_notes}</p>
            </div>
          )}

          {/* File preview */}
          <div className="border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-[50vh] bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error || !signedUrl ? (
              <div className="flex flex-col items-center justify-center h-48 bg-muted">
                <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{error || 'No se pudo cargar el archivo'}</p>
              </div>
            ) : isPdf ? (
              <iframe
                src={`${signedUrl}#toolbar=0`}
                className="w-full h-[50vh]"
                title={invoice.invoice_number}
              />
            ) : (
              <div className="flex items-center justify-center bg-muted">
                <img 
                  src={signedUrl} 
                  alt={invoice.invoice_number}
                  className="max-h-[50vh] object-contain"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button 
              onClick={handleOpenNewTab}
              disabled={!signedUrl}
              className="flex-1 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en nueva pestaña
            </Button>
            <Button 
              variant="outline"
              disabled={!signedUrl}
              onClick={handleDownload}
              className="flex-1 sm:flex-initial gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
