import { es } from './i18n/es';
import { en } from './i18n/en';

// NOTE: PT and FR translation files (./i18n/pt, ./i18n/fr) are intentionally
// kept on disk but excluded from the active SupportedLanguage union until those
// markets are reactivated. Do not re-add without product approval.
export type SupportedLanguage = 'es' | 'en';

export const translations = {
  es,
  en,
} as const;

export type TranslationKey = keyof typeof translations.es;

export function getTranslations(language: SupportedLanguage) {
  return translations[language] ?? translations.es;
}

export function t(language: SupportedLanguage, path: string): string {
  const keys = path.split('.');
  let result: any = translations[language] ?? translations.es;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // Fallback to Spanish if a key is missing in the current language
      if (language !== 'es') {
        return t('es', path);
      }
      console.warn(`Translation missing for: ${path}`);
      return path;
    }
  }

  return typeof result === 'string' ? result : path;
}
