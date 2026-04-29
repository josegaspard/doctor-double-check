import React, { forwardRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Forward refs to the underlying <button> so Radix Popover can attach
 * its trigger ref without producing "Function components cannot be given refs" warnings.
 */
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

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (lang: 'es' | 'en') => {
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
      <PopoverContent align="end" className="w-48 p-1.5">
        <LanguageOption
          selected={language === 'es'}
          label={`🇪🇸 ${t('settings.spanish')}`}
          onClick={() => handleSelect('es')}
        />
        <LanguageOption
          selected={language === 'en'}
          label={`🇺🇸 ${t('settings.english')}`}
          onClick={() => handleSelect('en')}
        />
      </PopoverContent>
    </Popover>
  );
}
