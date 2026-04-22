/**
 * Reusable fixtures for e2e/unit tests.
 *
 * All factories accept partial overrides and return deterministic objects
 * (incremental IDs scoped per test file via `resetFixtureIds()` in beforeEach).
 *
 * The aim is: ZERO duplication of mock data across the e2e suite. If a schema
 * changes, only this file needs to be updated.
 */

let counters: Record<string, number> = {};

function nextId(kind: string): string {
  counters[kind] = (counters[kind] || 0) + 1;
  return `fixture_${kind}_${counters[kind]}`;
}

/** Call from `beforeEach` to make IDs deterministic per test. */
export function resetFixtureIds() {
  counters = {};
}

// ============================================================================
// Users
// ============================================================================

export type FixtureRole = 'patient' | 'doctor' | 'resident' | 'admin' | 'visitor';

export interface FixtureUser {
  id: string;
  email: string;
  name: string;
  role: FixtureRole;
  doctorStatus?: 'pending' | 'approved' | 'rejected';
}

export function makeUser(overrides: Partial<FixtureUser> & { role?: FixtureRole } = {}): FixtureUser {
  const role = overrides.role ?? 'patient';
  const id = overrides.id ?? nextId(`user_${role}`);
  return {
    id,
    email: overrides.email ?? `${id}@test.local`,
    name: overrides.name ?? `Test ${role}`,
    role,
    doctorStatus: overrides.doctorStatus,
  };
}

// ============================================================================
// Profiles
// ============================================================================

export interface FixtureDoctorProfile {
  id: string;
  user_id: string;
  license: string;
  specialty: string;
  consultation_fee: number;
  status: 'pending' | 'approved' | 'rejected';
  cedula_status: 'pending' | 'approved' | 'rejected' | null;
  cedula_rejection_reason: string | null;
  cofepris_status: 'pending' | 'approved' | 'rejected' | null;
  cofepris_rejection_reason: string | null;
  cedula_profesional: string | null;
  cofepris_permit: string | null;
  rating: number;
  total_consultations: number;
}

export function makeDoctorProfile(
  overrides: Partial<FixtureDoctorProfile> = {}
): FixtureDoctorProfile {
  const id = overrides.id ?? nextId('doctor_profile');
  return {
    id,
    user_id: overrides.user_id ?? nextId('user_doctor'),
    license: overrides.license ?? 'LIC-12345',
    specialty: overrides.specialty ?? 'Cardiología',
    consultation_fee: overrides.consultation_fee ?? 350,
    status: overrides.status ?? 'approved',
    cedula_status: overrides.cedula_status ?? 'approved',
    cedula_rejection_reason: overrides.cedula_rejection_reason ?? null,
    cofepris_status: overrides.cofepris_status ?? 'approved',
    cofepris_rejection_reason: overrides.cofepris_rejection_reason ?? null,
    cedula_profesional: overrides.cedula_profesional ?? '12345678',
    cofepris_permit: overrides.cofepris_permit ?? 'COF-789',
    rating: overrides.rating ?? 4.8,
    total_consultations: overrides.total_consultations ?? 25,
  };
}

export interface FixturePatientProfile {
  id: string;
  name: string;
  email: string;
  role: 'patient';
}

export function makePatientProfile(overrides: Partial<FixturePatientProfile> = {}): FixturePatientProfile {
  const id = overrides.id ?? nextId('patient');
  return {
    id,
    name: overrides.name ?? 'Paciente Demo',
    email: overrides.email ?? `${id}@test.local`,
    role: 'patient',
  };
}

// ============================================================================
// Recordings
// ============================================================================

export interface FixtureRecording {
  id: string;
  doctor_id: string;
  title: string;
  description: string;
  is_public: boolean;
  price: number;
  duration: number;
  video_url: string;
  specialty: string;
  created_at: string;
}

export function makeRecording(overrides: Partial<FixtureRecording> = {}): FixtureRecording {
  const id = overrides.id ?? nextId('recording');
  return {
    id,
    doctor_id: overrides.doctor_id ?? nextId('user_doctor'),
    title: overrides.title ?? 'Sesión clínica de ejemplo',
    description: overrides.description ?? 'Descripción de la grabación',
    is_public: overrides.is_public ?? false,
    price: overrides.price ?? 150,
    duration: overrides.duration ?? 1800,
    video_url: overrides.video_url ?? `storage:recordings/${id}.mp4`,
    specialty: overrides.specialty ?? 'Cardiología',
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

// ============================================================================
// Vault
// ============================================================================

export interface FixtureVaultFile {
  id: string;
  patient_id: string;
  name: string;
  file_type: 'pdf' | 'image' | 'study';
  file_size: number;
  file_url: string;
  category: string;
  description: string | null;
  created_at: string;
}

export function makeVaultFile(overrides: Partial<FixtureVaultFile> = {}): FixtureVaultFile {
  const id = overrides.id ?? nextId('vault_file');
  return {
    id,
    patient_id: overrides.patient_id ?? nextId('patient'),
    name: overrides.name ?? 'estudio_laboratorio.pdf',
    file_type: overrides.file_type ?? 'pdf',
    file_size: overrides.file_size ?? 1024 * 200,
    file_url: overrides.file_url ?? `vault/${id}`,
    category: overrides.category ?? 'lab',
    description: overrides.description ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

export type VaultAuditAction =
  | 'accessed'
  | 'access_denied'
  | 'access_granted'
  | 'access_revoked'
  | 'otp_required'
  | 'otp_failed'
  | 'otp_verified'
  | 'uploaded'
  | 'viewed';

export interface FixtureVaultAuditEvent {
  id: string;
  file_id: string | null;
  actor_id: string | null;
  patient_id: string;
  action: VaultAuditAction;
  metadata: Record<string, any>;
  created_at: string;
}

export function makeVaultAuditEvent(
  overrides: Partial<FixtureVaultAuditEvent> = {}
): FixtureVaultAuditEvent {
  const id = overrides.id ?? nextId('vault_audit');
  return {
    id,
    file_id: overrides.file_id ?? nextId('vault_file'),
    actor_id: overrides.actor_id ?? nextId('user_doctor'),
    patient_id: overrides.patient_id ?? nextId('patient'),
    action: overrides.action ?? 'accessed',
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

/** Generate N audit events with monotonically increasing timestamps (DESC ordering friendly). */
export function makeAuditBurst(
  count: number,
  base: Partial<FixtureVaultAuditEvent> = {}
): FixtureVaultAuditEvent[] {
  const startMs = Date.now() - count * 1000;
  return Array.from({ length: count }).map((_, i) =>
    makeVaultAuditEvent({
      ...base,
      created_at: new Date(startMs + i * 1000).toISOString(),
    })
  );
}

// ============================================================================
// Chat & Entitlements
// ============================================================================

export interface FixtureChatSession {
  id: string;
  participant1Id: string;
  participant1Type: 'patient' | 'doctor' | 'resident';
  participant2Id: string;
  participant2Type: 'patient' | 'doctor' | 'resident';
  status: 'active' | 'closed';
  is_double_check: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count_1: number;
  unread_count_2: number;
}

export function makeChatSession(
  overrides: Partial<FixtureChatSession> = {}
): FixtureChatSession {
  const id = overrides.id ?? nextId('chat_session');
  return {
    id,
    participant1Id: overrides.participant1Id ?? nextId('patient'),
    participant1Type: overrides.participant1Type ?? 'patient',
    participant2Id: overrides.participant2Id ?? nextId('user_doctor'),
    participant2Type: overrides.participant2Type ?? 'doctor',
    status: overrides.status ?? 'active',
    is_double_check: overrides.is_double_check ?? false,
    last_message: overrides.last_message ?? null,
    last_message_at: overrides.last_message_at ?? null,
    unread_count_1: overrides.unread_count_1 ?? 0,
    unread_count_2: overrides.unread_count_2 ?? 0,
  };
}

export interface FixtureEntitlement {
  id: string;
  user_id: string;
  type: 'chat' | 'recording' | 'subscription';
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function makeEntitlement(
  overrides: Partial<FixtureEntitlement> = {}
): FixtureEntitlement {
  const id = overrides.id ?? nextId('entitlement');
  return {
    id,
    user_id: overrides.user_id ?? nextId('patient'),
    type: overrides.type ?? 'chat',
    is_active: overrides.is_active ?? true,
    expires_at:
      overrides.expires_at ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}
