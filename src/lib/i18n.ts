import { es } from './i18n/es';
import { en } from './i18n/en';
import { pt } from './i18n/pt';
import { fr } from './i18n/fr';
import { it } from './i18n/it';
import { de } from './i18n/de';
import { ca } from './i18n/ca';
import { zh } from './i18n/zh';

export type SupportedLanguage = 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de' | 'ca' | 'zh';

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
