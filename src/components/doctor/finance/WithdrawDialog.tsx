// «Retirar saldo» de verdad (13-sep-2026) — maqueta de Marta «ingresos-y-pagos.jpg»
// (botón rojo del hero de Ingresos y pagos).
//
// Hasta hoy el botón solo llevaba a Cuenta bancaria: los pagos al médico los
// lanza el admin y el médico no tenía forma de pedirlos. Ahora el médico
// SOLICITA un retiro:
//   saldo disponible · mínimo · cuenta destino (enmascarada) · importe · nota
//   → revisión con useConfirmAction → solicitud `pending` (el admin la revisa).
//
// REGLA DE DINERO: la solicitud NO descuenta saldo. Lo descuenta el pago real
// que lanza el admin con el flujo de siempre; un trigger de la base marca
// entonces la solicitud como pagada. Nada se descuenta dos veces.
//
// Sin la migración 20260913c el diálogo lo dice («pendiente de activar») y
// ofrece lo de hoy: ir a Cuenta bancaria. Nunca un error rojo.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Building2, CheckCircle2, Info, Landmark, Loader2, RefreshCw } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useAppDateFormat } from '@/lib/dateFormat';
import { fill, money2 } from '@/lib/proFormat';
import { doctorHref } from '@/lib/doctorSections';
import {
  usePayoutRequests,
  PAYOUT_NOTE_MAX,
  PAYOUT_STATUS_META,
  payoutFailureKey,
  toCents,
  type PayoutBankSummary,
} from '@/hooks/usePayoutRequests';
import '@/styles/funciones-retiros.css';

/** Nombre visible de la cuenta: el banco o, sin banco, el método (Stripe). */
export function bankNameOf(bank: PayoutBankSummary | null, t: (k: string) => string): string {
  if (!bank) return '—';
  if (bank.bank_name) return bank.bank_name;
  if (bank.payment_method === 'stripe' || bank.payment_method === 'both') return 'Stripe Connect';
  return t('mm2.retiros.dialog.accountFallback');
}

/** «BBVA · **** 4587» (nunca la CLABE completa). */
export function bankLabelOf(bank: PayoutBankSummary | null, t: (k: string) => string): string {
  if (!bank) return '—';
  const name = bankNameOf(bank, t);
  return bank.clabe_last4 ? `${name} · **** ${bank.clabe_last4}` : name;
}

/** Saldo en centavos hacia abajo: nunca se ofrece más de lo que hay. */
const floorCents = (n: number) => Math.floor(Number((Number(n) * 100).toFixed(6))) / 100;

/** «1234.5», «1234,50» o «1,234.50» → número; null si no es un importe con ≤ 2 decimales. */
export function parseAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '');
  if (!s) return null;
  const normalized = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

type Gate =
  | 'loading'
  | 'pending_activation'
  | 'error'
  | 'not_approved'
  | 'open_request'
  | 'no_bank'
  | 'unverified'
  | 'below_min'
  | 'form'
  | 'sent';

export interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const { t, language } = useLanguage();
  const fmt = useAppDateFormat();
  const { confirm, dialog } = useConfirmAction();
  const {
    loading, loadError, pendingActivation, pendingEarnings, minimum, bank, isApprovedDoctor,
    openRequest, submitting, requestPayout, cancelRequest, reload,
  } = usePayoutRequests({ enabled: open });

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<{ amount: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('');
    setTouched(false);
    setSent(null);
  }, [open]);

  const m = (n: number) => money2(n, language);
  const bankHref = doctorHref('cuenta', { tab: 'finanzas', f: 'banco' });
  const requestsHref = doctorHref('cuenta', { tab: 'finanzas', f: 'pendientes' });
  const close = () => onOpenChange(false);

  const balance = floorCents(pendingEarnings);
  const min = minimum ?? 0;
  const parsed = parseAmountInput(amount);

  const amountError: string | null = (() => {
    if (!amount.trim()) return t('mm2.retiros.dialog.errRequired');
    if (parsed == null || parsed <= 0) return t('mm2.retiros.dialog.errInvalid');
    if (parsed < min) return fill(t('mm2.retiros.dialog.errBelowMin'), { min: m(min) });
    if (parsed > balance) return fill(t('mm2.retiros.dialog.errAboveBalance'), { max: m(balance) });
    return null;
  })();

  const gate: Gate = sent
    ? 'sent'
    : loading
      ? 'loading'
      : pendingActivation
        ? 'pending_activation'
        : loadError
          ? 'error'
          : !isApprovedDoctor
            ? 'not_approved'
            : openRequest
              ? 'open_request'
              : !bank
                ? 'no_bank'
                : !bank.is_verified
                  ? 'unverified'
                  : balance <= 0 || balance < min
                    ? 'below_min'
                    : 'form';

  const submit = async () => {
    setTouched(true);
    if (amountError || parsed == null || !bank) return;
    const value = toCents(parsed);
    const cleanNote = note.trim();
    // Revisión: el primer clic nunca envía.
    const ok = await confirm({
      title: t('mm2.retiros.review.title'),
      description: t('mm2.retiros.review.desc'),
      tone: 'payment',
      confirmLabel: t('mm2.retiros.review.confirm'),
      details: [
        { label: t('mm2.retiros.review.account'), value: bankLabelOf(bank, t) },
        { label: t('mm2.retiros.review.balance'), value: m(balance) },
        ...(cleanNote ? [{ label: t('mm2.retiros.review.note'), value: cleanNote }] : []),
        { label: t('mm2.retiros.review.amount'), value: m(value), emphasis: true },
      ],
    });
    if (!ok) return;
    const res = await requestPayout(value, cleanNote);
    if (res.ok) {
      setSent({ amount: value });
      toast.success(t('mm2.retiros.toast.sent'));
      return;
    }
    toast.error(t(payoutFailureKey(res.reason)));
  };

  const cancelOpen = async () => {
    if (!openRequest) return;
    const ok = await confirm({
      title: t('mm2.retiros.cancel.title'),
      description: t('mm2.retiros.cancel.desc'),
      confirmLabel: t('mm2.retiros.cancel.confirm'),
      cancelLabel: t('mm2.retiros.cancel.keep'),
      details: [
        { label: t('mm2.retiros.list.requested'), value: fmt.formatDate(openRequest.created_at, 'PP') },
        { label: t('mm2.retiros.review.amount'), value: m(openRequest.amount), emphasis: true },
      ],
    });
    if (!ok) return;
    const res = await cancelRequest(openRequest.id);
    if (res.ok) toast.success(t('mm2.retiros.toast.cancelled'));
    else toast.error(t(payoutFailureKey(res.reason)));
  };

  // ------------------------------------------------------------ piezas
  const alertBox = (
    tone: 'warn' | 'info' | 'ok' | 'err',
    title: string,
    body?: React.ReactNode,
    Icon: React.ElementType = Info,
  ) => (
    <div className={`wd-alert wd-alert-${tone}`} role={tone === 'err' ? 'alert' : undefined}>
      <Icon />
      <div className="min-w-0">
        <p className="wd-alert-title">{title}</p>
        {body && <p>{body}</p>}
      </div>
    </div>
  );

  const stats = (
    <div className="wd-stats">
      <div className="wd-stat">
        <span className="k">{t('pro.earnings.kpiBalance')}</span>
        <span className="v">{m(balance)}</span>
      </div>
      {minimum != null && (
        <div className="wd-stat">
          <span className="k">{t('mm2.retiros.dialog.minimum')}</span>
          <span className="v">{m(minimum)}</span>
        </div>
      )}
    </div>
  );

  const bankBlock = bank ? (
    <div className="pro-bank wd-bank">
      <span className="pro-icon-box"><Building2 /></span>
      <span className="min-w-0 flex-1">
        <span className="wd-kicker">{t('mm2.retiros.dialog.destination')}</span>
        <span className="pro-row-name block">{bankNameOf(bank, t)}</span>
        {bank.clabe_last4 && (
          <span className="pro-row-sub block">{t('pro.earnings.accountOf')} **** {bank.clabe_last4}</span>
        )}
        {bank.account_holder_name && <span className="pro-row-sub block">{bank.account_holder_name}</span>}
      </span>
      <span className={`pro-pill ${bank.is_verified ? 'pro-pill-ok' : 'pro-pill-warn'}`}>
        {bank.is_verified ? t('pro.earnings.verified') : t('pro.earnings.unverified')}
      </span>
    </div>
  ) : null;

  const bankLink = (labelKey: string, variant = 'pro-btn-teal') => (
    <Link to={bankHref} onClick={close} className={`pro-btn ${variant}`}>
      <Building2 /> {t(labelKey)}
    </Link>
  );
  const closeBtn = (
    <button type="button" className="pro-btn pro-btn-outline" onClick={close}>
      {t('mm2.retiros.dialog.close')}
    </button>
  );
  const requestsLink = (
    <Link to={requestsHref} onClick={close} className="pro-btn pro-btn-teal">
      {t('mm2.retiros.dialog.seeRequests')}
    </Link>
  );

  let body: React.ReactNode = null;
  let actions: React.ReactNode = closeBtn;

  switch (gate) {
    case 'loading':
      body = (
        <div className="wd-loading" aria-live="polite">
          <Loader2 className="animate-spin" />
          <span className="sr-only">{t('mm2.retiros.dialog.loading')}</span>
        </div>
      );
      break;

    case 'pending_activation':
      body = (
        <>
          {stats}
          {bankBlock}
          {alertBox('warn', t('mm2.retiros.pending.title'), t('mm2.retiros.pending.body'))}
        </>
      );
      actions = (<>{closeBtn}{bankLink('mm2.retiros.dialog.goBank')}</>);
      break;

    case 'error':
      body = alertBox('err', t('mm2.retiros.dialog.loadError'), undefined, AlertTriangle);
      actions = (
        <>
          {closeBtn}
          <button type="button" className="pro-btn pro-btn-teal" onClick={() => reload()}>
            <RefreshCw /> {t('mm2.retiros.dialog.retry')}
          </button>
        </>
      );
      break;

    case 'not_approved':
      body = (
        <>
          {stats}
          {alertBox('warn', t('mm2.retiros.gate.notApprovedTitle'), t('mm2.retiros.gate.notApprovedBody'))}
        </>
      );
      break;

    case 'open_request': {
      const meta = PAYOUT_STATUS_META[openRequest!.status];
      body = (
        <>
          {stats}
          <div className="wd-open">
            <div className="wd-open-top">
              <span className="wd-kicker">{t('mm2.retiros.gate.openTitle')}</span>
              <span className={`pro-pill ${meta.pill}`}>{t(meta.labelKey)}</span>
            </div>
            <p className="wd-open-amount">{m(openRequest!.amount)}</p>
            <p className="wd-open-sub">
              {fill(t('mm2.retiros.list.requestedOn'), { d: fmt.formatDate(openRequest!.created_at, 'PP') })}
            </p>
            {openRequest!.doctor_note && <p className="wd-open-note">{openRequest!.doctor_note}</p>}
            <p className="wd-open-hint">
              {openRequest!.status === 'approved'
                ? t('mm2.retiros.gate.openApprovedBody')
                : t('mm2.retiros.gate.openPendingBody')}
            </p>
          </div>
        </>
      );
      actions = (
        <>
          {closeBtn}
          {openRequest!.status === 'pending' && (
            <button type="button" className="pro-btn pro-btn-outline wd-btn-danger" onClick={cancelOpen} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {t('mm2.retiros.cancel.button')}
            </button>
          )}
          {requestsLink}
        </>
      );
      break;
    }

    case 'no_bank':
      body = (
        <>
          {stats}
          {alertBox('warn', t('mm2.retiros.gate.noBankTitle'), t('mm2.retiros.gate.noBankBody'))}
        </>
      );
      actions = (<>{closeBtn}{bankLink('pro.earnings.addAccount')}</>);
      break;

    case 'unverified':
      body = (
        <>
          {stats}
          {bankBlock}
          {alertBox('warn', t('mm2.retiros.gate.unverifiedTitle'), t('mm2.retiros.gate.unverifiedBody'))}
        </>
      );
      actions = (<>{closeBtn}{bankLink('mm2.retiros.dialog.goBank')}</>);
      break;

    case 'below_min':
      body = (
        <>
          {stats}
          {bankBlock}
          {alertBox(
            'info',
            t('mm2.retiros.gate.belowMinTitle'),
            balance <= 0
              ? t('mm2.retiros.gate.noBalanceBody')
              : fill(t('mm2.retiros.gate.belowMinBody'), { balance: m(balance), min: m(min) }),
          )}
        </>
      );
      break;

    case 'form': {
      const showError = touched && !!amountError;
      body = (
        <>
          {stats}
          {bankBlock}
          <div className="wd-field">
            <label htmlFor="wd-amount" className="wd-label">{t('mm2.retiros.dialog.amountLabel')}</label>
            <div className="wd-amount">
              <div className={`wd-amount-box ${showError ? 'is-invalid' : ''}`}>
                <span className="cur" aria-hidden="true">$</span>
                <input
                  id="wd-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  placeholder="0.00"
                  onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 13))}
                  onBlur={() => setTouched(true)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                  aria-invalid={showError}
                  aria-describedby="wd-amount-help"
                />
                <span className="code">MXN</span>
              </div>
              <button
                type="button"
                className="pro-btn pro-btn-outline"
                onClick={() => { setAmount(balance.toFixed(2)); setTouched(true); }}
              >
                {t('mm2.retiros.dialog.allBalance')}
              </button>
            </div>
            <p id="wd-amount-help" className={`wd-help ${showError ? 'is-error' : ''}`}>
              {showError
                ? amountError
                : fill(t('mm2.retiros.dialog.amountHelp'), { min: m(min), max: m(balance) })}
            </p>
          </div>

          <div className="wd-field">
            <label htmlFor="wd-note" className="wd-label">
              {t('mm2.retiros.dialog.noteLabel')} <span className="wd-optional">{t('mm2.retiros.dialog.optional')}</span>
            </label>
            <Textarea
              id="wd-note"
              value={note}
              maxLength={PAYOUT_NOTE_MAX}
              onChange={e => setNote(e.target.value.slice(0, PAYOUT_NOTE_MAX))}
              placeholder={t('mm2.retiros.dialog.notePlaceholder')}
              className="min-h-[76px] bg-white text-slate-900"
            />
            <span className="wd-count">{note.length}/{PAYOUT_NOTE_MAX}</span>
          </div>

          <p className="wd-rule"><Info /> <span>{t('mm2.retiros.dialog.moneyRule')}</span></p>
        </>
      );
      actions = (
        <>
          <button type="button" className="pro-btn pro-btn-outline" onClick={close}>
            {t('mm2.retiros.dialog.cancel')}
          </button>
          <button type="button" className="pro-btn pro-btn-live" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Landmark />}
            {t('mm2.retiros.dialog.review')}
          </button>
        </>
      );
      break;
    }

    case 'sent':
      body = (
        <>
          {alertBox(
            'ok',
            t('mm2.retiros.sent.title'),
            fill(t('mm2.retiros.sent.body'), { amount: m(sent!.amount) }),
            CheckCircle2,
          )}
          <p className="wd-rule"><Info /> <span>{t('mm2.retiros.dialog.moneyRule')}</span></p>
        </>
      );
      actions = (<>{closeBtn}{requestsLink}</>);
      break;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="wd-dialog bg-white sm:max-w-lg">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-secondary">
              <span className="wd-title-icon"><Landmark /></span>
              <span className="min-w-0">{t('pro.earnings.withdraw')}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-600">{t('mm2.retiros.dialog.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 min-w-0">{body}</div>

          <div className="wd-actions">{actions}</div>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}

export interface WithdrawButtonProps {
  className?: string;
  children?: React.ReactNode;
}

/** El botón «Retirar saldo» con su diálogo. El diálogo (y sus lecturas) solo
 *  se monta al abrirlo. */
export function WithdrawButton({ className = 'pro-btn pro-btn-live', children }: WithdrawButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {children ?? (<><Landmark /> {t('pro.earnings.withdraw')}</>)}
      </button>
      {open && <WithdrawDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

export default WithdrawDialog;
