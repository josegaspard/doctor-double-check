/**
 * Patient Clinical Summary export (in-platform DRM-aware print)
 * Opens a watermarked, print-only HTML view that signals to the user
 * that the document is private to the platform. Includes:
 *  - Personal data, vitals, allergies
 *  - Chronic conditions, medications, surgeries
 *  - Family history, habits
 *  - Vaccines applied
 *  - Last-updated stamp + watermark with patient name
 */

export interface ClinicalSummaryInput {
  patient: { name: string; email: string };
  data: any; // clinical record snapshot
  language?: 'es' | 'en';
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

function row(label: string, value: any): string {
  if (value === null || value === undefined || value === '' || (typeof value === 'object' && Object.keys(value).length === 0)) return '';
  let display = '';
  if (Array.isArray(value)) {
    display = value.length ? value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ') : '—';
  } else if (typeof value === 'object') {
    display = JSON.stringify(value);
  } else {
    display = String(value);
  }
  return `
    <tr>
      <td style="padding:8px 12px;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;width:40%;">${label}</td>
      <td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;font-weight:500;">${display}</td>
    </tr>`;
}

function section(title: string, rows: string): string {
  if (!rows.trim()) return '';
  return `
    <section style="margin-bottom:24px;page-break-inside:avoid;">
      <h3 style="color:#0ea5e9;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #0ea5e9;font-size:14px;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        ${rows}
      </table>
    </section>`;
}

export const generateClinicalSummaryHTML = (input: ClinicalSummaryInput): string => {
  const { patient, data } = input;
  const now = new Date();

  // Personal
  const personalRows = [
    row('Sexo', data.sex),
    row('Fecha de nacimiento', data.date_of_birth),
    row('Tipo de sangre', data.blood_type),
    row('Estatura (cm)', data.height_cm),
    row('Peso (kg)', data.weight_kg),
    row('Alergias', data.allergies),
    row('Contacto de emergencia', data.emergency_contact_name),
    row('Teléfono de emergencia', data.emergency_contact_phone),
  ].join('');

  // Chronic conditions
  const chronicList = Object.entries(data.chronic_conditions_list || {})
    .filter(([, v]: any) => v?.active)
    .map(([k, v]: any) => `${k}${v.detail ? ' — ' + v.detail : ''}`);
  const chronicRows = chronicList.length ? row('Condiciones crónicas', chronicList) : '';

  // Medications
  const meds = (data.medications || []).filter((m: any) => m.name);
  const medsRows = meds.length
    ? row('Medicamentos actuales', meds.map((m: any) => `${m.name}${m.dose ? ' (' + m.dose + ')' : ''}${m.frequency ? ' — ' + m.frequency : ''}`))
    : '';

  // Surgeries
  const surgs = (data.surgeries || []).filter((s: any) => s.procedure);
  const surgRows = surgs.length
    ? row('Cirugías previas', surgs.map((s: any) => `${s.procedure}${s.date ? ' (' + s.date + ')' : ''}`))
    : '';

  // Family
  const family: string[] = [];
  if (data.family_diabetes) family.push(`Diabetes${data.family_diabetes_detail ? ' — ' + data.family_diabetes_detail : ''}`);
  if (data.family_hypertension) family.push(`Hipertensión${data.family_hypertension_detail ? ' — ' + data.family_hypertension_detail : ''}`);
  if (data.family_cancer) family.push(`Cáncer${data.family_cancer_detail ? ' — ' + data.family_cancer_detail : ''}`);
  if (data.family_heart_disease) family.push(`Enfermedad cardíaca${data.family_heart_disease_detail ? ' — ' + data.family_heart_disease_detail : ''}`);
  if (data.family_mental_illness) family.push(`Trastornos mentales${data.family_mental_illness_detail ? ' — ' + data.family_mental_illness_detail : ''}`);
  Object.entries(data.extra_family || {}).forEach(([k, v]: any) => {
    if (v?.active) family.push(`${k}${v.detail ? ' — ' + v.detail : ''}`);
  });
  const familyRows = family.length ? row('Antecedentes familiares', family) : '';

  // Habits
  const habits = [
    ['Alcohol', data.habit_alcohol, data.habit_alcohol_amount],
    ['Tabaco', data.habit_smoking, data.habit_smoking_amount],
    ['Vapeo', data.habit_vaping, data.habit_vaping_amount],
    ['Hookah', data.habit_hookah, data.habit_hookah_amount],
    ['Drogas', data.habit_drugs, data.habit_drugs_amount],
    ['Ejercicio', data.habit_exercise, data.habit_exercise_amount],
  ]
    .filter(([, freq]) => freq && freq !== 'never')
    .map(([label, freq, amt]) => `${label}: ${freq}${amt ? ' (' + amt + ')' : ''}`);
  const habitsRows = habits.length ? row('Hábitos', habits) : '';

  // Vaccines
  const appliedVaccines = Object.entries(data.vaccines || {})
    .filter(([, v]: any) => v?.applied)
    .map(([k, v]: any) => `${k}${v.doses ? ' (' + v.doses + ')' : ''}${v.date ? ' — ' + v.date : ''}`);
  const vaccineRows = appliedVaccines.length ? row('Vacunas aplicadas', appliedVaccines) : '';

  // Notes
  const notesRows = data.notes ? row('Notas', data.notes) : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex,nofollow">
  <title>Resumen Clínico — ${patient.name}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; color: rgba(14,165,233,0.06); font-weight: 900; pointer-events: none; z-index: 0; white-space: nowrap; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5; color: #1e293b; margin: 0; padding: 24px; background: #f8fafc;
      -webkit-user-select: none; user-select: none;
    }
    @media (max-width: 640px) { body { padding: 12px; } }
    .watermark { position: fixed; top: 40%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 60px; color: rgba(14,165,233,0.05); font-weight: 900; pointer-events: none; z-index: 0; white-space: nowrap; }
    .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body oncontextmenu="return false" oncopy="return false" oncut="return false">
  <div class="watermark">${patient.name.toUpperCase()} · MEDICAL MASTERS</div>
  <div class="container">
    <header style="text-align:center;margin-bottom:24px;padding:18px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;color:white;">
      <h1 style="margin:0 0 4px 0;font-size:22px;">📋 Resumen Clínico</h1>
      <p style="margin:0;opacity:0.9;font-size:13px;">Medical Masters · Documento privado</p>
    </header>

    <div style="background:white;padding:14px 18px;border-radius:10px;margin-bottom:18px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:12px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
      <div><strong>Paciente:</strong> ${patient.name}</div>
      <div><strong>Email:</strong> ${patient.email}</div>
      <div><strong>Generado:</strong> ${fmt(now)}</div>
    </div>

    ${section('Datos personales', personalRows)}
    ${section('Condiciones crónicas', chronicRows)}
    ${section('Medicamentos', medsRows)}
    ${section('Cirugías', surgRows)}
    ${section('Antecedentes familiares', familyRows)}
    ${section('Hábitos', habitsRows)}
    ${section('Vacunas', vaccineRows)}
    ${section('Notas adicionales', notesRows)}

    <footer style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px;">
      <p>⚠️ Documento confidencial — Solo para uso personal del paciente</p>
      <p>Generado dentro de Medical Masters · No compartir externamente</p>
      <p style="margin-top:6px;">ID: ${now.getTime().toString(36)}</p>
    </footer>
  </div>

  <div class="no-print" style="position:fixed;bottom:16px;right:16px;display:flex;gap:8px;">
    <button onclick="window.print()" style="background:#0ea5e9;color:white;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(14,165,233,0.4);min-height:44px;">
      📥 Descargar / Imprimir
    </button>
    <button onclick="window.close()" style="background:#64748b;color:white;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;min-height:44px;">
      Cerrar
    </button>
  </div>
</body>
</html>
  `;
};

export const exportClinicalSummary = (input: ClinicalSummaryInput): void => {
  const html = generateClinicalSummaryHTML(input);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
