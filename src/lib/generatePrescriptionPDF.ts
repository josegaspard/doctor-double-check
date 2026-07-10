import QRCode from 'qrcode';

export interface Medication {
  name: string;
  dosage: string;
  route?: string;        // Vía de administración (Oral, IM, IV, etc.)
  frequency: string;
  duration: string;
  notes?: string;
}

export interface PrescriptionData {
  id: string;
  patientName: string;
  patientAge?: string;
  diagnosis?: string;
  medications: Medication[];
  instructions?: string;
  notes?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense: string;
  doctorCedula?: string;
  doctorNumeroConsejo?: string;   // Céd. Esp. / No. de registro ante el Consejo
  doctorUniversity?: string;      // Universidad de egreso
  doctorHospital?: string;        // Membresía / afiliación hospitalaria
  doctorCofepris?: string;        // Permiso COFEPRIS (recetario controlado)
  doctorSignatureUrl?: string;
  signedAt: Date;
  cedulaVerified?: boolean;   // cédula verificada contra el registro de la SEP
  // Verificación (se rellenan en exportPrescriptionToPDF)
  verifyQrDataUrl?: string;
  verifyUrl?: string;
}

// Folio legible y estable derivado del id de la receta.
export const prescriptionFolio = (id: string): string =>
  `MM-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

// URL pública de verificación (portal /verificar-receta/:id).
export const prescriptionVerifyUrl = (id: string): string => {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://medical-masters.com';
  return `${origin}/verificar-receta/${id}`;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

// Escapa texto capturado del perfil del médico para evitar romper el HTML de la receta.
const esc = (s?: string): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Bloque de credenciales completas del médico, replicando el membrete oficial:
// nombre, membresía/afiliación hospitalaria, especialidad, universidad,
// Céd. Prof., Céd. Esp. (No. Consejo) y permiso COFEPRIS.
// `variant` ajusta el color según el fondo (caja "Médico" clara vs. pie de firma).
const doctorCredentialsHTML = (
  rx: PrescriptionData,
  variant: 'box' | 'signature',
): string => {
  const muted = '#6b7fa3';
  const accent = '#227787';
  const sepBadge = rx.cedulaVerified
    ? ` <span style="color:#166534; font-weight:600;">· ✓ Cédula verificada ante SEP</span>`
    : '';

  const lines: string[] = [];
  if (rx.doctorHospital) {
    lines.push(`<p style="margin: 2px 0 0; color: ${muted}; font-size: 12px;">${esc(rx.doctorHospital)}</p>`);
  }
  if (rx.doctorSpecialty) {
    lines.push(`<p style="margin: 2px 0 0; color: ${accent}; font-size: 13px; font-weight: 600;">${esc(rx.doctorSpecialty)}</p>`);
  }
  if (rx.doctorUniversity) {
    lines.push(`<p style="margin: 2px 0 0; color: ${muted}; font-size: 12px;">${esc(rx.doctorUniversity)}</p>`);
  }

  // Línea de cédulas: Céd. Prof. + Céd. Esp. (No. Consejo) + Lic.
  const idParts: string[] = [];
  if (rx.doctorCedula) idParts.push(`Céd. Prof. ${esc(rx.doctorCedula)}`);
  if (rx.doctorNumeroConsejo) idParts.push(`Céd. Esp. Reg. No. Consejo ${esc(rx.doctorNumeroConsejo)}`);
  // La licencia se muestra sólo si no coincide con la cédula profesional (evita duplicar).
  if (rx.doctorLicense && rx.doctorLicense !== rx.doctorCedula) idParts.push(`Lic. ${esc(rx.doctorLicense)}`);
  if (rx.doctorCofepris) idParts.push(`COFEPRIS ${esc(rx.doctorCofepris)}`);
  if (idParts.length) {
    lines.push(`<p style="margin: ${variant === 'box' ? '4px' : '2px'} 0 0; color: ${muted}; font-size: 12px;">${idParts.join(' · ')}${sepBadge}</p>`);
  } else if (sepBadge) {
    lines.push(`<p style="margin: 2px 0 0; color: ${muted}; font-size: 12px;">${sepBadge}</p>`);
  }

  return lines.join('\n');
};

export const generatePrescriptionHTML = (rx: PrescriptionData): string => {
  const medsRows = rx.medications.map((med, i) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; font-weight: 600; color: #163a83;">${i + 1}. ${med.name}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${med.dosage}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${med.route || '—'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${med.frequency}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${med.duration}</td>
    </tr>
    ${med.notes ? `<tr><td colspan="5" style="padding: 4px 12px 10px; border-bottom: 1px solid #d1d9e6; color: #6b7fa3; font-size: 12px; font-style: italic;">📝 ${med.notes}</td></tr>` : ''}
  `).join('');

  const folio = prescriptionFolio(rx.id);
  const verifyUrl = rx.verifyUrl || prescriptionVerifyUrl(rx.id);

  // Use the deployed logo URL
  const logoUrl = 'https://medical-masters.com/icon-512.png?v=18';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Médica - ${rx.patientName}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a2744;
      margin: 0;
      padding: 40px;
      background: #f0f4f8;
    }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(22, 58, 131, 0.12);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #163a83, #227787); padding: 24px 32px; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${logoUrl}" alt="Medical Masters" style="height: 44px; width: auto; filter: brightness(0) invert(1);" onerror="this.style.display='none'" />
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Receta Médica</h1>
            <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Medical Masters</p>
          </div>
        </div>
        <div style="text-align: right; font-size: 13px; opacity: 0.9;">
          <p style="margin: 0;">Fecha: ${formatDate(rx.signedAt)}</p>
          <p style="margin: 0;">Folio: ${folio}</p>
        </div>
      </div>
    </div>

    <div style="padding: 32px;">
      <!-- Doctor & Patient Info -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
        <div style="background: #f0f4fa; padding: 16px; border-radius: 8px; border-left: 4px solid #163a83;">
          <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: #6b7fa3; letter-spacing: 0.5px;">Médico</p>
          <p style="margin: 0; font-weight: 700; font-size: 16px; color: #163a83;">${esc(rx.doctorName)}</p>
          ${doctorCredentialsHTML(rx, 'box')}
        </div>
        <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; border-left: 4px solid #839ed5;">
          <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: #6b7fa3; letter-spacing: 0.5px;">Paciente</p>
          <p style="margin: 0; font-weight: 700; font-size: 16px; color: #1a2744;">${rx.patientName}</p>
          ${rx.patientAge ? `<p style="margin: 2px 0 0; color: #374a6d; font-size: 13px;">Edad: ${rx.patientAge}</p>` : ''}
        </div>
      </div>

      ${rx.diagnosis ? `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Diagnóstico</p>
        <p style="margin: 0; padding: 12px; background: #fefce8; border-radius: 8px; border: 1px solid #fde68a; color: #854d0e;">${rx.diagnosis}</p>
      </div>
      ` : ''}

      <!-- Medications -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Medicamentos</p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d9e6; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f0f4fa;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #163a83; font-weight: 600;">Medicamento</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #163a83; font-weight: 600;">Dosis</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #163a83; font-weight: 600;">Vía</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #163a83; font-weight: 600;">Frecuencia</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #163a83; font-weight: 600;">Duración</th>
            </tr>
          </thead>
          <tbody>
            ${medsRows}
          </tbody>
        </table>
      </div>

      ${rx.instructions ? `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Indicaciones</p>
        <p style="margin: 0; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; color: #166534; white-space: pre-wrap;">${rx.instructions}</p>
      </div>
      ` : ''}

      ${rx.notes ? `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Notas Adicionales</p>
        <p style="margin: 0; padding: 12px; background: #f5f7fa; border-radius: 8px; border: 1px solid #d1d9e6; color: #374a6d; white-space: pre-wrap;">${rx.notes}</p>
      </div>
      ` : ''}

      <!-- Signature -->
      <div style="margin-top: 40px; text-align: center; border-top: 2px solid #d1d9e6; padding-top: 24px;">
        ${rx.doctorSignatureUrl ? `
        <div style="margin-bottom: 12px;">
          <img src="${rx.doctorSignatureUrl}" alt="Firma del doctor" style="max-height: 80px; width: auto; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
        </div>
        ` : ''}
        <div style="display: inline-block; border-bottom: 2px solid #163a83; padding: 0 40px 4px;">
          <p style="margin: 0; font-weight: 700; font-size: 16px; color: #163a83;">${esc(rx.doctorName)}</p>
        </div>
        ${doctorCredentialsHTML(rx, 'signature')}
      </div>

      <!-- Verificación (QR + folio) -->
      <div style="margin-top: 28px; display: flex; align-items: center; gap: 16px; background: #f0f4fa; border: 1px solid #d1d9e6; border-radius: 10px; padding: 16px;">
        ${rx.verifyQrDataUrl ? `<img src="${rx.verifyQrDataUrl}" alt="Código QR de verificación" style="width: 96px; height: 96px; flex-shrink: 0; background: #fff; border-radius: 6px;" />` : ''}
        <div style="min-width: 0;">
          <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; color: #163a83; font-weight: 700; letter-spacing: 0.5px;">Verificación de autenticidad</p>
          <p style="margin: 0; font-size: 12px; color: #374a6d;">Escanea el código QR o visita el enlace para confirmar que esta receta fue emitida por un médico verificado en Medical Masters.</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #6b7fa3; word-break: break-all;"><strong style="color:#163a83;">Folio ${folio}</strong> · ${verifyUrl}</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f0f4fa; padding: 16px; text-align: center; color: #839ed5; font-size: 11px;">
      <p style="margin: 0;">Este documento es una receta médica electrónica generada por Medical Masters</p>
      <p style="margin: 4px 0 0;">⚠️ Documento válido solo con la información del médico tratante verificado</p>
    </div>
  </div>

  <div class="no-print" style="position: fixed; bottom: 24px; right: 24px;">
    <button onclick="window.print()" style="background: linear-gradient(135deg, #163a83, #227787); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(22, 58, 131, 0.4);">
      📥 Descargar PDF
    </button>
  </div>
</body>
</html>`;
};

export const exportPrescriptionToPDF = async (
  data: PrescriptionData,
  // Ventana ya abierta de forma síncrona por quien llama (para no ser bloqueada por
  // el navegador cuando hay awaits antes de generar el PDF, p. ej. al traer las
  // credenciales del médico). Si no se pasa, se abre aquí mismo.
  preOpenedWindow?: Window | null,
): Promise<void> => {
  // Abrir la ventana de forma SÍNCRONA (si no, el bloqueador de popups la mata
  // al abrirla tras un await). Luego generamos el QR y escribimos el HTML.
  const printWindow = preOpenedWindow ?? window.open('', '_blank');

  const verifyUrl = data.verifyUrl || prescriptionVerifyUrl(data.id);
  let verifyQrDataUrl: string | undefined;
  try {
    verifyQrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  } catch { /* si falla el QR, la receta sigue mostrando folio + enlace */ }

  const html = generatePrescriptionHTML({ ...data, verifyUrl, verifyQrDataUrl });
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
  }
};
