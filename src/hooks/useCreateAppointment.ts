// Crear una consulta desde el panel del médico (11-sep-2026).
//
// Hasta hoy el médico NO podía crear una cita: la política RLS de `appointments`
// solo deja insertar al paciente. La creación va por la función
// doctor_create_appointment, que escribe el paquete de base de datos.
//
// El código funciona ANTES de aplicar esa migración: si la función todavía no
// existe (PGRST202 / 42883 / PGRST205 / 42P01) el hook devuelve
// `pending_activation` y la pantalla enseña un aviso honesto. Nunca inventa que
// la cita quedó agendada.
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CreateAppointmentFailure =
  | 'pending_activation'
  | 'conflict'
  | 'forbidden'
  | 'invalid'
  | 'error';

export interface CreateAppointmentInput {
  patientId: string;
  startsAt: Date | string;
  durationMinutes?: number;
  notes?: string | null;
  modality?: string | null;
}

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: CreateAppointmentFailure; error?: any };

/** Códigos con los que Postgres/PostgREST dicen «eso todavía no existe». */
const MISSING_CODES = new Set(['PGRST202', 'PGRST205', '42883', '42P01']);

export function isMissingDbObject(err: any): boolean {
  if (!err) return false;
  if (MISSING_CODES.has(String(err.code || ''))) return true;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
  return /does not exist|schema cache|could not find the function|could not find the table/.test(msg);
}

/** La modalidad la añade la migración: si la función aún no la acepta, se reintenta sin ella. */
const modalityRejected = (err: any): boolean => {
  const code = String(err?.code || '');
  if (['PGRST202', '22P02', '23514'].includes(code)) return true;
  const msg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  return msg.includes('p_modality') || msg.includes('modality');
};

const classify = (err: any): CreateAppointmentFailure => {
  const code = String(err?.code || '');
  if (code === '23505') return 'conflict';
  if (code === '42501') return 'forbidden';
  if (['23514', '23503', '22007', '22008', '22P02'].includes(code)) return 'invalid';
  const msg = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  if (/solap|overlap|ocupad|already booked|taken|conflict/.test(msg)) return 'conflict';
  if (/no autoriz|not authoriz|permission|forbidden|denied/.test(msg)) return 'forbidden';
  if (code === 'P0001' || /invalid|no v[aá]lid/.test(msg)) return 'invalid';
  return 'error';
};

// Si en esta sesión ya se comprobó que la función no está, la pantalla puede
// avisar desde el primer paso en lugar de esperar al final.
let pendingActivationSeen = false;

export function useCreateAppointment() {
  const [creating, setCreating] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(pendingActivationSeen);

  const createAppointment = useCallback(async (input: CreateAppointmentInput): Promise<CreateAppointmentResult> => {
    setCreating(true);
    try {
      const startsAt =
        typeof input.startsAt === 'string' ? input.startsAt : input.startsAt.toISOString();
      const notes = (input.notes || '').trim();
      const base: Record<string, any> = {
        p_patient_id: input.patientId,
        p_starts_at: startsAt,
        p_duration_minutes: input.durationMinutes ?? 30,
        p_notes: notes ? notes : null,
      };
      const call = (payload: Record<string, any>) =>
        (supabase.rpc as any)('doctor_create_appointment', payload);

      let { data, error } = await call(
        input.modality ? { ...base, p_modality: input.modality } : base,
      );

      if (error && input.modality && modalityRejected(error)) {
        ({ data, error } = await call(base));
      }

      if (error) {
        if (isMissingDbObject(error)) {
          pendingActivationSeen = true;
          setPendingActivation(true);
          return { ok: false, reason: 'pending_activation', error };
        }
        console.error('[useCreateAppointment]', error);
        return { ok: false, reason: classify(error), error };
      }

      const id =
        typeof data === 'string'
          ? data
          : Array.isArray(data)
            ? (data[0]?.id ?? data[0])
            : (data as any)?.id ?? data;
      if (!id || typeof id !== 'string') {
        console.error('[useCreateAppointment] respuesta sin id', data);
        return { ok: false, reason: 'error' };
      }
      return { ok: true, appointmentId: id };
    } catch (e: any) {
      if (isMissingDbObject(e)) {
        pendingActivationSeen = true;
        setPendingActivation(true);
        return { ok: false, reason: 'pending_activation', error: e };
      }
      console.error('[useCreateAppointment]', e);
      return { ok: false, reason: 'error', error: e };
    } finally {
      setCreating(false);
    }
  }, []);

  return { createAppointment, creating, pendingActivation };
}

export default useCreateAppointment;
