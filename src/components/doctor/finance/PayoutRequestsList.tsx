// Historial de solicitudes de retiro del médico (13-sep-2026).
//
// Va en Ingresos y pagos › «Pagos pendientes» (encima de los cobros retenidos) y
// su aviso compacto (`PayoutRequestNotice`) en «Próximo pago» cuando hay una en
// curso. Recibe el estado de `usePayoutRequests` desde la página para no pedir
// lo mismo dos veces.
// Estados: pendiente · aprobada (pago en camino) · pagada (con el pago real) ·
// rechazada (con el motivo del equipo) · cancelada. Solo una pendiente se puede
// cancelar, y siempre con confirmación.
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Clock, Info, Landmark, Loader2, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill, money2 } from '@/lib/proFormat';
import {
  PAYOUT_STATUS_META,
  payoutFailureKey,
  type LinkedPayout,
  type PayoutRequest,
  type PayoutRequestStatus,
  type UsePayoutRequests,
} from '@/hooks/usePayoutRequests';
import { WithdrawButton } from '@/components/doctor/finance/WithdrawDialog';
import '@/styles/funciones-retiros.css';

const STATUS_ICON: Record<PayoutRequestStatus, React.ElementType> = {
  pending: Clock,
  approved: CheckCircle2,
  paid: Wallet,
  rejected: XCircle,
  cancelled: Ban,
};

export interface PayoutRequestsListProps {
  data: UsePayoutRequests;
  /** Botón «Nueva solicitud» en la cabecera cuando no hay ninguna en curso. */
  showNewButton?: boolean;
}

export function PayoutRequestsList({ data, showNewButton = true }: PayoutRequestsListProps) {
  const { t, language } = useLanguage();
  const fmt = useAppDateFormat();
  const { confirm, dialog } = useConfirmAction();
  const { requests, payouts, openRequest, loading, loadError, pendingActivation, cancelRequest, reload } = data;
  const [cancelling, setCancelling] = useState<string | null>(null);

  const m = (n: number) => money2(n, language);
  const methodOf = (p: LinkedPayout) =>
    p.stripe_transfer_id && !p.stripe_transfer_id.startsWith('manual_') ? 'Stripe' : t('pro.earnings.methodManual');

  const onCancel = async (r: PayoutRequest) => {
    const ok = await confirm({
      title: t('mm2.retiros.cancel.title'),
      description: t('mm2.retiros.cancel.desc'),
      confirmLabel: t('mm2.retiros.cancel.confirm'),
      cancelLabel: t('mm2.retiros.cancel.keep'),
      details: [
        { label: t('mm2.retiros.list.requested'), value: fmt.formatDate(r.created_at, 'PP') },
        { label: t('mm2.retiros.review.amount'), value: m(r.amount), emphasis: true },
      ],
    });
    if (!ok) return;
    setCancelling(r.id);
    const res = await cancelRequest(r.id);
    setCancelling(null);
    if (res.ok) toast.success(t('mm2.retiros.toast.cancelled'));
    else toast.error(t(payoutFailureKey(res.reason)));
  };

  return (
    <section className="wd-list" aria-labelledby="wd-list-title">
      <div className="wd-list-head">
        <h3 id="wd-list-title" className="wd-list-title"><Landmark /> {t('mm2.retiros.list.title')}</h3>
        {showNewButton && !loading && !pendingActivation && !loadError && !openRequest && (
          <WithdrawButton className="pro-btn pro-btn-outline pro-btn-sm">
            <Landmark /> {t('mm2.retiros.list.new')}
          </WithdrawButton>
        )}
      </div>

      {loading ? (
        <div className="wd-loading"><Loader2 className="animate-spin" /></div>
      ) : pendingActivation ? (
        <div className="pro-note"><Info /><span>{t('mm2.retiros.pending.list')}</span></div>
      ) : loadError ? (
        <div className="pro-note">
          <Info />
          <span>
            {t('mm2.retiros.dialog.loadError')}{' '}
            <button type="button" className="wd-linkbtn" onClick={() => reload()}>
              <RefreshCw className="hidden" aria-hidden="true" />{t('mm2.retiros.dialog.retry')}
            </button>
          </span>
        </div>
      ) : requests.length === 0 ? (
        <p className="wd-empty">{t('mm2.retiros.list.empty')}</p>
      ) : (
        <ul className="wd-rows">
          {requests.map(r => {
            const meta = PAYOUT_STATUS_META[r.status];
            const Icon = STATUS_ICON[r.status];
            const payout = r.payout_id ? payouts[r.payout_id] : undefined;
            return (
              <li key={r.id} className="wd-row">
                <span className="pro-icon-box"><Icon /></span>
                <div className="wd-row-main">
                  <div className="wd-row-top">
                    <span className="pro-row-name">{m(r.amount)}</span>
                    <span className={`pro-pill ${meta.pill}`}>{t(meta.labelKey)}</span>
                  </div>
                  <p className="pro-row-sub">
                    {fill(t('mm2.retiros.list.requestedOn'), { d: fmt.formatDate(r.created_at, 'PP') })}
                    {r.reviewed_at && (r.status === 'approved' || r.status === 'rejected')
                      ? ` · ${fill(t('mm2.retiros.list.reviewedOn'), { d: fmt.formatDate(r.reviewed_at, 'PP') })}`
                      : ''}
                  </p>
                  {r.status === 'approved' && <p className="pro-row-sub">{t('mm2.retiros.list.approvedHint')}</p>}
                  {r.status === 'paid' && payout && (
                    <p className="pro-row-sub">
                      {fill(t('mm2.retiros.list.paidOn'), {
                        d: fmt.formatDate(payout.paid_at || payout.created_at, 'PP'),
                        amount: m(payout.amount),
                        method: methodOf(payout),
                      })}
                    </p>
                  )}
                  {r.doctor_note && (
                    <p className="wd-row-note"><span className="lbl">{t('mm2.retiros.list.yourNote')}</span> {r.doctor_note}</p>
                  )}
                  {r.admin_note && (
                    <p className="wd-row-admin"><span className="lbl">{t('mm2.retiros.list.teamNote')}</span> {r.admin_note}</p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <div className="wd-row-act">
                    <button
                      type="button"
                      className="pro-btn pro-btn-outline pro-btn-xs wd-btn-danger"
                      onClick={() => onCancel(r)}
                      disabled={cancelling === r.id}
                    >
                      {cancelling === r.id ? <Loader2 className="animate-spin" /> : null}
                      {t('mm2.retiros.cancel.button')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </section>
  );
}

export interface PayoutRequestNoticeProps {
  request: PayoutRequest;
  /** «Ver solicitud»: la página decide adónde lleva (pestaña Pagos pendientes). */
  onView?: () => void;
}

/** Aviso compacto: «Solicitaste un retiro de $X el 12 sep · pendiente de revisión». */
export function PayoutRequestNotice({ request, onView }: PayoutRequestNoticeProps) {
  const { t, language } = useLanguage();
  const fmt = useAppDateFormat();
  const key = request.status === 'approved' ? 'mm2.retiros.notice.approved' : 'mm2.retiros.notice.pending';
  return (
    <div className="pro-note wd-notice" role="status">
      <Landmark />
      <span className="txt">
        {fill(t(key), { amount: money2(request.amount, language), d: fmt.formatDate(request.created_at, 'PP') })}
        {onView && (
          <>
            {' '}
            <button type="button" className="wd-linkbtn" onClick={onView}>{t('mm2.retiros.notice.view')}</button>
          </>
        )}
      </span>
    </div>
  );
}

export default PayoutRequestsList;
