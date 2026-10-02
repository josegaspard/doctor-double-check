import { useLanguage } from '@/contexts/LanguageContext';

export type InvoiceStatus = 'pending' | 'issued' | 'cancelled';

const PILL: Record<InvoiceStatus, string> = {
  pending: 'pro-pill-warn',
  issued: 'pro-pill-ok',
  cancelled: 'pro-pill-muted',
};

/** Estado de la factura de una venta: pendiente, emitida o cancelada (reembolso). */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useLanguage();
  return <span className={`pro-pill w-fit self-start sm:self-auto flex-shrink-0 ${PILL[status] ?? PILL.pending}`}>{t(`billing.status.${status}`)}</span>;
}
