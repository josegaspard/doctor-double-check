/**
 * Quita emojis/pictogramas de un texto (cliente 2026-10-01: nada de emojis en la web,
 * solo iconografía lucide). Se usa al pintar títulos y mensajes que vienen de la BD
 * (notificaciones creadas por funciones SQL y edge functions con un emoji delante).
 *
 * Cubre: Extended_Pictographic, selector de variación (FE0F), unión ZWJ (200D),
 * tonos de piel, etiquetas de subdivisión (banderas tipo Cataluña/Escocia),
 * pares de indicadores regionales (banderas de país) y keycaps. Respeta © ® ™.
 */
const EMOJI_RE =
  /(?:(?![©®™])\p{Extended_Pictographic}|\p{Regional_Indicator}|[⃣️‍]|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])+/gu;

export function stripEmoji(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMOJI_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}
