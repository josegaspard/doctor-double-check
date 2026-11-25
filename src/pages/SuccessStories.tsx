import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import TrustSignals from '@/components/TrustSignals';
import { useCoherenceText } from '@/lib/coherence/i18n';

export default function SuccessStories() {
  const { t } = useLanguage();
  const ct = useCoherenceText();

  return (
    <MainLayout>
      {/* Hero */}
      <header className="relative pt-20 sm:pt-28 pb-12 sm:pb-20 bg-gradient-to-br from-secondary via-primary to-secondary overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-light/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">{t('successStoriesPage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('successStoriesPage.hero.titlePart1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-light to-white">{t('successStoriesPage.hero.titlePart2')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto px-4">
              {t('successStoriesPage.hero.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* 24-nov-2026: fuera las cifras sin respaldo (5 000+ médicos, 15M+ pacientes,
          98 %) y los tres testimonios de ejemplo con fotos de banco. Hasta que haya
          casos reales con permiso, se explica eso y se enseña lo comprobable. */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl font-bold text-foreground">{ct('ss.storiesTitle')}</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">{ct('ss.storiesBody')}</p>
          </div>
          <TrustSignals withHeading={false} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 bg-gradient-to-br from-secondary to-primary">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('successStoriesPage.cta.title')}</h2>
          <p className="text-light/90 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('successStoriesPage.cta.subtitle')}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-primary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {t('successStoriesPage.cta.button')}
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
