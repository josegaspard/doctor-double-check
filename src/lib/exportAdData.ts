// CSV + PDF export utilities for advertising data

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, tableHTML: string) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .summary { margin-bottom: 16px; font-size: 13px; }
  .summary span { font-weight: 600; }
</style></head><body>
<h1>${title}</h1>
${tableHTML}
</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 300);
}

export function campaignsToTableHTML(
  campaigns: Array<{
    name: string;
    status: string;
    budget: number;
    impressions: number;
    clicks: number;
    ctr: string;
  }>,
  totalRevenue: number
) {
  const rows = campaigns.map(c =>
    `<tr><td>${c.name}</td><td>${c.status}</td><td>$${c.budget.toLocaleString()}</td><td>${c.impressions.toLocaleString()}</td><td>${c.clicks}</td><td>${c.ctr}%</td></tr>`
  ).join('');
  return `<div class="summary">Ingresos Totales: <span>$${totalRevenue.toLocaleString()} MXN</span></div>
<table><thead><tr><th>Campaña</th><th>Estado</th><th>Budget</th><th>Impresiones</th><th>Clics</th><th>CTR</th></tr></thead><tbody>${rows}</tbody></table>`;
}
