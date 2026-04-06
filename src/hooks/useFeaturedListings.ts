import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FeaturedListing {
  id: string;
  listing_type: string;
  listing_id: string;
  priority: number;
  label_es: string;
  label_en: string;
}

export function useFeaturedListings(listingType: 'hospital' | 'product') {
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [featuredMap, setFeaturedMap] = useState<Record<string, FeaturedListing>>({});
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();
  const trackedImpressions = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetch = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('featured_listings' as any)
        .select('id, listing_type, listing_id, priority, label_es, label_en, start_date, end_date')
        .eq('listing_type', listingType)
        .eq('is_active', true);

      const valid = ((data as any[]) || []).filter(f => {
        if (f.start_date && f.start_date > now) return false;
        if (f.end_date && f.end_date < now) return false;
        return true;
      });

      const ids = new Set(valid.map(f => f.listing_id));
      const map: Record<string, FeaturedListing> = {};
      valid.forEach(f => { map[f.listing_id] = f; });

      setFeaturedIds(ids);
      setFeaturedMap(map);
      setLoading(false);
    };
    fetch();
  }, [listingType]);

  const trackImpression = useCallback(async (listingId: string) => {
    const featured = featuredMap[listingId];
    if (!featured || trackedImpressions.current.has(featured.id)) return;
    trackedImpressions.current.add(featured.id);

    await supabase.from('featured_events' as any).insert({
      featured_id: featured.id,
      event_type: 'impression',
      user_id: user?.id || null,
      user_role: role || null,
    });
  }, [featuredMap, user, role]);

  const trackClick = useCallback(async (listingId: string) => {
    const featured = featuredMap[listingId];
    if (!featured) return;

    await supabase.from('featured_events' as any).insert({
      featured_id: featured.id,
      event_type: 'click',
      user_id: user?.id || null,
      user_role: role || null,
    });
  }, [featuredMap, user, role]);

  return { featuredIds, featuredMap, loading, trackImpression, trackClick };
}
