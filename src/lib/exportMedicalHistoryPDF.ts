/**
 * Export medical history to PDF
 * Uses browser's print functionality to generate a clean PDF
 */

export interface MedicalHistoryItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  dateOfStudy?: Date;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

export interface PatientInfo {
  name: string;
  email: string;
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Escapa datos controlados por el paciente (títulos, descripciones, nombre, email)
// antes de interpolarlos en el HTML → evita XSS almacenado al abrir/imprimir el PDF.
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getFileIcon = (type: string): string => {
  switch (type) {
    case 'pdf':
      return '📄';
    case 'image':
      return '🖼️';
    default:
      return '📁';
  }
};

export const generateMedicalHistoryHTML = (
  items: MedicalHistoryItem[],
  patient: PatientInfo
): string => {
  const now = new Date();
  
  // Group by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MedicalHistoryItem[]>);

  const categorySections = Object.entries(groupedItems)
    .map(([category, categoryItems]) => {
      const itemRows = categoryItems
        .map(
          (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">${getFileIcon(item.fileType)}</span>
              <div>
                <strong style="color: #1e293b;">${esc(item.title)}</strong>
                ${item.description ? `<br><span style="color: #64748b; font-size: 12px;">${esc(item.description)}</span>` : ''}
              </div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">
            ${item.dateOfStudy ? formatDate(item.dateOfStudy) : 'No especificada'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b;">
            ${formatFileSize(item.fileSize)}
          </td>
        </tr>
      `
        )
        .join('');

      return `
      <div style="margin-bottom: 32px;">
        <h3 style="color: #0ea5e9; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #0ea5e9;">
          📂 ${esc(category)} (${categoryItems.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px; text-align: left; color: #475569; font-weight: 600;">Estudio</th>
              <th style="padding: 12px; text-align: center; color: #475569; font-weight: 600;">Fecha</th>
              <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Tamaño</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
    `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historial Médico - ${esc(patient.name)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 40px;
      background: #f8fafc;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 40px; padding: 24px; background: linear-gradient(135deg, #0ea5e9, #0284c7); border-radius: 16px; color: white;">
    <h1 style="margin: 0 0 8px 0; font-size: 28px;">🏥 Historial Médico</h1>
    <p style="margin: 0; opacity: 0.9;">Medical Masters</p>
  </div>

  <!-- Patient Info -->
  <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
      <div>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Paciente</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600;">${esc(patient.name)}</p>
      </div>
      <div>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Email</p>
        <p style="margin: 0; font-size: 14px;">${esc(patient.email)}</p>
      </div>
      <div>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Fecha de Exportación</p>
        <p style="margin: 0; font-size: 14px;">${formatDate(now)}</p>
      </div>
      <div>
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Total de Estudios</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0ea5e9;">${items.length}</p>
      </div>
    </div>
  </div>

  <!-- Content by Category -->
  ${categorySections}

  <!-- Footer -->
  <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
    <p>Este documento fue generado automáticamente por Medical Masters</p>
    <p>Fecha: ${now.toISOString()}</p>
    <p style="margin-top: 16px;">⚠️ Documento confidencial - Solo para uso personal</p>
  </div>

  <!-- Print Button (hidden when printing) -->
  <div class="no-print" style="position: fixed; bottom: 24px; right: 24px;">
    <button onclick="window.print()" style="background: #0ea5e9; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);">
      📥 Descargar PDF
    </button>
  </div>
</body>
</html>
  `;
};

export const exportMedicalHistoryToPDF = (
  items: MedicalHistoryItem[],
  patient: PatientInfo
): void => {
  const html = generateMedicalHistoryHTML(items, patient);
  
  // Open in new window for printing (noopener/noreferrer: corta acceso a window.opener)
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto-trigger print dialog after content loads
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
  }
};
