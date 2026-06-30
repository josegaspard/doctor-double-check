import React, { forwardRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLanguage } from '@/lib/i18n';

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

interface LangDef { code: SupportedLanguage; flag: string; labelKey: string; fallback: string; }
const LANGS: LangDef[] = [
  { code: 'es', flag: '🇪🇸', labelKey: 'settings.spanish',    fallback: 'Castellano' },
  { code: 'en', flag: '🇺🇸', labelKey: 'settings.english',    fallback: 'English' },
  { code: 'pt', flag: '🇵🇹', labelKey: 'settings.portuguese', fallback: 'Português' },
  { code: 'fr', flag: '🇫🇷', labelKey: 'settings.french',     fallback: 'Français' },
  { code: 'it', flag: '🇮🇹', labelKey: 'settings.italian',    fallback: 'Italiano' },
  { code: 'de', flag: '🇩🇪', labelKey: 'settings.german',     fallback: 'Deutsch' },
  { code: 'ca', flag: '🏴󠁥󠁳󠁣󠁴󠁿', labelKey: 'settings.catalan',    fallback: 'Català' },
  { code: 'zh', flag: '🇨🇳', labelKey: 'settings.chinese',    fallback: '中文' },
];

export function LanguageSwitcher({ className, unstyled = false }: { className?: string; unstyled?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('settings.language') || 'Language'}
          className={`${unstyled ? 'inline-flex items-center justify-center min-h-[2.25rem] min-w-[2.25rem]' : 'app-header-control'} shrink-0 ${className || ''}`}
        >
          <Globe className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {LANGS.map((l) => (
          <LanguageOption
            key={l.code}
            selected={language === l.code}
            flag={l.code === 'ca' ? <SenyeraIcon /> : <span>{l.flag}</span>}
            text={t(l.labelKey) || l.fallback}
            onClick={() => handleSelect(l.code)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
