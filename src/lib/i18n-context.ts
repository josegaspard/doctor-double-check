import { t as translate, normalizeLanguage, SupportedLanguage } from '@/lib/i18n';

/**
 * Idioma actual desde localStorage (para código fuera del contexto de React).
 * Antes solo reconocía 'en' y daba castellano a pt/fr/it/de/ca/zh: los errores
 * de Chat/Lives/Vault/Wallet salían en castellano en esas seis sesiones.
 */
function getCurrentLanguage(): SupportedLanguage {
  const cached = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;
  return normalizeLanguage(cached);
}

/**
 * Translate a key using the current cached language.
 * Use this in contexts/hooks that don't have access to LanguageContext.
 */
export function tContext(path: string): string {
  return translate(getCurrentLanguage(), path);
}
