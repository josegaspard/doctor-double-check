// Formateador común de fechas y horas del área del médico (11-sep-2026).
//
// Antes cada pantalla escribía `locale: es` o 'es-MX' a mano (o nada), así que
// una sesión en inglés veía los meses en castellano y una en catalán los días en
// inglés. Todo lo nuevo formatea por aquí: el idioma sale de useLanguage y el
// locale de lib/dateLocale, que ya cubre los 8 idiomas.
//
// Nada en duro: ni el locale, ni la zona horaria (la del navegador), ni el
// primer día de la semana.
import { useMemo } from 'react';
import { format as formatFns } from 'date-fns';
import type { Locale } from 'date-fns';
import { getDateLocale, getIntlLocale } from '@/lib/dateLocale';
import { useLanguage } from '@/contexts/LanguageContext';

export type WeekStart = 0 | 1;
export type DateLike = Date | string | number;
export type WeekdayWidth = 'long' | 'short';

/** Idiomas en los que la semana empieza en lunes (el resto usa el del locale). */
const MONDAY_FIRST = new Set(['es', 'ca', 'fr', 'it', 'de', 'pt']);

const toDate = (value: DateLike): Date => (value instanceof Date ? value : new Date(value));

const capIn = (s: string, intlLocale: string) =>
  s ? s.charAt(0).toLocaleUpperCase(intlLocale) + s.slice(1) : s;

export interface AppDateFormat {
  /** Idioma activo de la sesión */
  language: string;
  /** Locale de date-fns, para `format()` y para react-day-picker */
  locale: Locale;
  /** Locale BCP-47, para Intl */
  intlLocale: string;
  /** 0 = domingo, 1 = lunes */
  weekStartsOn: WeekStart;
  /** Zona horaria del navegador (IANA), p. ej. "America/Mexico_City" */
  timeZone: string;
  /** Fecha con patrón de date-fns; por defecto 'PPP' → "11 de septiembre de 2026" */
  formatDate: (value: DateLike, pattern?: string) => string;
  /** Hora en 24 h → "18:30" */
  formatTime: (value: DateLike) => string;
  /** "11 sep 2026, 18:30" */
  formatDateTime: (value: DateLike) => string;
  /** Día de la semana por número (0 = domingo, como Date.getDay()) */
  formatWeekday: (day: number, width?: WeekdayWidth) => string;
  /** "septiembre de 2026" */
  formatMonthYear: (value: DateLike) => string;
  /** Días de la semana ordenados según weekStartsOn (números 0-6) */
  weekdayOrder: number[];
  /** "2026-09-11" en hora LOCAL (no UTC): sirve de clave de día */
  toDateKey: (value: DateLike) => string;
  /** "2026-09-11" → Date a las 00:00 locales */
  parseDateKey: (key: string) => Date;
  /** "Mexico City (UTC−6)" */
  tzLabel: () => string;
}

export function getAppDateFormat(language: string): AppDateFormat {
  const locale = getDateLocale(language);
  const intlLocale = getIntlLocale(language);
  const weekStartsOn: WeekStart = MONDAY_FIRST.has(language)
    ? 1
    : ((locale.options?.weekStartsOn ?? 0) as WeekStart);
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  })();

  const formatDate = (value: DateLike, pattern = 'PPP') => {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return '';
    return formatFns(d, pattern, { locale, weekStartsOn });
  };

  const formatTime = (value: DateLike) => {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(intlLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d);
  };

  const formatDateTime = (value: DateLike) => {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${formatDate(d, 'd MMM yyyy').replace('.', '')}, ${formatTime(d)}`;
  };

  const formatWeekday = (day: number, width: WeekdayWidth = 'long') => {
    const index = ((day % 7) + 7) % 7;
    const label = locale.localize?.day(index as 0 | 1 | 2 | 3 | 4 | 5 | 6, {
      width: width === 'long' ? 'wide' : 'abbreviated',
    });
    return capIn(String(label ?? ''), intlLocale).replace('.', '');
  };

  const formatMonthYear = (value: DateLike) => {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return '';
    return capIn(new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(d), intlLocale);
  };

  const weekdayOrder = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

  const toDateKey = (value: DateLike) => {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const parseDateKey = (key: string) => {
    const [y, m, d] = String(key || '').split('-').map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const tzLabel = () => {
    const off = -new Date().getTimezoneOffset();
    const sign = off >= 0 ? '+' : '−';
    const h = Math.floor(Math.abs(off) / 60);
    const m = Math.abs(off) % 60;
    const city = timeZone.split('/').pop()?.replace(/_/g, ' ') || timeZone;
    return `${city} (UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''})`;
  };

  return {
    language,
    locale,
    intlLocale,
    weekStartsOn,
    timeZone,
    formatDate,
    formatTime,
    formatDateTime,
    formatWeekday,
    formatMonthYear,
    weekdayOrder,
    toDateKey,
    parseDateKey,
    tzLabel,
  };
}

/** Formateador atado al idioma activo de la sesión. */
export function useAppDateFormat(): AppDateFormat {
  const { language } = useLanguage();
  return useMemo(() => getAppDateFormat(language), [language]);
}
