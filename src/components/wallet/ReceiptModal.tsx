import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

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

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale === 'en' ? 'en-US' : 'es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeepLink(metadata: Record<string, any> | null | undefined, t: (k: string) => string) {
  if (!metadata) return null;
  if (metadata.recording_id) return { label: t('walletLedger.viewSource'), to: `/recording/${metadata.recording_id}` };
  if (metadata.session_id) return { label: t('walletLedger.viewSource'), to: `/chat?session=${metadata.session_id}` };
  if (metadata.consultation_id) return { label: t('walletLedger.viewSource'), to: `/chat?consultation=${metadata.consultation_id}` };
  return null;
}

export function ReceiptModal({ open, onOpenChange, transaction }: ReceiptModalProps) {
  const { language, t } = useLanguage();
  if (!transaction) return null;
  const deepLink = getDeepLink(transaction.metadata, t);
  const statusColor =
    transaction.status === 'paid' ? 'bg-success/10 text-success border-success/20'
    : transaction.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20'
    : 'bg-muted text-muted-foreground border-border';

  const statusLabel =
    transaction.status === 'paid' ? t('walletLedger.statusPaid')
    : transaction.status === 'failed' ? t('walletLedger.statusFailed')
    : t('walletLedger.statusPending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="receipt-modal">
        <DialogHeader>
          <DialogTitle>{t('receipt.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 print:p-6" id="receipt-printable">
          <div className="flex justify-between items-start pb-3 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground">{t('receipt.transactionId')}</p>
              <p className="text-xs font-mono text-foreground" data-testid="receipt-tx-id">
                {transaction.id.slice(0, 8)}…{transaction.id.slice(-4)}
              </p>
            </div>
            <Badge className={statusColor} variant="outline">{statusLabel}</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('receipt.date')}</span>
              <span className="text-foreground font-medium">{formatDate(transaction.created_at, language)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('receipt.type')}</span>
              <span className="text-foreground font-medium capitalize">{transaction.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('receipt.description')}</span>
              <span className="text-foreground font-medium text-right max-w-[60%]">{transaction.description ?? '—'}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground font-semibold">{t('receipt.amount')}</span>
              <span className={`text-lg font-bold ${transaction.amount >= 0 ? 'text-success' : 'text-destructive'}`} data-testid="receipt-amount">
                {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString(language === 'en' ? 'en-US' : 'es-MX')} MXN
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('receipt.close')}</Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> {t('receipt.download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
