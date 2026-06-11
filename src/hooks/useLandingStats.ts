import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Admin-editable marketing/credibility stats (site_settings.landing_stats).
// String values so the admin can type "5,000+", "15M+", "98%", "3x", etc.
// Every key falls back to the historical hardcoded value.
export interface LandingStats {
  active_doctors: string;
  patients_served: string;
  satisfaction: string;
  availability: string;
  enterprise_absenteeism: string;
  enterprise_roi: string;
  enterprise_satisfaction: string;
  enterprise_support: string;
}

export const LANDING_STATS_DEFAULTS: LandingStats = {
  active_doctors: '5,000+',
  patients_served: '15M+',
  satisfaction: '98%',
  availability: '24/7',
  enterprise_absenteeism: '40%',
  enterprise_roi: '3x',
  enterprise_satisfaction: '95%',
  enterprise_support: '24/7',
};

let cached: LandingStats | null = null;

export function useLandingStats() {
  const [stats, setStats] = useState<LandingStats>(cached || LANDING_STATS_DEFAULTS);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'landing_stats')
          .maybeSingle();
        const merged = { ...LANDING_STATS_DEFAULTS, ...((data?.value as Partial<LandingStats>) || {}) };
        cached = merged;
        if (active) setStats(merged);
      } catch {
        if (active) setStats(LANDING_STATS_DEFAULTS);
      }
    })();
    return () => { active = false; };
  }, []);

  return stats;
}
