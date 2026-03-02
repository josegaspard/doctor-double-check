import { Link } from 'react-router-dom';
import { useFooterLinks } from '@/hooks/useFooterLinks';
import { useSocialLinks } from '@/hooks/useSiteSettings';
import { useLanguage } from '@/contexts/LanguageContext';
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

export function UnifiedFooter({ variant }: Props) {
  const { footerLinks } = useFooterLinks();
  const { socialLinks } = useSocialLinks();
  const { t } = useLanguage();

  if (variant === 'app') {
    return (
      <footer className="bg-[#0b1d45] text-slate-300 py-6 mt-auto hidden sm:block">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={logoWhite} alt="Medical Masters" className="h-7 opacity-90" />
              </div>
              <SocialIcons socialLinks={socialLinks} />
            </div>

            <div className="border-t border-white/10" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <nav className="flex items-center gap-4 flex-wrap justify-center">
                {footerLinks.legal.map((link, i) => (
                  <Link
                    key={i}
                    to={link.href}
                    className={`text-xs hover:text-white/90 transition-colors ${
                      link.href === '/report-issue' ? 'text-orange-300/80 hover:text-orange-200' : 'text-slate-400'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <p className="text-xs text-slate-500">{footerLinks.copyright}</p>
            </div>

            {footerLinks.show_status_badge && (
              <div className="flex justify-center md:justify-end">
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
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">{t('landingFooter.platform')}</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              {footerLinks.platform.map((link, i) => (
                <li key={i}>
                  <Link to={link.href} className="hover:text-[#aed3d9] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">{t('landingFooter.resources')}</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              {footerLinks.resources.map((link, i) => (
                <li key={i}>
                  <Link to={link.href} className="hover:text-[#aed3d9] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-bold mb-3 sm:mb-6 text-sm">{t('landingFooter.legal')}</h4>
            <ul className="space-y-2 sm:space-y-4 text-xs sm:text-sm">
              {footerLinks.legal.map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.href}
                    className={`hover:text-[#aed3d9] transition-colors ${
                      link.href === '/report-issue' ? 'text-orange-300/80 hover:text-orange-200' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
