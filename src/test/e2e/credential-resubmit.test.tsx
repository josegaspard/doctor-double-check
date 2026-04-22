import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Doctor credential resubmit flow (logic-level e2e):
 * 1. Doctor lands on profile with cedula_status='rejected' + reason
 * 2. Sees Alert with full rejection reason
 * 3. Picks a valid PDF/JPG → upload to doctor-credentials bucket
 * 4. DB update: cedula_status='pending', cedula_rejection_reason=null
 * 5. UI now reflects pending state, no Alert
 */

interface DoctorCredentialState {
  cedula_status: 'pending' | 'approved' | 'rejected';
  cedula_rejection_reason: string | null;
  cedula_document_url: string | null;
}

const ALLOWED_RESUBMIT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

function validateResubmitFile(file: { type: string; size: number; name: string }): string | null {
  if (!ALLOWED_RESUBMIT_MIME.includes(file.type)) {
    return 'Tipo no permitido. Acepta PDF/JPG/PNG.';
  }
  if (file.size > MAX_BYTES) return 'Archivo demasiado grande (máx 10MB).';
  if (file.size === 0) return 'Archivo vacío.';
  return null;
}

async function performResubmit(
  state: DoctorCredentialState,
  file: { type: string; size: number; name: string },
  upload: (path: string) => Promise<{ ok: boolean; path?: string; error?: string }>,
  updateProfile: (patch: Partial<DoctorCredentialState>) => Promise<{ ok: boolean }>
): Promise<{ ok: boolean; newState?: DoctorCredentialState; error?: string }> {
  if (state.cedula_status !== 'rejected') {
    return { ok: false, error: 'Resubmit only allowed when status=rejected' };
  }
  const validationErr = validateResubmitFile(file);
  if (validationErr) return { ok: false, error: validationErr };

  const path = `cedula/${Date.now()}_${file.name}`;
  const up = await upload(path);
  if (!up.ok || !up.path) return { ok: false, error: up.error || 'Upload failed' };

  const upd = await updateProfile({
    cedula_status: 'pending',
    cedula_rejection_reason: null,
    cedula_document_url: up.path,
  });
  if (!upd.ok) return { ok: false, error: 'DB update failed' };

  return {
    ok: true,
    newState: {
      cedula_status: 'pending',
      cedula_rejection_reason: null,
      cedula_document_url: up.path,
    },
  };
}

describe('Credential resubmit — happy path', () => {
  let upload: ReturnType<typeof vi.fn>;
  let updateProfile: ReturnType<typeof vi.fn>;
  const initial: DoctorCredentialState = {
    cedula_status: 'rejected',
    cedula_rejection_reason: 'Foto borrosa',
    cedula_document_url: 'cedula/old.jpg',
  };

  beforeEach(() => {
    upload = vi.fn(async (path: string) => ({ ok: true, path }));
    updateProfile = vi.fn(async () => ({ ok: true }));
  });

  it('valid PDF is uploaded and status flips to pending with reason cleared', async () => {
    const file = { type: 'application/pdf', size: 200_000, name: 'cedula-new.pdf' };
    const res = await performResubmit(initial, file, upload, updateProfile);

    expect(res.ok).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({
      cedula_status: 'pending',
      cedula_rejection_reason: null,
      cedula_document_url: expect.any(String),
    });
    expect(res.newState?.cedula_status).toBe('pending');
    expect(res.newState?.cedula_rejection_reason).toBeNull();
  });

  it('valid JPG is accepted with correct mime', async () => {
    const file = { type: 'image/jpeg', size: 100_000, name: 'cedula.jpg' };
    const res = await performResubmit(initial, file, upload, updateProfile);
    expect(res.ok).toBe(true);
  });

  it('valid PNG is accepted', async () => {
    const file = { type: 'image/png', size: 50_000, name: 'cedula.png' };
    const res = await performResubmit(initial, file, upload, updateProfile);
    expect(res.ok).toBe(true);
  });
});

describe('Credential resubmit — validation', () => {
  const initial: DoctorCredentialState = {
    cedula_status: 'rejected',
    cedula_rejection_reason: 'Foto borrosa',
    cedula_document_url: null,
  };

  it('rejects unsupported mime type', async () => {
    const file = { type: 'application/zip', size: 1000, name: 'evil.zip' };
    const res = await performResubmit(initial, file, vi.fn(), vi.fn());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Tipo no permitido/);
  });

  it('rejects files larger than 10MB', async () => {
    const file = { type: 'application/pdf', size: 20 * 1024 * 1024, name: 'big.pdf' };
    const res = await performResubmit(initial, file, vi.fn(), vi.fn());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/demasiado grande/);
  });

  it('rejects empty files', async () => {
    const file = { type: 'application/pdf', size: 0, name: 'empty.pdf' };
    const res = await performResubmit(initial, file, vi.fn(), vi.fn());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/vacío/);
  });
});

describe('Credential resubmit — guards', () => {
  it('refuses resubmit when status is approved (no-op safety)', async () => {
    const state: DoctorCredentialState = {
      cedula_status: 'approved',
      cedula_rejection_reason: null,
      cedula_document_url: 'cedula/ok.pdf',
    };
    const file = { type: 'application/pdf', size: 1000, name: 'x.pdf' };
    const res = await performResubmit(state, file, vi.fn(), vi.fn());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/only allowed when status=rejected/);
  });

  it('refuses resubmit when already pending', async () => {
    const state: DoctorCredentialState = {
      cedula_status: 'pending',
      cedula_rejection_reason: null,
      cedula_document_url: null,
    };
    const file = { type: 'application/pdf', size: 1000, name: 'x.pdf' };
    const res = await performResubmit(state, file, vi.fn(), vi.fn());
    expect(res.ok).toBe(false);
  });

  it('storage upload failure surfaces as user-readable error', async () => {
    const initial: DoctorCredentialState = {
      cedula_status: 'rejected',
      cedula_rejection_reason: 'foo',
      cedula_document_url: null,
    };
    const upload = vi.fn(async () => ({ ok: false, error: 'Network error' }));
    const updateProfile = vi.fn(async () => ({ ok: true }));
    const file = { type: 'application/pdf', size: 1000, name: 'x.pdf' };
    const res = await performResubmit(initial, file, upload, updateProfile);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Network error');
    // CRITICAL: never updates the DB if upload failed
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
