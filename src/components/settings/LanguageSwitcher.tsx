import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';

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
        <Button variant="ghost" size="icon" className="shrink-0">
          <Globe className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5">
        <button
          onClick={() => handleSelect('es')}
          className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
            language === 'es' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
        >
          <span className="text-base">🇪🇸 {t('settings.spanish')}</span>
          {language === 'es' && <Check className="h-4 w-4" />}
        </button>
        <button
          onClick={() => handleSelect('en')}
          className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
            language === 'en' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
        >
          <span className="text-base">🇺🇸 {t('settings.english')}</span>
          {language === 'en' && <Check className="h-4 w-4" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}
