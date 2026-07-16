import QRCode from 'qrcode';
import { RECETA_LOGO_WHITE_DATAURL } from '@/lib/recetaLogo';

export interface Medication {
  name: string;          // Nombre comercial
  genericName?: string;  // Nombre genérico (sustancia activa) — las farmacias pueden exigir uno u otro
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
  patientBirthDate?: string;   // Fecha de nacimiento (se muestra debajo de Edad)
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
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; font-weight: 600; color: #163a83;">${i + 1}. ${esc(med.name)}${med.genericName ? `<br/><span style="font-weight: 400; font-size: 12px; color: #374a6d;">Genérico: ${esc(med.genericName)}</span>` : ''}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${esc(med.dosage)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${esc(med.route) || '—'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${esc(med.frequency)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #d1d9e6; color: #374a6d;">${esc(med.duration)}</td>
    </tr>
    ${med.notes ? `<tr><td colspan="5" style="padding: 4px 12px 10px; border-bottom: 1px solid #d1d9e6; color: #6b7fa3; font-size: 12px; font-style: italic;">📝 ${esc(med.notes)}</td></tr>` : ''}
  `).join('');

  const folio = prescriptionFolio(rx.id);
  const verifyUrl = rx.verifyUrl || prescriptionVerifyUrl(rx.id);

  // Logo embebido en base64 (bundle local): pinta al instante, sin red.
  const logoUrl = RECETA_LOGO_WHITE_DATAURL;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta Médica - ${esc(rx.patientName)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      /* Solo fuentes del sistema: sin descargas de webfonts → impresión inmediata */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
          <img src="${logoUrl}" alt="Medical Masters" style="height: 48px; width: auto;" onerror="this.style.display='none'" />
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
          <p style="margin: 0; font-weight: 700; font-size: 16px; color: #1a2744;">${esc(rx.patientName)}</p>
          ${rx.patientAge ? `<p style="margin: 2px 0 0; color: #374a6d; font-size: 13px;">Edad: ${esc(rx.patientAge)}</p>` : ''}
          ${rx.patientBirthDate ? `<p style="margin: 2px 0 0; color: #374a6d; font-size: 13px;">Fecha de nacimiento: ${esc(rx.patientBirthDate)}</p>` : ''}
        </div>
      </div>

      ${rx.diagnosis ? `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Diagnóstico</p>
        <p style="margin: 0; padding: 12px; background: #fefce8; border-radius: 8px; border: 1px solid #fde68a; color: #854d0e;">${esc(rx.diagnosis)}</p>
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
        <p style="margin: 0; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; color: #166534; white-space: pre-wrap;">${esc(rx.instructions)}</p>
      </div>
      ` : ''}

      ${rx.notes ? `
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #6b7fa3; font-weight: 600;">Notas Adicionales</p>
        <p style="margin: 0; padding: 12px; background: #f5f7fa; border-radius: 8px; border: 1px solid #d1d9e6; color: #374a6d; white-space: pre-wrap;">${esc(rx.notes)}</p>
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

// Convierte una URL remota (p. ej. la firma del médico en Storage) a data URL
// con timeout: así la ventana de impresión no queda esperando a la red. Si la
// conversión falla o tarda, se usa la URL original como estaba.
const toDataUrlWithTimeout = async (url: string, timeoutMs = 2500): Promise<string> => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
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
  // QR + firma en paralelo. Con logo embebido, QR data-url y firma data-url,
  // la receta no depende de NINGÚN fetch dentro de la ventana de impresión.
  const [verifyQrDataUrl, signatureDataUrl] = await Promise.all([
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .catch(() => undefined), // si falla el QR, la receta sigue mostrando folio + enlace
    data.doctorSignatureUrl ? toDataUrlWithTimeout(data.doctorSignatureUrl) : Promise.resolve(undefined),
  ]);

  const html = generatePrescriptionHTML({
    ...data,
    verifyUrl,
    verifyQrDataUrl,
    doctorSignatureUrl: signatureDataUrl ?? data.doctorSignatureUrl,
  });
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Imprimir en cuanto las imágenes estén decodificadas (todas son data URLs →
    // casi inmediato), en vez del setTimeout fijo de 250ms que además corría
    // ANTES de que la firma remota terminara de cargar.
    const fire = () => {
      const imgs = Array.from(printWindow.document.images);
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            // addEventListener (no asignar onload/onerror) para NO pisar el
            // handler inline onerror="this.style.display='none'" que oculta
            // imágenes rotas (firma remota caída → sin icono de imagen rota).
            : new Promise<void>((r) => {
                img.addEventListener('load', () => r(), { once: true });
                img.addEventListener('error', () => r(), { once: true });
              }),
        ),
      ).then(() => {
        printWindow.focus();
        printWindow.print();
      });
    };
    if (printWindow.document.readyState === 'complete') fire();
    else printWindow.onload = fire;
  }
};
