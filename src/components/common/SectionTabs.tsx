// Pestañas de sección del área del médico (11-sep-2026).
//
// Son CHIPS con aria-pressed, no role="tab": index.css pinta de blanco todo lo
// que lleve role="tab" dentro de <main>, y ahí las pestañas se volvían ilegibles.
// El valor vive en la URL (?tab=…, ?s=…) para que un enlace o una redirección
// abra la pestaña correcta.
import React, { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface SectionTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Contador (solicitudes, mensajes sin leer…). 0 o undefined no se pinta. */
  badge?: number;
  disabled?: boolean;
}

export interface SectionTabsProps<T extends string = string> {
  value: T;
  onChange: (id: T) => void;
  items: SectionTabItem<T>[];
  /** 'onDark' = sobre el fondo de la app · 'onLight' = dentro de una tarjeta blanca */
  variant?: 'onDark' | 'onLight';
  ariaLabel?: string;
  className?: string;
}

export function SectionTabs<T extends string = string>({
  value,
  onChange,
  items,
  variant = 'onDark',
  ariaLabel,
  className,
}: SectionTabsProps<T>) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  // La pestaña activa siempre visible en móvil, sin mover la página.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 12);
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 12;
  }, [value, items.length]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const strip = stripRef.current;
    if (!strip) return;
    const buttons = Array.from(strip.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (buttons.length === 0) return;
    const current = buttons.findIndex(b => b === document.activeElement);
    let next = current;
    if (e.key === 'ArrowLeft') next = current <= 0 ? buttons.length - 1 : current - 1;
    else if (e.key === 'ArrowRight') next = current === -1 || current === buttons.length - 1 ? 0 : current + 1;
    else if (e.key === 'Home') next = 0;
    else next = buttons.length - 1;
    e.preventDefault();
    buttons[next]?.focus();
  }, []);

  const onLight = variant === 'onLight';

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={[
        'flex items-center gap-1 p-1 rounded-2xl max-w-full overflow-x-auto',
        '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        onLight ? 'border border-[#d6e1e7] bg-white' : 'border border-white/25 bg-white/10 backdrop-blur-sm',
        className || '',
      ].join(' ')}
    >
      {items.map(item => {
        const active = item.id === value;
        const Icon = item.icon;
        const base =
          'inline-flex flex-none items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
        const skin = active
          ? onLight
            ? 'bg-primary text-white shadow-sm focus-visible:ring-primary'
            : 'bg-white text-secondary shadow-sm focus-visible:ring-white'
          : onLight
            ? 'text-slate-600 hover:bg-slate-100 focus-visible:ring-primary'
            : 'text-white/85 hover:bg-white/15 focus-visible:ring-white';
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            data-active={active ? 'true' : 'false'}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled && !active) onChange(item.id); }}
            className={`${base} ${skin}`}
          >
            {Icon && <Icon className="h-4 w-4 flex-none" aria-hidden="true" />}
            <span className="min-w-0">{item.label}</span>
            {!!item.badge && item.badge > 0 && (
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  active
                    ? onLight ? 'bg-white/25 text-white' : 'bg-primary text-white'
                    : onLight ? 'bg-slate-200 text-slate-700' : 'bg-white text-secondary'
                }`}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sincroniza una pestaña con un parámetro de la URL (replace: no llena el
 * historial). Si el valor no está entre los permitidos, devuelve el de por
 * defecto sin tocar la URL.
 *
 * `options.clear` borra parámetros que solo tienen sentido dentro de una
 * pestaña (por ejemplo `nueva` al salir de Consultas).
 */
export function useSectionParam<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
  options?: { clear?: string[] },
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(name);
  const value = (allowed as readonly string[]).includes(raw || '') ? (raw as T) : fallback;
  const clearKey = (options?.clear || []).join(',');

  const setValue = useCallback(
    (next: T) => {
      setParams(
        prev => {
          const p = new URLSearchParams(prev);
          p.set(name, next);
          clearKey.split(',').filter(Boolean).forEach(k => p.delete(k));
          return p;
        },
        { replace: true },
      );
    },
    [setParams, name, clearKey],
  );

  return [value, setValue];
}

export default SectionTabs;
