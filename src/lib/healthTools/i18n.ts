// Diccionario propio de las herramientas de salud (18-nov-2026).
//
// Va aparte de los 8 diccionarios grandes (500 kB cada uno) para no tocarlos y
// para que solo lo descargue quien abre una herramienta: cada idioma es un
// chunk pequeño que se pide bajo demanda. Si falta una clave en un idioma, sale
// la castellana; si falta también ahí, la propia clave (se ve en las pruebas).
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { es, type HealthToolsDict } from './i18n/es';

type Lang = 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de' | 'ca' | 'zh';

const loaders: Record<Exclude<Lang, 'es'>, () => Promise<{ default: HealthToolsDict }>> = {
  en: () => import('./i18n/en').then(m => ({ default: m.en })),
  pt: () => import('./i18n/pt').then(m => ({ default: m.pt })),
  fr: () => import('./i18n/fr').then(m => ({ default: m.fr })),
  it: () => import('./i18n/it').then(m => ({ default: m.it })),
  de: () => import('./i18n/de').then(m => ({ default: m.de })),
  ca: () => import('./i18n/ca').then(m => ({ default: m.ca })),
  zh: () => import('./i18n/zh').then(m => ({ default: m.zh })),
};
const cache: Partial<Record<Lang, HealthToolsDict>> = { es };

function lookup(dict: unknown, path: string): string | undefined {
  let o: unknown = dict;
  for (const k of path.split('.')) {
    if (o && typeof o === 'object' && k in (o as Record<string, unknown>)) o = (o as Record<string, unknown>)[k];
    else return undefined;
  }
  return typeof o === 'string' ? o : undefined;
}

export type HT = (key: string, vars?: Record<string, string | number>) => string;

export function useHealthToolsText(): { ht: HT; lang: Lang; locale: string } {
  const { language } = useLanguage();
  const lang = (language in loaders || language === 'es' ? language : 'es') as Lang;
  const [dict, setDict] = useState<HealthToolsDict>(cache[lang] ?? es);

  useEffect(() => {
    let alive = true;
    if (cache[lang]) { setDict(cache[lang]!); return; }
    loaders[lang as Exclude<Lang, 'es'>]()
      .then(m => { cache[lang] = m.default; if (alive) setDict(m.default); })
      .catch(() => { if (alive) setDict(es); });
    return () => { alive = false; };
  }, [lang]);

  const ht: HT = (key, vars) => {
    let s = lookup(dict, key) ?? lookup(es, key) ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
  const locale = { es: 'es-MX', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', ca: 'ca-ES', zh: 'zh-CN' }[lang];
  return { ht, lang, locale };
}

/** Número con la coma o el punto decimal del idioma. */
export function fmt(n: number, locale: string, digits = 1): string {
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
export function fmtDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function fmtShort(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
