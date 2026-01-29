import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
}

export function useSocialLinks() {
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: '',
    youtube: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'social_links')
          .single();

        if (data?.value && !error) {
          setSocialLinks(data.value as unknown as SocialLinks);
        }
      } catch (error) {
        console.error('Error fetching social links:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSocialLinks();
  }, []);

  return { socialLinks, isLoading };
}
