import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SiteVideos {
  home: string | null;
  tutorial_doctor: string | null;
  tutorial_patient: string | null;
  tutorial_resident: string | null;
}

const DEFAULTS: SiteVideos = {
  home: '/landing-mm-2026.mp4',
  tutorial_doctor: null,
  tutorial_patient: null,
  tutorial_resident: null,
};

/**
 * Lee los videos configurables desde site_settings (id='videos').
 * Todo editable por el súper admin (bucket 'site-videos'). Si no hay valor,
 * cae a los assets estáticos por defecto.
 */
export function useSiteVideos() {
  const [videos, setVideos] = useState<SiteVideos>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'videos')
          .maybeSingle();
        if (active && data?.value) {
          const v = data.value as Partial<SiteVideos>;
          setVideos({
            home: v.home ?? DEFAULTS.home,
            tutorial_doctor: v.tutorial_doctor ?? null,
            tutorial_patient: v.tutorial_patient ?? null,
            tutorial_resident: v.tutorial_resident ?? null,
          });
        }
      } catch (e) {
        console.error('Error fetching site videos:', e);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { videos, isLoading };
}
