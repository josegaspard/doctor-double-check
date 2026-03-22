import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdConfig {
  is_active: boolean;
  cpm_rate: number;
  cpc_rate: number;
  min_budget: number;
  max_file_size_kb: number;
  allowed_formats: string[];
}

interface AdPlacement {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  width: number;
  height: number;
  format: string;
  is_active: boolean;
  sort_order: number;
}

interface AdCreative {
  id: string;
  campaign_id: string;
  placement_id: string;
  media_url: string;
  media_type: string;
  click_url: string;
  alt_text: string | null;
}

export interface AdCreativeWithFormat extends AdCreative {
  placement_format: string;
  placement_name: string;
}

const DEFAULT_CONFIG: AdConfig = {
  is_active: false,
  cpm_rate: 50,
  cpc_rate: 5,
  min_budget: 500,
  max_file_size_kb: 2048,
  allowed_formats: ['image', 'gif', 'video'],
};

let cachedConfig: AdConfig | null = null;
let configFetchPromise: Promise<AdConfig> | null = null;

async function fetchAdConfig(): Promise<AdConfig> {
  if (cachedConfig) return cachedConfig;
  if (configFetchPromise) return configFetchPromise;

  configFetchPromise = (async () => {
    const { data } = await supabase
      .from('ad_config' as any)
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    const d = data as any;
    cachedConfig = d ? {
      is_active: d.is_active,
      cpm_rate: Number(d.cpm_rate),
      cpc_rate: Number(d.cpc_rate),
      min_budget: Number(d.min_budget),
      max_file_size_kb: d.max_file_size_kb,
      allowed_formats: d.allowed_formats,
    } : DEFAULT_CONFIG;
    return cachedConfig;
  })();

  return configFetchPromise;
}

export function useAdConfig() {
  const [config, setConfig] = useState<AdConfig>(cachedConfig || DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(!cachedConfig);

  useEffect(() => {
    fetchAdConfig().then(c => {
      setConfig(c);
      setIsLoading(false);
    });
  }, []);

  const refetch = useCallback(async () => {
    cachedConfig = null;
    configFetchPromise = null;
    const c = await fetchAdConfig();
    setConfig(c);
  }, []);

  return { config, isLoading, refetch };
}

export function useAdPlacements() {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    const { data } = await supabase
      .from('ad_placements' as any)
      .select('*')
      .order('sort_order');
    setPlacements((data as any[]) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  return { placements, isLoading, refetch: fetchPlacements };
}

/** Fetches a single active creative for the given placement */
export function useAdCreative(placementName: string) {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const [creative, setCreative] = useState<AdCreativeWithFormat | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const impressionTracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setCreative(null);

      try {
        const config = await fetchAdConfig();
        if (!config.is_active || cancelled) {
          setIsActive(false);
          setIsLoading(false);
          return;
        }
        setIsActive(true);

        const { data: placement } = await supabase
          .from('ad_placements' as any)
          .select('id, format, name')
          .eq('name', placementName)
          .eq('is_active', true)
          .maybeSingle();

        if (!placement || cancelled) {
          setIsLoading(false);
          return;
        }
        const p = placement as any;

        const { data: creatives } = await supabase
          .from('ad_creatives' as any)
          .select('id, campaign_id, placement_id, media_url, media_type, click_url, alt_text')
          .eq('placement_id', p.id)
          .eq('is_active', true);

        if (!creatives || creatives.length === 0 || cancelled) {
          setIsLoading(false);
          return;
        }

        const campaignIds = [...new Set((creatives as any[]).map((c: any) => c.campaign_id))];
        const { data: campaigns } = await supabase
          .from('ad_campaigns' as any)
          .select('id, target_roles, target_language')
          .in('id', campaignIds)
          .eq('status', 'active');

        if (!campaigns || campaigns.length === 0 || cancelled) {
          setIsLoading(false);
          return;
        }

        const validCampaignIds = new Set(
          (campaigns as any[])
            .filter((c: any) => {
              if (role && c.target_roles && !(c.target_roles as string[]).includes(role)) return false;
              if (c.target_language && c.target_language !== language) return false;
              return true;
            })
            .map((c: any) => c.id)
        );

        const validCreatives: AdCreativeWithFormat[] = (creatives as any[])
          .filter((c: any) => validCampaignIds.has(c.campaign_id))
          .map((c: any) => ({
            ...c,
            placement_format: p.format,
            placement_name: p.name,
          }));

        if (validCreatives.length === 0 || cancelled) {
          setIsLoading(false);
          return;
        }

        const randomIndex = Math.floor(Math.random() * validCreatives.length);
        setCreative(validCreatives[randomIndex]);
      } catch (error) {
        console.error('[useAdCreative] Failed to load creative', error);
        setIsActive(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [placementName, role, language]);

  const trackImpression = useCallback(async () => {
    if (!creative || impressionTracked.current.has(creative.id)) return;
    impressionTracked.current.add(creative.id);

    await supabase.from('ad_events' as any).insert({
      creative_id: creative.id,
      campaign_id: creative.campaign_id,
      event_type: 'impression',
      user_id: user?.id || null,
      user_role: role || null,
      user_language: language,
    });
  }, [creative, user, role, language]);

  const trackClick = useCallback(async () => {
    if (!creative) return;
    await supabase.from('ad_events' as any).insert({
      creative_id: creative.id,
      campaign_id: creative.campaign_id,
      event_type: 'click',
      user_id: user?.id || null,
      user_role: role || null,
      user_language: language,
    });
  }, [creative, user, role, language]);

  return { creative, isActive, isLoading, trackImpression, trackClick };
}
