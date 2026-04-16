import React, { useState } from 'react';
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

interface SearchableFilterProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  icon?: LucideIcon;
  allLabel?: string;
}

export function SearchableFilter({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel = 'Sin resultados',
  icon: Icon,
  allLabel = 'Todas',
}: SearchableFilterProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const displayValue = value || allLabel;

  const handleSelect = (selected: string) => {
    onChange(selected === allLabel ? '' : selected);
    setOpen(false);
  };

  const allOptions = [allLabel, ...options];

  const listContent = (
    <Command>
      <CommandInput placeholder={searchPlaceholder || `Buscar ${placeholder.toLowerCase()}...`} />
      <CommandList className="max-h-[300px]">
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup>
          {allOptions.map((option) => (
            <CommandItem
              key={option}
              value={option}
              onSelect={() => handleSelect(option)}
              className="min-h-[44px] flex items-center gap-2 cursor-pointer"
            >
              <Check
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  (option === allLabel ? !value : value === option)
                    ? 'opacity-100'
                    : 'opacity-0'
                )}
              />
              <span className="truncate">{option}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        'justify-between gap-1.5 font-medium text-xs h-9',
        isMobile ? 'flex-1 min-w-0' : 'w-full',
        value && 'border-primary/50 text-foreground'
      )}
    >
      <span className="flex items-center gap-1.5 truncate min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />}
        <span className="truncate">{displayValue}</span>
      </span>
      {value ? (
        <X
          className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
        />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <div onClick={() => setOpen(true)}>
          {triggerButton}
        </div>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-4">
            {listContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {listContent}
      </PopoverContent>
    </Popover>
  );
}
