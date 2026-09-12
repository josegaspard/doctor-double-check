// Servicios y precios del médico (F1 «servicios», 12-sep-2026).
//
// Fuente: tabla doctor_services + RPC get_doctor_services (migración
// 20260913a_servicios_medico.sql).
//
// Antes de aplicar la migración la tabla no existe: los dos hooks marcan
// `pendingActivation`, devuelven la lista vacía y NUNCA fingen que guardan.
// Con la lista vacía el perfil público y la reserva hacen lo de hoy (una sola
// fila con consultation_fee y turnos de 30 min).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';
import {
  SERVICE_LIMITS,
  draftToPayload,
  hasServiceErrors,
  normalizeService,
  validateServiceDraft,
  type DoctorService,
  type ServiceDraft,
} from '@/components/doctor/services/serviceModel';

export * from '@/components/doctor/services/serviceModel';

const sb = supabase as any;

const SERVICE_COLUMNS =
  'id, doctor_id, name, description, duration_minutes, price, modality, icon, sort_order, is_active, created_at, updated_at';

export type ServiceMutationFailure = 'pending_activation' | 'invalid' | 'forbidden' | 'limit' | 'error';
export type ServiceMutationResult = { ok: true } | { ok: false; reason: ServiceMutationFailure; error?: any };

const classify = (err: any): ServiceMutationFailure => {
  const code = String(err?.code || '');
  const msg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  if (code === '42501' || /row-level security|permission denied/.test(msg)) return 'forbidden';
  if (['23514', '22P02', '22003', '23502', '22001'].includes(code)) return 'invalid';
  return 'error';
};

/** Los servicios del propio médico, activos e inactivos, con todas las escrituras. */
export function useDoctorServices(doctorId?: string) {
  const { user } = useAuth();
  const id = doctorId || user?.id;
  const [services, setServices] = useState<DoctorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) {
        setLoading(false);
        return;
      }
      const req = ++reqRef.current;
      if (!opts.silent) setLoading(true);
      setError(null);
      const { data, error: err } = await sb
        .from('doctor_services')
        .select(SERVICE_COLUMNS)
        .eq('doctor_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (req !== reqRef.current) return;
      if (err) {
        if (isMissingDbObject(err)) {
          setPendingActivation(true);
          setServices([]);
        } else {
          console.error('[useDoctorServices]', err);
          setError(err.message || 'error');
        }
        setLoading(false);
        return;
      }
      setPendingActivation(false);
      setServices(((data as any[]) || []).map(normalizeService));
      setLoading(false);
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Ejecuta una escritura y relee la lista (también si falla, para no dejar un orden optimista falso). */
  const run = async (fn: () => Promise<void>): Promise<ServiceMutationResult> => {
    if (!id) return { ok: false, reason: 'forbidden' };
    if (pendingActivation) return { ok: false, reason: 'pending_activation' };
    setSaving(true);
    try {
      await fn();
      return { ok: true };
    } catch (err: any) {
      if (isMissingDbObject(err)) {
        setPendingActivation(true);
        return { ok: false, reason: 'pending_activation', error: err };
      }
      console.error('[useDoctorServices] escritura', err);
      return { ok: false, reason: classify(err), error: err };
    } finally {
      await load({ silent: true });
      setSaving(false);
    }
  };

  const create = async (draft: ServiceDraft): Promise<ServiceMutationResult> => {
    if (hasServiceErrors(validateServiceDraft(draft))) return { ok: false, reason: 'invalid' };
    if (services.length >= SERVICE_LIMITS.maxServices) return { ok: false, reason: 'limit' };
    const nextOrder = services.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;
    return run(async () => {
      const { error: err } = await sb
        .from('doctor_services')
        .insert({ doctor_id: id, ...draftToPayload(draft), sort_order: nextOrder });
      if (err) throw err;
    });
  };

  const update = async (serviceId: string, draft: ServiceDraft): Promise<ServiceMutationResult> => {
    if (hasServiceErrors(validateServiceDraft(draft))) return { ok: false, reason: 'invalid' };
    return run(async () => {
      const { error: err } = await sb.from('doctor_services').update(draftToPayload(draft)).eq('id', serviceId).eq('doctor_id', id);
      if (err) throw err;
    });
  };

  const setActive = async (serviceId: string, active: boolean): Promise<ServiceMutationResult> =>
    run(async () => {
      const { error: err } = await sb.from('doctor_services').update({ is_active: active }).eq('id', serviceId).eq('doctor_id', id);
      if (err) throw err;
    });

  const remove = async (serviceId: string): Promise<ServiceMutationResult> =>
    run(async () => {
      const { error: err } = await sb.from('doctor_services').delete().eq('id', serviceId).eq('doctor_id', id);
      if (err) throw err;
    });

  /** Sube (-1) o baja (+1) un servicio. Reescribe sort_order solo de las filas que cambian. */
  const move = async (serviceId: string, dir: -1 | 1): Promise<ServiceMutationResult> => {
    const idx = services.findIndex((s) => s.id === serviceId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= services.length) return { ok: true };
    const next = [...services];
    [next[idx], next[target]] = [next[target], next[idx]];
    const changes = next
      .map((s, i) => ({ id: s.id, from: s.sort_order, to: i }))
      .filter((c) => c.from !== c.to);
    setServices(next.map((s, i) => ({ ...s, sort_order: i })));
    return run(async () => {
      for (const c of changes) {
        const { error: err } = await sb.from('doctor_services').update({ sort_order: c.to }).eq('id', c.id).eq('doctor_id', id);
        if (err) throw err;
      }
    });
  };

  return { services, loading, saving, error, pendingActivation, reload: load, create, update, setActive, remove, move };
}

/**
 * Servicios ACTIVOS que ve cualquiera en el perfil público y en la reserva.
 * `owner`: el propio médico lee su tabla (así ve su vista previa aunque su
 * perfil esté en revisión y la RPC pública no devuelva nada).
 */
export function usePublicDoctorServices(doctorId?: string, opts: { owner?: boolean } = {}) {
  const owner = !!opts.owner;
  const [services, setServices] = useState<DoctorService[]>([]);
  const [loading, setLoading] = useState<boolean>(!!doctorId);
  const [pendingActivation, setPendingActivation] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const req = ++reqRef.current;
    if (!doctorId) {
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = owner
      ? await sb
          .from('doctor_services')
          .select(SERVICE_COLUMNS)
          .eq('doctor_id', doctorId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      : await sb.rpc('get_doctor_services', { p_doctor_id: doctorId });
    if (req !== reqRef.current) return;
    if (res.error) {
      const missing = isMissingDbObject(res.error);
      if (!missing) console.error('[usePublicDoctorServices]', res.error);
      setPendingActivation(missing);
      // Sin lista: el perfil y la reserva vuelven a la tarifa única de hoy.
      setServices([]);
    } else {
      setPendingActivation(false);
      setServices(
        (Array.isArray(res.data) ? res.data : [])
          .map(normalizeService)
          .filter((s: DoctorService) => s.is_active && s.id),
      );
    }
    setLoading(false);
  }, [doctorId, owner]);

  useEffect(() => {
    load();
    return () => {
      reqRef.current++;
    };
  }, [load]);

  return { services, loading, pendingActivation, reload: load };
}

export default useDoctorServices;
