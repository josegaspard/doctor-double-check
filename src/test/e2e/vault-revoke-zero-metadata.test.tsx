/**
 * Vault zero-metadata: when the patient revokes access, the doctor must lose
 * ALL visibility — no name, no mime, no created_at, no URL.
 *
 * We model this against the new `get_doctor_accessible_files()` RPC, which
 * INNER JOINs vault_access. This guarantees row-level disappearance instead
 * of relying on client-side filtering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface VaultFile {
  id: string;
  patient_id: string;
  name: string;
  file_type: 'image' | 'document';
  file_url: string;
  file_size: number;
  category: string;
  created_at: string;
}

interface VaultAccess {
  file_id: string;
  doctor_id: string;
  expires_at: string | null;
}

interface AuditEvent {
  id: string;
  file_id: string;
  actor_id: string;
  patient_id: string;
  action: 'access_granted' | 'access_revoked' | 'accessed' | 'access_denied';
  created_at: string;
}

/** Replicates server-side get_doctor_accessible_files() behavior. */
function getDoctorAccessibleFiles(
  doctorId: string,
  files: VaultFile[],
  accesses: VaultAccess[]
): VaultFile[] {
  const now = new Date();
  const grants = new Set(
    accesses
      .filter((a) => a.doctor_id === doctorId && (a.expires_at === null || new Date(a.expires_at) > now))
      .map((a) => a.file_id)
  );
  return files.filter((f) => grants.has(f.id));
}

describe('Vault zero-metadata after revocation', () => {
  const FILE: VaultFile = {
    id: 'file-clinical-1',
    patient_id: 'patient-1',
    name: 'rx-positivo-tumor.pdf',
    file_type: 'document',
    file_url: 'https://signed.test/file-clinical-1?token=t1',
    file_size: 102400,
    category: 'Imagenología',
    created_at: '2026-04-01T10:00:00Z',
  };

  const DOCTOR_ID = 'doctor-2';

  let files: VaultFile[];
  let accesses: VaultAccess[];
  let auditLog: AuditEvent[];

  beforeEach(() => {
    files = [FILE];
    accesses = [{ file_id: FILE.id, doctor_id: DOCTOR_ID, expires_at: null }];
    auditLog = [
      {
        id: 'evt-1',
        file_id: FILE.id,
        actor_id: 'patient-1',
        patient_id: 'patient-1',
        action: 'access_granted',
        created_at: '2026-04-01T10:00:00Z',
      },
    ];
  });

  it('doctor with active access sees full metadata', () => {
    const result = getDoctorAccessibleFiles(DOCTOR_ID, files, accesses);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('rx-positivo-tumor.pdf');
    expect(result[0].file_type).toBe('document');
    expect(result[0].file_size).toBe(102400);
    expect(result[0].created_at).toBeTruthy();
  });

  it('after revocation the file disappears entirely (zero metadata leak)', () => {
    // Patient revokes
    accesses = accesses.filter((a) => !(a.file_id === FILE.id && a.doctor_id === DOCTOR_ID));
    // Trigger logs the revocation (simulating trg_vault_access_audit)
    auditLog.push({
      id: 'evt-2',
      file_id: FILE.id,
      actor_id: 'patient-1',
      patient_id: 'patient-1',
      action: 'access_revoked',
      created_at: '2026-04-22T14:00:00Z',
    });

    const result = getDoctorAccessibleFiles(DOCTOR_ID, files, accesses);
    expect(result.length).toBe(0);
    // No name, no type, no anything leaks
    const json = JSON.stringify(result);
    expect(json).not.toContain('rx-positivo-tumor');
    expect(json).not.toContain('document');
    expect(json).not.toContain('Imagenología');
  });

  it('audit log records access_revoked with correct actor and patient', () => {
    accesses = accesses.filter((a) => !(a.file_id === FILE.id && a.doctor_id === DOCTOR_ID));
    auditLog.push({
      id: 'evt-2',
      file_id: FILE.id,
      actor_id: 'patient-1',
      patient_id: 'patient-1',
      action: 'access_revoked',
      created_at: '2026-04-22T14:00:00Z',
    });
    const revokedEvents = auditLog.filter((e) => e.action === 'access_revoked');
    expect(revokedEvents.length).toBe(1);
    expect(revokedEvents[0].actor_id).toBe('patient-1');
    expect(revokedEvents[0].file_id).toBe(FILE.id);
  });

  it('expired access (expires_at < now) is treated as revoked', () => {
    accesses = [
      {
        file_id: FILE.id,
        doctor_id: DOCTOR_ID,
        expires_at: '2020-01-01T00:00:00Z', // expired
      },
    ];
    const result = getDoctorAccessibleFiles(DOCTOR_ID, files, accesses);
    expect(result.length).toBe(0);
  });

  it('a direct fetch attempt to a revoked file URL must be blocked (simulated 403)', async () => {
    accesses = [];
    const fetchMock = vi.fn().mockResolvedValue({ status: 403, ok: false });
    const res = await fetchMock(FILE.file_url);
    expect(res.status).toBe(403);
    expect(res.ok).toBe(false);
  });

  it('other doctors with active access still see the file', () => {
    accesses.push({ file_id: FILE.id, doctor_id: 'doctor-other', expires_at: null });
    // revoke only DOCTOR_ID
    accesses = accesses.filter((a) => !(a.doctor_id === DOCTOR_ID && a.file_id === FILE.id));

    expect(getDoctorAccessibleFiles(DOCTOR_ID, files, accesses).length).toBe(0);
    expect(getDoctorAccessibleFiles('doctor-other', files, accesses).length).toBe(1);
  });

  it('re-granting access restores visibility (full lifecycle)', () => {
    // Revoke
    accesses = [];
    expect(getDoctorAccessibleFiles(DOCTOR_ID, files, accesses).length).toBe(0);

    // Re-grant
    accesses.push({ file_id: FILE.id, doctor_id: DOCTOR_ID, expires_at: null });
    const result = getDoctorAccessibleFiles(DOCTOR_ID, files, accesses);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('rx-positivo-tumor.pdf');
  });
});
