// Invitaciones de pacientes del médico (13-sep-2026).
//
// Fuente: tabla doctor_patient_invites y RPC doctor_import_patient_invites
// (migración 20260913d_invitaciones_pacientes). El correo lo manda la Edge
// Function send-patient-invite.
//
// Antes de aplicar la migración la tabla no existe: el hook marca
// `pendingActivation`, la lista queda vacía y ninguna acción finge que guarda.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';
import { INVITE_MAX_ROWS, type PatientRowInput } from '@/components/doctor/patients/patientRows';

const sb = supabase as any;

export type InviteStatus = 'pending' | 'sent' | 'accepted' | 'revoked';

export interface PatientInvite {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  token: string;
  status: InviteStatus;
  sentAt: string | null;
  createdAt: string;
}

export interface ImportRowResult {
  /** Posición (1..n) en la lista enviada a la RPC. */
  row: number;
  result: 'created' | 'duplicate' | 'invalid';
  reason?: string;
  id?: string;
}

export interface ImportSummary {
  created: number;
  reactivated: number;
  duplicates: number;
  invalid: number;
  total: number;
  rows: ImportRowResult[];
}

export type InviteFailure =
  | 'pending_activation'
  | 'forbidden'
  | 'too_many'
  | 'invalid'
  | 'not_found'
  | 'not_sendable'
  | 'no_email'
  | 'recently_sent'
  | 'daily_limit'
  | 'unavailable'
  | 'error';

export type InviteResult<T = undefined> = { ok: true; data: T } | { ok: false; reason: InviteFailure; error?: any };

/** Enlace personal de la invitación (aterriza en /app, que guarda el token). */
export const inviteLinkFor = (token: string) =>
  `${window.location.origin}/app?invitacion=${encodeURIComponent(token)}`;

const mapRow = (r: any): PatientInvite => ({
  id: r.id,
  fullName: r.full_name || '',
  email: r.email ?? null,
  phone: r.phone ?? null,
  note: r.note ?? null,
  token: r.token,
  status: r.status,
  sentAt: r.sent_at ?? null,
  createdAt: r.created_at,
});

const classifyDbError = (err: any): InviteFailure => {
  if (isMissingDbObject(err)) return 'pending_activation';
  const code = String(err?.code || '');
  const msg = `${err?.message || ''}`.toLowerCase();
  if (code === '42501') return 'forbidden';
  if (msg.includes('too_many_rows')) return 'too_many';
  if (['22023', '23514', '23505', '22P02'].includes(code)) return 'invalid';
  return 'error';
};

const toSummary = (data: any): ImportSummary => ({
  created: Number(data?.created || 0),
  reactivated: Number(data?.reactivated || 0),
  duplicates: Number(data?.duplicates || 0),
  invalid: Number(data?.invalid || 0),
  total: Number(data?.total || 0),
  rows: Array.isArray(data?.rows) ? data.rows : [],
});

/** Lee el estado y el cuerpo de un error de supabase.functions.invoke. */
async function readFunctionError(error: any): Promise<{ status: number; body: any; network: boolean }> {
  const ctx = error?.context;
  const network = error?.name === 'FunctionsFetchError' || error?.name === 'FunctionsRelayError';
  const status = Number(ctx?.status || 0);
  let body: any = null;
  try {
    if (ctx && typeof ctx.clone === 'function') body = await ctx.clone().json();
  } catch {
    /* sin cuerpo JSON */
  }
  return { status, body, network };
}

export function usePatientInvites() {
  const { supabaseUser, role } = useAuth();
  const me = supabaseUser?.id;
  const [invites, setInvites] = useState<PatientInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActivation, setPendingActivation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me || role !== 'doctor') {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await sb
      .from('doctor_patient_invites')
      .select('id, full_name, email, phone, note, token, status, sent_at, created_at')
      .eq('doctor_id', me)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1000);
    if (err) {
      if (isMissingDbObject(err)) {
        setPendingActivation(true);
        setInvites([]);
      } else {
        console.error('[usePatientInvites]', err);
        setError(err.message || 'error');
      }
      setLoading(false);
      return;
    }
    setPendingActivation(false);
    setInvites((data || []).map(mapRow));
    setLoading(false);
  }, [me, role]);

  useEffect(() => {
    load();
  }, [load]);

  /** Crea invitaciones (valida y deduplica la RPC). No envía ningún correo. */
  const importRows = useCallback(
    async (rows: PatientRowInput[]): Promise<InviteResult<ImportSummary>> => {
      if (!me || role !== 'doctor') return { ok: false, reason: 'forbidden' };
      if (pendingActivation) return { ok: false, reason: 'pending_activation' };
      if (rows.length === 0) return { ok: false, reason: 'invalid' };
      if (rows.length > INVITE_MAX_ROWS) return { ok: false, reason: 'too_many' };
      const payload = rows.map(r => ({ full_name: r.full_name, email: r.email, phone: r.phone, note: r.note }));
      const { data, error: err } = await sb.rpc('doctor_import_patient_invites', { p_rows: payload });
      if (err) {
        const reason = classifyDbError(err);
        if (reason === 'pending_activation') setPendingActivation(true);
        else if (reason === 'error') console.error('[usePatientInvites] import', err);
        return { ok: false, reason, error: err };
      }
      await load();
      return { ok: true, data: toSummary(data) };
    },
    [me, role, pendingActivation, load],
  );

  /** Revoca: el enlace deja de funcionar. Una invitación aceptada no se toca. */
  const revoke = useCallback(
    async (id: string): Promise<InviteResult> => {
      if (!me) return { ok: false, reason: 'forbidden' };
      const { data, error: err } = await sb
        .from('doctor_patient_invites')
        .update({ status: 'revoked' })
        .eq('id', id)
        .eq('doctor_id', me)
        .in('status', ['pending', 'sent'])
        .select('id');
      if (err) {
        const reason = classifyDbError(err);
        if (reason === 'pending_activation') setPendingActivation(true);
        else console.error('[usePatientInvites] revoke', err);
        return { ok: false, reason, error: err };
      }
      if (!data || data.length === 0) return { ok: false, reason: 'not_found' };
      setInvites(prev => prev.filter(i => i.id !== id));
      return { ok: true, data: undefined };
    },
    [me],
  );

  /** Envía el correo de invitación (Edge Function send-patient-invite). */
  const sendEmail = useCallback(
    async (id: string): Promise<InviteResult> => {
      if (!me) return { ok: false, reason: 'forbidden' };
      const { data, error: fnErr } = await supabase.functions.invoke('send-patient-invite', {
        body: { invite_id: id },
      });
      if (fnErr) {
        const { status, body, network } = await readFunctionError(fnErr);
        const code = String(body?.error || body?.code || '');
        if (network || (status === 404 && code === 'NOT_FOUND')) return { ok: false, reason: 'unavailable', error: fnErr };
        if (code === 'pending_activation') return { ok: false, reason: 'pending_activation', error: fnErr };
        if (code === 'recently_sent') return { ok: false, reason: 'recently_sent', error: fnErr };
        if (code === 'daily_limit') return { ok: false, reason: 'daily_limit', error: fnErr };
        if (code === 'no_email') return { ok: false, reason: 'no_email', error: fnErr };
        if (code === 'invite_not_sendable') return { ok: false, reason: 'not_sendable', error: fnErr };
        if (code === 'invite_not_found') return { ok: false, reason: 'not_found', error: fnErr };
        if (status === 401 || status === 403) return { ok: false, reason: 'forbidden', error: fnErr };
        console.error('[usePatientInvites] send', status, body);
        return { ok: false, reason: 'error', error: fnErr };
      }
      if (data && data.success === false) return { ok: false, reason: 'error', error: data };
      await load();
      return { ok: true, data: undefined };
    },
    [me, load],
  );

  return { invites, loading, error, pendingActivation, reload: load, importRows, revoke, sendEmail };
}

export default usePatientInvites;
