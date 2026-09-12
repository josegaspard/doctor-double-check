// Claves de texto de las invitaciones (13-sep-2026): un único mapa para el
// diálogo de importar, el formulario de invitar y las acciones de la tarjeta.
import type { InviteFailure } from '@/hooks/usePatientInvites';

const FAILURE_KEYS: Record<InviteFailure, string> = {
  pending_activation: 'mm2.importar.errors.pendingActivation',
  forbidden: 'mm2.importar.errors.forbidden',
  too_many: 'mm2.importar.errors.tooMany',
  invalid: 'mm2.importar.errors.invalid',
  not_found: 'mm2.importar.errors.notFound',
  not_sendable: 'mm2.importar.errors.notSendable',
  no_email: 'mm2.importar.errors.noEmail',
  recently_sent: 'mm2.importar.errors.recentlySent',
  daily_limit: 'mm2.importar.errors.dailyLimit',
  unavailable: 'mm2.importar.errors.unavailable',
  error: 'mm2.importar.errors.generic',
};

export const failureKey = (reason: InviteFailure) => FAILURE_KEYS[reason] || FAILURE_KEYS.error;

/** Motivo por fila (vista previa y resultado de la RPC). */
const REASON_KEYS: Record<string, string> = {
  name_missing: 'mm2.importar.reason.nameMissing',
  name_too_long: 'mm2.importar.reason.nameTooLong',
  contact_missing: 'mm2.importar.reason.contactMissing',
  email_invalid: 'mm2.importar.reason.emailInvalid',
  phone_invalid: 'mm2.importar.reason.phoneInvalid',
  note_too_long: 'mm2.importar.reason.noteTooLong',
  repeated_in_file: 'mm2.importar.reason.repeatedInFile',
  own_email: 'mm2.importar.reason.ownEmail',
  already_invited: 'mm2.importar.reason.alreadyInvited',
  already_accepted: 'mm2.importar.reason.alreadyAccepted',
  already_patient: 'mm2.importar.reason.alreadyPatient',
  reactivated: 'mm2.importar.reason.reactivated',
};

export const reasonKey = (reason?: string | null) => (reason && REASON_KEYS[reason]) || 'mm2.importar.reason.invalid';

/** Duplicada (ámbar) o inválida (roja). */
export const isDuplicateReason = (reason?: string | null) =>
  reason === 'repeated_in_file' || reason === 'already_invited' || reason === 'already_accepted' || reason === 'already_patient';
