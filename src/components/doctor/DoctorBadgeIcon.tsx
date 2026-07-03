import { useDoctorBadge } from '@/hooks/useDoctorBadge';
import { ManualBadge } from './ManualBadge';

// Drop-in: dado el user_id de un doctor, muestra su distintivo (solo icono, grande).
// Úsalo en CUALQUIER superficie donde aparezca un doctor (chat, citas, reseñas...).
// No renderiza nada si el doctor no tiene distintivo.
export function DoctorBadgeIcon({
  userId,
  size = 'md',
  className,
}: {
  userId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const badge = useDoctorBadge(userId);
  if (!badge) return null;
  return <ManualBadge badge={badge} size={size} iconOnly className={className} />;
}
