import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SiteToggles {
  show_news_section: boolean;
  show_content_medical: boolean;
  show_prescriptions: boolean;
  live_chat_free: boolean;
  show_transaction_history: boolean;
}

const DEFAULT_TOGGLES: SiteToggles = {
  show_news_section: false,
  show_content_medical: false,
  show_prescriptions: false,
  live_chat_free: true,
  show_transaction_history: false,
};

let cachedToggles: SiteToggles | null = null;
let fetchPromise: Promise<SiteToggles> | null = null;

async function fetchToggles(): Promise<SiteToggles> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', 'feature_toggles')
      .maybeSingle();

    if (data?.value && !error) {
      cachedToggles = { ...DEFAULT_TOGGLES, ...(data.value as unknown as Partial<SiteToggles>) };
    } else {
      cachedToggles = DEFAULT_TOGGLES;
    }
  } catch {
    cachedToggles = DEFAULT_TOGGLES;
  }
  fetchPromise = null;
  return cachedToggles;
}

export function useSiteToggles() {
  const [toggles, setToggles] = useState<SiteToggles>(cachedToggles || DEFAULT_TOGGLES);
  const [isLoading, setIsLoading] = useState(!cachedToggles);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (cachedToggles) {
      setToggles(cachedToggles);
      setIsLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchToggles();
    }

    fetchPromise.then((result) => {
      if (mounted.current) {
        setToggles(result);
        setIsLoading(false);
      }
    });

    return () => { mounted.current = false; };
  }, []);

  return { toggles, isLoading };
}

// For admin: save toggles
export async function saveSiteToggles(toggles: SiteToggles, updatedBy?: string) {
  const { error } = await supabase
    .from('site_settings')
    .upsert({
      id: 'feature_toggles',
      value: toggles as any,
      updated_by: updatedBy,
    });

  if (!error) {
    cachedToggles = toggles;
  }
  return { error };
}
