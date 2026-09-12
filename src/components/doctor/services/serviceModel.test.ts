import { describe, expect, it } from 'vitest';
import {
  draftToPayload,
  emptyServiceDraft,
  minServicePrice,
  normalizeService,
  summarizeModalities,
  validateServiceDraft,
  type ServiceDraft,
} from './serviceModel';

const draft = (patch: Partial<ServiceDraft> = {}): ServiceDraft => ({
  ...emptyServiceDraft(),
  name: 'Consulta inicial',
  price: '1200',
  ...patch,
});

describe('validateServiceDraft', () => {
  it('acepta un servicio completo', () => {
    expect(validateServiceDraft(draft())).toEqual({});
  });

  it('exige nombre de 2 a 80 caracteres', () => {
    expect(validateServiceDraft(draft({ name: '  ' })).name).toBe('required');
    expect(validateServiceDraft(draft({ name: 'A' })).name).toBe('tooShort');
    expect(validateServiceDraft(draft({ name: 'x'.repeat(81) })).name).toBe('tooLong');
  });

  it('limita la descripción a 200 caracteres', () => {
    expect(validateServiceDraft(draft({ description: 'x'.repeat(201) })).description).toBe('tooLong');
  });

  it('duración entera de 10 a 240', () => {
    expect(validateServiceDraft(draft({ duration_minutes: '' })).duration_minutes).toBe('required');
    expect(validateServiceDraft(draft({ duration_minutes: '30.5' })).duration_minutes).toBe('notInteger');
    expect(validateServiceDraft(draft({ duration_minutes: '5' })).duration_minutes).toBe('outOfRange');
    expect(validateServiceDraft(draft({ duration_minutes: '241' })).duration_minutes).toBe('outOfRange');
    expect(validateServiceDraft(draft({ duration_minutes: '240' })).duration_minutes).toBeUndefined();
  });

  it('precio obligatorio, ≥ 0, con dos decimales como mucho', () => {
    expect(validateServiceDraft(draft({ price: '' })).price).toBe('required');
    expect(validateServiceDraft(draft({ price: '-1' })).price).toBe('notNumber');
    expect(validateServiceDraft(draft({ price: 'abc' })).price).toBe('notNumber');
    expect(validateServiceDraft(draft({ price: '10.555' })).price).toBe('tooManyDecimals');
    expect(validateServiceDraft(draft({ price: '1000000' })).price).toBe('outOfRange');
    expect(validateServiceDraft(draft({ price: '0' })).price).toBeUndefined();
    expect(validateServiceDraft(draft({ price: '750.50' })).price).toBeUndefined();
  });

  it('rechaza modalidad o icono fuera de la lista', () => {
    expect(validateServiceDraft(draft({ modality: 'x' as any })).modality).toBe('invalidOption');
    expect(validateServiceDraft(draft({ icon: 'x' as any })).icon).toBe('invalidOption');
  });
});

describe('draftToPayload', () => {
  it('recorta textos y convierte números', () => {
    expect(draftToPayload(draft({ name: '  Segunda   opinión ', description: '  ', duration_minutes: '45', price: '950' }))).toEqual({
      name: 'Segunda opinión',
      description: null,
      duration_minutes: 45,
      price: 950,
      modality: 'online',
      icon: 'stethoscope',
      is_active: true,
    });
  });
});

describe('resúmenes para el perfil público', () => {
  const svc = (price: number, modality: any, is_active = true) =>
    normalizeService({ id: String(price), price, modality, is_active });

  it('«Consultas desde» = el precio más bajo de los activos', () => {
    expect(minServicePrice([svc(1200, 'online'), svc(750, 'online'), svc(100, 'online', false)])).toBe(750);
    expect(minServicePrice([])).toBeNull();
  });

  it('modalidades reales', () => {
    expect(summarizeModalities([])).toBeNull();
    expect(summarizeModalities([svc(1, 'online')])).toBe('online');
    expect(summarizeModalities([svc(1, 'presencial')])).toBe('presencial');
    expect(summarizeModalities([svc(1, 'online'), svc(2, 'presencial')])).toBe('both');
    expect(summarizeModalities([svc(1, 'ambas')])).toBe('both');
    expect(summarizeModalities([svc(1, 'online'), svc(2, 'presencial', false)])).toBe('online');
  });

  it('normaliza filas raras sin romper', () => {
    const s = normalizeService({ id: 1, price: '99.5', duration_minutes: null, modality: 'x', icon: 'x' });
    expect(s).toMatchObject({ id: '1', price: 99.5, duration_minutes: 30, modality: 'online', icon: 'stethoscope', is_active: true });
  });
});
