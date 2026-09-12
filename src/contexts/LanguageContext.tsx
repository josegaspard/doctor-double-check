import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import {
  SupportedLanguage,
  DEFAULT_LANGUAGE,
  getTranslations,
  normalizeLanguage,
  t as translate,
} from '@/lib/i18n';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (path: string) => string;
  translations: ReturnType<typeof getTranslations>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Clave de siempre (la leen también ChunkErrorBoundary e i18n-context) + marca
// de "lo eligió el usuario". Sin la marca no se puede distinguir una elección
// de una corazonada del navegador.
const LANG_KEY = 'preferred_language';
const EXPLICIT_KEY = 'preferred_language_explicit';

// Admin text overrides (site_settings.text_overrides): { [lang]: { [i18nKey]: text } }.
// Lets the admin reword ANY landing/UI string without a deploy. A missing/empty
// override falls through to the normal i18n value, so this can never blank out text.
type TextOverrides = Partial<Record<SupportedLanguage, Record<string, string>>>;
let overridesCache: TextOverrides = {};

function readStored(): { lang: SupportedLanguage; explicit: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (!raw) return null;
    return { lang: normalizeLanguage(raw), explicit: localStorage.getItem(EXPLICIT_KEY) === '1' };
  } catch {
    return null;
  }
}

function writeStored(lang: SupportedLanguage, explicit: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANG_KEY, lang);
    if (explicit) localStorage.setItem(EXPLICIT_KEY, '1');
  } catch {
    /* navegador sin almacenamiento: la sesión sigue en memoria */
  }
}

function initialLanguage(): SupportedLanguage {
  const stored = readStored();
  if (stored) return stored.lang;
  // Sin nada guardado se usa el idioma del navegador como PISTA (no cuenta como
  // elección: al iniciar sesión manda el perfil).
  if (typeof navigator !== 'undefined' && navigator.language) return normalizeLanguage(navigator.language);
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const supabaseUser = authContext?.supabaseUser ?? null;
  const [language, setLanguageState] = useState<SupportedLanguage>(initialLanguage);

  // El idioma de la sesión manda en TODA la sesión: se resuelve una vez por
  // usuario y ya no cambia hasta que él lo cambie.
  //   elección explícita del usuario  >  perfil  >  pista del navegador  >  es
  // Antes el perfil pisaba siempre y quien elegía inglés en la portada entraba
  // a la app en castellano.
  useEffect(() => {
    let active = true;
    const loadLanguage = async () => {
      const stored = readStored();
      if (stored && active) setLanguageState(stored.lang);

      if (!supabaseUser?.id) return;

      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', supabaseUser.id)
        .single();
      if (!active) return;

      const profileLang = data?.preferred_language ? normalizeLanguage(data.preferred_language) : null;

      if (stored?.explicit) {
        // El usuario ya eligió en este navegador: su elección manda y se
        // sincroniza el perfil para que ambos digan lo mismo.
        setLanguageState(stored.lang);
        if (profileLang && profileLang !== stored.lang) void persistToProfile(supabaseUser.id, stored.lang);
        return;
      }

      if (profileLang) {
        setLanguageState(profileLang);
        writeStored(profileLang, false);
      }
    };

    loadLanguage();
    return () => { active = false; };
  }, [supabaseUser?.id]);

  // El atributo lang del documento acompaña a la sesión (lectores de pantalla,
  // guiones de corrección del navegador y traducción automática). index.html lo
  // trae fijo en "es".
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);

  const setLanguage = async (lang: SupportedLanguage) => {
    const next = normalizeLanguage(lang);
    setLanguageState(next);
    writeStored(next, true);
    if (supabaseUser?.id) await persistToProfile(supabaseUser.id, next);
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

// El enum supported_language de la BD puede NO incluir todavía 'ca'/'zh'
// (ver migración 20260709_supported_language_ca_zh). Sin try/catch, Postgres
// rechaza el enum inválido y deja una promesa rechazada sin manejar. La UI ya
// cambió por localStorage; persistir es best-effort.
async function persistToProfile(userId: string, lang: SupportedLanguage) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: lang } as any)
      .eq('id', userId);
    if (error) console.warn('No se pudo guardar el idioma preferido:', error.message);
  } catch (e) {
    console.warn('No se pudo guardar el idioma preferido:', e);
  }
}

// Respaldo para cuando aún no hay contexto (HMR, carga diferida). Se calcula al
// vuelo —antes se congelaba al importar el módulo y se quedaba con el idioma de
// la primera carga— y se memoriza por idioma para no devolver un objeto nuevo
// en cada render.
const fallbackCache = new Map<SupportedLanguage, LanguageContextType>();

function fallbackFor(lang: SupportedLanguage): LanguageContextType {
  const cached = fallbackCache.get(lang);
  if (cached) return cached;
  const value: LanguageContextType = {
    language: lang,
    setLanguage: async () => {},
    t: (path: string) => translate(lang, path),
    translations: getTranslations(lang),
  };
  fallbackCache.set(lang, value);
  return value;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context) return context;
  return fallbackFor(readStored()?.lang ?? DEFAULT_LANGUAGE);
}
