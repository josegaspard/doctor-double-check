import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FooterLink {
  label: string;
  href: string;
}

export interface FooterLinksData {
  platform: FooterLink[];
  resources: FooterLink[];
  legal: FooterLink[];
  copyright: string;
  show_status_badge: boolean;
}

const DEFAULT_FOOTER: FooterLinksData = {
  platform: [
    { label: 'Para Doctores', href: '/for-doctors' },
    { label: 'Para Residentes', href: '/for-residents' },
    { label: 'Para Pacientes', href: '/for-patients' },
    { label: 'Empresas', href: '/enterprise' },
  ],
  resources: [
    { label: 'Casos de Éxito', href: '/success-stories' },
    { label: 'Ayuda', href: '/help' },
    { label: 'Contacto', href: '/contact' },
  ],
  legal: [
    { label: 'Privacidad', href: '/privacy' },
    { label: 'Términos', href: '/terms' },
    { label: 'Seguridad', href: '/security' },
    { label: 'Cumplimiento', href: '/compliance' },
    { label: 'Reportar', href: '/report-issue' },
  ],
  copyright: '2025 Medical Masters. Todos los derechos reservados.',
  show_status_badge: true,
};

export function useFooterLinks() {
  const [footerLinks, setFooterLinks] = useState<FooterLinksData>(DEFAULT_FOOTER);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'footer_links')
          .maybeSingle();

        if (data?.value && !error) {
          setFooterLinks({ ...DEFAULT_FOOTER, ...(data.value as unknown as FooterLinksData) });
        }
      } catch (e) {
        console.error('Error fetching footer links:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, []);

  return { footerLinks, isLoading };
}
