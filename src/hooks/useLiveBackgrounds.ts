import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveBackground {
  id: string;
  label: string;
  url: string;
}

// Fondo por defecto: logo Medical Masters (asset estático que ya existía como
// único fondo hardcodeado del live). El súper admin puede agregar/quitar más
// desde Admin → Site Settings → Fondos de Lives (site_settings id='live_backgrounds').
export const DEFAULT_LIVE_BACKGROUNDS: LiveBackground[] = [
  { id: 'mm-logo', label: 'Medical Masters', url: '/live-bg-mm.jpg' },
];

/**
 * Lee los fondos virtuales configurables para lives desde site_settings
 * (id='live_backgrounds', value={items:[{id,label,url}]}). Mismo patrón que
 * useSiteVideos. Si no hay valor guardado, cae al fondo de marca por defecto.
 */
export function useLiveBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<LiveBackground[]>(DEFAULT_LIVE_BACKGROUNDS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'live_backgrounds')
          .maybeSingle();
        const items = (data?.value as any)?.items;
        if (active && Array.isArray(items) && items.length > 0) {
          setBackgrounds(
            items.filter((b: any) => b && typeof b.url === 'string' && b.url)
              .map((b: any) => ({ id: String(b.id ?? b.url), label: String(b.label ?? 'Fondo'), url: b.url })),
          );
        }
      } catch (e) {
        console.error('Error fetching live backgrounds:', e);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { backgrounds, isLoading };
}
