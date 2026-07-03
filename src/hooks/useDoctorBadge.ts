import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Distintivo manual (medalla/palomita) de un doctor por su user_id.
// doctor_profiles tiene RLS "solo dueño/admin", así que leemos vía el RPC
// SECURITY DEFINER get_doctor_badges. Batched + cacheado en memoria para que
// una lista con N doctores dispare 1 sola llamada y no N.
export type ManualBadgeValue = 'gold' | 'verified' | null;

const cache = new Map<string, ManualBadgeValue>();
const listeners = new Map<string, Set<(b: ManualBadgeValue) => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = Array.from(pending);
  pending = new Set();
  if (ids.length === 0) return;
  try {
    const { data } = await supabase.rpc('get_doctor_badges' as any, { p_user_ids: ids });
    const got = new Map<string, ManualBadgeValue>();
    (data as any[] | null)?.forEach((r) => got.set(r.user_id, r.manual_badge));
    ids.forEach((id) => {
      const b = (got.get(id) ?? null) as ManualBadgeValue;
      cache.set(id, b);
      listeners.get(id)?.forEach((fn) => fn(b));
    });
  } catch {
    // ante error, marca como "sin badge" para no reintentar en bucle
    ids.forEach((id) => {
      if (!cache.has(id)) cache.set(id, null);
      listeners.get(id)?.forEach((fn) => fn(cache.get(id) ?? null));
    });
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 60);
}

export function useDoctorBadge(userId?: string | null): ManualBadgeValue {
  const [badge, setBadge] = useState<ManualBadgeValue>(
    userId && cache.has(userId) ? (cache.get(userId) as ManualBadgeValue) : null,
  );

  useEffect(() => {
    if (!userId) {
      setBadge(null);
      return;
    }
    if (cache.has(userId)) {
      setBadge(cache.get(userId) as ManualBadgeValue);
      return;
    }
    let set = listeners.get(userId);
    if (!set) {
      set = new Set();
      listeners.set(userId, set);
    }
    const fn = (b: ManualBadgeValue) => setBadge(b);
    set.add(fn);
    pending.add(userId);
    schedule();
    return () => {
      set!.delete(fn);
    };
  }, [userId]);

  return badge;
}
