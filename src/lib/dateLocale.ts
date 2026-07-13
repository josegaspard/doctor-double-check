import { es, enUS, ptBR, fr, it, de, ca, zhCN } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { SupportedLanguage } from '@/lib/i18n';

// Mapa central idioma → locale de date-fns. Antes cada sitio importaba solo `es`/`enUS`
// y caía a inglés para pt/fr/it/de/ca/zh ("5 minutes ago" en español, etc.).
const LOCALES: Record<SupportedLanguage, Locale> = {
  es, en: enUS, pt: ptBR, fr, it, de, ca, zh: zhCN,
};

export const getDateLocale = (lang: string | undefined): Locale =>
  LOCALES[(lang as SupportedLanguage)] ?? es;

// Mapa idioma → locale BCP-47 para APIs nativas (Intl.DateTimeFormat /
// toLocaleDateString / toLocaleTimeString). Antes varias pantallas fijaban
// 'es-MX' a mano → alemán/francés/inglés veían días y meses en español.
const INTL_LOCALES: Record<SupportedLanguage, string> = {
  es: 'es-MX', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', ca: 'ca-ES', zh: 'zh-CN',
};

export const getIntlLocale = (lang: string | undefined): string =>
  INTL_LOCALES[(lang as SupportedLanguage)] ?? 'es-MX';
