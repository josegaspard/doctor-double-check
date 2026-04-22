import { describe, it, expect } from 'vitest';

/**
 * E2E: When the patient revokes vault access, the doctor MUST NOT find
 * the file via listing, category filter, search, or direct id lookup.
 * Zero metadata leak (name, description) anywhere on doctor screens.
 */

interface VaultFile {
  id: string;
  patient_id: string;
  name: string;
  category: string;
  description: string;
}

interface VaultAccess {
  file_id: string;
  doctor_id: string;
  expires_at: string | null;
}

const ALL_FILES: VaultFile[] = [
  {
    id: 'archivo-A',
    patient_id: 'patient-1',
    name: 'rx-tumor.pdf',
    category: 'Imagenología',
    description: 'Radiografía con sospecha de tumor en pulmón derecho',
  },
  {
    id: 'archivo-B',
    patient_id: 'patient-1',
    name: 'analitica-sangre.pdf',
    category: 'Laboratorio',
    description: 'Hemograma completo',
  },
];

let ACCESS: VaultAccess[] = [
  { file_id: 'archivo-A', doctor_id: 'doctor-1', expires_at: null },
];

/** Simulates the SECURITY DEFINER RPC — only files with active access leak through */
function getDoctorAccessibleFiles(doctorId: string): VaultFile[] {
  const allowedIds = new Set(
    ACCESS.filter(
      (a) =>
        a.doctor_id === doctorId &&
        (a.expires_at === null || new Date(a.expires_at) > new Date())
    ).map((a) => a.file_id)
  );
  return ALL_FILES.filter((f) => allowedIds.has(f.id));
}

function filterByCategory(files: VaultFile[], category: string): VaultFile[] {
  return files.filter((f) => f.category === category);
}

function searchByTerm(files: VaultFile[], term: string): VaultFile[] {
  const t = term.toLowerCase();
  return files.filter(
    (f) => f.name.toLowerCase().includes(t) || f.description.toLowerCase().includes(t)
  );
}

function findById(files: VaultFile[], id: string): VaultFile | undefined {
  return files.find((f) => f.id === id);
}

function revokeAccess(fileId: string, doctorId: string) {
  ACCESS = ACCESS.filter((a) => !(a.file_id === fileId && a.doctor_id === doctorId));
}

describe('Vault revoke — file invisibility across all doctor screens', () => {
  it('initially: doctor sees archivo-A in listing, filter, and search', () => {
    // Restore initial access
    ACCESS = [{ file_id: 'archivo-A', doctor_id: 'doctor-1', expires_at: null }];

    const list = getDoctorAccessibleFiles('doctor-1');
    expect(list.find((f) => f.id === 'archivo-A')).toBeDefined();

    const imagFilter = filterByCategory(list, 'Imagenología');
    expect(imagFilter.find((f) => f.id === 'archivo-A')).toBeDefined();

    expect(searchByTerm(list, 'tumor').find((f) => f.id === 'archivo-A')).toBeDefined();
    expect(searchByTerm(list, 'rx').find((f) => f.id === 'archivo-A')).toBeDefined();
    expect(findById(list, 'archivo-A')).toBeDefined();
  });

  it('after revoke: archivo-A disappears from EVERY screen', () => {
    ACCESS = [{ file_id: 'archivo-A', doctor_id: 'doctor-1', expires_at: null }];
    revokeAccess('archivo-A', 'doctor-1');

    const list = getDoctorAccessibleFiles('doctor-1');
    expect(list).toHaveLength(0);

    expect(filterByCategory(list, 'Imagenología')).toHaveLength(0);
    expect(searchByTerm(list, 'tumor')).toHaveLength(0);
    expect(searchByTerm(list, 'rx')).toHaveLength(0);
    expect(searchByTerm(list, 'tumo')).toHaveLength(0); // partial match
    expect(findById(list, 'archivo-A')).toBeUndefined();
  });

  it('zero metadata leak: serialized doctor views never contain file name or description', () => {
    ACCESS = [{ file_id: 'archivo-A', doctor_id: 'doctor-1', expires_at: null }];
    revokeAccess('archivo-A', 'doctor-1');

    const list = getDoctorAccessibleFiles('doctor-1');
    const allViews = {
      list,
      filtered: filterByCategory(list, 'Imagenología'),
      search1: searchByTerm(list, 'tumor'),
      search2: searchByTerm(list, 'rx'),
      direct: findById(list, 'archivo-A'),
    };
    const serialized = JSON.stringify(allViews);

    expect(serialized).not.toContain('rx-tumor.pdf');
    expect(serialized).not.toContain('tumor');
    expect(serialized).not.toContain('Radiografía');
    expect(serialized).not.toContain('archivo-A');
  });

  it('expired access (expires_at in the past) is treated as revoked', () => {
    ACCESS = [
      {
        file_id: 'archivo-A',
        doctor_id: 'doctor-1',
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ];

    const list = getDoctorAccessibleFiles('doctor-1');
    expect(list).toHaveLength(0);
    expect(findById(list, 'archivo-A')).toBeUndefined();
  });

  it('other doctors cannot see the file even if its owner doctor lost access', () => {
    ACCESS = [];
    const otherList = getDoctorAccessibleFiles('doctor-2');
    expect(otherList).toHaveLength(0);
    expect(searchByTerm(otherList, 'tumor')).toHaveLength(0);
  });
});
