#!/usr/bin/env node
// Auditoría de idioma (11-sep-2026).
//
// Dos informes en uno:
//   1. Por idioma, las claves que faltan respecto a es.ts (el fichero de
//      referencia) y las que sobran.
//   2. Por fichero del área del médico, los textos en duro que se ven en
//      pantalla y no pasan por t().
//
// No modifica nada: solo lee e imprime. Los ficheros de idioma son objetos JS
// planos (sin imports ni sintaxis de TypeScript), así que se cargan copiándolos
// a un .mjs temporal; si algún día llevan TypeScript, se usa esbuild.
//
// Uso:
//   node scripts/i18n-audit.mjs                 informe completo
//   node scripts/i18n-audit.mjs --lang=ca       solo un idioma
//   node scripts/i18n-audit.mjs --area=all      textos en duro de toda la app
//   node scripts/i18n-audit.mjs --max=20        cuántos ejemplos por bloque
//   node scripts/i18n-audit.mjs --json          salida en JSON
//   node scripts/i18n-audit.mjs --strict        sale con código 1 si falta algo

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');            // .../medical-masters/src
const APP = path.join(ROOT, 'src');               // .../medical-masters/src/src
const I18N_DIR = path.join(APP, 'lib', 'i18n');

const BASE_LANG = 'es';
const LANGS = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'zh'];

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};
const ONLY_LANG = flag('lang');
const AREA = flag('area', 'doctor');
const MAX = Number(flag('max', 12)) || 12;
const AS_JSON = Boolean(flag('json', false));
const STRICT = Boolean(flag('strict', false));

const num = (n) => n.toLocaleString('es-MX');

// ---------------------------------------------------------------------------
// 1. Claves por idioma
// ---------------------------------------------------------------------------
async function loadLanguage(lang) {
  const file = path.join(I18N_DIR, `${lang}.ts`);
  const source = fs.readFileSync(file, 'utf8');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-i18n-'));
  const tmpFile = path.join(tmpDir, `${lang}.mjs`);
  try {
    fs.writeFileSync(tmpFile, source, 'utf8');
    let mod;
    try {
      mod = await import(pathToFileURL(tmpFile).href);
    } catch (err) {
      // Respaldo por si el fichero pasa a llevar sintaxis de TypeScript.
      const esbuild = await import('esbuild').catch(() => null);
      if (!esbuild) throw err;
      const out = await esbuild.transform(source, { loader: 'ts', format: 'esm' });
      fs.writeFileSync(tmpFile, out.code, 'utf8');
      mod = await import(`${pathToFileURL(tmpFile).href}?t=${Date.now()}`);
    }
    const dict = mod[lang] ?? mod.default;
    if (!dict || typeof dict !== 'object') throw new Error(`${lang}.ts no exporta un objeto`);
    return dict;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Textos en duro
// ---------------------------------------------------------------------------

// Ficheros que ve el médico (el mismo recorte que el mapa de «Idioma»), más las
// carpetas nuevas de la reorganización.
const DOCTOR_DIRS = [
  'components/doctor', 'components/availability', 'components/agenda', 'components/patients',
  'components/layout', 'components/chat', 'components/live', 'components/recordings',
  'components/content', 'components/education', 'components/meetings', 'components/wallet',
  'components/vault', 'components/settings', 'components/subscriptions', 'components/invoices',
  'components/finance', 'components/community', 'components/directory', 'components/schedule',
  'components/prescriptions', 'components/notifications', 'components/common', 'components/confirm',
];
const DOCTOR_PAGES = [
  'Settings.tsx', 'UserProfile.tsx', 'SubscribersList.tsx', 'Chat.tsx', 'LivesGrid.tsx',
  'RecordingsGrid.tsx', 'Notifications.tsx', 'Wallet.tsx', 'WalletLedger.tsx', 'Meetings.tsx',
  'MyAppointments.tsx', 'MedicalEducation.tsx', 'Foro.tsx', 'Prescriptions.tsx', 'MyBooks.tsx',
  'MyOrders.tsx', 'ContentGallery.tsx',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function targetFiles() {
  if (AREA === 'all') return walk(path.join(APP, 'pages')).concat(walk(path.join(APP, 'components')));
  const files = [];
  const pagesDir = path.join(APP, 'pages');
  if (fs.existsSync(pagesDir)) {
    for (const name of fs.readdirSync(pagesDir)) {
      if (!/\.tsx$/.test(name)) continue;
      if (name.startsWith('Doctor') || DOCTOR_PAGES.includes(name)) files.push(path.join(pagesDir, name));
    }
  }
  for (const dir of DOCTOR_DIRS) files.push(...walk(path.join(APP, dir)));
  return [...new Set(files)].sort();
}

// Marcas, siglas y tecnicismos que no se traducen.
const ALLOW = new Set([
  'medical masters', 'stripe', 'pdf', 'live', 'lives', 'ok', 'id', 'dmca', 'mxn', 'usd', 'eur',
  'whatsapp', 'google', 'apple', 'zoom', 'daily', 'cloudflare', 'supabase', 'bunny', 'sms', 'otp',
  'mfa', 'kyc', 'clabe', 'rfc', 'curp', 'url', 'html', 'css', 'api', 'iban', 'qr', 'ia', 'ai',
  'medical', 'masters', 'email', 'e-mail', 'chat', 'web', 'app',
]);

const LETTER = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÇç]/;

function looksLikeCopy(text) {
  const s = text.trim();
  if (s.length < 3 || s.length > 240) return false;
  if (!LETTER.test(s)) return false;
  if (ALLOW.has(s.toLowerCase())) return false;
  if (/^[0-9\s.,:%+\-–—·|/()]+$/.test(s)) return false;
  if (/^(https?:|\/|#|\.|@|data:|mailto:)/.test(s)) return false;
  if (/[{}$`]/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s) && !s.includes(' ')) return false;      // identificador suelto
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(s)) return false;                   // slug o clase
  if (/^[a-z]+(\.[a-z][a-zA-Z0-9]*)+$/.test(s)) return false;                // clave i18n
  if (!s.includes(' ') && s.length < 4) return false;
  return true;
}

// Quita comentarios para no marcarlos como copy (conserva la longitud → las
// líneas siguen cuadrando).
function stripComments(source) {
  let out = '';
  let mode = 'code';
  for (let i = 0; i < source.length; i++) {
    const two = source.slice(i, i + 2);
    if (mode === 'code' && two === '//') { mode = 'line'; out += '  '; i++; continue; }
    if (mode === 'code' && two === '/*') { mode = 'block'; out += '  '; i++; continue; }
    if (mode === 'line' && source[i] === '\n') { mode = 'code'; out += '\n'; continue; }
    if (mode === 'block' && two === '*/') { mode = 'code'; out += '  '; i++; continue; }
    if (mode === 'code') out += source[i];
    else out += source[i] === '\n' ? '\n' : ' ';
  }
  return out;
}

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

const TEXT_PROPS = /\b(placeholder|title|aria-label|alt|label|description|tooltip|emptyMessage|confirmText|cancelText|submitLabel)\s*=\s*(["'])([^"']{3,240})\2/g;
const TOASTS = /\btoast(?:\.(?:success|error|info|warning|message|loading))?\(\s*(["'])([^"']{3,240})\1/g;
const JSX_TEXT = />([^<>{}\n][^<>{}]{1,239})</g;

function scanFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const source = stripComments(raw);
  const hits = [];
  const seen = new Set();
  const push = (kind, index, text) => {
    const line = lineAt(source, index);
    const key = `${line}:${text.trim()}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ line, kind, text: text.trim().replace(/\s+/g, ' ') });
  };

  let m;
  while ((m = JSX_TEXT.exec(source))) {
    const text = m[1];
    if (/[=;()[\]/\\]/.test(text)) continue;          // trozos de código, no copy
    if (looksLikeCopy(text)) push('jsx', m.index + 1, text);
  }
  while ((m = TEXT_PROPS.exec(source))) {
    if (looksLikeCopy(m[3])) push(`prop:${m[1]}`, m.index, m[3]);
  }
  while ((m = TOASTS.exec(source))) {
    if (looksLikeCopy(m[2])) push('toast', m.index, m[2]);
  }

  hits.sort((a, b) => a.line - b.line);
  return hits;
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
async function main() {
  const dicts = {};
  for (const lang of LANGS) dicts[lang] = flatten(await loadLanguage(lang));

  const base = dicts[BASE_LANG];
  const baseKeys = [...base.keys()];
  const langs = (ONLY_LANG && ONLY_LANG !== true ? String(ONLY_LANG).split(',') : LANGS)
    .filter((l) => LANGS.includes(l));

  const keyReport = langs.map((lang) => {
    const dict = dicts[lang];
    const missing = baseKeys.filter((k) => !dict.has(k));
    const extra = [...dict.keys()].filter((k) => !base.has(k));
    return {
      lang,
      total: dict.size,
      missing: missing.length,
      extra: extra.length,
      coverage: baseKeys.length ? 1 - missing.length / baseKeys.length : 1,
      sampleMissing: missing.slice(0, MAX),
      sampleExtra: extra.slice(0, MAX),
    };
  });

  const files = targetFiles();
  const hardcoded = [];
  for (const file of files) {
    const hits = scanFile(file);
    if (hits.length) hardcoded.push({ file: path.relative(ROOT, file), hits });
  }
  hardcoded.sort((a, b) => b.hits.length - a.hits.length);
  const hardcodedTotal = hardcoded.reduce((acc, f) => acc + f.hits.length, 0);

  if (AS_JSON) {
    console.log(JSON.stringify({
      baseLanguage: BASE_LANG,
      baseKeys: baseKeys.length,
      languages: keyReport,
      area: AREA,
      filesScanned: files.length,
      hardcodedTotal,
      hardcoded,
    }, null, 2));
  } else {
    console.log(`\n=== CLAVES POR IDIOMA (referencia: ${BASE_LANG}.ts, ${num(baseKeys.length)} claves) ===\n`);
    for (const r of keyReport) {
      const pct = (r.coverage * 100).toFixed(1).replace('.', ',');
      console.log(
        `${r.lang.padEnd(3)} ${String(num(r.total)).padStart(6)} claves   ` +
        `faltan ${String(num(r.missing)).padStart(5)}   sobran ${String(num(r.extra)).padStart(4)}   ${pct} %`,
      );
      if (r.sampleMissing.length) console.log(`      faltan p. ej.: ${r.sampleMissing.join(', ')}${r.missing > MAX ? ' …' : ''}`);
      if (r.sampleExtra.length) console.log(`      sobran p. ej.: ${r.sampleExtra.join(', ')}${r.extra > MAX ? ' …' : ''}`);
    }

    console.log(`\n=== TEXTOS EN DURO (${AREA === 'all' ? 'toda la app' : 'área del médico'}: ${files.length} ficheros, ${num(hardcodedTotal)} hallazgos) ===\n`);
    console.log('Detección heurística: revisa cada línea antes de tocarla.\n');
    for (const f of hardcoded) {
      console.log(`${f.file}  (${f.hits.length})`);
      for (const h of f.hits.slice(0, MAX)) {
        console.log(`   ${String(h.line).padStart(5)}  ${h.kind.padEnd(12)} «${h.text}»`);
      }
      if (f.hits.length > MAX) console.log(`   … y ${f.hits.length - MAX} más`);
    }

    const totalMissing = keyReport.reduce((acc, r) => acc + r.missing, 0);
    console.log(`\nRESUMEN: ${num(totalMissing)} claves sin traducir en ${keyReport.length} idiomas · ` +
      `${num(hardcodedTotal)} textos en duro en ${hardcoded.length} de ${files.length} ficheros.\n`);
  }

  if (STRICT) {
    const broken = keyReport.some((r) => r.missing > 0) || hardcodedTotal > 0;
    if (broken) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[i18n-audit]', err);
  process.exitCode = 2;
});
