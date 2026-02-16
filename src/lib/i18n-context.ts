import { t as translate, SupportedLanguage } from '@/lib/i18n';

/**
 * Get current language from localStorage (for use outside React context).
 * Falls back to 'es' if not set.
 */
function getCurrentLanguage(): SupportedLanguage {
  const cached = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;
  return (cached === 'en' ? 'en' : 'es');
}

/**
 * Translate a key using the current cached language.
 * Use this in contexts/hooks that don't have access to LanguageContext.
 */
export function tContext(path: string): string {
  return translate(getCurrentLanguage(), path);
}
