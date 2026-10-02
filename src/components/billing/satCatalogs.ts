// Catálogos del SAT (CFDI 4.0) que necesita el comprador para que el médico le facture.
// c_RegimenFiscal y c_UsoCFDI: solo las claves que aplican a una compra de servicios
// médicos o contenido; los nombres son los oficiales del SAT.

export const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
export const TAX_ZIP_REGEX = /^[0-9]{5}$/;
export const CFDI_UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

/** 'fisica' (RFC de 13), 'moral' (RFC de 12) o null si aún no es válido. */
export type TaxpayerKind = 'fisica' | 'moral';
export function rfcKind(rfc: string): TaxpayerKind | null {
  if (!RFC_REGEX.test(rfc)) return null;
  return rfc.length === 13 ? 'fisica' : 'moral';
}

export interface SatOption {
  code: string;
  name: string;
  /** A qué tipo de contribuyente aplica. */
  kinds: TaxpayerKind[];
}

export const TAX_REGIMES: SatOption[] = [
  { code: '601', name: 'General de Ley Personas Morales', kinds: ['moral'] },
  { code: '603', name: 'Personas Morales con Fines no Lucrativos', kinds: ['moral'] },
  { code: '605', name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', kinds: ['fisica'] },
  { code: '606', name: 'Arrendamiento', kinds: ['fisica'] },
  { code: '607', name: 'Régimen de Enajenación o Adquisición de Bienes', kinds: ['fisica'] },
  { code: '608', name: 'Demás ingresos', kinds: ['fisica'] },
  { code: '610', name: 'Residentes en el Extranjero sin Establecimiento Permanente en México', kinds: ['fisica', 'moral'] },
  { code: '611', name: 'Ingresos por Dividendos (socios y accionistas)', kinds: ['fisica'] },
  { code: '612', name: 'Personas Físicas con Actividades Empresariales y Profesionales', kinds: ['fisica'] },
  { code: '614', name: 'Ingresos por intereses', kinds: ['fisica'] },
  { code: '615', name: 'Régimen de los ingresos por obtención de premios', kinds: ['fisica'] },
  { code: '616', name: 'Sin obligaciones fiscales', kinds: ['fisica'] },
  { code: '620', name: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos', kinds: ['moral'] },
  { code: '621', name: 'Incorporación Fiscal', kinds: ['fisica'] },
  { code: '622', name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', kinds: ['fisica', 'moral'] },
  { code: '623', name: 'Opcional para Grupos de Sociedades', kinds: ['moral'] },
  { code: '624', name: 'Coordinados', kinds: ['moral'] },
  { code: '625', name: 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', kinds: ['fisica'] },
  { code: '626', name: 'Régimen Simplificado de Confianza', kinds: ['fisica', 'moral'] },
];

export const CFDI_USES: SatOption[] = [
  { code: 'D01', name: 'Honorarios médicos, dentales y gastos hospitalarios', kinds: ['fisica'] },
  { code: 'D02', name: 'Gastos médicos por incapacidad o discapacidad', kinds: ['fisica'] },
  { code: 'D07', name: 'Primas por seguros de gastos médicos', kinds: ['fisica'] },
  { code: 'G01', name: 'Adquisición de mercancías', kinds: ['fisica', 'moral'] },
  { code: 'G03', name: 'Gastos en general', kinds: ['fisica', 'moral'] },
  { code: 'S01', name: 'Sin efectos fiscales', kinds: ['fisica', 'moral'] },
];

export const DEFAULT_CFDI_USE = 'D01';

export const regimeName = (code?: string | null) =>
  TAX_REGIMES.find((r) => r.code === code)?.name ?? code ?? '';
export const cfdiUseName = (code?: string | null) =>
  CFDI_USES.find((u) => u.code === code)?.name ?? code ?? '';

export interface BuyerFiscal {
  rfc: string;
  legal_name: string;
  tax_zip: string;
  tax_regime: string;
  cfdi_use: string;
  email?: string | null;
}

/** Texto listo para pegar en el sistema de facturación del médico. */
export function fiscalToClipboardText(f: BuyerFiscal): string {
  return [
    `RFC: ${f.rfc}`,
    `Nombre o razón social: ${f.legal_name}`,
    `Código postal fiscal: ${f.tax_zip}`,
    `Régimen fiscal: ${f.tax_regime} - ${regimeName(f.tax_regime)}`,
    `Uso de CFDI: ${f.cfdi_use} - ${cfdiUseName(f.cfdi_use)}`,
    f.email ? `Correo: ${f.email}` : '',
  ].filter(Boolean).join('\n');
}

/** Lee del XML del CFDI el UUID del timbre y el RFC del receptor. */
export function parseCfdiXml(xml: string): { uuid: string | null; receptorRfc: string | null; total: number | null } {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { uuid: null, receptorRfc: null, total: null };
    const tfd = doc.getElementsByTagNameNS('*', 'TimbreFiscalDigital')[0];
    const receptor = doc.getElementsByTagNameNS('*', 'Receptor')[0];
    const comprobante = doc.getElementsByTagNameNS('*', 'Comprobante')[0];
    const uuid = tfd?.getAttribute('UUID')?.trim().toUpperCase() || null;
    const receptorRfc = receptor?.getAttribute('Rfc')?.trim().toUpperCase() || null;
    const totalRaw = comprobante?.getAttribute('Total');
    return { uuid, receptorRfc, total: totalRaw ? Number(totalRaw) : null };
  } catch {
    return { uuid: null, receptorRfc: null, total: null };
  }
}

/** La tabla aún no existe (migración sin aplicar): la UI lo dice en vez de fallar. */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
}
