import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink, Calendar, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export function InvoicePreviewModal({ isOpen, onClose, invoice }: InvoicePreviewModalProps) {
  if (!invoice) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

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

  const isPdf = invoice.file_name.toLowerCase().endsWith('.pdf');

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
            {isPdf ? (
              <iframe
                src={`${invoice.file_url}#toolbar=0`}
                className="w-full h-[50vh]"
                title={invoice.invoice_number}
              />
            ) : (
              <div className="flex items-center justify-center bg-muted">
                <img 
                  src={invoice.file_url} 
                  alt={invoice.invoice_number}
                  className="max-h-[50vh] object-contain"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => window.open(invoice.file_url, '_blank')}
              className="flex-1 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en nueva pestaña
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const a = document.createElement('a');
                a.href = invoice.file_url;
                a.download = invoice.file_name;
                a.click();
              }}
              className="gap-2"
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
