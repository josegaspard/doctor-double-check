import { es } from './i18n/es';
import { en } from './i18n/en';
import { pt } from './i18n/pt';
import { fr } from './i18n/fr';
import { it } from './i18n/it';
import { de } from './i18n/de';
import { ca } from './i18n/ca';
import { zh } from './i18n/zh';

// Idiomas que ofrece la plataforma. Decisión del cliente (11-sep-2026): se
// mantienen los 8 y se traduce TODO; ninguno se oculta.
export const SUPPORTED_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ca', 'zh'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Idioma de arranque cuando no hay elección del usuario ni perfil. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

/** Idioma puente cuando falta una clave en el idioma activo (ver `t`). */
export const BRIDGE_LANGUAGE: SupportedLanguage = 'en';

// Nombre de cada idioma EN SU PROPIO idioma. Un desplegable de idiomas se lee
// así en todas las sesiones: quien se dejó el chino puesto encuentra el suyo.
export const LANGUAGE_AUTONYMS: Record<SupportedLanguage, string> = {
  es: 'Castellano',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  ca: 'Català',
  zh: '中文',
};

export const translations = {
  es,
  en,
  pt,
  fr,
  it,
  de,
  ca,
  zh,
} as const;

export type TranslationKey = keyof typeof translations.es;

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Normaliza cualquier código de idioma al de la sesión: 'pt-BR' → 'pt',
 * 'ZH-Hans-CN' → 'zh', vacío o desconocido → castellano.
 * Es la ÚNICA función que decide esto (LanguageContext, i18n-context,
 * ChunkErrorBoundary y dateLocale la usan).
 */
export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) return DEFAULT_LANGUAGE;
  const base = value.trim().slice(0, 2).toLowerCase();
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function getTranslations(language: SupportedLanguage | string) {
  return translations[normalizeLanguage(language)];
}

// ---------------------------------------------------------------------------
// Claves que faltan: registro en memoria + aviso en desarrollo
// ---------------------------------------------------------------------------
const missingByLanguage = new Map<string, Set<string>>();
const isDev = Boolean(import.meta.env?.DEV);

function reportMissing(language: string, path: string) {
  let set = missingByLanguage.get(language);
  if (!set) {
    set = new Set<string>();
    missingByLanguage.set(language, set);
  }
  if (set.has(path)) return;
  set.add(path);
  if (isDev) console.warn(`[i18n] falta la clave "${path}" en "${language}"`);
}

/** Claves que han faltado en esta sesión, por idioma. Para depurar y para el guion de auditoría. */
export function getMissingTranslations(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  missingByLanguage.forEach((set, lang) => {
    out[lang] = Array.from(set).sort();
  });
  return out;
}

export function clearMissingTranslations() {
  missingByLanguage.clear();
}

function lookup(language: SupportedLanguage, keys: string[]): string | undefined {
  let node: any = translations[language];
  for (const key of keys) {
    if (node && typeof node === 'object' && key in node) node = node[key];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Traduce una clave al idioma de la sesión.
 *
 * REGLA DE RESPALDO (11-sep-2026): una sesión = un solo idioma. Antes, si
 * faltaba la clave se devolvía el castellano en silencio, y por eso el menú
 * salía en catalán y las pantallas nuevas en castellano.
 *   - Idioma activo. Si está, se usa.
 *   - Si falta y el idioma NO es castellano → inglés (idioma puente, el único
 *     con paridad completa frente a es.ts). Jamás castellano.
 *   - Si falta también en inglés: en desarrollo se devuelve la clave (el fallo
 *     tiene que verse y el test de paridad del integrador lo caza); en
 *     producción, castellano como última red para no dejar la pantalla con un
 *     "pro.agenda.title" delante del médico.
 *   - En castellano (idioma de referencia) una clave que falta es un fallo del
 *     código: se avisa y se devuelve la clave, como antes.
 */
export function t(language: SupportedLanguage | string, path: string): string {
  const lang = normalizeLanguage(language);
  const keys = path.split('.');

  const direct = lookup(lang, keys);
  if (direct !== undefined) return direct;

  reportMissing(lang, path);

  if (lang === DEFAULT_LANGUAGE) return path;

  if (lang !== BRIDGE_LANGUAGE) {
    const bridge = lookup(BRIDGE_LANGUAGE, keys);
    if (bridge !== undefined) return bridge;
    reportMissing(BRIDGE_LANGUAGE, path);
  }

  if (isDev) return path;
  return lookup(DEFAULT_LANGUAGE, keys) ?? path;
}
