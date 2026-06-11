import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Shield, Users, BarChart3, Headphones, Globe, CheckCircle, Zap, Briefcase, Factory, Truck, Banknote, Store, RadioTower } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLandingStats } from '@/hooks/useLandingStats';

export default function Enterprise() {
  const { t } = useLanguage();
  const landingStats = useLandingStats();

  const features = [
    {
      icon: Users,
      title: t('enterprisePage.features.employeeManagement.title'),
      description: t('enterprisePage.features.employeeManagement.description'),
    },
    {
      icon: Shield,
      title: t('enterprisePage.features.compliance.title'),
      description: t('enterprisePage.features.compliance.description'),
    },
    {
      icon: BarChart3,
      title: t('enterprisePage.features.analytics.title'),
      description: t('enterprisePage.features.analytics.description'),
    },
    {
      icon: Headphones,
      title: t('enterprisePage.features.support.title'),
      description: t('enterprisePage.features.support.description'),
    },
    {
      icon: Globe,
      title: t('enterprisePage.features.multiLocation.title'),
      description: t('enterprisePage.features.multiLocation.description'),
    },
    {
      icon: Zap,
      title: t('enterprisePage.features.apiIntegration.title'),
      description: t('enterprisePage.features.apiIntegration.description'),
    },
  ];

  const stats = [
    { value: landingStats.enterprise_absenteeism, label: t('enterprisePage.stats.absenteeism') },
    { value: landingStats.enterprise_roi, label: t('enterprisePage.stats.roi') },
    { value: landingStats.enterprise_satisfaction, label: t('enterprisePage.stats.satisfaction') },
    { value: landingStats.enterprise_support, label: t('enterprisePage.stats.support') },
  ];

  // Industrias representativas (placeholders genéricos, sin marcas reales).
  // El equipo comercial reemplaza estos sectores con casos firmados conforme se
  // cierren contratos. Importante: subir SVG propios de cada cliente, NO usar
  // logos de marcas sin contrato y consentimiento por escrito.
  const trustedBy = [
    { icon: Factory,    label: t('enterprisePage.trustedBy.manufacturing.label'), sector: t('enterprisePage.trustedBy.manufacturing.sector') },
    { icon: Banknote,   label: t('enterprisePage.trustedBy.finance.label'),       sector: t('enterprisePage.trustedBy.finance.sector') },
    { icon: Truck,      label: t('enterprisePage.trustedBy.logistics.label'),     sector: t('enterprisePage.trustedBy.logistics.sector') },
    { icon: Store,      label: t('enterprisePage.trustedBy.retail.label'),        sector: t('enterprisePage.trustedBy.retail.sector') },
    { icon: RadioTower, label: t('enterprisePage.trustedBy.telecom.label'),       sector: t('enterprisePage.trustedBy.telecom.sector') },
    { icon: Briefcase,  label: t('enterprisePage.trustedBy.corporate.label'),     sector: t('enterprisePage.trustedBy.corporate.sector') },
  ];

  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('enterprisePage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('enterprisePage.hero.titleStart')} <span className="text-white">{t('enterprisePage.hero.titleEnd')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-white/85 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              {t('enterprisePage.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {t('enterprisePage.hero.ctaDemo')}
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-white/15 backdrop-blur-sm border-2 border-white/60 rounded-xl hover:bg-white/25 hover:border-white shadow-md transition-all"
              >
                {t('enterprisePage.hero.ctaSales')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="py-8 sm:py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-xl sm:text-3xl font-bold text-secondary">{stat.value}</p>
                <p className="text-[10px] sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-3 sm:mb-4">
            {t('enterprisePage.featuresSection.title')}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            {t('enterprisePage.featuresSection.subtitle')}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center mb-3 sm:mb-4">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By — fondo brand teal (mismo que header/footer) */}
      <section className="py-12 sm:py-24 bg-[#227787]">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-lg sm:text-2xl font-bold text-center text-white mb-2 sm:mb-3">
            {t('enterprisePage.trustedBySection.title')}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 text-center max-w-xl mx-auto mb-6 sm:mb-10">
            {t('enterprisePage.trustedBySection.subtitle')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 max-w-5xl mx-auto">
            {trustedBy.map((item, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center gap-2 p-4 sm:p-5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 shadow-sm hover:bg-white/15 hover:border-white/30 transition-all"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white leading-tight">{item.label}</p>
                  <p className="text-[10px] sm:text-[11px] text-white/80 mt-0.5 leading-tight">{item.sector}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-12 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-6 sm:mb-12">
            {t('enterprisePage.plansSection.title')}
          </h2>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-gray-50 p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-gray-200">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 sm:mb-2">{t('enterprisePage.plansSection.starter.name')}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{t('enterprisePage.plansSection.starter.description')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">{t('enterprisePage.plansSection.starter.priceFrom')}<span className="text-xs sm:text-sm font-normal text-muted-foreground">{t('enterprisePage.plansSection.starter.priceSuffix')}</span></p>
              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.starter.feature1')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.starter.feature2')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.starter.feature3')}</li>
              </ul>
              <Link to="/contact" className="block text-center py-2.5 sm:py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-sm">
                {t('enterprisePage.plansSection.starter.cta')}
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#227787] p-4 sm:p-8 rounded-xl sm:rounded-2xl text-white relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-0.5 sm:py-1 bg-light text-secondary text-[10px] sm:text-xs font-bold rounded-full whitespace-nowrap">
                {t('enterprisePage.plansSection.pro.badge')}
              </div>
              <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 mt-2 sm:mt-0">{t('enterprisePage.plansSection.pro.name')}</h3>
              <p className="text-xs sm:text-sm text-white/85 mb-3 sm:mb-4">{t('enterprisePage.plansSection.pro.description')}</p>
              <p className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('enterprisePage.plansSection.pro.priceFrom')}<span className="text-xs sm:text-sm font-normal text-white/85">{t('enterprisePage.plansSection.pro.priceSuffix')}</span></p>
              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light flex-shrink-0" />{t('enterprisePage.plansSection.pro.feature1')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light flex-shrink-0" />{t('enterprisePage.plansSection.pro.feature2')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light flex-shrink-0" />{t('enterprisePage.plansSection.pro.feature3')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light flex-shrink-0" />{t('enterprisePage.plansSection.pro.feature4')}</li>
              </ul>
              <Link to="/contact" className="block text-center py-2.5 sm:py-3 bg-white text-secondary rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm">
                {t('enterprisePage.plansSection.pro.cta')}
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-gray-50 p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-gray-200">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-1 sm:mb-2">{t('enterprisePage.plansSection.enterprise.name')}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">{t('enterprisePage.plansSection.enterprise.description')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">{t('enterprisePage.plansSection.enterprise.price')}</p>
              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.enterprise.feature1')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.enterprise.feature2')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.enterprise.feature3')}</li>
                <li className="flex items-center gap-2 text-xs sm:text-sm"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />{t('enterprisePage.plansSection.enterprise.feature4')}</li>
              </ul>
              <Link to="/contact" className="block text-center py-2.5 sm:py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-sm">
                {t('enterprisePage.plansSection.enterprise.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-[#227787]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('enterprisePage.cta.title')}</h2>
          <p className="text-white/85 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('enterprisePage.cta.subtitle')}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {t('enterprisePage.cta.button')}
          </Link>
        </div>
      </section>

      </MainLayout>
  );
}
