// Solicitudes de retiro del médico (13-sep-2026) — «Retirar saldo» de verdad.
//
// Fuente: tabla `payout_requests` y RPC `request_doctor_payout`,
// `cancel_payout_request`, `admin_review_payout_request`, `get_payout_minimum`
// (migración 20260913c_solicitudes_retiro).
//
// REGLA DE DINERO: solicitar NO descuenta saldo. `doctor_profiles.pending_earnings`
// solo lo descuenta el pago real que lanza el admin (flujo de siempre en
// /admin/payouts); un trigger sobre `doctor_payouts` marca la solicitud como
// pagada. Este hook no escribe saldos ni pagos: solo llama a las RPC.
//
// Antes de aplicar la migración la tabla y las RPC no existen: el hook marca
// `pendingActivation` y la pantalla lo dice, ofreciendo lo de hoy (la cuenta
// bancaria). Nunca un error rojo.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

// Tabla y RPC nuevas: todavía no están en los tipos generados.
const sb = supabase as any;

export type PayoutRequestStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';

export interface PayoutRequest {
  id: string;
  doctor_id: string;
  amount: number;
  status: PayoutRequestStatus;
  bank_account_id: string | null;
  doctor_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  payout_id: string | null;
  created_at: string;
  updated_at: string;
}

/** El pago real (`doctor_payouts`) con el que se cerró una solicitud. */
export interface LinkedPayout {
  id: string;
  amount: number;
  status: string | null;
  paid_at: string | null;
  created_at: string;
  stripe_transfer_id: string | null;
}

/** Cuenta para retiros, sin la CLABE completa. */
export interface PayoutBankSummary {
  id: string;
  bank_name: string | null;
  clabe_last4: string | null;
  account_holder_name: string | null;
  payment_method: string | null;
  is_verified: boolean;
}

export type PayoutRequestFailure =
  | 'pending_activation'
  | 'not_authenticated'
  | 'not_approved_doctor'
  | 'no_bank_account'
  | 'bank_account_not_verified'
  | 'below_minimum'
  | 'insufficient_balance'
  | 'request_already_open'
  | 'invalid_amount'
  | 'invalid_note'
  | 'request_not_found'
  | 'request_not_pending'
  | 'not_admin'
  | 'invalid_decision'
  | 'note_required'
  | 'error';

/** Sin strictNullChecks TypeScript no estrecha una unión por `ok`: por eso es
 *  una interfaz plana. Con `ok: false` siempre viene `reason`. */
export interface PayoutRequestResult {
  ok: boolean;
  id?: string;
  reason?: PayoutRequestFailure;
  error?: any;
}

export const OPEN_PAYOUT_STATUSES: readonly PayoutRequestStatus[] = ['pending', 'approved'];
export const PAYOUT_NOTE_MAX = 500;

/** Clave i18n y píldora `pro-pill-*` de cada estado. */
export const PAYOUT_STATUS_META: Record<PayoutRequestStatus, { labelKey: string; pill: string }> = {
  pending: { labelKey: 'mm2.retiros.status.pending', pill: 'pro-pill-warn' },
  approved: { labelKey: 'mm2.retiros.status.approved', pill: 'pro-pill-info' },
  paid: { labelKey: 'mm2.retiros.status.paid', pill: 'pro-pill-ok' },
  rejected: { labelKey: 'mm2.retiros.status.rejected', pill: 'pro-pill-live' },
  cancelled: { labelKey: 'mm2.retiros.status.cancelled', pill: 'pro-pill-muted' },
};

/** Clave i18n del texto de cada fallo (para toasts y avisos). */
export const payoutFailureKey = (reason: PayoutRequestFailure) => `mm2.retiros.errors.${reason}`;

const CHANGED_EVENT = 'mm:payout-requests-changed';

/** Avisa a todas las instancias del hook (hero de Cuenta, lista, admin) de que recarguen. */
export function notifyPayoutRequestsChanged() {
  try {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* entorno sin window (tests) */
  }
}

/** Redondeo a centavos sin arrastrar el error de coma flotante. */
export const toCents = (n: number) => Math.round(Number(n) * 100) / 100;

const REQUEST_COLUMNS =
  'id, doctor_id, amount, status, bank_account_id, doctor_note, admin_note, reviewed_by, reviewed_at, payout_id, created_at, updated_at';

const normalizeRequest = (r: any): PayoutRequest => ({
  ...r,
  amount: Number(r?.amount) || 0,
  status: (['pending', 'approved', 'rejected', 'paid', 'cancelled'].includes(r?.status) ? r.status : 'pending') as PayoutRequestStatus,
});

const normalizeBank = (b: any): PayoutBankSummary | null =>
  b
    ? {
        id: b.id,
        bank_name: b.bank_name ?? null,
        clabe_last4: b.clabe_last4 ?? null,
        account_holder_name: b.account_holder_name ?? null,
        payment_method: b.payment_method ?? null,
        is_verified: !!b.is_verified,
      }
    : null;

/** Mensaje de la RPC → motivo. Las RPC lanzan el motivo como texto del error. */
export function classifyPayoutError(err: any): PayoutRequestFailure {
  if (!err) return 'error';
  if (isMissingDbObject(err)) return 'pending_activation';
  const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase();
  const known: [string, PayoutRequestFailure][] = [
    ['not_authenticated', 'not_authenticated'],
    ['not_approved_doctor', 'not_approved_doctor'],
    ['bank_account_not_verified', 'bank_account_not_verified'],
    ['no_bank_account', 'no_bank_account'],
    ['below_minimum', 'below_minimum'],
    ['insufficient_balance', 'insufficient_balance'],
    ['request_already_open', 'request_already_open'],
    ['invalid_amount', 'invalid_amount'],
    ['invalid_note_too_long', 'invalid_note'],
    ['request_not_found', 'request_not_found'],
    ['request_not_pending', 'request_not_pending'],
    ['note_required_for_rejection', 'note_required'],
    ['invalid_decision', 'invalid_decision'],
    ['not_admin', 'not_admin'],
  ];
  for (const [needle, reason] of known) if (msg.includes(needle)) return reason;
  // Índice único «una pendiente por médico»
  if (String(err.code || '') === '23505') return 'request_already_open';
  return 'error';
}

async function loadLinkedPayouts(ids: string[]): Promise<Record<string, LinkedPayout>> {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('doctor_payouts')
    .select('id, amount, status, paid_at, created_at, stripe_transfer_id')
    .in('id', ids);
  if (error || !data) return {};
  const map: Record<string, LinkedPayout> = {};
  (data as any[]).forEach(p => {
    map[p.id] = { ...p, amount: Number(p.amount) || 0 };
  });
  return map;
}

// ============================================================================
// MÉDICO
// ============================================================================

export interface UsePayoutRequestsOptions {
  /** false = no carga nada (diálogo cerrado). */
  enabled?: boolean;
}

export function usePayoutRequests({ enabled = true }: UsePayoutRequestsOptions = {}) {
  const { user } = useAuth();
  const uid = user?.id;

  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [payouts, setPayouts] = useState<Record<string, LinkedPayout>>({});
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [isApprovedDoctor, setIsApprovedDoctor] = useState(false);
  const [bank, setBank] = useState<PayoutBankSummary | null>(null);
  const [minimum, setMinimum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!uid || !enabled) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [reqRes, profRes, bankRes] = await Promise.all([
        sb.from('payout_requests').select(REQUEST_COLUMNS).eq('doctor_id', uid).order('created_at', { ascending: false }).limit(50),
        supabase.from('doctor_profiles').select('pending_earnings, status').eq('user_id', uid).maybeSingle(),
        supabase
          .from('doctor_bank_accounts')
          .select('id, bank_name, clabe_last4, account_holder_name, payment_method, is_verified')
          .eq('doctor_id', uid)
          .maybeSingle(),
      ]);

      setPendingEarnings(Number((profRes.data as any)?.pending_earnings) || 0);
      setIsApprovedDoctor((profRes.data as any)?.status === 'approved');
      setBank(normalizeBank(bankRes.data));

      // Sin la tabla no se pregunta por la RPC: una sola petición fallida, no dos.
      if (isMissingDbObject(reqRes.error)) {
        setPendingActivation(true);
        setRequests([]);
        setPayouts({});
        setMinimum(null);
        return;
      }
      if (reqRes.error) {
        console.error('[usePayoutRequests] load', reqRes.error);
        setPendingActivation(false);
        setLoadError(true);
        return;
      }

      const minRes = await sb.rpc('get_payout_minimum');
      if (isMissingDbObject(minRes.error)) {
        // Migración a medias: la tabla existe pero la RPC no. Mismo aviso honesto.
        setPendingActivation(true);
        setRequests([]);
        setPayouts({});
        setMinimum(null);
        return;
      }
      setPendingActivation(false);

      const rows = ((reqRes.data as any[]) || []).map(normalizeRequest);
      setRequests(rows);
      setMinimum(!minRes.error && minRes.data != null ? Number(minRes.data) : null);
      setPayouts(await loadLinkedPayouts(rows.map(r => r.payout_id).filter(Boolean) as string[]));
    } catch (e) {
      if (isMissingDbObject(e)) {
        setPendingActivation(true);
      } else {
        console.error('[usePayoutRequests] load', e);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [uid, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => { load(); };
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, [load, enabled]);

  /** La solicitud en curso (pendiente o aprobada), si la hay. */
  const openRequest = useMemo(
    () => requests.find(r => OPEN_PAYOUT_STATUSES.includes(r.status)) || null,
    [requests],
  );

  /** Envía la solicitud. NO descuenta saldo: lo hace el pago real del admin. */
  const requestPayout = useCallback(
    async (amount: number, note?: string | null): Promise<PayoutRequestResult> => {
      if (!uid) return { ok: false, reason: 'not_authenticated' };
      if (pendingActivation) return { ok: false, reason: 'pending_activation' };
      const value = toCents(amount);
      if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'invalid_amount' };
      const cleanNote = (note || '').trim().slice(0, PAYOUT_NOTE_MAX);
      setSubmitting(true);
      try {
        const { data, error } = await sb.rpc('request_doctor_payout', { p_amount: value, p_note: cleanNote || null });
        if (error) {
          const reason = classifyPayoutError(error);
          if (reason === 'pending_activation') setPendingActivation(true);
          if (reason === 'error') console.error('[usePayoutRequests] request', error);
          return { ok: false, reason, error };
        }
        notifyPayoutRequestsChanged();
        return { ok: true, id: String(data ?? '') };
      } catch (e) {
        const reason = classifyPayoutError(e);
        if (reason === 'pending_activation') setPendingActivation(true);
        else console.error('[usePayoutRequests] request', e);
        return { ok: false, reason, error: e };
      } finally {
        setSubmitting(false);
      }
    },
    [uid, pendingActivation],
  );

  /** Cancela una solicitud propia que siga pendiente. */
  const cancelRequest = useCallback(
    async (requestId: string): Promise<PayoutRequestResult> => {
      if (!uid) return { ok: false, reason: 'not_authenticated' };
      if (pendingActivation) return { ok: false, reason: 'pending_activation' };
      setSubmitting(true);
      try {
        const { error } = await sb.rpc('cancel_payout_request', { p_request_id: requestId });
        if (error) {
          const reason = classifyPayoutError(error);
          if (reason === 'pending_activation') setPendingActivation(true);
          if (reason === 'error') console.error('[usePayoutRequests] cancel', error);
          return { ok: false, reason, error };
        }
        notifyPayoutRequestsChanged();
        return { ok: true, id: requestId };
      } catch (e) {
        console.error('[usePayoutRequests] cancel', e);
        return { ok: false, reason: classifyPayoutError(e), error: e };
      } finally {
        setSubmitting(false);
      }
    },
    [uid, pendingActivation],
  );

  return {
    requests,
    payouts,
    openRequest,
    pendingEarnings,
    isApprovedDoctor,
    bank,
    minimum,
    loading,
    loadError,
    pendingActivation,
    submitting,
    reload: load,
    requestPayout,
    cancelRequest,
  };
}

export type UsePayoutRequests = ReturnType<typeof usePayoutRequests>;

// ============================================================================
// ADMIN
// ============================================================================

export interface AdminPayoutRequest extends PayoutRequest {
  doctor_name: string | null;
  doctor_avatar: string | null;
  doctor_specialty: string | null;
  /** Saldo del médico AHORA (no el del momento de la solicitud). */
  doctor_pending_earnings: number;
  bank: PayoutBankSummary | null;
  payout: LinkedPayout | null;
}

export function useAdminPayoutRequests({ enabled = true }: UsePayoutRequestsOptions = {}) {
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await sb
        .from('payout_requests')
        .select(REQUEST_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (isMissingDbObject(error)) {
          setPendingActivation(true);
          setRequests([]);
        } else {
          console.error('[useAdminPayoutRequests] load', error);
          setLoadError(true);
        }
        return;
      }
      setPendingActivation(false);

      const rows = ((data as any[]) || []).map(normalizeRequest);
      const doctorIds = [...new Set(rows.map(r => r.doctor_id))];
      const payoutIds = rows.map(r => r.payout_id).filter(Boolean) as string[];

      const [profRes, dpRes, bankRes, payoutMap] = await Promise.all([
        doctorIds.length
          ? supabase.from('profiles').select('id, name, avatar_url').in('id', doctorIds)
          : Promise.resolve({ data: [] as any[] }),
        doctorIds.length
          ? supabase.from('doctor_profiles').select('user_id, specialty, pending_earnings').in('user_id', doctorIds)
          : Promise.resolve({ data: [] as any[] }),
        doctorIds.length
          ? supabase
              .from('doctor_bank_accounts')
              .select('id, doctor_id, bank_name, clabe_last4, account_holder_name, payment_method, is_verified')
              .in('doctor_id', doctorIds)
          : Promise.resolve({ data: [] as any[] }),
        loadLinkedPayouts(payoutIds),
      ]);

      const profMap = new Map(((profRes as any).data || []).map((p: any) => [p.id, p]));
      const dpMap = new Map(((dpRes as any).data || []).map((d: any) => [d.user_id, d]));
      const bankMap = new Map(((bankRes as any).data || []).map((b: any) => [b.doctor_id, b]));

      setRequests(
        rows.map(r => {
          const p: any = profMap.get(r.doctor_id);
          const d: any = dpMap.get(r.doctor_id);
          return {
            ...r,
            doctor_name: p?.name || null,
            doctor_avatar: p?.avatar_url || null,
            doctor_specialty: d?.specialty || null,
            doctor_pending_earnings: Number(d?.pending_earnings) || 0,
            bank: normalizeBank(bankMap.get(r.doctor_id)),
            payout: r.payout_id ? payoutMap[r.payout_id] || null : null,
          };
        }),
      );
    } catch (e) {
      if (isMissingDbObject(e)) {
        setPendingActivation(true);
      } else {
        console.error('[useAdminPayoutRequests] load', e);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => { load(); };
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, [load, enabled]);

  /** Aprueba o rechaza (rechazar exige nota). No mueve dinero. */
  const review = useCallback(
    async (requestId: string, decision: 'approved' | 'rejected', note?: string | null): Promise<PayoutRequestResult> => {
      const cleanNote = (note || '').trim().slice(0, PAYOUT_NOTE_MAX);
      if (decision === 'rejected' && !cleanNote) return { ok: false, reason: 'note_required' };
      setReviewing(requestId);
      try {
        const { error } = await sb.rpc('admin_review_payout_request', {
          p_request_id: requestId,
          p_decision: decision,
          p_note: cleanNote || null,
        });
        if (error) {
          const reason = classifyPayoutError(error);
          if (reason === 'pending_activation') setPendingActivation(true);
          if (reason === 'error') console.error('[useAdminPayoutRequests] review', error);
          return { ok: false, reason, error };
        }
        notifyPayoutRequestsChanged();
        return { ok: true, id: requestId };
      } catch (e) {
        console.error('[useAdminPayoutRequests] review', e);
        return { ok: false, reason: classifyPayoutError(e), error: e };
      } finally {
        setReviewing(null);
      }
    },
    [],
  );

  return { requests, loading, loadError, pendingActivation, reviewing, reload: load, review };
}
