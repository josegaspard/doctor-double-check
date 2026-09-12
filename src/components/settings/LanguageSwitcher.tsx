import React, { forwardRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGE_AUTONYMS, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/i18n';

// Bandera de Cataluña (Senyera) como SVG: el emoji 🏴󠁥󠁳󠁣󠁴󠁿 (bandera de
// subdivisión) NO se renderiza en la mayoría de navegadores/SO (Windows,
// muchos Android) → salía vacío. Con SVG se ve siempre. Cliente 2026-06-16.
export const SenyeraIcon = () => (
  <svg viewBox="0 0 9 6" className="inline-block w-5 h-[0.85rem] rounded-[2px] ring-1 ring-black/15 align-[-2px]" aria-hidden="true">
    <rect width="9" height="6" fill="#FCDD09" />
    <g fill="#DA121A">
      <rect y="0.667" width="9" height="0.667" />
      <rect y="2" width="9" height="0.667" />
      <rect y="3.333" width="9" height="0.667" />
      <rect y="4.667" width="9" height="0.667" />
    </g>
  </svg>
);

const LanguageOption = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; flag: React.ReactNode; text: string }
>(({ selected, flag, text, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-current={selected || undefined}
    className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
      selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
    } ${className || ''}`}
    {...props}
  >
    <span className="flex items-center gap-2 text-base">
      <span className="inline-flex items-center justify-center w-5">{flag}</span>
      {text}
    </span>
    {selected && <Check className="h-4 w-4" />}
  </button>
));
LanguageOption.displayName = 'LanguageOption';

const FLAGS: Record<SupportedLanguage, string> = {
  es: '🇪🇸', en: '🇺🇸', pt: '🇵🇹', fr: '🇫🇷', it: '🇮🇹', de: '🇩🇪', ca: '🏴󠁥󠁳󠁣󠁴󠁿', zh: '🇨🇳',
};

/**
 * Lista de idiomas. Es la ÚNICA lista de la app: la usa el globo de la cabecera
 * y la puede incrustar Cuenta > Idioma (`/settings?s=idioma`), para no repetir
 * la lógica en tres sitios como hasta ahora.
 *
 * El nombre de cada idioma va SIEMPRE en su propio idioma (Castellano, English,
 * 中文…): así se encuentra el propio aunque la sesión esté en uno que no se
 * entiende, y no se mezclan idiomas dentro de la lista.
 */
export function LanguageOptionsList({
  variant = 'menu',
  onSelected,
  className,
}: {
  variant?: 'menu' | 'panel';
  onSelected?: (lang: SupportedLanguage) => void;
  className?: string;
}) {
  const { language, setLanguage, t } = useLanguage();
  // Respaldo mientras el integrador no añade las claves mm2.lang.* a los 8 idiomas.
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const handleSelect = (lang: SupportedLanguage) => {
    if (lang !== language) void setLanguage(lang);
    onSelected?.(lang);
  };

  return (
    <div className={className}>
      {variant === 'panel' && (
        <p className="text-xs text-muted-foreground mb-2">
          {tf('mm2.lang.sessionNote', 'Toda la sesión se muestra en el idioma que elijas.')}
        </p>
      )}
      <div className={variant === 'panel' ? 'grid gap-1 sm:grid-cols-2' : ''}>
        {SUPPORTED_LANGUAGES.map((code) => (
          <LanguageOption
            key={code}
            selected={language === code}
            flag={code === 'ca' ? <SenyeraIcon /> : <span>{FLAGS[code]}</span>}
            text={LANGUAGE_AUTONYMS[code]}
            onClick={() => handleSelect(code)}
          />
        ))}
      </div>
    </div>
  );
}

export function LanguageSwitcher({ className, unstyled = false }: { className?: string; unstyled?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tf('mm2.lang.change', 'Cambiar idioma')}
          className={`${unstyled ? 'inline-flex items-center justify-center min-h-[2.25rem] min-w-[2.25rem]' : 'app-header-control'} shrink-0 ${className || ''}`}
        >
          <Globe className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <p className="px-3 pt-1 pb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {tf('mm2.lang.title', 'Idioma')}
        </p>
        <LanguageOptionsList onSelected={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
