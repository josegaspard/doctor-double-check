import { es } from './i18n/es';
import { en } from './i18n/en';

export type SupportedLanguage = 'es' | 'en';

export const translations = {
  es,
  en,
} as const;

export type TranslationKey = keyof typeof translations.es;

export function getTranslations(language: SupportedLanguage) {
  return translations[language];
}

export function t(language: SupportedLanguage, path: string): string {
  const keys = path.split('.');
  let result: any = translations[language];
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      console.warn(`Translation missing for: ${path}`);
      return path;
    }
  }
  
  return typeof result === 'string' ? result : path;
}
