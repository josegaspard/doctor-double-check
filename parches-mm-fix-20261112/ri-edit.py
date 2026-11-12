import sys
def rep(p, pairs):
    s=open(p,encoding="utf8").read()
    for a,b in pairs:
        n=s.count(a)
        assert n==1, (p, n, a[:60])
        s=s.replace(a,b)
    open(p,"w",encoding="utf8").write(s)
rep("src/lib/i18n.ts", [
("""// Solo el castellano (idioma por defecto y última red de `t`) va en el chunk
// inicial. Los otros 7 diccionarios (~480 kB cada uno) se cargan bajo demanda
// con `loadLanguage` (main.tsx precarga el de la sesión antes de pintar).
import { es } from './i18n/es';""",
"""// Ningún diccionario va en el chunk inicial (antes el castellano metía ~480 kB
// en index.js). Los 8 se cargan bajo demanda: main.tsx espera SOLO el del
// idioma de la sesión antes de pintar y el inglés puente llega después.
// El build añade <link rel="modulepreload"> del castellano (vite.config.ts).
import type { es } from './i18n/es';"""),
("""const loaders: Record<Exclude<SupportedLanguage, 'es'>, () => Promise<Dictionary>> = {
""","""const loaders: Record<SupportedLanguage, () => Promise<Dictionary>> = {
  es: () => import('./i18n/es').then((m) => m.es),
"""),
("""/** Diccionarios ya cargados. El castellano siempre está. */
export const translations: Partial<Record<SupportedLanguage, Dictionary>> = { es };""",
"""/** Diccionarios ya cargados. */
export const translations: Partial<Record<SupportedLanguage, Dictionary>> = {};"""),
("""  if (lang === 'es' || translations[lang]) return Promise.resolve();""",
"""  if (translations[lang]) return Promise.resolve();"""),
("""/** Carga el diccionario del idioma y, si no es castellano, el del idioma puente. */
export function loadLanguage(language: SupportedLanguage | string): Promise<void> {
  const lang = normalizeLanguage(language);
  if (lang === 'es') return Promise.resolve();
  return Promise.all([loadOne(lang), loadOne(BRIDGE_LANGUAGE)]).then(() => undefined);
}""",
"""/** Carga el diccionario del idioma y, si no es castellano, el del idioma puente. */
export function loadLanguage(language: SupportedLanguage | string): Promise<void> {
  const lang = normalizeLanguage(language);
  if (lang === 'es') return loadOne('es');
  return Promise.all([loadOne(lang), loadOne(BRIDGE_LANGUAGE)]).then(() => undefined);
}

/**
 * Solo el diccionario del idioma, sin el puente: es lo que espera la primera
 * pintura. El puente lo completa LanguageProvider (isLanguageLoaded → recarga).
 */
export function loadPrimaryLanguage(language: SupportedLanguage | string): Promise<void> {
  return loadOne(normalizeLanguage(language));
}"""),
("""  return translations[normalizeLanguage(language)] ?? translations[BRIDGE_LANGUAGE] ?? es;""",
"""  return translations[normalizeLanguage(language)]
    ?? translations[BRIDGE_LANGUAGE]
    ?? translations[DEFAULT_LANGUAGE]
    ?? Object.values(translations)[0]
    ?? ({} as Dictionary);"""),
])
rep("src/main.tsx", [
("""import { loadLanguage } from "./lib/i18n";""","""import { loadPrimaryLanguage } from "./lib/i18n";"""),
("""// El diccionario del idioma de la sesión se descarga en paralelo y se espera
// antes de pintar (solo el castellano va en el chunk inicial).
Promise.all([
  enforceBrowserSessionGuard(),
  loadLanguage(initialLanguage()).catch(() => {}),
]).finally(() => {""",
"""// El diccionario del idioma de la sesión se descarga en paralelo y se espera
// antes de pintar; el inglés puente ya no bloquea la primera pintura (llega
// después). Si el del idioma falla, se intenta el castellano.
Promise.all([
  enforceBrowserSessionGuard(),
  loadPrimaryLanguage(initialLanguage())
    .catch(() => loadPrimaryLanguage("es"))
    .catch(() => {}),
]).finally(() => {"""),
])
print("ok")
