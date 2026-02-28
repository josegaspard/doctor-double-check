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
  const [language, setLanguageState] = useState<SupportedLanguage>('es');

  // Load user's language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      // First check localStorage for cached preference
      const cached = localStorage.getItem('preferred_language');
      if (cached === 'es' || cached === 'en') {
        setLanguageState(cached);
      }

      // If user is logged in, fetch from database
      if (supabaseUser?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', supabaseUser.id)
          .single();

        if (data?.preferred_language) {
          const lang = data.preferred_language as SupportedLanguage;
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

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
