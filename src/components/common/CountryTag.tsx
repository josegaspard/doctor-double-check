import { cn } from '@/lib/utils';
import { flagEmojiToCode } from '@/lib/countryFlag';

/**
 * Código de país en una etiqueta pequeña, en lugar del emoji de bandera
 * (que en Windows se ve como letras). Acepta el código ISO o el emoji guardado en BD.
 */
export function CountryTag({ code, flag, className }: { code?: string | null; flag?: string | null; className?: string }) {
  const iso = (code || flagEmojiToCode(flag) || '').toUpperCase();
  if (!iso) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold leading-4 tracking-wide text-muted-foreground align-middle',
        className,
      )}
    >
      {iso}
    </span>
  );
}
