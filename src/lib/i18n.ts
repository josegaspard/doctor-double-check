// Solo el castellano (idioma por defecto y última red de `t`) va en el chunk
// inicial. Los otros 7 diccionarios (~480 kB cada uno) se cargan bajo demanda
// con `loadLanguage` (main.tsx precarga el de la sesión antes de pintar).
import { es } from './i18n/es';

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

type Dictionary = typeof es;

const loaders: Record<Exclude<SupportedLanguage, 'es'>, () => Promise<Dictionary>> = {
  en: () => import('./i18n/en').then((m) => m.en as unknown as Dictionary),
  pt: () => import('./i18n/pt').then((m) => m.pt as unknown as Dictionary),
  fr: () => import('./i18n/fr').then((m) => m.fr as unknown as Dictionary),
  it: () => import('./i18n/it').then((m) => m.it as unknown as Dictionary),
  de: () => import('./i18n/de').then((m) => m.de as unknown as Dictionary),
  ca: () => import('./i18n/ca').then((m) => m.ca as unknown as Dictionary),
  zh: () => import('./i18n/zh').then((m) => m.zh as unknown as Dictionary),
};

/** Diccionarios ya cargados. El castellano siempre está. */
export const translations: Partial<Record<SupportedLanguage, Dictionary>> = { es };

const pending = new Map<SupportedLanguage, Promise<void>>();

function loadOne(lang: SupportedLanguage): Promise<void> {
  if (lang === 'es' || translations[lang]) return Promise.resolve();
  let p = pending.get(lang);
  if (!p) {
    p = loaders[lang]()
      .then((dict) => { translations[lang] = dict; })
      .finally(() => pending.delete(lang));
    pending.set(lang, p);
  }
  return p;
}

export function isLanguageLoaded(language: SupportedLanguage | string): boolean {
  const lang = normalizeLanguage(language);
  return Boolean(translations[lang]) && (lang === 'es' || Boolean(translations[BRIDGE_LANGUAGE]));
}

/** Carga el diccionario del idioma y, si no es castellano, el del idioma puente. */
export function loadLanguage(language: SupportedLanguage | string): Promise<void> {
  const lang = normalizeLanguage(language);
  if (lang === 'es') return Promise.resolve();
  return Promise.all([loadOne(lang), loadOne(BRIDGE_LANGUAGE)]).then(() => undefined);
}

export type TranslationKey = keyof Dictionary;

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

export function getTranslations(language: SupportedLanguage | string): Dictionary {
  return translations[normalizeLanguage(language)] ?? translations[BRIDGE_LANGUAGE] ?? es;
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
  const requested = normalizeLanguage(language);
  // Mientras el diccionario del idioma no ha llegado se usa el puente (o el
  // castellano), sin registrar claves "que faltan" que en realidad existen.
  const lang: SupportedLanguage = translations[requested]
    ? requested
    : (translations[BRIDGE_LANGUAGE] ? BRIDGE_LANGUAGE : DEFAULT_LANGUAGE);
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
