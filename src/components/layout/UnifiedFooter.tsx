import { Link } from 'react-router-dom';
import { useFooterLinks } from '@/hooks/useFooterLinks';
import { useSocialLinks } from '@/hooks/useSiteSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdConfig } from '@/hooks/useAds';
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
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
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-white font-bold mb-3 sm:mb-4 text-xs uppercase tracking-wider">{title}</h4>
      <ul className="space-y-2 sm:space-y-3">
        {links.map((link, i) => (
          <li key={i}>
            <Link
              to={link.href}
              className={`text-xs sm:text-sm hover:text-white/90 transition-colors ${
                link.href === '/report-issue' ? 'text-orange-300/80 hover:text-orange-200' : 'text-slate-400'
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

export function UnifiedFooter({ variant }: Props) {
  const { footerLinks } = useFooterLinks();
  const { socialLinks } = useSocialLinks();
  const { t } = useLanguage();
  const { config: adConfig } = useAdConfig();

  // Inject "Publicidad" link into resources when ads are active
  const resourcesLinks = adConfig.is_active
    ? [...footerLinks.resources, { label: t('ads.advertising'), href: '/advertising' }]
    : footerLinks.resources;
  if (variant === 'app') {
    return (
      <footer className="bg-[#0b1d45] text-slate-300 pt-8 sm:pt-10 pb-24 sm:pb-6 mt-auto">
        <div className="container mx-auto px-4">
          {/* Main grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <img src={logoWhite} alt="Medical Masters" className="h-7 opacity-90 mb-3" />
              <p className="text-xs text-slate-400 mb-3 max-w-xs leading-relaxed">
                {t('landingFooter.brandDescription')}
              </p>
              <SocialIcons socialLinks={socialLinks} />
            </div>

            <FooterLinkColumn title={t('landingFooter.platform')} links={footerLinks.platform} />
            <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
            <FooterLinkColumn title={t('landingFooter.legal')} links={footerLinks.legal} />
          </div>

          <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{footerLinks.copyright}</p>
            {footerLinks.show_status_badge && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-500 font-bold text-xs">{t('landingFooter.allSystems')}</span>
              </div>
            )}
          </div>
        </div>
      </footer>
    );
  }

  // Landing variant - full footer with columns
  return (
    <footer className="bg-[#0b1d45] pt-12 sm:pt-20 pb-8 sm:pb-10 text-slate-300 border-t border-white/5 font-light text-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-10 mb-10 sm:mb-16">
          {/* Brand Column */}
          <div className="col-span-2">
            <img src={logoWhite} alt="Medical Logo" className="h-8 mb-4 sm:mb-6 opacity-90" />
            <p className="mb-4 sm:mb-6 max-w-sm text-slate-400 text-xs sm:text-sm">
              {t('landingFooter.brandDescription')}
            </p>
            <SocialIcons socialLinks={socialLinks} />
          </div>

          {/* Platform */}
          <FooterLinkColumn title={t('landingFooter.platform')} links={footerLinks.platform} />
          <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
          <FooterLinkColumn title={t('landingFooter.legal')} links={footerLinks.legal} />
        </div>

        <div className="border-t border-white/10 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm text-center sm:text-left">{footerLinks.copyright}</p>
          {footerLinks.show_status_badge && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-500 font-bold text-xs">{t('landingFooter.allSystems')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
