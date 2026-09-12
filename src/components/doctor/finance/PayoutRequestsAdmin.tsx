// Admin › Pagos a médicos › «Solicitudes de retiro» (13-sep-2026).
//
// Revisar NO mueve dinero:
//   · Aprobar / Rechazar (con nota; rechazar exige motivo) → siempre con revisión
//     en useConfirmAction.
//   · «Ir a pagar» abre el diálogo de pago de siempre de /admin/payouts, que
//     paga el SALDO COMPLETO del médico. Al quedar ese pago en `paid`, un
//     trigger de la base marca la solicitud como pagada con su `payout_id`.
//     Nada se descuenta dos veces: la solicitud nunca tocó el saldo.
// Filtros con botones aria-pressed (sin Tabs nuevas).
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle, Clock, History, Info, Landmark, Loader2, RefreshCw, Send, Users, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill } from '@/lib/proFormat';
import {
  useAdminPayoutRequests,
  PAYOUT_NOTE_MAX,
  PAYOUT_STATUS_META,
  payoutFailureKey,
  type AdminPayoutRequest,
  type PayoutRequestStatus,
} from '@/hooks/usePayoutRequests';
import { bankLabelOf } from '@/components/doctor/finance/WithdrawDialog';
import '@/styles/funciones-retiros.css';

type Filter = 'pending' | 'approved' | 'history';
type Decision = 'approved' | 'rejected';

const BADGE_VARIANT: Record<PayoutRequestStatus, 'warning' | 'info' | 'verified' | 'destructive' | 'outline'> = {
  pending: 'warning',
  approved: 'info',
  paid: 'verified',
  rejected: 'destructive',
  cancelled: 'outline',
};

export interface PayoutRequestsAdminProps {
  /** Abre el flujo de pago existente para ese médico. */
  onPay: (doctorId: string, doctorName: string) => void;
  formatCurrency: (amount: number) => string;
}

export function PayoutRequestsAdmin({ onPay, formatCurrency }: PayoutRequestsAdminProps) {
  const { t } = useLanguage();
  const fmt = useAppDateFormat();
  const { confirm, dialog } = useConfirmAction();
  const { requests, loading, loadError, pendingActivation, reviewing, reload, review } = useAdminPayoutRequests();
  const [filter, setFilter] = useState<Filter>('pending');
  const [draft, setDraft] = useState<{ id: string; decision: Decision; note: string; touched: boolean } | null>(null);

  const isOpen = (s: PayoutRequestStatus) => s === 'pending' || s === 'approved';

  const counts = useMemo(
    () => ({
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      history: requests.filter(r => !isOpen(r.status)).length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    if (filter === 'history') return requests.filter(r => !isOpen(r.status));
    // Las abiertas, por orden de llegada.
    return requests
      .filter(r => r.status === filter)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [requests, filter]);

  const doctorName = (r: AdminPayoutRequest) => r.doctor_name || t('adminPayoutsPage.fallback.doctor');

  const startReview = (r: AdminPayoutRequest, decision: Decision) =>
    setDraft({ id: r.id, decision, note: '', touched: false });

  const submitReview = async (r: AdminPayoutRequest) => {
    if (!draft || draft.id !== r.id) return;
    const note = draft.note.trim();
    if (draft.decision === 'rejected' && !note) {
      setDraft({ ...draft, touched: true });
      return;
    }
    const approving = draft.decision === 'approved';
    const ok = await confirm({
      title: approving ? t('mm2.retiros.admin.confirmApproveTitle') : t('mm2.retiros.admin.confirmRejectTitle'),
      description: approving ? t('mm2.retiros.admin.confirmApproveDesc') : t('mm2.retiros.admin.confirmRejectDesc'),
      tone: approving ? 'payment' : 'destructive',
      confirmLabel: approving ? t('mm2.retiros.admin.approve') : t('mm2.retiros.admin.reject'),
      details: [
        { label: t('mm2.retiros.admin.doctor'), value: doctorName(r) },
        { label: t('mm2.retiros.admin.balanceNow'), value: formatCurrency(r.doctor_pending_earnings) },
        { label: t('mm2.retiros.admin.account'), value: r.bank ? bankLabelOf(r.bank, t) : t('mm2.retiros.admin.noBank') },
        ...(note ? [{ label: t('mm2.retiros.admin.note'), value: note }] : []),
        { label: t('mm2.retiros.admin.requested'), value: formatCurrency(r.amount), emphasis: true },
      ],
    });
    if (!ok) return;
    const res = await review(r.id, draft.decision, note);
    if (res.ok) {
      toast.success(approving ? t('mm2.retiros.toast.approved') : t('mm2.retiros.toast.rejected'));
      setDraft(null);
      if (approving) setFilter('approved');
      return;
    }
    toast.error(t(payoutFailureKey(res.reason)));
  };

  const filters: { key: Filter; label: string; Icon: React.ElementType }[] = [
    { key: 'pending', label: t('mm2.retiros.admin.filterPending'), Icon: Clock },
    { key: 'approved', label: t('mm2.retiros.admin.filterApproved'), Icon: CheckCircle },
    { key: 'history', label: t('mm2.retiros.admin.filterHistory'), Icon: History },
  ];

  return (
    <Card className="mb-6 wr-admin">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Landmark className="w-5 h-5" />
              {t('mm2.retiros.admin.title')}
              {counts.pending > 0 && <Badge variant="warning">{counts.pending}</Badge>}
            </CardTitle>
            <CardDescription className="mt-1">{t('mm2.retiros.admin.subtitle')}</CardDescription>
          </div>
          {!pendingActivation && (
            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('mm2.retiros.admin.refresh')}
            </Button>
          )}
        </div>
        {!pendingActivation && !loadError && (
          <div className="wr-chips mt-3" role="group" aria-label={t('mm2.retiros.admin.title')}>
            {filters.map(f => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                className={`wr-chip ${filter === f.key ? 'is-active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                <f.Icon />
                {f.label}
                <span className="wr-chip-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading && requests.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : pendingActivation ? (
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t('mm2.retiros.admin.pendingActivation')}</span>
          </div>
        ) : loadError ? (
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{t('mm2.retiros.dialog.loadError')}</span>
            <Button variant="outline" size="sm" onClick={() => reload()}>{t('mm2.retiros.dialog.retry')}</Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {filter === 'pending'
              ? t('mm2.retiros.admin.emptyPending')
              : filter === 'approved'
                ? t('mm2.retiros.admin.emptyApproved')
                : t('mm2.retiros.admin.emptyHistory')}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map(r => {
              const meta = PAYOUT_STATUS_META[r.status];
              const short = isOpen(r.status) && r.doctor_pending_earnings < r.amount;
              const editing = draft?.id === r.id;
              return (
                <div key={r.id} className="wr-row">
                  <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.doctor_avatar
                        ? <img src={r.doctor_avatar} alt="" className="w-full h-full object-cover" />
                        : <Users className="w-5 h-5 text-muted-foreground" />}
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{doctorName(r)}</p>
                        {r.doctor_specialty && <Badge variant="outline" className="text-xs">{r.doctor_specialty}</Badge>}
                        <Badge variant={BADGE_VARIANT[r.status]} className="text-xs">{t(meta.labelKey)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fill(t('mm2.retiros.admin.requestedOn'), { d: fmt.formatDateTime(r.created_at) })}
                        {r.reviewed_at && r.status !== 'pending'
                          ? ` · ${fill(t('mm2.retiros.list.reviewedOn'), { d: fmt.formatDate(r.reviewed_at, 'PP') })}`
                          : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{r.bank ? bankLabelOf(r.bank, t) : t('mm2.retiros.admin.noBank')}</span>
                        {r.bank && (
                          <Badge variant={r.bank.is_verified ? 'verified' : 'warning'} className="text-[10px]">
                            {r.bank.is_verified ? t('pro.earnings.verified') : t('pro.earnings.unverified')}
                          </Badge>
                        )}
                      </p>
                      {r.doctor_note && (
                        <p className="text-sm mt-2 wr-row-note">
                          <span className="text-muted-foreground">{t('mm2.retiros.admin.doctorNote')}</span> {r.doctor_note}
                        </p>
                      )}
                      {r.admin_note && (
                        <p className="text-sm mt-1 wr-row-note">
                          <span className="text-muted-foreground">{t('mm2.retiros.admin.adminNote')}</span> {r.admin_note}
                        </p>
                      )}
                      {r.status === 'paid' && r.payout && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {fill(t('mm2.retiros.admin.paidWith'), {
                            d: fmt.formatDate(r.payout.paid_at || r.payout.created_at, 'PP'),
                            amount: formatCurrency(r.payout.amount),
                          })}
                        </p>
                      )}
                      {short && (
                        <p className="text-xs mt-1 flex items-start gap-1 text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {t('mm2.retiros.admin.balanceBelow')}
                        </p>
                      )}
                      {r.status === 'approved' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {fill(t('mm2.retiros.admin.payHint'), { balance: formatCurrency(r.doctor_pending_earnings) })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4 flex-shrink-0 ml-auto">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t('mm2.retiros.admin.requested')}</p>
                        <p className="font-bold">{formatCurrency(r.amount)}</p>
                        {isOpen(r.status) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('mm2.retiros.admin.balanceNow')}{' '}
                            <span className="font-semibold text-foreground">{formatCurrency(r.doctor_pending_earnings)}</span>
                          </p>
                        )}
                      </div>
                      {r.status === 'pending' && !editing && (
                        <div className="flex flex-col gap-1">
                          <Button size="sm" className="gap-1" onClick={() => startReview(r, 'approved')}>
                            <CheckCircle className="w-4 h-4" /> {t('mm2.retiros.admin.approve')}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => startReview(r, 'rejected')}>
                            <XCircle className="w-4 h-4" /> {t('mm2.retiros.admin.reject')}
                          </Button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" className="gap-1" onClick={() => onPay(r.doctor_id, r.doctor_name || '')}>
                          <Send className="w-4 h-4" /> {t('mm2.retiros.admin.goPay')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {editing && draft && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      <label htmlFor={`wr-note-${r.id}`} className="text-sm font-medium block">
                        {draft.decision === 'approved' ? t('mm2.retiros.admin.noteApprove') : t('mm2.retiros.admin.noteReject')}
                      </label>
                      <Textarea
                        id={`wr-note-${r.id}`}
                        rows={2}
                        maxLength={PAYOUT_NOTE_MAX}
                        value={draft.note}
                        onChange={e => setDraft({ ...draft, note: e.target.value.slice(0, PAYOUT_NOTE_MAX) })}
                        placeholder={
                          draft.decision === 'approved'
                            ? t('mm2.retiros.admin.noteApprovePlaceholder')
                            : t('mm2.retiros.admin.noteRejectPlaceholder')
                        }
                      />
                      {draft.decision === 'rejected' && draft.touched && !draft.note.trim() && (
                        <p className="text-xs text-amber-700">{t('mm2.retiros.errors.note_required')}</p>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDraft(null)} disabled={reviewing === r.id}>
                          {t('mm2.retiros.dialog.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          variant={draft.decision === 'rejected' ? 'destructive' : 'default'}
                          disabled={reviewing === r.id}
                          onClick={() => submitReview(r)}
                          className="gap-1"
                        >
                          {reviewing === r.id && <Loader2 className="w-4 h-4 animate-spin" />}
                          {draft.decision === 'approved' ? t('mm2.retiros.admin.approve') : t('mm2.retiros.admin.reject')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!pendingActivation && (
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{t('mm2.retiros.admin.moneyRule')}</span>
          </p>
        )}
      </CardContent>
      {dialog}
    </Card>
  );
}

export default PayoutRequestsAdmin;
