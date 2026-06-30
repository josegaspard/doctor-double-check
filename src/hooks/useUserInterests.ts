import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Intereses del usuario derivados de sus búsquedas recientes (cliente 2026-06-29).
 * Devuelve una lista de términos en minúsculas ordenados por frecuencia.
 * Se usa para priorizar contenido afín (lives, casos, contenido) — "si busco
 * nutrición, que me empiecen a salir cosas de nutrición".
 */
export function useUserInterests(limit = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-interests', user?.id, limit],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_user_interests', { p_limit: limit });
      if (error) return [] as string[];
      return ((data as any[]) || []).map((r) => String(r.term).toLowerCase()).filter(Boolean);
    },
  });
}

/** Score simple: cuántos intereses aparecen en el texto del item. */
export function interestScore(text: string | null | undefined, interests: string[]): number {
  if (!text || !interests.length) return 0;
  const hay = text.toLowerCase();
  let score = 0;
  for (const term of interests) {
    if (term && hay.includes(term)) score++;
  }
  return score;
}
