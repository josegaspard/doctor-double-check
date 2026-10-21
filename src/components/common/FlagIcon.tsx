import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Banderas en SVG vectorial (NO emoji: en Windows los emojis de bandera se ven
 * como dos letras sueltas; regla del cliente 2026-10-01). Cada bandera se dibuja
 * con formas simples dentro de un viewBox 24×16 y se recorta con esquinas
 * redondeadas y un borde finito para que resalte sobre fondos claros y oscuros.
 *
 * Acepta:
 *  - un código de IDIOMA en minúsculas (es, en, pt, fr, it, de, ca, zh) → bandera
 *    del idioma (en→Reino Unido, ca→Cataluña/Senyera, zh→China…);
 *  - un código de PAÍS ISO-3166 alfa-2 en mayúsculas (MX, US, AR…).
 * Si no se reconoce, cae con elegancia a un globo.
 */

// Estrella de 5 puntas centrada en (cx,cy) con radio externo r.
function star(cx: number, cy: number, r: number, fill = '#ffde00') {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const ao = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push(`${cx + r * Math.cos(ao)},${cy + r * Math.sin(ao)}`);
    const ai = ao + Math.PI / 5;
    pts.push(`${cx + r * 0.382 * Math.cos(ai)},${cy + r * 0.382 * Math.sin(ai)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

// Cada entrada devuelve el contenido del SVG (viewBox 0 0 24 16).
const FLAGS: Record<string, () => JSX.Element> = {
  ES: () => (
    <>
      <rect width="24" height="16" fill="#c60b1e" />
      <rect y="4" width="24" height="8" fill="#ffc400" />
    </>
  ),
  GB: () => (
    <>
      <rect width="24" height="16" fill="#012169" />
      <g stroke="#fff" strokeWidth="3.2">
        <line x1="0" y1="0" x2="24" y2="16" />
        <line x1="24" y1="0" x2="0" y2="16" />
      </g>
      <g stroke="#c8102e" strokeWidth="1.5">
        <line x1="0" y1="0" x2="24" y2="16" />
        <line x1="24" y1="0" x2="0" y2="16" />
      </g>
      <rect x="9.6" width="4.8" height="16" fill="#fff" />
      <rect y="5.6" width="24" height="4.8" fill="#fff" />
      <rect x="10.4" width="3.2" height="16" fill="#c8102e" />
      <rect y="6.4" width="24" height="3.2" fill="#c8102e" />
    </>
  ),
  PT: () => (
    <>
      <rect width="24" height="16" fill="#da291c" />
      <rect width="9.6" height="16" fill="#006600" />
      <circle cx="9.6" cy="8" r="1.9" fill="#ffcc00" stroke="#c8102e" strokeWidth="0.5" />
    </>
  ),
  FR: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#0055a4" />
      <rect x="16" width="8" height="16" fill="#ef4135" />
    </>
  ),
  IT: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#009246" />
      <rect x="16" width="8" height="16" fill="#ce2b37" />
    </>
  ),
  DE: () => (
    <>
      <rect width="24" height="16" fill="#000" />
      <rect y="5.33" width="24" height="5.34" fill="#dd0000" />
      <rect y="10.67" width="24" height="5.33" fill="#ffce00" />
    </>
  ),
  CAT: () => (
    <>
      <rect width="24" height="16" fill="#fcdd09" />
      <rect y="1.78" width="24" height="1.78" fill="#da121a" />
      <rect y="5.33" width="24" height="1.78" fill="#da121a" />
      <rect y="8.89" width="24" height="1.78" fill="#da121a" />
      <rect y="12.44" width="24" height="1.78" fill="#da121a" />
    </>
  ),
  CN: () => (
    <>
      <rect width="24" height="16" fill="#de2910" />
      {star(4.5, 4.5, 2.4)}
      {star(9, 1.8, 0.9)}
      {star(10.5, 4, 0.9)}
      {star(10.5, 6.8, 0.9)}
      {star(9, 9, 0.9)}
    </>
  ),
  MX: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#006341" />
      <rect x="16" width="8" height="16" fill="#ce1126" />
      <circle cx="12" cy="8" r="1.5" fill="none" stroke="#7a5c2e" strokeWidth="0.9" />
    </>
  ),
  US: () => (
    <>
      <rect width="24" height="16" fill="#b22234" />
      <rect y="2.46" width="24" height="2.46" fill="#fff" />
      <rect y="7.38" width="24" height="2.46" fill="#fff" />
      <rect y="12.3" width="24" height="2.46" fill="#fff" />
      <rect width="10" height="8.6" fill="#3c3b6e" />
      <g fill="#fff">
        <circle cx="2" cy="2" r="0.7" />
        <circle cx="5" cy="2" r="0.7" />
        <circle cx="8" cy="2" r="0.7" />
        <circle cx="3.5" cy="4.3" r="0.7" />
        <circle cx="6.5" cy="4.3" r="0.7" />
        <circle cx="2" cy="6.6" r="0.7" />
        <circle cx="5" cy="6.6" r="0.7" />
        <circle cx="8" cy="6.6" r="0.7" />
      </g>
    </>
  ),
  CA: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="6" height="16" fill="#d52b1e" />
      <rect x="18" width="6" height="16" fill="#d52b1e" />
      <polygon
        points="12,3.5 12.7,6 14.8,5.2 13.4,7.4 15.5,8 13.4,8.6 14.8,10.8 12.7,10 12,12.5 11.3,10 9.2,10.8 10.6,8.6 8.5,8 10.6,7.4 9.2,5.2 11.3,6"
        fill="#d52b1e"
      />
    </>
  ),
  AR: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.33" fill="#74acdf" />
      <rect y="10.67" width="24" height="5.33" fill="#74acdf" />
      <circle cx="12" cy="8" r="1.5" fill="#f6b40e" />
    </>
  ),
  BR: () => (
    <>
      <rect width="24" height="16" fill="#009b3a" />
      <polygon points="12,1.5 22.5,8 12,14.5 1.5,8" fill="#fedf00" />
      <circle cx="12" cy="8" r="3.1" fill="#002776" />
    </>
  ),
  CL: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#d52b1e" />
      <rect width="8" height="8" fill="#0039a6" />
      {star(4, 4, 2.3, '#fff')}
    </>
  ),
  CO: () => (
    <>
      <rect width="24" height="16" fill="#fcd116" />
      <rect y="8" width="24" height="4" fill="#003893" />
      <rect y="12" width="24" height="4" fill="#ce1126" />
    </>
  ),
  PE: () => (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#d91023" />
      <rect x="16" width="8" height="16" fill="#d91023" />
    </>
  ),
};

// Idioma → clave de bandera (minúsculas; ca = catalán/Senyera, no Canadá).
const LANG_TO_FLAG: Record<string, string> = {
  es: 'ES',
  en: 'GB',
  pt: 'PT',
  fr: 'FR',
  it: 'IT',
  de: 'DE',
  ca: 'CAT',
  zh: 'CN',
};

export function resolveFlagKey(code?: string | null): string | null {
  const raw = (code ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Idioma solo si venía en minúsculas (los países llegan en mayúsculas: 'CA' = Canadá).
  if (raw === lower && lower in LANG_TO_FLAG) return LANG_TO_FLAG[lower];
  const key = raw.toUpperCase();
  return key in FLAGS ? key : null;
}

export function FlagIcon({ code, className }: { code?: string | null; className?: string }) {
  const key = resolveFlagKey(code);
  const base = 'inline-flex shrink-0 items-center justify-center align-middle';

  if (!key) {
    // Caída con elegancia: globo neutro cuando el código no se reconoce.
    return <Globe className={cn(base, 'h-3.5 w-5 text-muted-foreground', className)} aria-hidden />;
  }

  return (
    <span
      className={cn(
        base,
        'h-3.5 w-5 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-foreground/15',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 16" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        {FLAGS[key]()}
      </svg>
    </span>
  );
}
