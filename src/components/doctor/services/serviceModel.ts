// Modelo de «Servicios y precios» del médico (F1 servicios, 12-sep-2026).
//
// Funciones puras (sin Supabase ni React) que comparten el editor de la cuenta,
// el perfil público y la reserva. Los límites son los mismos CHECK de la
// migración 20260913a_servicios_medico.sql: si cambian aquí, cambian allí.

export const SERVICE_MODALITIES = ['online', 'presencial', 'ambas'] as const;
export type ServiceModality = (typeof SERVICE_MODALITIES)[number];

export const SERVICE_ICON_IDS = ['video', 'user', 'file', 'stethoscope', 'heart', 'clipboard'] as const;
export type ServiceIconId = (typeof SERVICE_ICON_IDS)[number];

export const SERVICE_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  descriptionMax: 200,
  durationMin: 10,
  durationMax: 240,
  priceMax: 999999,
  /** Tope del editor para que el perfil público siga siendo legible. */
  maxServices: 20,
} as const;

/** Atajos de duración del editor (el campo acepta cualquier entero de 10 a 240). */
export const DURATION_PRESETS = [15, 30, 45, 60, 90] as const;

export interface DoctorService {
  id: string;
  doctor_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  /** MXN */
  price: number;
  modality: ServiceModality;
  icon: ServiceIconId;
  sort_order: number;
  is_active: boolean;
}

/** Lo que edita el formulario: texto tal cual lo escribe el médico. */
export interface ServiceDraft {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  modality: ServiceModality;
  icon: ServiceIconId;
  is_active: boolean;
}

export type ServiceField = 'name' | 'description' | 'duration_minutes' | 'price' | 'modality' | 'icon';
export type ServiceFieldError =
  | 'required'
  | 'tooShort'
  | 'tooLong'
  | 'notInteger'
  | 'outOfRange'
  | 'notNumber'
  | 'tooManyDecimals'
  | 'invalidOption';
export type ServiceErrors = Partial<Record<ServiceField, ServiceFieldError>>;

export interface ServicePayload {
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  modality: ServiceModality;
  icon: ServiceIconId;
  is_active: boolean;
}

export const isServiceModality = (v: unknown): v is ServiceModality =>
  typeof v === 'string' && (SERVICE_MODALITIES as readonly string[]).includes(v);

export const isServiceIconId = (v: unknown): v is ServiceIconId =>
  typeof v === 'string' && (SERVICE_ICON_IDS as readonly string[]).includes(v);

export const emptyServiceDraft = (): ServiceDraft => ({
  name: '',
  description: '',
  duration_minutes: '30',
  price: '',
  modality: 'online',
  icon: 'stethoscope',
  is_active: true,
});

export const draftFromService = (s: DoctorService): ServiceDraft => ({
  name: s.name,
  description: s.description || '',
  duration_minutes: String(s.duration_minutes),
  price: String(s.price),
  modality: s.modality,
  icon: s.icon,
  is_active: s.is_active,
});

/** Fila de la base (tabla o RPC) → servicio con tipos seguros. */
export function normalizeService(r: any): DoctorService {
  return {
    id: String(r?.id ?? ''),
    doctor_id: String(r?.doctor_id ?? ''),
    name: String(r?.name ?? ''),
    description: r?.description ? String(r.description) : null,
    duration_minutes: Number(r?.duration_minutes) || 30,
    price: Math.max(0, Number(r?.price) || 0),
    modality: isServiceModality(r?.modality) ? r.modality : 'online',
    icon: isServiceIconId(r?.icon) ? r.icon : 'stethoscope',
    sort_order: Number(r?.sort_order) || 0,
    is_active: r?.is_active !== false,
  };
}

const parseDecimal = (raw: string): number | null => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
};

export function validateServiceDraft(d: ServiceDraft): ServiceErrors {
  const errors: ServiceErrors = {};

  const name = (d.name || '').trim();
  if (!name) errors.name = 'required';
  else if (name.length < SERVICE_LIMITS.nameMin) errors.name = 'tooShort';
  else if (name.length > SERVICE_LIMITS.nameMax) errors.name = 'tooLong';

  if ((d.description || '').trim().length > SERVICE_LIMITS.descriptionMax) errors.description = 'tooLong';

  const durRaw = String(d.duration_minutes ?? '').trim();
  if (!durRaw) errors.duration_minutes = 'required';
  else if (!/^\d+$/.test(durRaw)) errors.duration_minutes = 'notInteger';
  else {
    const dur = Number(durRaw);
    if (dur < SERVICE_LIMITS.durationMin || dur > SERVICE_LIMITS.durationMax) errors.duration_minutes = 'outOfRange';
  }

  const priceRaw = String(d.price ?? '').trim();
  const price = parseDecimal(priceRaw);
  if (price === null) errors.price = 'required';
  else if (Number.isNaN(price)) errors.price = 'notNumber';
  else if (/\.\d{3,}$/.test(priceRaw)) errors.price = 'tooManyDecimals';
  else if (price < 0 || price > SERVICE_LIMITS.priceMax) errors.price = 'outOfRange';

  if (!isServiceModality(d.modality)) errors.modality = 'invalidOption';
  if (!isServiceIconId(d.icon)) errors.icon = 'invalidOption';

  return errors;
}

export const hasServiceErrors = (e: ServiceErrors) => Object.keys(e).length > 0;

/** Solo para borradores ya validados. */
export function draftToPayload(d: ServiceDraft): ServicePayload {
  const description = (d.description || '').trim();
  return {
    name: (d.name || '').trim().replace(/\s+/g, ' '),
    description: description ? description : null,
    duration_minutes: Number(String(d.duration_minutes).trim()),
    price: Math.round(Number(String(d.price).trim()) * 100) / 100,
    modality: d.modality,
    icon: d.icon,
    is_active: !!d.is_active,
  };
}

/** Precio más bajo de los servicios activos («Consultas desde»), o null si no hay. */
export function minServicePrice(services: Pick<DoctorService, 'price' | 'is_active'>[]): number | null {
  const prices = services.filter((s) => s.is_active !== false).map((s) => Number(s.price)).filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

export type ModalitySummary = 'online' | 'presencial' | 'both' | null;

/** Cómo atiende según sus servicios activos reales. */
export function summarizeModalities(services: Pick<DoctorService, 'modality' | 'is_active'>[]): ModalitySummary {
  const active = services.filter((s) => s.is_active !== false);
  if (!active.length) return null;
  const online = active.some((s) => s.modality === 'online' || s.modality === 'ambas');
  const inPerson = active.some((s) => s.modality === 'presencial' || s.modality === 'ambas');
  if (online && inPerson) return 'both';
  return online ? 'online' : 'presencial';
}
