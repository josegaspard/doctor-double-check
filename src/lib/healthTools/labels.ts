// Etiquetas cortas de menú y pie para las secciones nuevas (18-nov-2026), en los
// 8 idiomas. Van aquí y no en el diccionario de las herramientas para que el pie
// y la cabecera no tengan que descargarlo.
type L = 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de' | 'ca' | 'zh';
const LABELS = {
  healthTools: { es: 'Herramientas de salud', en: 'Health tools', pt: 'Ferramentas de saúde', fr: 'Outils santé', it: 'Strumenti per la salute', de: 'Gesundheitstools', ca: 'Eines de salut', zh: '健康工具' },
  womenHealth: { es: 'Salud de la mujer', en: "Women's health", pt: 'Saúde da mulher', fr: 'Santé de la femme', it: 'Salute della donna', de: 'Frauengesundheit', ca: 'Salut de la dona', zh: '女性健康' },
} as const;
export function navLabel(key: keyof typeof LABELS, language: string): string {
  const row = LABELS[key] as Record<L, string>;
  return row[(language in row ? language : 'es') as L];
}
