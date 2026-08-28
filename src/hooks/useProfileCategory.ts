import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Categoría de perfil (cliente 2026-08-28): tres categorías con distintivo
//   'star'       = ⭐ estrella
//   'purple_dot' = 🟣 punto morado
//   'green_dot'  = 🟢 punto verde
// El distintivo se ve en el perfil Y en el contenido, para saber de un vistazo
// qué tipo de perfil publicó cada cosa.
//
// Mismo patrón que useDoctorBadge: RPC SECURITY DEFINER + batched + cache en
// memoria, para que una parrilla con N autores dispare 1 sola llamada.
export type CategoryMark = 'star' | 'purple_dot' | 'green_dot';

export interface ProfileCategory {
  categoryKey: string | null;
  displayName: string | null;
  mark: CategoryMark | null;
  /** 'doctor' | 'resident' | 'patient' | 'admin' | null */
  authorRole: string | null;
}

const EMPTY: ProfileCategory = { categoryKey: null, displayName: null, mark: null, authorRole: null };

const cache = new Map<string, ProfileCategory>();
const listeners = new Map<string, Set<(c: ProfileCategory) => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = Array.from(pending);
  pending = new Set();
  if (ids.length === 0) return;
  try {
    const { data } = await supabase.rpc('get_profile_categories' as any, { p_user_ids: ids });
    const got = new Map<string, ProfileCategory>();
    (data as any[] | null)?.forEach((r) => {
      got.set(r.user_id, {
        categoryKey: r.category_key ?? null,
        displayName: r.display_name ?? null,
        mark: (r.mark ?? null) as CategoryMark | null,
        authorRole: r.author_role ?? null,
      });
    });
    ids.forEach((id) => {
      const c = got.get(id) ?? EMPTY;
      cache.set(id, c);
      listeners.get(id)?.forEach((fn) => fn(c));
    });
  } catch {
    // ante error se marca "sin categoría" para no reintentar en bucle
    ids.forEach((id) => {
      if (!cache.has(id)) cache.set(id, EMPTY);
      listeners.get(id)?.forEach((fn) => fn(cache.get(id) ?? EMPTY));
    });
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 60);
}

export function useProfileCategory(userId?: string | null): ProfileCategory {
  const [cat, setCat] = useState<ProfileCategory>(
    userId && cache.has(userId) ? (cache.get(userId) as ProfileCategory) : EMPTY,
  );

  useEffect(() => {
    if (!userId) {
      setCat(EMPTY);
      return;
    }
    if (cache.has(userId)) {
      setCat(cache.get(userId) as ProfileCategory);
      return;
    }
    let set = listeners.get(userId);
    if (!set) {
      set = new Set();
      listeners.set(userId, set);
    }
    const fn = (c: ProfileCategory) => setCat(c);
    set.add(fn);
    pending.add(userId);
    schedule();
    return () => { set!.delete(fn); };
  }, [userId]);

  return cat;
}

/** Invalida la caché (tras asignar categorías desde el admin). */
export function clearProfileCategoryCache() {
  cache.clear();
}

/**
 * Versión en lote: dada una lista de autores devuelve un mapa
 * { user_id -> ProfileCategory }. Lo usan las parrillas (lives, contenido,
 * grabaciones) para poder FILTRAR por tipo de perfil sin N peticiones.
 */
export function useProfileCategories(userIds: (string | undefined | null)[]): Record<string, ProfileCategory> {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[])).sort();
  const key = ids.join(',');
  const [map, setMap] = useState<Record<string, ProfileCategory>>({});

  useEffect(() => {
    if (ids.length === 0) { setMap({}); return; }
    let alive = true;

    const missing = ids.filter((id) => !cache.has(id));
    const build = () => {
      const out: Record<string, ProfileCategory> = {};
      ids.forEach((id) => { out[id] = cache.get(id) ?? EMPTY; });
      if (alive) setMap(out);
    };

    if (missing.length === 0) { build(); return; }

    supabase
      .rpc('get_profile_categories' as any, { p_user_ids: missing })
      .then(({ data }) => {
        const got = new Map<string, ProfileCategory>();
        (data as any[] | null)?.forEach((r) => {
          got.set(r.user_id, {
            categoryKey: r.category_key ?? null,
            displayName: r.display_name ?? null,
            mark: (r.mark ?? null) as CategoryMark | null,
            authorRole: r.author_role ?? null,
          });
        });
        missing.forEach((id) => {
          const c = got.get(id) ?? EMPTY;
          cache.set(id, c);
          listeners.get(id)?.forEach((fn) => fn(c));
        });
        build();
      })
      .then(undefined, () => {
        missing.forEach((id) => { if (!cache.has(id)) cache.set(id, EMPTY); });
        build();
      });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
