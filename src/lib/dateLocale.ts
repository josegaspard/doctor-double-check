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
