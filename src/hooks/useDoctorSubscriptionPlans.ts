// Planes de suscripción con nombre propio por médico (F2 «planes», 13-sep-2026).
//
// Fuente: tabla doctor_subscription_plans (migración 20260913b_planes_suscripcion).
// El modelo de niveles NO cambia: cada médico personaliza SUS dos niveles
// (basic / premium). Si un nivel no tiene plan activo, se muestra y se cobra lo
// de hoy: nombre «Básico/Premium» y precio global (useSubscriptionPricing).
//
// Dos modos:
//   · scope 'public' (por defecto): RPC get_doctor_subscription_plans, solo planes
//     activos. Caché por médico de 60 s compartida entre la tarjeta del perfil y
//     los botones de suscripción de la misma página.
//   · scope 'owner': SELECT directo con RLS de dueño (incluye desactivados) y
//     savePlan() para crear o modificar.
//
// Antes de aplicar la migración la tabla y la RPC no existen: el hook marca
// `pendingActivation` y devuelve 0 planes, así que todo cae en los planes
// globales de hoy (lo mismo que hace la Edge Function create-subscription-checkout).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';
import type { SubscriptionPricing } from '@/hooks/useSubscriptionPricing';

const sb = supabase as any;

export type PlanTier = 'basic' | 'premium';
export const PLAN_TIERS: readonly PlanTier[] = ['basic', 'premium'];

/** Mismos límites que los CHECK de la migración. */
export const PLAN_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  descMax: 280,
  perkMax: 80,
  perksMax: 6,
  priceMinCents: 1000,
  priceMaxCents: 500000,
} as const;

export interface DoctorSubscriptionPlan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  price_cents: number;
  perks: string[];
  /** En scope 'public' siempre true (la RPC solo devuelve activos). */
  is_active: boolean;
  updated_at?: string | null;
}

/** Lo que se pinta y se cobra para un nivel: el plan del médico o el global de hoy. */
export interface ResolvedTierPlan {
  tier: PlanTier;
  name: string;
  description: string;
  priceCents: number;
  perks: string[];
  isCustom: boolean;
  planId: string | null;
}

export interface PlanInput {
  name: string;
  description: string;
  /** Centavos (NaN si el campo no es un número). */
  priceCents: number;
  perks: string[];
  isActive: boolean;
}

export type PlanField = 'name' | 'price' | 'description' | 'perks';
export type PlanFieldError =
  | 'nameShort' | 'nameLong'
  | 'priceInvalid' | 'priceDecimals' | 'priceLow' | 'priceHigh'
  | 'descLong'
  | 'perksMax' | 'perkLong';

export type PlanSaveResult =
  | { ok: true; plan: DoctorSubscriptionPlan }
  | { ok: false; reason: 'pending_activation' | 'invalid' | 'forbidden' | 'error'; fields?: Partial<Record<PlanField, PlanFieldError>>; error?: any };

type T = (path: string) => string;

// ------------------------------------------------------------------ helpers puros

const isTier = (v: unknown): v is PlanTier => v === 'basic' || v === 'premium';

function normalizeRow(r: any): DoctorSubscriptionPlan | null {
  if (!r || !isTier(r.tier)) return null;
  const cents = Number(r.price_cents);
  if (!Number.isFinite(cents)) return null;
  return {
    id: String(r.id),
    tier: r.tier,
    name: String(r.name ?? ''),
    description: r.description ?? null,
    price_cents: Math.round(cents),
    perks: Array.isArray(r.perks) ? r.perks.map((p: unknown) => String(p ?? '')).filter(Boolean) : [],
    is_active: r.is_active === undefined ? true : !!r.is_active,
    updated_at: r.updated_at ?? null,
  };
}

/** Ventajas globales de hoy (las mismas que enseñaba la tarjeta del perfil). */
export function globalTierPerks(tier: PlanTier, t: T): string[] {
  return tier === 'basic'
    ? [t('subscriptions.exclusiveContent'), t('subscriptions.priorityNotifications'), t('subscriptions.subscriberBadge')]
    : [t('subscriptions.allBasicFeatures'), t('subscriptions.recordingDiscount'), t('subscriptions.priorityChat')];
}

export function globalTierPlan(tier: PlanTier, pricing: SubscriptionPricing, t: T): ResolvedTierPlan {
  return {
    tier,
    name: tier === 'basic' ? t('subscriptions.basicTierName') : t('subscriptions.premiumTierName'),
    description: tier === 'basic' ? t('subscriptions.basicTierDescription') : t('subscriptions.premiumTierDescription'),
    priceCents: tier === 'basic' ? pricing.basic_cents : pricing.premium_cents,
    perks: globalTierPerks(tier, t),
    isCustom: false,
    planId: null,
  };
}

/** Plan ACTIVO del médico para ese nivel o, si no hay, el global de hoy. */
export function resolveTierPlan(
  tier: PlanTier,
  plans: DoctorSubscriptionPlan[] | null | undefined,
  pricing: SubscriptionPricing,
  t: T,
): ResolvedTierPlan {
  const plan = (plans || []).find(p => p.tier === tier && p.is_active);
  if (!plan) return globalTierPlan(tier, pricing, t);
  const std = globalTierPlan(tier, pricing, t);
  return {
    tier,
    name: plan.name.trim() || std.name,
    description: (plan.description || '').trim(),
    priceCents: plan.price_cents,
    perks: plan.perks,
    isCustom: true,
    planId: plan.id,
  };
}

/** «499», «499.5», «499,50», «$ 1200» → centavos. NaN si no es un importe. */
export function parsePriceToCents(raw: string): number {
  const s = String(raw ?? '').replace(/[\s$]/g, '').replace(/MXN/i, '');
  if (!s) return NaN;
  // Coma decimal solo si no hay punto (el input numérico ya usa punto).
  const normalized = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  const cents = n * 100;
  // Más de dos decimales → no entero en centavos.
  return Math.abs(cents - Math.round(cents)) < 1e-6 ? Math.round(cents) : cents;
}

export function cleanPerks(perks: string[]): string[] {
  return (perks || []).map(p => String(p ?? '').trim()).filter(Boolean);
}

/** Validación de campo (misma regla que los CHECK). null = todo bien. */
export function validatePlanInput(input: PlanInput): Partial<Record<PlanField, PlanFieldError>> | null {
  const out: Partial<Record<PlanField, PlanFieldError>> = {};
  const name = (input.name || '').trim();
  if (name.length < PLAN_LIMITS.nameMin) out.name = 'nameShort';
  else if (name.length > PLAN_LIMITS.nameMax) out.name = 'nameLong';

  const c = input.priceCents;
  if (!Number.isFinite(c)) out.price = 'priceInvalid';
  else if (!Number.isInteger(c)) out.price = 'priceDecimals';
  else if (c < PLAN_LIMITS.priceMinCents) out.price = 'priceLow';
  else if (c > PLAN_LIMITS.priceMaxCents) out.price = 'priceHigh';

  if ((input.description || '').trim().length > PLAN_LIMITS.descMax) out.description = 'descLong';

  const perks = cleanPerks(input.perks);
  if (perks.length > PLAN_LIMITS.perksMax) out.perks = 'perksMax';
  else if (perks.some(p => p.length > PLAN_LIMITS.perkMax)) out.perks = 'perkLong';

  return Object.keys(out).length ? out : null;
}

// ------------------------------------------------------------ caché (scope public)

interface CacheEntry { at: number; plans: DoctorSubscriptionPlan[]; pending: boolean; failed: boolean }
const TTL_MS = 60_000;
const publicCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();
const subscribers = new Set<(doctorId: string) => void>();

async function fetchPublicPlans(doctorId: string, force = false): Promise<CacheEntry> {
  const hit = publicCache.get(doctorId);
  if (!force && hit && !hit.failed && Date.now() - hit.at < TTL_MS) return hit;
  const running = inflight.get(doctorId);
  if (running) return running;

  const job = (async (): Promise<CacheEntry> => {
    try {
      const { data, error } = await sb.rpc('get_doctor_subscription_plans', { p_doctor_id: doctorId });
      if (error) {
        const pending = isMissingDbObject(error);
        if (!pending) console.error('[useDoctorSubscriptionPlans] get_doctor_subscription_plans', error);
        // Un fallo de red NO se guarda como «sin planes»: se reintenta en el siguiente uso.
        const entry = { at: Date.now(), plans: [], pending, failed: !pending };
        if (pending) publicCache.set(doctorId, entry);
        return entry;
      }
      const plans = (Array.isArray(data) ? data : []).map(normalizeRow).filter(Boolean) as DoctorSubscriptionPlan[];
      const entry = { at: Date.now(), plans, pending: false, failed: false };
      publicCache.set(doctorId, entry);
      return entry;
    } catch (err) {
      console.error('[useDoctorSubscriptionPlans] get_doctor_subscription_plans', err);
      return { at: Date.now(), plans: [], pending: false, failed: true };
    } finally {
      inflight.delete(doctorId);
    }
  })();
  inflight.set(doctorId, job);
  return job;
}

/** Olvida la caché de un médico y avisa a los hooks montados para que recarguen. */
export function invalidateDoctorPlans(doctorId: string) {
  publicCache.delete(doctorId);
  subscribers.forEach(fn => fn(doctorId));
}

// ------------------------------------------------------------------------- hook

export function useDoctorSubscriptionPlans(doctorId?: string | null, options: { scope?: 'public' | 'owner' } = {}) {
  const scope = options.scope ?? 'public';
  const cached = scope === 'public' && doctorId ? publicCache.get(doctorId) : undefined;
  const [plans, setPlans] = useState<DoctorSubscriptionPlan[]>(cached?.plans ?? []);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [pendingActivation, setPendingActivation] = useState<boolean>(!!cached?.pending);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!doctorId) { setPlans([]); setLoading(false); return; }
    setError(null);

    if (scope === 'public') {
      const entry = await fetchPublicPlans(doctorId, force);
      setPlans(entry.plans);
      setPendingActivation(entry.pending);
      if (entry.failed) setError('load_failed');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: err } = await sb
      .from('doctor_subscription_plans')
      .select('id, tier, name, description, price_cents, perks, is_active, updated_at')
      .eq('doctor_id', doctorId);
    if (err) {
      if (isMissingDbObject(err)) {
        setPendingActivation(true);
        setPlans([]);
      } else {
        console.error('[useDoctorSubscriptionPlans] owner select', err);
        setError(err.message || 'load_failed');
      }
      setLoading(false);
      return;
    }
    setPendingActivation(false);
    setPlans(((data || []).map(normalizeRow).filter(Boolean) as DoctorSubscriptionPlan[]));
    setLoading(false);
  }, [doctorId, scope]);

  useEffect(() => { load(); }, [load]);

  // Si otro componente guarda un plan de este médico, este hook recarga.
  useEffect(() => {
    if (!doctorId) return;
    const onChange = (id: string) => { if (id === doctorId) load(true); };
    subscribers.add(onChange);
    return () => { subscribers.delete(onChange); };
  }, [doctorId, load]);

  /**
   * Planes activos recién leídos de la base, sin caché. Se usa justo antes de
   * enseñar el resumen de pago: el precio del modal tiene que ser el que cobra
   * la Edge Function. `ok: false` = no se pudo confirmar (no enseñar precio).
   */
  const fetchFresh = useCallback(async (): Promise<{ ok: boolean; plans: DoctorSubscriptionPlan[]; pending: boolean }> => {
    if (!doctorId) return { ok: true, plans: [], pending: false };
    const entry = await fetchPublicPlans(doctorId, true);
    if (entry.failed) return { ok: false, plans: [], pending: false };
    if (scope === 'public') {
      setPlans(entry.plans);
      setPendingActivation(entry.pending);
    }
    return { ok: true, plans: entry.plans, pending: entry.pending };
  }, [doctorId, scope]);

  /** Crea o modifica el plan de un nivel (UPSERT por doctor_id + tier). */
  const savePlan = useCallback(async (tier: PlanTier, input: PlanInput): Promise<PlanSaveResult> => {
    if (!doctorId) return { ok: false, reason: 'forbidden' };
    if (pendingActivation) return { ok: false, reason: 'pending_activation' };
    const fields = validatePlanInput(input);
    if (fields) return { ok: false, reason: 'invalid', fields };

    const description = (input.description || '').trim();
    const row = {
      doctor_id: doctorId,
      tier,
      name: input.name.trim(),
      description: description || null,
      price_cents: input.priceCents,
      perks: cleanPerks(input.perks),
      is_active: !!input.isActive,
    };

    setSaving(true);
    try {
      const { data, error: err } = await sb
        .from('doctor_subscription_plans')
        .upsert(row, { onConflict: 'doctor_id,tier' })
        .select('id, tier, name, description, price_cents, perks, is_active, updated_at')
        .single();
      if (err) throw err;
      const saved = normalizeRow(data);
      invalidateDoctorPlans(doctorId);
      if (scope === 'owner') await load(true);
      return saved ? { ok: true, plan: saved } : { ok: false, reason: 'error' };
    } catch (err: any) {
      if (isMissingDbObject(err)) {
        setPendingActivation(true);
        return { ok: false, reason: 'pending_activation', error: err };
      }
      console.error('[useDoctorSubscriptionPlans] savePlan', err);
      const code = String(err?.code || '');
      return {
        ok: false,
        reason: code === '42501' ? 'forbidden' : ['23514', '23505', '22P02'].includes(code) ? 'invalid' : 'error',
        error: err,
      };
    } finally {
      setSaving(false);
    }
  }, [doctorId, pendingActivation, scope, load]);

  return { plans, loading, saving, error, pendingActivation, reload: () => load(true), fetchFresh, savePlan };
}

export default useDoctorSubscriptionPlans;
