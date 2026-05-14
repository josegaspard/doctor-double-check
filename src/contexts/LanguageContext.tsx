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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const supabaseUser = authContext?.supabaseUser ?? null;
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;
    if (cached === 'es' || cached === 'en') return cached;
    // Legacy users with pt/fr stored get migrated back to ES (PT/FR retired).
    if (cached === 'pt' || cached === 'fr') {
      try { localStorage.setItem('preferred_language', 'es'); } catch {}
      return 'es';
    }
    // Auto-detect from browser language
    if (typeof navigator !== 'undefined') {
      const l = navigator.language?.slice(0, 2).toLowerCase();
      if (l === 'en') return 'en';
    }
    return 'es';
  });

  // Load user's language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      // First check localStorage for cached preference
      const cached = localStorage.getItem('preferred_language');
      if (cached === 'es' || cached === 'en') {
        setLanguageState(cached as SupportedLanguage);
      } else if (cached === 'pt' || cached === 'fr') {
        // Migrate retired locales back to ES.
        setLanguageState('es');
        try { localStorage.setItem('preferred_language', 'es'); } catch {}
      }

      // If user is logged in, fetch from database
      if (supabaseUser?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', supabaseUser.id)
          .single();

        if (data?.preferred_language) {
          const raw = data.preferred_language;
          const lang: SupportedLanguage = raw === 'en' ? 'en' : 'es';
          setLanguageState(lang);
          localStorage.setItem('preferred_language', lang);
          // Persist migration back to DB if the user had PT/FR stored.
          if (raw !== 'es' && raw !== 'en' && supabaseUser?.id) {
            supabase.from('profiles').update({ preferred_language: lang }).eq('id', supabaseUser.id).then(() => {});
          }
        }
      }
    };

    loadLanguage();
  }, [supabaseUser?.id]);

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);

    // If user is logged in, save to database
    if (supabaseUser?.id) {
      await supabase
        .from('profiles')
        .update({ preferred_language: lang })
        .eq('id', supabaseUser.id);
    }
  };

  const t = (path: string) => translate(language, path);
  const translations = getTranslations(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Fallback for cases where context is not yet available (e.g. HMR, lazy loading race)
const fallbackLanguage: LanguageContextType = {
  language: (typeof window !== 'undefined' && localStorage.getItem('preferred_language') === 'en' ? 'en' : 'es') as SupportedLanguage,
  setLanguage: async () => {},
  t: (path: string) => translate(
    (typeof window !== 'undefined' && localStorage.getItem('preferred_language') === 'en' ? 'en' : 'es') as SupportedLanguage,
    path
  ),
  translations: getTranslations(
    (typeof window !== 'undefined' && localStorage.getItem('preferred_language') === 'en' ? 'en' : 'es') as SupportedLanguage
  ),
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackLanguage;
}
