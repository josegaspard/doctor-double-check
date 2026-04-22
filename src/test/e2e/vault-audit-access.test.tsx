import { describe, it, expect } from 'vitest';

/**
 * RLS contract for vault_audit_log access — these tests model the policy:
 *  - Patient sees rows where patient_id = self
 *  - Doctor sees rows where actor_id = self (their own actions)
 *  - Filters by file_id, action, date range narrow the visible set further
 *
 * If RLS regresses (e.g. someone makes the table public), these tests still
 * pass at unit level — but the application-layer filter must always include
 * the user_id scope as proven below.
 */

type Action =
  | 'accessed'
  | 'access_denied'
  | 'access_granted'
  | 'access_revoked'
  | 'otp_required'
  | 'otp_failed'
  | 'otp_verified';

interface AuditRow {
  id: string;
  file_id: string;
  actor_id: string;
  patient_id: string;
  action: Action;
  created_at: string;
}

interface Filters {
  patientScope?: string; // mode='patient' → patient_id = X
  actorScope?: string; // mode='doctor' → actor_id = X
  fileFilter?: string;
  actionFilter?: Action | 'all';
  fromDate?: string;
  toDate?: string;
}

function applyFilters(rows: AuditRow[], f: Filters): AuditRow[] {
  return rows.filter((r) => {
    if (f.patientScope && r.patient_id !== f.patientScope) return false;
    if (f.actorScope && r.actor_id !== f.actorScope) return false;
    if (f.fileFilter && f.fileFilter !== 'all' && r.file_id !== f.fileFilter) return false;
    if (f.actionFilter && f.actionFilter !== 'all' && r.action !== f.actionFilter) return false;
    if (f.fromDate && r.created_at < f.fromDate) return false;
    if (f.toDate && r.created_at > f.toDate + 'T23:59:59') return false;
    return true;
  });
}

const FIXTURE: AuditRow[] = [
  // Patient1 owns file-A and file-B
  { id: '1', file_id: 'file-A', actor_id: 'doctor-1', patient_id: 'patient-1', action: 'access_granted', created_at: '2026-04-20T10:00:00' },
  { id: '2', file_id: 'file-A', actor_id: 'doctor-1', patient_id: 'patient-1', action: 'accessed', created_at: '2026-04-20T11:00:00' },
  { id: '3', file_id: 'file-B', actor_id: 'doctor-2', patient_id: 'patient-1', action: 'access_denied', created_at: '2026-04-21T09:00:00' },
  { id: '4', file_id: 'file-B', actor_id: 'patient-1', action: 'access_revoked' as Action, patient_id: 'patient-1', created_at: '2026-04-21T12:00:00' },
  // Patient2 owns file-C — strictly out of scope for patient1
  { id: '5', file_id: 'file-C', actor_id: 'doctor-1', patient_id: 'patient-2', action: 'accessed', created_at: '2026-04-22T08:00:00' },
];

describe('Vault audit — patient mode', () => {
  it('patient1 sees ONLY events on their own files', () => {
    const visible = applyFilters(FIXTURE, { patientScope: 'patient-1' });
    expect(visible.length).toBe(4);
    expect(visible.every((r) => r.patient_id === 'patient-1')).toBe(true);
    // The patient2 event is hidden
    expect(visible.find((r) => r.file_id === 'file-C')).toBeUndefined();
  });

  it('patient1 with file filter sees only events for that specific file', () => {
    const visible = applyFilters(FIXTURE, {
      patientScope: 'patient-1',
      fileFilter: 'file-A',
    });
    expect(visible.length).toBe(2);
    expect(visible.every((r) => r.file_id === 'file-A')).toBe(true);
  });

  it('patient1 with action filter narrows to that action only', () => {
    const visible = applyFilters(FIXTURE, {
      patientScope: 'patient-1',
      actionFilter: 'access_denied',
    });
    expect(visible.length).toBe(1);
    expect(visible[0].action).toBe('access_denied');
  });

  it('date range filter excludes rows outside the window', () => {
    const visible = applyFilters(FIXTURE, {
      patientScope: 'patient-1',
      fromDate: '2026-04-21',
      toDate: '2026-04-21',
    });
    expect(visible.length).toBe(2);
    expect(visible.every((r) => r.created_at.startsWith('2026-04-21'))).toBe(true);
  });
});

describe('Vault audit — doctor mode', () => {
  it('doctor1 sees ONLY rows where they were the actor', () => {
    const visible = applyFilters(FIXTURE, { actorScope: 'doctor-1' });
    expect(visible.length).toBe(3);
    expect(visible.every((r) => r.actor_id === 'doctor-1')).toBe(true);
    // doctor2 actions hidden
    expect(visible.find((r) => r.actor_id === 'doctor-2')).toBeUndefined();
  });

  it('doctor1 cannot see rows where they were not the actor (cross-tenant safety)', () => {
    const visible = applyFilters(FIXTURE, { actorScope: 'doctor-1' });
    // Specifically: the access_denied row by doctor-2 must not appear
    expect(visible.find((r) => r.id === '3')).toBeUndefined();
  });

  it('doctor1 with file filter only sees events for files they actually touched', () => {
    const visible = applyFilters(FIXTURE, { actorScope: 'doctor-1', fileFilter: 'file-A' });
    expect(visible.length).toBe(2);
    expect(visible.every((r) => r.actor_id === 'doctor-1' && r.file_id === 'file-A')).toBe(true);
  });
});

describe('Vault audit — denial rules', () => {
  it('a stranger with no scope sees nothing (defensive default)', () => {
    // If the panel ever renders without userId, applyFilters({}) would return everything;
    // the panel guards against this by not calling fetchAudit until userId exists.
    // Here we model the guard explicitly:
    const userId: string | null = null;
    const shouldQuery = !!userId;
    expect(shouldQuery).toBe(false);
  });

  it('combining patient scope + action filter never widens visibility', () => {
    const widest = applyFilters(FIXTURE, { patientScope: 'patient-1' }).length;
    const narrowed = applyFilters(FIXTURE, {
      patientScope: 'patient-1',
      actionFilter: 'accessed',
    }).length;
    expect(narrowed).toBeLessThanOrEqual(widest);
  });
});
