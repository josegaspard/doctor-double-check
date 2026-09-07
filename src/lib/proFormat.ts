// Utilidades de formato del diseño PRO (7-sep-2026). Todo con Intl: sin
// locales de date-fns que cargar y coherente con los 8 idiomas de la app.
import { getIntlLocale } from '@/lib/dateLocale';

type T = (path: string) => string;

const loc = (lang: string) => getIntlLocale(lang as any);

/** Rellena `{n}`-style placeholders: fill('En {n} min', { n: 5 }) */
export const fill = (tpl: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), tpl);

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const initialsOf = (name?: string | null) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?';

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const fmtTime = (d: Date, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

/** "5 sep" */
export const fmtDayShort = (d: Date, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { day: 'numeric', month: 'short' }).format(d).replace('.', '');

/** "lunes, 7 de septiembre" */
export const fmtDayLong = (d: Date, lang: string) =>
  cap(new Intl.DateTimeFormat(loc(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(d));

/** "7 sep 2026" */
export const fmtDate = (d: Date, lang: string) =>
  new Intl.DateTimeFormat(loc(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace('.', '');

/** Hoy / Mañana / Ayer / "12 sep" */
export const dayLabel = (d: Date, lang: string, t: T) => {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(d, now)) return t('pro.common.today');
  if (isSameDay(d, tomorrow)) return t('pro.common.tomorrow');
  if (isSameDay(d, yesterday)) return t('pro.common.yesterday');
  return fmtDayShort(d, lang);
};

/** "Hoy, 18:00" */
export const whenLabel = (d: Date, lang: string, t: T) => `${dayLabel(d, lang, t)}, ${fmtTime(d, lang)}`;

/** "GMT-6" según el navegador del usuario */
export const tzShort = (lang: string) => {
  try {
    const parts = new Intl.DateTimeFormat(loc(lang), { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
};

/** "Mexico City (UTC−6)" */
export const tzLabel = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '−';
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  return `${city} (UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''})`;
};

export const money = (n: number, lang: string, currency = 'MXN') =>
  new Intl.NumberFormat(loc(lang), { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

/** Búsqueda sin tildes ni mayúsculas */
export const norm = (s?: string | null) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
