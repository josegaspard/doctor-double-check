// Lectura de la lista de pacientes que sube un médico (13-sep-2026).
//
// Acepta un CSV (coma o punto y coma) o celdas pegadas desde Excel/Sheets
// (tabuladores). Detecta las columnas por su cabecera (nombre, apellidos,
// correo, teléfono, nota) y, si no hay cabecera, las deduce por el contenido.
// Valida y marca repetidas con las MISMAS reglas que la RPC
// `doctor_import_patient_invites`, para que la vista previa no prometa algo
// que la base luego rechaza. Aquí no se inventa ningún dato: una celda vacía
// se queda vacía.

export const INVITE_MAX_ROWS = 500;
export const INVITE_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
export const PHONE_RE = /^\+?[0-9]{8,15}$/;

export type RowIssue =
  | 'name_missing'
  | 'name_too_long'
  | 'contact_missing'
  | 'email_invalid'
  | 'phone_invalid'
  | 'note_too_long'
  | 'repeated_in_file';

export type Delimiter = '\t' | ';' | ',';

export interface PatientRowInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
}

export interface ParsedPatientRow extends PatientRowInput {
  /** Línea del texto original (1 = primera línea). */
  line: number;
  issue: RowIssue | null;
}

export interface ColumnMapping {
  name: number;
  lastName: number[];
  email: number;
  phone: number;
  note: number;
}

export interface ParseResult {
  delimiter: Delimiter;
  hasHeader: boolean;
  headers: string[];
  mapping: ColumnMapping;
  rows: ParsedPatientRow[];
  /** Filas con datos (sin contar cabecera ni líneas vacías). */
  dataRowCount: number;
  tooMany: boolean;
}

// Cabeceras reconocidas en los 8 idiomas de la app (es, en, pt, fr, it, de, ca, zh), ya
// normalizadas con normHeader (sin acentos, espacios ni signos). En fr, ca, de e it el apellido
// suele ir en su propia columna («Nom», «Cognom», «Nachname», «Cognome»): va en lastName, y como el
// nombre completo se compone `nombre + apellidos`, una sola columna «Nom» también funciona.
const HEADER_SYNONYMS: Record<'name' | 'lastName' | 'email' | 'phone' | 'note', string[]> = {
  name: [
    'nombre', 'nombres', 'nombrecompleto', 'nombreyapellido', 'nombreyapellidos', 'nombredelpaciente',
    'paciente', 'name', 'fullname', 'firstname', 'patient', 'patientname',
    'nome', 'nomecompleto', 'nomedopaciente', 'prenom', 'nomcomplet', 'nomedelpaziente', 'pazient', 'paziente',
    'vorname', 'vollstandigername', 'patientenname', 'nomcomplert', 'pacient',
    '姓名', '名字', '全名', '患者', '患者姓名', '病人', '名',
  ],
  lastName: [
    'apellido', 'apellidos', 'apellidopaterno', 'apellidomaterno', 'primerapellido', 'segundoapellido',
    'lastname', 'surname', 'familyname',
    'sobrenome', 'nom', 'nomdefamille', 'cognome', 'nachname', 'familienname', 'cognom', 'cognoms',
    '姓', '姓氏',
  ],
  email: [
    'correo', 'correoelectronico', 'email', 'mail', 'emailaddress', 'correoe', 'ecorreo',
    'correioeletronico', 'enderecodeemail', 'courriel', 'adresseemail', 'adressemail',
    'posta', 'postaelettronica', 'indirizzoemail', 'emailadresse', 'correu', 'correuelectronic',
    '邮箱', '电子邮件', '电子邮箱', '邮件', '邮箱地址',
  ],
  phone: [
    'telefono', 'tel', 'celular', 'cel', 'movil', 'whatsapp', 'phone', 'mobile', 'telefonocelular',
    'numerodetelefono', 'telefonomovil', 'phonenumber', 'cellphone', 'numero',
    'telefone', 'telemovel', 'numerodetelefone', 'telephone', 'portable', 'numerodetelephone',
    'cellulare', 'numeroditelefono', 'telefon', 'handy', 'mobiltelefon', 'telefonnummer', 'mobil',
    '电话', '手机', '手机号', '手机号码', '电话号码', '联系电话',
  ],
  note: [
    'nota', 'notas', 'observacion', 'observaciones', 'comentario', 'comentarios', 'note', 'notes',
    'comment', 'comments', 'motivo', 'detalle',
    'observacao', 'observacoes', 'remarque', 'remarques', 'commentaire', 'commentaires',
    'osservazioni', 'osservazione', 'commento', 'notiz', 'notizen', 'bemerkung', 'bemerkungen',
    'anmerkung', 'kommentar', 'observacions', 'comentaris',
    '备注', '说明', '注释', '附注',
  ],
};

const normHeader = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Letras latinas sin acento, cifras e ideogramas chinos (cabeceras en zh como «姓名»).
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '');

const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

export const cleanName = (s: string) => (s || '').replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim();

export const cleanEmail = (s: string) =>
  (s || '')
    .trim()
    .replace(/^mailto:/i, '')
    .replace(/^<|>$/g, '')
    .trim()
    .toLowerCase();

export const cleanPhone = (s: string) => {
  const kept = (s || '').replace(/[^0-9+]/g, '');
  if (!kept) return '';
  const phone = kept.startsWith('+') ? `+${kept.slice(1).replace(/\+/g, '')}` : kept.replace(/\+/g, '');
  return phone === '+' ? '' : phone;
};

export const cleanNote = (s: string) => (s || '').replace(CONTROL_RE, ' ').trim();

/** Mismo orden de comprobaciones que la RPC. */
export function validatePatientRow(row: PatientRowInput): RowIssue | null {
  const name = row.full_name || '';
  if (name.length < 2) return 'name_missing';
  if (name.length > 120) return 'name_too_long';
  if (!row.email && !row.phone) return 'contact_missing';
  if (row.email && (row.email.length > 254 || !EMAIL_RE.test(row.email))) return 'email_invalid';
  if (row.phone && !PHONE_RE.test(row.phone)) return 'phone_invalid';
  if (row.note && row.note.length > 500) return 'note_too_long';
  return null;
}

export function normalizePatientRow(input: { full_name?: string; email?: string; phone?: string; note?: string }): PatientRowInput {
  return {
    full_name: cleanName(input.full_name || ''),
    email: cleanEmail(input.email || '') || null,
    phone: cleanPhone(input.phone || '') || null,
    note: cleanNote(input.note || '') || null,
  };
}

/** Tabulador si lo hay (pegado desde Excel); si no, el separador más frecuente fuera de comillas. */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = (text || '').replace(/^\uFEFF/, '').split(/\r?\n/).find(l => l.trim().length > 0) || '';
  let inQuotes = false;
  const counts = { '\t': 0, ';': 0, ',': 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\t' || ch === ';' || ch === ',')) counts[ch] += 1;
  }
  if (counts['\t'] > 0) return '\t';
  return counts[';'] > counts[','] ? ';' : ',';
}

/** CSV con comillas («""» escapa comillas, saltos de línea dentro de comillas). */
export function splitDelimited(text: string, delimiter: Delimiter): { cells: string[]; line: number }[] {
  const src = (text || '').replace(/^\uFEFF/, '');
  const out: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  const pushRow = () => {
    cells.push(cell);
    if (cells.some(c => c.trim().length > 0)) out.push({ cells, line: rowLine });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') { cell = ''; inQuotes = true; continue; }
    if (ch === delimiter) { cells.push(cell); cell = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { pushRow(); line++; rowLine = line; continue; }
    cell += ch;
  }
  if (cell.length > 0 || cells.length > 0) pushRow();
  return out;
}

const emptyMapping = (): ColumnMapping => ({ name: -1, lastName: [], email: -1, phone: -1, note: -1 });

function mapHeaders(headers: string[]): ColumnMapping {
  const m = emptyMapping();
  headers.forEach((h, i) => {
    const k = normHeader(h);
    if (!k) return;
    if (m.email < 0 && HEADER_SYNONYMS.email.includes(k)) m.email = i;
    else if (m.phone < 0 && HEADER_SYNONYMS.phone.includes(k)) m.phone = i;
    else if (HEADER_SYNONYMS.lastName.includes(k)) m.lastName.push(i);
    else if (m.name < 0 && HEADER_SYNONYMS.name.includes(k)) m.name = i;
    else if (m.note < 0 && HEADER_SYNONYMS.note.includes(k)) m.note = i;
  });
  return m;
}

const looksLikeEmail = (v: string) => EMAIL_RE.test(cleanEmail(v));
const looksLikePhone = (v: string) => !/[a-z]/i.test(v) && PHONE_RE.test(cleanPhone(v));
const hasLetters = (v: string) => /\p{L}/u.test(v);

/** Sin cabecera: correo = la columna con más correos; teléfono = la de más teléfonos; nombre = la primera con letras. */
function inferMapping(sample: string[][]): ColumnMapping {
  const m = emptyMapping();
  const width = Math.max(0, ...sample.map(r => r.length));
  const ratio = (col: number, test: (v: string) => boolean) => {
    const vals = sample.map(r => (r[col] || '').trim()).filter(Boolean);
    return vals.length ? vals.filter(test).length / vals.length : 0;
  };
  let best = 0;
  for (let c = 0; c < width; c++) {
    const r = ratio(c, looksLikeEmail);
    if (r >= 0.5 && r > best) { best = r; m.email = c; }
  }
  best = 0;
  for (let c = 0; c < width; c++) {
    if (c === m.email) continue;
    const r = ratio(c, looksLikePhone);
    if (r >= 0.5 && r > best) { best = r; m.phone = c; }
  }
  for (let c = 0; c < width; c++) {
    if (c === m.email || c === m.phone) continue;
    if (m.name < 0 && ratio(c, hasLetters) >= 0.5) { m.name = c; continue; }
    if (m.name >= 0 && m.note < 0 && ratio(c, v => v.length > 0) > 0) m.note = c;
  }
  return m;
}

export function parsePatientText(text: string): ParseResult {
  const delimiter = detectDelimiter(text);
  const table = splitDelimited(text, delimiter);
  const headerCandidate = table[0]?.cells || [];
  const headerMapping = mapHeaders(headerCandidate);
  const headerLooksLikeData = headerCandidate.some(v => looksLikeEmail(v) || looksLikePhone(v));
  const hasHeader =
    table.length > 0 &&
    !headerLooksLikeData &&
    (headerMapping.name >= 0 || headerMapping.lastName.length > 0 || headerMapping.email >= 0 || headerMapping.phone >= 0);

  const data = hasHeader ? table.slice(1) : table;
  const mapping = hasHeader ? headerMapping : inferMapping(data.slice(0, 50).map(r => r.cells));
  const cell = (cells: string[], i: number) => (i >= 0 ? cells[i] || '' : '');

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const rows: ParsedPatientRow[] = data.map(({ cells, line }) => {
    const lastName = mapping.lastName.map(i => cell(cells, i)).join(' ');
    const normalized = normalizePatientRow({
      full_name: `${cell(cells, mapping.name)} ${lastName}`,
      email: cell(cells, mapping.email),
      phone: cell(cells, mapping.phone),
      note: cell(cells, mapping.note),
    });
    let issue = validatePatientRow(normalized);
    if (!issue) {
      if ((normalized.email && seenEmails.has(normalized.email)) || (!normalized.email && normalized.phone && seenPhones.has(normalized.phone))) {
        issue = 'repeated_in_file';
      } else {
        if (normalized.email) seenEmails.add(normalized.email);
        if (normalized.phone) seenPhones.add(normalized.phone);
      }
    }
    return { ...normalized, line, issue };
  });

  return {
    delimiter,
    hasHeader,
    headers: hasHeader ? headerCandidate.map(h => h.trim()) : [],
    mapping,
    rows,
    dataRowCount: rows.length,
    tooMany: rows.length > INVITE_MAX_ROWS,
  };
}

/** Plantilla vacía: solo la cabecera, sin pacientes de ejemplo. */
export const TEMPLATE_CSV = 'nombre,correo,telefono,nota\r\n';

/** Lee un archivo como UTF-8; si trae caracteres rotos (CSV de Excel en Windows), como Windows-1252. */
export async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return utf8;
  }
}
