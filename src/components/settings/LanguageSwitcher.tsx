import React, { forwardRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLanguage } from '@/lib/i18n';

const LanguageOption = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; label: string }
>(({ selected, label, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
      selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
    } ${className || ''}`}
    {...props}
  >
    <span className="text-base">{label}</span>
    {selected && <Check className="h-4 w-4" />}
  </button>
));
LanguageOption.displayName = 'LanguageOption';

interface LangDef { code: SupportedLanguage; flag: string; labelKey: string; fallback: string; }
const LANGS: LangDef[] = [
  { code: 'es', flag: '🇪🇸', labelKey: 'settings.spanish',    fallback: 'Español' },
  { code: 'en', flag: '🇺🇸', labelKey: 'settings.english',    fallback: 'English' },
  { code: 'pt', flag: '🇵🇹', labelKey: 'settings.portuguese', fallback: 'Português' },
  { code: 'fr', flag: '🇫🇷', labelKey: 'settings.french',     fallback: 'Français' },
  { code: 'it', flag: '🇮🇹', labelKey: 'settings.italian',    fallback: 'Italiano' },
  { code: 'de', flag: '🇩🇪', labelKey: 'settings.german',     fallback: 'Deutsch' },
];

export function LanguageSwitcher({ className }: { className?: string }) {
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
          className={`app-header-control shrink-0 ${className || ''}`}
        >
          <Globe className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {LANGS.map((l) => (
          <LanguageOption
            key={l.code}
            selected={language === l.code}
            label={`${l.flag} ${t(l.labelKey) || l.fallback}`}
            onClick={() => handleSelect(l.code)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
