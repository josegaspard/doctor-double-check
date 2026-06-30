// Verificación de cédula / colegiación / licencia médica por país.
// No existe una API pública universal para validar cédulas médicas de todos los
// países, así que enlazamos al registro / colegio / autoridad OFICIAL de cada país
// (verificación MANUAL). Cubrimos +40 países de América, Europa, Asia, Oceanía y
// África; cualquier país no listado cae a la lista completa de registros.

export interface CedulaRegistry {
  /** Nombre del país (para mostrar). */
  country: string;
  /** Organismo / registro oficial. */
  authority: string;
  /** URL de consulta pública para verificar la cédula/colegiación/licencia. */
  url: string;
}

// Claves = código ISO-2 de país (mismo formato que el countryCode del perfil).
export const CEDULA_REGISTRIES: Record<string, CedulaRegistry> = {
  // ───────── América Latina ─────────
  MX: { country: 'México', authority: 'Registro Nacional de Profesionistas (SEP)', url: 'https://www.cedulaprofesional.sep.gob.mx/cedula/presidencia/indexAvanzada.action' },
  AR: { country: 'Argentina', authority: 'REFEPS · SISA (Min. de Salud)', url: 'https://sisa.msal.gov.ar/sisa/' },
  BO: { country: 'Bolivia', authority: 'Colegio Médico de Bolivia', url: 'https://colmedbolivia.org/' },
  BR: { country: 'Brasil', authority: 'Conselho Federal de Medicina (CFM)', url: 'https://portal.cfm.org.br/busca-medicos/' },
  CL: { country: 'Chile', authority: 'Registro Nacional de Prestadores (Superintendencia de Salud)', url: 'https://rnpi.superdesalud.gob.cl/' },
  CO: { country: 'Colombia', authority: 'ReTHUS (MinSalud)', url: 'https://web.sispro.gov.co/THUS/Cliente/ConsultasPublicas/ConsultaPublicaDeTalentoHumano.aspx' },
  CR: { country: 'Costa Rica', authority: 'Colegio de Médicos y Cirujanos', url: 'https://www.medicos.cr/' },
  EC: { country: 'Ecuador', authority: 'SENESCYT · Consultas', url: 'https://www.senescyt.gob.ec/consultas/' },
  SV: { country: 'El Salvador', authority: 'Junta de Vigilancia de la Profesión Médica', url: 'https://jvpm.gob.sv/' },
  GT: { country: 'Guatemala', authority: 'Colegio de Médicos y Cirujanos', url: 'https://colmedegua.org/' },
  PA: { country: 'Panamá', authority: 'Ministerio de Salud (MINSA)', url: 'https://www.minsa.gob.pa/' },
  PY: { country: 'Paraguay', authority: 'Ministerio de Salud (MSPyBS)', url: 'https://www.mspbs.gov.py/' },
  PE: { country: 'Perú', authority: 'Colegio Médico del Perú', url: 'https://aplicaciones.cmp.org.pe/conoce_a_tu_medico/' },
  DO: { country: 'República Dominicana', authority: 'Colegio Médico Dominicano', url: 'https://www.cmd.org.do/' },
  UY: { country: 'Uruguay', authority: 'Colegio Médico del Uruguay', url: 'https://www.colegiomedico.org.uy/' },
  VE: { country: 'Venezuela', authority: 'Federación Médica Venezolana', url: 'https://www.federacionmedicavenezolana.org/' },
  // ───────── Norteamérica ─────────
  US: { country: 'Estados Unidos', authority: 'FSMB · DocInfo', url: 'https://www.docinfo.org/' },
  CA: { country: 'Canadá', authority: 'FMRAC (autoridades médicas)', url: 'https://www.fmrac.ca/' },
  // ───────── Europa ─────────
  ES: { country: 'España', authority: 'Consejo General de Colegios de Médicos (CGCOM)', url: 'https://www.cgcom.es/' },
  PT: { country: 'Portugal', authority: 'Ordem dos Médicos', url: 'https://ordemdosmedicos.pt/' },
  FR: { country: 'Francia', authority: "Ordre National des Médecins", url: 'https://www.conseil-national.medecin.fr/' },
  DE: { country: 'Alemania', authority: 'Bundesärztekammer', url: 'https://www.bundesaerztekammer.de/' },
  IT: { country: 'Italia', authority: 'FNOMCeO', url: 'https://portale.fnomceo.it/cerca-prof/' },
  GB: { country: 'Reino Unido', authority: 'General Medical Council (GMC)', url: 'https://www.gmc-uk.org/registration-and-licensing/the-medical-register' },
  IE: { country: 'Irlanda', authority: 'Medical Council', url: 'https://www.medicalcouncil.ie/public-information/check-the-register/' },
  NL: { country: 'Países Bajos', authority: 'BIG-register', url: 'https://www.bigregister.nl/' },
  BE: { country: 'Bélgica', authority: 'Ordre des médecins (Ordomedic)', url: 'https://ordomedic.be/' },
  CH: { country: 'Suiza', authority: 'MedReg (Confederación)', url: 'https://www.medregom.admin.ch/' },
  AT: { country: 'Austria', authority: 'Österreichische Ärztekammer', url: 'https://www.aerztekammer.at/arztsuche' },
  PL: { country: 'Polonia', authority: 'Naczelna Izba Lekarska', url: 'https://rejestr.nil.org.pl/' },
  SE: { country: 'Suecia', authority: 'Socialstyrelsen', url: 'https://www.socialstyrelsen.se/' },
  NO: { country: 'Noruega', authority: 'Helsepersonellregisteret', url: 'https://helsepersonell.helsedirektoratet.no/' },
  DK: { country: 'Dinamarca', authority: 'Autorisationsregister (STPS)', url: 'https://autorisation.stps.dk/' },
  FI: { country: 'Finlandia', authority: 'JulkiTerhikki (Valvira)', url: 'https://julkiterhikki.valvira.fi/' },
  RO: { country: 'Rumanía', authority: 'Colegiul Medicilor din România', url: 'https://www.cmr.ro/' },
  CZ: { country: 'Chequia', authority: 'Česká lékařská komora', url: 'https://www.lkcr.cz/' },
  RU: { country: 'Rusia', authority: 'Roszdravnadzor', url: 'https://roszdravnadzor.gov.ru/' },
  TR: { country: 'Turquía', authority: 'Türk Tabipleri Birliği', url: 'https://www.ttb.org.tr/' },
  // ───────── Asia / Medio Oriente ─────────
  IN: { country: 'India', authority: 'National Medical Commission (Indian Medical Register)', url: 'https://www.nmc.org.in/information-desk/indian-medical-register/' },
  CN: { country: 'China', authority: 'National Health Commission (NHC)', url: 'http://www.nhc.gov.cn/' },
  JP: { country: 'Japón', authority: 'MHLW · 医師等資格確認検索', url: 'https://licenseif.mhlw.go.jp/search_isei/' },
  KR: { country: 'Corea del Sur', authority: 'Korean Medical Association', url: 'https://www.kma.org/' },
  PH: { country: 'Filipinas', authority: 'PRC · Verification', url: 'https://online.prc.gov.ph/Verification' },
  ID: { country: 'Indonesia', authority: 'Konsil Kedokteran Indonesia (KKI)', url: 'https://www.kki.go.id/' },
  MY: { country: 'Malasia', authority: 'Malaysian Medical Council (MMC)', url: 'https://mmc.gov.my/' },
  SG: { country: 'Singapur', authority: 'Singapore Medical Council (MOH)', url: 'https://prs.moh.gov.sg/' },
  TH: { country: 'Tailandia', authority: 'Thai Medical Council', url: 'https://www.tmc.or.th/' },
  PK: { country: 'Pakistán', authority: 'PMDC', url: 'https://www.pmdc.pk/' },
  SA: { country: 'Arabia Saudita', authority: 'SCFHS', url: 'https://www.scfhs.org.sa/' },
  AE: { country: 'Emiratos Árabes Unidos', authority: 'Dubai Health Authority (DHA)', url: 'https://www.dha.gov.ae/' },
  IL: { country: 'Israel', authority: 'Ministry of Health', url: 'https://www.health.gov.il/' },
  // ───────── Oceanía ─────────
  AU: { country: 'Australia', authority: 'AHPRA', url: 'https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx' },
  NZ: { country: 'Nueva Zelanda', authority: 'Medical Council of New Zealand', url: 'https://www.mcnz.org.nz/' },
  // ───────── África ─────────
  ZA: { country: 'Sudáfrica', authority: 'HPCSA', url: 'https://www.hpcsa.co.za/' },
  NG: { country: 'Nigeria', authority: 'MDCN', url: 'https://www.mdcn.gov.ng/' },
  EG: { country: 'Egipto', authority: 'Egyptian Medical Syndicate', url: 'https://www.ems.org.eg/' },
};

// Texto libre que el doctor escribe en "País" → código ISO-2.
const NAME_TO_ISO: Record<string, string> = {
  'mexico': 'MX', 'méxico': 'MX',
  'argentina': 'AR',
  'bolivia': 'BO',
  'brasil': 'BR', 'brazil': 'BR',
  'chile': 'CL',
  'colombia': 'CO',
  'costa rica': 'CR',
  'ecuador': 'EC',
  'el salvador': 'SV', 'salvador': 'SV',
  'guatemala': 'GT',
  'panama': 'PA', 'panamá': 'PA',
  'paraguay': 'PY',
  'peru': 'PE', 'perú': 'PE',
  'republica dominicana': 'DO', 'república dominicana': 'DO', 'dominican republic': 'DO',
  'uruguay': 'UY',
  'venezuela': 'VE',
  'estados unidos': 'US', 'usa': 'US', 'united states': 'US', 'eeuu': 'US', 'ee.uu.': 'US', 'eua': 'US',
  'canada': 'CA', 'canadá': 'CA',
  'espana': 'ES', 'españa': 'ES', 'spain': 'ES',
  'portugal': 'PT',
  'francia': 'FR', 'france': 'FR',
  'alemania': 'DE', 'germany': 'DE', 'deutschland': 'DE',
  'italia': 'IT', 'italy': 'IT',
  'reino unido': 'GB', 'united kingdom': 'GB', 'uk': 'GB', 'inglaterra': 'GB', 'england': 'GB', 'gran bretana': 'GB', 'gran bretaña': 'GB',
  'irlanda': 'IE', 'ireland': 'IE',
  'paises bajos': 'NL', 'países bajos': 'NL', 'holanda': 'NL', 'netherlands': 'NL',
  'belgica': 'BE', 'bélgica': 'BE', 'belgium': 'BE',
  'suiza': 'CH', 'switzerland': 'CH',
  'austria': 'AT',
  'polonia': 'PL', 'poland': 'PL',
  'suecia': 'SE', 'sweden': 'SE',
  'noruega': 'NO', 'norway': 'NO',
  'dinamarca': 'DK', 'denmark': 'DK',
  'finlandia': 'FI', 'finland': 'FI',
  'rumania': 'RO', 'rumanía': 'RO', 'romania': 'RO',
  'chequia': 'CZ', 'republica checa': 'CZ', 'república checa': 'CZ', 'czech republic': 'CZ',
  'rusia': 'RU', 'russia': 'RU',
  'turquia': 'TR', 'turquía': 'TR', 'turkey': 'TR',
  'india': 'IN',
  'china': 'CN',
  'japon': 'JP', 'japón': 'JP', 'japan': 'JP',
  'corea del sur': 'KR', 'corea': 'KR', 'south korea': 'KR', 'korea': 'KR',
  'filipinas': 'PH', 'philippines': 'PH',
  'indonesia': 'ID',
  'malasia': 'MY', 'malaysia': 'MY',
  'singapur': 'SG', 'singapore': 'SG',
  'tailandia': 'TH', 'thailand': 'TH',
  'pakistan': 'PK', 'pakistán': 'PK',
  'arabia saudita': 'SA', 'arabia saudí': 'SA', 'saudi arabia': 'SA',
  'emiratos arabes unidos': 'AE', 'emiratos árabes unidos': 'AE', 'emiratos': 'AE', 'uae': 'AE',
  'israel': 'IL',
  'australia': 'AU',
  'nueva zelanda': 'NZ', 'new zealand': 'NZ',
  'sudafrica': 'ZA', 'sudáfrica': 'ZA', 'south africa': 'ZA',
  'nigeria': 'NG',
  'egipto': 'EG', 'egypt': 'EG',
};

export function resolveCountryIso(input?: string | null): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (!key) return null;
  if (CEDULA_REGISTRIES[key.toUpperCase()]) return key.toUpperCase();
  return NAME_TO_ISO[key] || null;
}

export function getCedulaRegistry(country?: string | null): CedulaRegistry | null {
  const iso = resolveCountryIso(country);
  return iso ? CEDULA_REGISTRIES[iso] : null;
}

// ───────── Credencial de especialista / colegiado (según el país) ─────────
// Algunos países nombran la credencial del especialista de forma distinta:
//   - México: "Cédula de especialista" (cédula de especialidad emitida por la SEP).
//   - España y la mayoría de países hispanohablantes con colegio médico: "N.º de colegiado".
//   - Resto / país desconocido: etiqueta combinada "Cédula de especialista / colegiado".
// Se usa SOLO para elegir la etiqueta del campo; el valor se guarda igual.
const COLEGIADO_ISO = new Set([
  'ES', 'PE', 'BO', 'CO', 'CR', 'GT', 'DO', 'UY', 'VE', 'PA', 'PY', 'AR', 'EC', 'CL', 'SV',
]);

/** Devuelve la CLAVE i18n de la etiqueta del campo según el país del doctor. */
export function getSpecialistCredentialLabelKey(country?: string | null): string {
  const iso = resolveCountryIso(country);
  if (iso === 'MX') return 'profile.specialistCedula';        // Cédula de especialista
  if (iso && COLEGIADO_ISO.has(iso)) return 'profile.colegiado'; // N.º de colegiado
  return 'profile.specialistOrColegiado';                     // Cédula de especialista / colegiado
}

// Cédula de relleno DETERMINISTA (estable por usuario) para que el campo nunca
// aparezca vacío en el perfil mientras el doctor no registre la suya real.
export function generatePlaceholderCedula(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const n = 10000000 + (h % 90000000); // 8 dígitos
  return String(n);
}
