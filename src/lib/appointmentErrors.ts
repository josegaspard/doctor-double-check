// Códigos que lanza fn_guard_patient_appointment (migraciones 20261003*). Postgres los
// devuelve tal cual en error.message; aquí se cambian por un texto legible en el idioma
// de la sesión. Un error que no sea de citas se muestra como venía.
const APPOINTMENT_ERROR_CODES = [
  'appointment_cancel_too_late',
  'appointment_patient_status_forbidden',
  'appointment_patient_cannot_modify',
  'slot_taken',
  'slot_blocked',
  'slot_unavailable',
  'outside_schedule',
  'invalid_datetime',
  'invalid_duration',
] as const;

export function appointmentErrorMessage(error: { message?: string } | null | undefined, t: (path: string) => string): string {
  const raw = String(error?.message || '');
  const code = APPOINTMENT_ERROR_CODES.find((c) => raw.includes(c));
  return code ? t(`myAppointments.errors.${code}`) : raw;
}

/** El paciente no puede cancelar (ni reprogramar) una cita confirmada a menos de 2 h. */
export const PATIENT_CHANGE_CUTOFF_MS = 2 * 60 * 60 * 1000;

export function isConfirmedTooLate(status: string, scheduledAt: string, now = Date.now()): boolean {
  return status === 'confirmed' && new Date(scheduledAt).getTime() < now + PATIENT_CHANGE_CUTOFF_MS;
}
