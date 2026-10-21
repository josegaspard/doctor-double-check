import { flagEmojiToCode } from '@/lib/countryFlag';
import { FlagIcon } from '@/components/common/FlagIcon';

/**
 * Bandera del idioma o del país, en SVG vectorial (NO emoji: en Windows los
 * emojis de bandera se ven como letras; regla del cliente 2026-10-01).
 *
 * Mantiene la API anterior ({ code, flag, className }) para no romper sus usos:
 *  - `code` puede ser un código de idioma (es, en, pt…) o de país ISO-2 (MX, US…).
 *  - `flag` es el emoji guardado en BD; si no hay `code`, se deriva de ahí.
 * Si no se reconoce el código, FlagIcon cae con elegancia a un globo.
 */
export function CountryTag({ code, flag, className }: { code?: string | null; flag?: string | null; className?: string }) {
  const value = code || flagEmojiToCode(flag) || '';
  if (!value) return null;
  return <FlagIcon code={value} className={className} />;
}
