import { describe, it, expect } from 'vitest';

/**
 * CSV export helpers — replicate VaultAuditPanel's escapeCsv to verify
 * RFC4180 compliance and ensure the export matches the filtered set exactly.
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

interface AuditRow {
  created_at: string;
  action: string;
  file_name: string;
  actor: string;
  patient_id: string;
  metadata?: any;
}

function buildCsv(rows: AuditRow[]): string {
  const headers = ['Fecha', 'Acción', 'Archivo', 'Actor', 'Patient ID', 'Metadata'];
  const body = rows.map((r) => [
    r.created_at,
    r.action,
    r.file_name,
    r.actor,
    r.patient_id,
    r.metadata ? JSON.stringify(r.metadata) : '',
  ]);
  return (
    '\uFEFF' +
    [headers, ...body].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  );
}

describe('Vault audit CSV export', () => {
  const ALL_ROWS: AuditRow[] = Array.from({ length: 10 }).map((_, i) => ({
    created_at: `2026-04-${String(15 + Math.floor(i / 4)).padStart(2, '0')} 10:00:00`,
    action: i % 3 === 0 ? 'access_granted' : i % 3 === 1 ? 'accessed' : 'access_revoked',
    file_name: `file_${i}.pdf`,
    actor: i % 2 === 0 ? 'Dra. López' : 'Dr. Pérez',
    patient_id: 'patient-1',
  }));

  it('CSV header is exactly Fecha,Acción,Archivo,Actor,Patient ID,Metadata', () => {
    const csv = buildCsv(ALL_ROWS.slice(0, 1));
    const firstLine = csv.replace(/^\uFEFF/, '').split('\r\n')[0];
    expect(firstLine).toBe('Fecha,Acción,Archivo,Actor,Patient ID,Metadata');
  });

  it('exports exactly the visible (filtered) rows — not the unfiltered set', () => {
    // Simulate filter: only "Hoy" (2026-04-15) → 4 rows match (i=0..3)
    const today = '2026-04-15';
    const filtered = ALL_ROWS.filter((r) => r.created_at.startsWith(today));
    expect(filtered.length).toBe(4);

    const csv = buildCsv(filtered);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    // header + 4 data rows
    expect(lines.length).toBe(5);
    // Each data row contains the file name
    for (let i = 0; i < 4; i++) {
      expect(lines[i + 1]).toContain(`file_${i}.pdf`);
    }
    // Should NOT contain rows from other days
    for (let i = 4; i < 10; i++) {
      expect(csv).not.toContain(`file_${i}.pdf`);
    }
  });

  it('escapes quotes per RFC4180 (doubles them and wraps in quotes)', () => {
    const row: AuditRow = {
      created_at: '2026-04-22 12:00:00',
      action: 'accessed',
      file_name: 'lab "urgent" report.pdf',
      actor: 'Dr. "Pepe", López',
      patient_id: 'p1',
    };
    const csv = buildCsv([row]);
    // The actor field has both a comma and quotes → must be wrapped in quotes
    // and inner quotes doubled
    expect(csv).toContain('"Dr. ""Pepe"", López"');
    expect(csv).toContain('"lab ""urgent"" report.pdf"');
  });

  it('handles newlines safely by wrapping the cell in quotes', () => {
    const row: AuditRow = {
      created_at: '2026-04-22 12:00:00',
      action: 'accessed',
      file_name: 'multi\nline.pdf',
      actor: 'Dra. López',
      patient_id: 'p1',
    };
    const csv = buildCsv([row]);
    expect(csv).toContain('"multi\nline.pdf"');
  });

  it('serializes metadata as JSON when present', () => {
    const row: AuditRow = {
      created_at: '2026-04-22',
      action: 'access_granted',
      file_name: 'x.pdf',
      actor: 'A',
      patient_id: 'p1',
      metadata: { doctor_id: 'doc-1', expires_at: '2026-05-22' },
    };
    const csv = buildCsv([row]);
    expect(csv).toMatch(/"\{""doctor_id"":""doc-1""/);
  });

  it('starts with UTF-8 BOM so Excel opens it without mojibake', () => {
    const csv = buildCsv([ALL_ROWS[0]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produces a valid Blob for download with correct mime type', () => {
    const csv = buildCsv(ALL_ROWS.slice(0, 3));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    expect(blob.type).toBe('text/csv;charset=utf-8;');
    expect(blob.size).toBeGreaterThan(0);
  });
});
