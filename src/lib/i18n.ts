import { es } from './i18n/es';
import { en } from './i18n/en';
import { pt } from './i18n/pt';
import { fr } from './i18n/fr';

export type SupportedLanguage = 'es' | 'en' | 'pt' | 'fr';

export const translations = {
  es,
  en,
  pt,
  fr,
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
