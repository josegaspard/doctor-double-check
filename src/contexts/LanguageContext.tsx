import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { SupportedLanguage, getTranslations, t as translate } from '@/lib/i18n';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (path: string) => string;
  translations: ReturnType<typeof getTranslations>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SUPPORTED: readonly SupportedLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'] as const;

// Admin text overrides (site_settings.text_overrides): { [lang]: { [i18nKey]: text } }.
// Lets the admin reword ANY landing/UI string without a deploy. A missing/empty
// override falls through to the normal i18n value, so this can never blank out text.
type TextOverrides = Partial<Record<SupportedLanguage, Record<string, string>>>;
let overridesCache: TextOverrides = {};

function normalize(value: string | null | undefined): SupportedLanguage {
  if (!value) return 'es';
  const v = value.slice(0, 2).toLowerCase();
  return (SUPPORTED as readonly string[]).includes(v) ? (v as SupportedLanguage) : 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const supabaseUser = authContext?.supabaseUser ?? null;
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;
    if (cached) return normalize(cached);
    if (typeof navigator !== 'undefined') {
      return normalize(navigator.language);
    }
    return 'es';
  });

  // Load user's language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      const cached = localStorage.getItem('preferred_language');
      if (cached) setLanguageState(normalize(cached));

      if (supabaseUser?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', supabaseUser.id)
          .single();

        if (data?.preferred_language) {
          const lang = normalize(data.preferred_language);
          setLanguageState(lang);
          localStorage.setItem('preferred_language', lang);
        }
      }
    };

    loadLanguage();
  }, [supabaseUser?.id]);

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);

    if (supabaseUser?.id) {
      await supabase
        .from('profiles')
        .update({ preferred_language: lang } as any)
        .eq('id', supabaseUser.id);
    }
  };

  // Load admin text overrides once (cached at module level).
  const [overrides, setOverrides] = useState<TextOverrides>(overridesCache);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'text_overrides')
          .maybeSingle();
        const v = (data?.value && typeof data.value === 'object') ? (data.value as TextOverrides) : {};
        overridesCache = v;
        if (active) setOverrides(v);
      } catch { /* keep i18n defaults */ }
    })();
    return () => { active = false; };
  }, []);

  const t = (path: string) => {
    const o = overrides[language]?.[path];
    return (o !== undefined && o !== null && o !== '') ? o : translate(language, path);
  };
  const translations = getTranslations(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Fallback for cases where context is not yet available (e.g. HMR, lazy loading race)
const fallbackLang = (): SupportedLanguage =>
  normalize(typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null);

const fallbackLanguage: LanguageContextType = {
  language: fallbackLang(),
  setLanguage: async () => {},
  t: (path: string) => translate(fallbackLang(), path),
  translations: getTranslations(fallbackLang()),
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackLanguage;
}
