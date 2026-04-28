import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DisclaimerContent {
  version: string;
  enabled: boolean;
  long: string;
  short: string;
}

const DEFAULT: DisclaimerContent = {
  version: 'v1',
  enabled: true,
  long: 'La información proporcionada constituye orientación médica y no sustituye una consulta presencial. En urgencias acude al 911.',
  short: '⚠️ Orientación médica — no sustituye consulta presencial. Urgencias: 911.',
};

/**
 * Loads the editable disclaimer text from site_settings and tracks
 * whether the current user has already accepted the current version.
 */
export function useDisclaimer(disclaimerKey: string = 'disclaimer_orientacion_medica') {
  const { user } = useAuth();
  const [content, setContent] = useState<DisclaimerContent>(DEFAULT);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: settings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', disclaimerKey)
        .maybeSingle();

      const value = (settings?.value as Partial<DisclaimerContent> | null) ?? null;
      const merged: DisclaimerContent = { ...DEFAULT, ...(value ?? {}) };
      if (cancelled) return;
      setContent(merged);

      if (!user) {
        setAccepted(false);
        setLoading(false);
        return;
      }

      const { data: acc } = await supabase
        .from('disclaimer_acceptances')
        .select('id')
        .eq('user_id', user.id)
        .eq('disclaimer_key', disclaimerKey)
        .eq('disclaimer_version', merged.version)
        .maybeSingle();

      if (cancelled) return;
      setAccepted(!!acc);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, disclaimerKey]);

  const accept = async (context: Record<string, unknown> = {}) => {
    if (!user) return false;
    const { error } = await supabase.from('disclaimer_acceptances').insert({
      user_id: user.id,
      disclaimer_key: disclaimerKey,
      disclaimer_version: content.version,
      context,
    });
    if (!error) setAccepted(true);
    return !error;
  };

  return { content, accepted, loading, accept };
}
