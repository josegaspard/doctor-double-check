import { Link } from 'react-router-dom';
import { useFooterLinks } from '@/hooks/useFooterLinks';
import { useSocialLinks } from '@/hooks/useSiteSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdConfig } from '@/hooks/useAds';
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import { DmcaBadge } from '@/components/layout/DmcaBadge';
import logoWhite from '@/assets/logo-medical-masters-white.png';

interface Props {
  variant: 'landing' | 'app';
}

function SocialIcons({ socialLinks, className = '' }: { socialLinks: any; className?: string }) {
  const icons = [
    { key: 'facebook', url: socialLinks.facebook, Icon: Facebook },
    { key: 'instagram', url: socialLinks.instagram, Icon: Instagram },
    { key: 'twitter', url: socialLinks.twitter, Icon: Twitter },
    { key: 'linkedin', url: socialLinks.linkedin, Icon: Linkedin },
    { key: 'youtube', url: socialLinks.youtube, Icon: Youtube },
  ].filter(i => i.url);

  if (icons.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icons.map(({ key, url, Icon }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={key}
          className="group w-9 h-9 rounded-full border-2 border-white/70 bg-white/15 shadow-sm flex items-center justify-center hover:bg-white hover:border-white transition-colors"
        >
          <Icon className="w-4 h-4 text-white group-hover:text-[#163a83]" />
        </a>
      ))}
    </div>
  );
}

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="text-left">
      <h4 className="text-white font-bold mb-3 sm:mb-4 text-xs uppercase tracking-wider">{title}</h4>
      <ul className="space-y-2 sm:space-y-3">
        {links.map((link, i) => (
          <li key={i}>
            <Link
              to={link.href}
              className={`text-xs sm:text-sm font-medium transition-colors ${
                link.href === '/report-issue'
                  ? 'text-warning hover:text-white'
                  : 'text-white hover:text-white hover:underline'
              }`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Map href → translation key. Allows links from BD to render translated labels.
const HREF_I18N_MAP: Record<string, string> = {
  '/for-doctors': 'landingFooter.forDoctors',
  '/for-residents': 'landingFooter.forResidents',
  '/for-patients': 'landingFooter.forPatients',
  '/enterprise': 'landingFooter.enterprise',
  '/success-stories': 'landingFooter.successStories',
  '/help': 'landingFooter.help',
  '/contact': 'landingFooter.contact',
  '/privacy': 'landingFooter.privacy',
  '/terms': 'landingFooter.terms',
  '/security': 'landingFooter.security',
  '/compliance': 'landingFooter.compliance',
  '/arco': 'landingFooter.arco',
  '/dmca': 'landingFooter.dmca',
  '/report-issue': 'landingFooter.report',
  '/advertising': 'ads.advertising',
  '/vendor/dashboard': 'landingFooter.vendorPortal',
};

export function UnifiedFooter({ variant }: Props) {
  const { footerLinks } = useFooterLinks();
  const { socialLinks } = useSocialLinks();
  const { t, language } = useLanguage();
  const { config: adConfig } = useAdConfig();
  const { role } = useAuth();

  // Translate labels using i18n keys when href is known; fallback to BD label.
  const translateLink = (l: { label: string; href: string }) => {
    const key = HREF_I18N_MAP[l.href];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return { ...l, label: translated };
    }
    return l;
  };

  const platformLinksRaw = footerLinks.platform.some(l => l.href === '/for-residents')
    ? footerLinks.platform
    : [...footerLinks.platform, { label: 'Para Residentes', href: '/for-residents' }];
  // Garantizar el enlace al Portal de proveedores en el footer (cliente
  // 2026-07-02: va aquí, NO en el menú "Más") — solo para quien puede usarlo.
  const canSeeVendorPortal = role === 'doctor' || role === 'resident' || role === 'admin';
  const platformWithVendors = !canSeeVendorPortal
    ? platformLinksRaw.filter(l => l.href !== '/vendor/dashboard')
    : platformLinksRaw.some(l => l.href === '/vendor/dashboard')
    ? platformLinksRaw
    : [...platformLinksRaw, { label: 'Portal de proveedores', href: '/vendor/dashboard' }];
  const platformLinks = platformWithVendors.map(translateLink);

  const resourcesLinksRaw = adConfig.is_active
    ? [...footerLinks.resources, { label: t('ads.advertising'), href: '/advertising' }]
    : footerLinks.resources;
  const resourcesLinks = resourcesLinksRaw.map(translateLink);

  // Garantizar SIEMPRE el enlace de Términos y Condiciones en el footer
  // (cliente 2026-06-29), aunque un override de site_settings lo haya quitado.
  const legalWithTerms = footerLinks.legal.some(l => l.href === '/terms')
    ? footerLinks.legal
    : [{ label: 'Términos y Condiciones', href: '/terms' }, ...footerLinks.legal];
  const legalLinksRaw = legalWithTerms.some(l => l.href === '/dmca')
    ? legalWithTerms
    : [...legalWithTerms, { label: 'Protección DMCA', href: '/dmca' }];
  const legalLinks = legalLinksRaw.map(translateLink);

  // Copyright: el superadministrador puede sobrescribirlo desde /admin/site-settings
  // (site_settings → footer_links.copyright). Si no lo definió, se usa el texto
  // localizado con el año actual.
  const year = new Date().getFullYear();
  const lang = String(language);
  const adminCopyright = footerLinks.copyright?.trim();
  const copyright = adminCopyright
    ? adminCopyright
    : lang === 'es'
    ? `${year} Medical Masters. Todos los derechos reservados.`
    : lang === 'pt'
    ? `${year} Medical Masters. Todos os direitos reservados.`
    : lang === 'fr'
    ? `${year} Medical Masters. Tous droits réservés.`
    : lang === 'it'
    ? `${year} Medical Masters. Tutti i diritti riservati.`
    : lang === 'de'
    ? `${year} Medical Masters. Alle Rechte vorbehalten.`
    : `${year} Medical Masters. All rights reserved.`;

  if (variant === 'app') {
    return (
      <footer className="bg-[#227787] text-white pt-8 sm:pt-10 pb-24 sm:pb-6 mt-auto border-t-0">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6">
            <div className="col-span-2 md:col-span-1 flex flex-col items-start">
              <img src={logoWhite} alt="Medical Masters" className="h-6 sm:h-7 mb-3" />
              <p className="text-[11px] sm:text-xs text-white mb-3 max-w-xs leading-relaxed text-left">
                {t('landingFooter.brandDescription')}
              </p>
              <SocialIcons socialLinks={socialLinks} />
            </div>

            <FooterLinkColumn title={t('landingFooter.platform')} links={platformLinks} />
            <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
            <FooterLinkColumn title={t('landingFooter.legal')} links={legalLinks} />
          </div>

          <div className="border-t border-white/30 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white font-medium">{copyright}</p>
            <div className="flex items-center gap-3">
              {footerLinks.show_status_badge && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white font-semibold text-xs">{t('landingFooter.allSystems')}</span>
                </div>
              )}
              <DmcaBadge />
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="relative bg-[#227787] pt-14 sm:pt-24 pb-8 sm:pb-10 text-white border-t-0 text-sm"
      // Un solo bloque: el footer arranca EXACTO con el navy de la sección de arriba (#163a83)
      // y degrada en SÓLIDO (color→color, sin transparencia) hasta el teal del footer. Sin costura.
      style={{ backgroundImage: 'linear-gradient(to bottom, #163a83 0px, #1c5a82 110px, #227787 230px)' }}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-10 mb-10 sm:mb-16">
          <div className="col-span-2 md:col-span-2 xl:col-span-2">
            <img src={logoWhite} alt="Medical Logo" className="h-8 mb-4 sm:mb-6" />
            <p className="mb-4 sm:mb-6 max-w-sm text-white text-xs sm:text-sm">
              {t('landingFooter.brandDescription')}
            </p>
            <SocialIcons socialLinks={socialLinks} />
          </div>

          <FooterLinkColumn title={t('landingFooter.platform')} links={platformLinks} />
          <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
          <FooterLinkColumn title={t('landingFooter.legal')} links={legalLinks} />
        </div>

        <div className="border-t border-white/30 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm text-center sm:text-left text-white font-medium">{copyright}</p>
          <div className="flex items-center gap-4">
            {footerLinks.show_status_badge && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-semibold text-xs">{t('landingFooter.allSystems')}</span>
              </div>
            )}
            <DmcaBadge />
          </div>
        </div>
      </div>
    </footer>
  );
}
