import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ¿Hay algún live transmitiendo AHORA? (24-nov-2026). Misma condición pública
// que LivesContext (status 'live' + is_broadcasting). La portada solo dice
// «EN VIVO» si es cierto; si no, «Próximos lives». Se revisa cada 60 s.
export function useLiveNow(): boolean {
  const [liveNow, setLiveNow] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const { count } = await supabase
          .from('lives')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'live')
          .eq('is_broadcasting', true);
        if (alive) setLiveNow((count ?? 0) > 0);
      } catch { /* sin red: se queda en «Próximos lives» */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return liveNow;
}
