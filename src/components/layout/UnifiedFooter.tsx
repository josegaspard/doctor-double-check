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

function AppStoreBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-2 items-center ${className}`}>
      {/* Apple App Store */}
      <a
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-black border border-white/20 hover:bg-black/80 transition-colors min-w-[110px]"
      >
        <svg viewBox="0 0 384 512" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-white flex-shrink-0">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[7px] sm:text-[8px] text-white/60">Disponible en</span>
          <span className="text-[10px] sm:text-xs font-semibold text-white">App Store</span>
        </div>
      </a>
      {/* Google Play */}
      <a
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-black border border-white/20 hover:bg-black/80 transition-colors min-w-[110px]"
      >
        <svg viewBox="0 0 512 512" className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0">
          <path fill="#4285F4" d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1z"/>
          <path fill="#34A853" d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0z"/>
          <path fill="#FBBC04" d="M472.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8z"/>
          <path fill="#EA4335" d="M104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-[7px] sm:text-[8px] text-white/60">Disponible en</span>
          <span className="text-[10px] sm:text-xs font-semibold text-white">Google Play</span>
        </div>
      </a>
    </div>
  );
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

export function UnifiedFooter({ variant }: Props) {
  const { footerLinks } = useFooterLinks();
  const { socialLinks } = useSocialLinks();
  const { t } = useLanguage();
  const { config: adConfig } = useAdConfig();

  const platformLinks = footerLinks.platform.some(l => l.href === '/for-residents')
    ? footerLinks.platform
    : [...footerLinks.platform, { label: 'Para Residentes', href: '/for-residents' }];

  const resourcesLinks = adConfig.is_active
    ? [...footerLinks.resources, { label: t('ads.advertising'), href: '/advertising' }]
    : footerLinks.resources;

  if (variant === 'app') {
    return (
      <footer className="bg-[#00768b] text-white pt-8 sm:pt-10 pb-24 sm:pb-6 mt-auto border-t-0">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6">
            <div className="col-span-2 md:col-span-1 flex flex-col items-start">
              <img src={logoWhite} alt="Medical Masters" className="h-6 sm:h-7 mb-3" />
              <p className="text-[11px] sm:text-xs text-white mb-3 max-w-xs leading-relaxed text-left">
                {t('landingFooter.brandDescription')}
              </p>
              <SocialIcons socialLinks={socialLinks} />
              <AppStoreBadges className="mt-3" />
            </div>

            <FooterLinkColumn title={t('landingFooter.platform')} links={platformLinks} />
            <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
            <FooterLinkColumn title={t('landingFooter.legal')} links={footerLinks.legal} />
          </div>

          <div className="border-t border-white/30 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white font-medium">{footerLinks.copyright}</p>
            {footerLinks.show_status_badge && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/25 border border-success/60">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-success font-bold text-xs">{t('landingFooter.allSystems')}</span>
              </div>
            )}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[#00768b] pt-12 sm:pt-20 pb-8 sm:pb-10 text-white border-t border-transparent text-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-10 mb-10 sm:mb-16">
          <div className="col-span-2 md:col-span-2 xl:col-span-2">
            <img src={logoWhite} alt="Medical Logo" className="h-8 mb-4 sm:mb-6" />
            <p className="mb-4 sm:mb-6 max-w-sm text-white text-xs sm:text-sm">
              {t('landingFooter.brandDescription')}
            </p>
            <SocialIcons socialLinks={socialLinks} />
            <AppStoreBadges className="mt-5 justify-center md:justify-start" />
          </div>

          <FooterLinkColumn title={t('landingFooter.platform')} links={platformLinks} />
          <FooterLinkColumn title={t('landingFooter.resources')} links={resourcesLinks} />
          <FooterLinkColumn title={t('landingFooter.legal')} links={footerLinks.legal} />
        </div>

        <div className="border-t border-white/30 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm text-center sm:text-left text-white font-medium">{footerLinks.copyright}</p>
          {footerLinks.show_status_badge && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/25 border border-success/60">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-success font-bold text-xs">{t('landingFooter.allSystems')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
