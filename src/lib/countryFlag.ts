/**
 * Banderas sin emoji (cliente 2026-10-01): en Windows los emojis de bandera se ven
 * como dos letras sueltas, así que en la interfaz se pinta el código ISO en una
 * etiqueta (<CountryTag />). Estas utilidades convierten entre ambos formatos:
 * la BD sigue guardando `profiles.country_flag` como emoji por compatibilidad.
 */
const RI_BASE = 0x1f1e6; // REGIONAL INDICATOR SYMBOL LETTER A

/** "MX" → bandera emoji (solo para guardar en BD; no pintarla). */
export function codeToFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (ch) => String.fromCodePoint(RI_BASE + ch.charCodeAt(0) - 65));
}

/** Bandera emoji (p. ej. MX) → "MX". Devuelve '' si no es una bandera de país. */
export function flagEmojiToCode(flag: string | null | undefined): string {
  if (!flag) return '';
  const letters = Array.from(flag)
    .map((ch) => ch.codePointAt(0) ?? 0)
    .filter((cp) => cp >= RI_BASE && cp <= RI_BASE + 25)
    .map((cp) => String.fromCharCode(cp - RI_BASE + 65));
  return letters.length === 2 ? letters.join('') : '';
}
