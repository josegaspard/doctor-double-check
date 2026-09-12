import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  cleanPerks,
  parsePriceToCents,
  resolveTierPlan,
  validatePlanInput,
  type DoctorSubscriptionPlan,
  type PlanInput,
} from './useDoctorSubscriptionPlans';

const pricing = { basic_cents: 9900, premium_cents: 19900, resident_discount_pct: 50, premium_recording_discount_pct: 20 };
const t = (k: string) => k;

const plan = (patch: Partial<DoctorSubscriptionPlan> = {}): DoctorSubscriptionPlan => ({
  id: 'p1',
  tier: 'basic',
  name: 'Seguimiento cardiovascular',
  description: 'Control mensual',
  price_cents: 49900,
  perks: ['Contenido exclusivo'],
  is_active: true,
  ...patch,
});

const input = (patch: Partial<PlanInput> = {}): PlanInput => ({
  name: 'Seguimiento',
  description: '',
  priceCents: 49900,
  perks: ['Uno'],
  isActive: true,
  ...patch,
});

describe('parsePriceToCents', () => {
  it('convierte importes con punto, coma, signo y MXN', () => {
    expect(parsePriceToCents('499')).toBe(49900);
    expect(parsePriceToCents('499.5')).toBe(49950);
    expect(parsePriceToCents('499,50')).toBe(49950);
    expect(parsePriceToCents('$ 1,200.00')).toBe(120000);
    expect(parsePriceToCents('899 MXN')).toBe(89900);
  });
  it('marca lo que no es un importe', () => {
    expect(Number.isNaN(parsePriceToCents(''))).toBe(true);
    expect(Number.isNaN(parsePriceToCents('abc'))).toBe(true);
    expect(Number.isNaN(parsePriceToCents('-5'))).toBe(true);
    expect(Number.isInteger(parsePriceToCents('10.555'))).toBe(false);
  });
});

describe('validatePlanInput', () => {
  it('acepta un plan completo', () => {
    expect(validatePlanInput(input())).toBeNull();
  });
  it('respeta los límites de la migración', () => {
    expect(validatePlanInput(input({ name: 'ab' }))?.name).toBe('nameShort');
    expect(validatePlanInput(input({ name: 'x'.repeat(PLAN_LIMITS.nameMax + 1) }))?.name).toBe('nameLong');
    expect(validatePlanInput(input({ priceCents: NaN }))?.price).toBe('priceInvalid');
    expect(validatePlanInput(input({ priceCents: 1055.5 }))?.price).toBe('priceDecimals');
    expect(validatePlanInput(input({ priceCents: PLAN_LIMITS.priceMinCents - 1 }))?.price).toBe('priceLow');
    expect(validatePlanInput(input({ priceCents: PLAN_LIMITS.priceMaxCents + 1 }))?.price).toBe('priceHigh');
    expect(validatePlanInput(input({ priceCents: PLAN_LIMITS.priceMinCents }))).toBeNull();
    expect(validatePlanInput(input({ priceCents: PLAN_LIMITS.priceMaxCents }))).toBeNull();
    expect(validatePlanInput(input({ description: 'x'.repeat(281) }))?.description).toBe('descLong');
    expect(validatePlanInput(input({ perks: Array(7).fill('ok') }))?.perks).toBe('perksMax');
    expect(validatePlanInput(input({ perks: ['x'.repeat(81)] }))?.perks).toBe('perkLong');
  });
  it('las ventajas vacías no cuentan', () => {
    expect(cleanPerks(['  ', 'Uno ', ''])).toEqual(['Uno']);
    expect(validatePlanInput(input({ perks: ['a', '', 'b', ' ', 'c', 'd', 'e', 'f'] }))).toBeNull();
  });
});

describe('resolveTierPlan', () => {
  it('sin planes cae en el global de hoy', () => {
    const r = resolveTierPlan('premium', [], pricing, t);
    expect(r.isCustom).toBe(false);
    expect(r.priceCents).toBe(19900);
    expect(r.name).toBe('subscriptions.premiumTierName');
    expect(r.planId).toBeNull();
  });
  it('usa el plan activo del nivel pedido', () => {
    const r = resolveTierPlan('basic', [plan(), plan({ id: 'p2', tier: 'premium', price_cents: 89900 })], pricing, t);
    expect(r.isCustom).toBe(true);
    expect(r.priceCents).toBe(49900);
    expect(r.name).toBe('Seguimiento cardiovascular');
    expect(r.planId).toBe('p1');
  });
  it('un plan desactivado vuelve al global', () => {
    const r = resolveTierPlan('basic', [plan({ is_active: false })], pricing, t);
    expect(r.isCustom).toBe(false);
    expect(r.priceCents).toBe(9900);
  });
});
