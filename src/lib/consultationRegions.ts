// Restricción geográfica del negocio de consultas (cliente 2026-06-29):
// "Por ahora solo México" — solo pacientes/doctores mexicanos pueden agendar/dar
// consultas. Para abrir a más países, agrega su código ISO-2 a la lista.
export const CONSULTATION_ALLOWED_COUNTRIES = ['MX'];

/**
 * ¿Puede este país agendar/dar consultas?
 * Regla segura: solo bloqueamos cuando el país es EXPLÍCITAMENTE uno no permitido.
 * Si el país es desconocido (usuarios antiguos sin country_code) NO bloqueamos,
 * para no romper cuentas mexicanas existentes que se registraron antes del campo.
 */
export function isConsultationCountryAllowed(countryCode?: string | null): boolean {
  if (!countryCode) return true;
  return CONSULTATION_ALLOWED_COUNTRIES.includes(countryCode.toUpperCase());
}
