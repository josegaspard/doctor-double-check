import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileCategory, type CategoryMark } from '@/hooks/useProfileCategory';
import { useLanguage } from '@/contexts/LanguageContext';

// Distintivo de categoría de perfil (cliente 2026-08-28).
//   estrella · punto morado · punto verde
// Se pinta en el perfil del médico/residente y en cada pieza de contenido.

const SIZES = {
  sm: { dot: 'w-2 h-2', star: 'w-3.5 h-3.5', text: 'text-[10px]' },
  md: { dot: 'w-2.5 h-2.5', star: 'w-4 h-4', text: 'text-xs' },
  lg: { dot: 'w-3 h-3', star: 'w-5 h-5', text: 'text-sm' },
} as const;

export function CategoryMarkIcon({
  mark,
  size = 'md',
  className,
}: {
  mark: CategoryMark;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  if (mark === 'star') {
    return (
      <Star
        className={cn(s.star, 'text-premium fill-premium shrink-0', className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn(
        s.dot,
        'rounded-full shrink-0 inline-block',
        mark === 'purple_dot' ? 'bg-[#7c3aed]' : 'bg-[#16a34a]',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Drop-in: dado el user_id del autor, pinta su distintivo de categoría.
 * No renderiza nada si no tiene categoría asignada.
 */
export function ProfileCategoryMark({
  userId,
  size = 'md',
  withLabel = false,
  className,
}: {
  userId?: string | null;
  size?: keyof typeof SIZES;
  /** Añade el nombre de la categoría junto al distintivo */
  withLabel?: boolean;
  className?: string;
}) {
  const { mark, displayName } = useProfileCategory(userId);
  if (!mark) return null;

  const label = displayName || '';

  if (!withLabel) {
    return (
      <span
        className={cn('inline-flex items-center shrink-0', className)}
        title={label}
        aria-label={label}
        role="img"
      >
        <CategoryMarkIcon mark={mark} size={size} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 font-medium whitespace-nowrap shrink-0',
        SIZES[size].text,
        className,
      )}
      title={label}
    >
      <CategoryMarkIcon mark={mark} size={size} />
      {label}
    </span>
  );
}

/**
 * Etiqueta "Médico" / "Residente" del autor. El cliente quiere distinguir en la
 * parrilla y en el contenido quién es residente y quién médico.
 */
export function AuthorRoleTag({
  userId,
  className,
}: {
  userId?: string | null;
  className?: string;
}) {
  const { authorRole } = useProfileCategory(userId);
  const { t } = useLanguage();
  if (authorRole !== 'doctor' && authorRole !== 'resident') return null;
  const isResident = authorRole === 'resident';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0',
        isResident
          ? 'border-secondary/30 bg-secondary/10 text-secondary'
          : 'border-primary/30 bg-primary/10 text-primary',
        className,
      )}
    >
      {isResident ? t('profileCategory.resident') : t('profileCategory.doctor')}
    </span>
  );
}
