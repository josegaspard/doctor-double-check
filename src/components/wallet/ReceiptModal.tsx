import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ReceiptTransaction {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
}

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: ReceiptTransaction | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeepLink(metadata?: Record<string, any> | null) {
  if (!metadata) return null;
  if (metadata.recording_id) return { label: 'Ver grabación', to: `/recording/${metadata.recording_id}` };
  if (metadata.session_id) return { label: 'Ver sesión de chat', to: `/chat?session=${metadata.session_id}` };
  if (metadata.consultation_id) return { label: 'Ver consulta', to: `/chat?consultation=${metadata.consultation_id}` };
  return null;
}

export function ReceiptModal({ open, onOpenChange, transaction }: ReceiptModalProps) {
  if (!transaction) return null;
  const deepLink = getDeepLink(transaction.metadata);
  const statusColor =
    transaction.status === 'paid' ? 'bg-success/10 text-success border-success/20'
    : transaction.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="receipt-modal">
        <DialogHeader>
          <DialogTitle>Recibo de transacción</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 print:p-6" id="receipt-printable">
          <div className="flex justify-between items-start pb-3 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground">ID Transacción</p>
              <p className="text-xs font-mono text-foreground" data-testid="receipt-tx-id">
                {transaction.id.slice(0, 8)}…{transaction.id.slice(-4)}
              </p>
            </div>
            <Badge className={statusColor} variant="outline">{transaction.status}</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha</span>
              <span className="text-foreground font-medium">{formatDate(transaction.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span className="text-foreground font-medium capitalize">{transaction.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descripción</span>
              <span className="text-foreground font-medium text-right max-w-[60%]">{transaction.description ?? '—'}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground font-semibold">Monto</span>
              <span className={`text-lg font-bold ${transaction.amount >= 0 ? 'text-success' : 'text-destructive'}`} data-testid="receipt-amount">
                {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString('es-MX')} MXN
              </span>
            </div>
            {transaction.metadata?.stripe_payment_intent && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stripe Payment Intent</span>
                <span className="font-mono text-foreground">{transaction.metadata.stripe_payment_intent.slice(0, 16)}…</span>
              </div>
            )}
          </div>

          {deepLink && (
            <Button asChild variant="outline" className="w-full gap-2" data-testid="receipt-deep-link">
              <Link to={deepLink.to} onClick={() => onOpenChange(false)}>
                <ExternalLink className="w-4 h-4" />
                {deepLink.label}
              </Link>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
