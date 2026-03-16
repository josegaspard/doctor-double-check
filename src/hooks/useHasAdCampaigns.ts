import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useHasAdCampaigns() {
  const { user } = useAuth();
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    supabase
      .from('ad_campaigns' as any)
      .select('id', { count: 'exact', head: true })
      .eq('advertiser_id', user.id)
      .then(({ count }) => {
        setHasCampaigns((count ?? 0) > 0);
        setIsLoading(false);
      });
  }, [user?.id]);

  return { hasCampaigns, isLoading };
}
