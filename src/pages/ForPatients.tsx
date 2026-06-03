import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Video, FileText, Shield, Clock, Smartphone, Users, CheckCircle, Stethoscope, BookOpen } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForPatients() {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Stethoscope,
      title: t('forPatientsPage.benefits.medicalGuidance.title'),
      description: t('forPatientsPage.benefits.medicalGuidance.description'),
    },
    {
      icon: BookOpen,
      title: t('forPatientsPage.benefits.clinicalCases.title'),
      description: t('forPatientsPage.benefits.clinicalCases.description'),
    },
    {
      icon: Video,
      title: t('forPatientsPage.benefits.educationalLives.title'),
      description: t('forPatientsPage.benefits.educationalLives.description'),
    },
    {
      icon: FileText,
      title: t('forPatientsPage.benefits.secondOpinion.title'),
      description: t('forPatientsPage.benefits.secondOpinion.description'),
    },
    {
      icon: Shield,
      title: t('forPatientsPage.benefits.verifiedDoctors.title'),
      description: t('forPatientsPage.benefits.verifiedDoctors.description'),
    },
    {
      icon: Clock,
      title: t('forPatientsPage.benefits.availability.title'),
      description: t('forPatientsPage.benefits.availability.description'),
    },
    {
      icon: Smartphone,
      title: t('forPatientsPage.benefits.mobileApp.title'),
      description: t('forPatientsPage.benefits.mobileApp.description'),
    },
  ];

  const howItWorks = [
    { step: 1, title: t('forPatientsPage.howItWorks.step1Title'), description: t('forPatientsPage.howItWorks.step1Description') },
    { step: 2, title: t('forPatientsPage.howItWorks.step2Title'), description: t('forPatientsPage.howItWorks.step2Description') },
    { step: 3, title: t('forPatientsPage.howItWorks.step3Title'), description: t('forPatientsPage.howItWorks.step3Description') },
    { step: 4, title: t('forPatientsPage.howItWorks.step4Title'), description: t('forPatientsPage.howItWorks.step4Description') },
  ];

  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('forPatientsPage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('forPatientsPage.hero.titlePart1')} <span className="text-white">{t('forPatientsPage.hero.titlePart2')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-white/85 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              {t('forPatientsPage.hero.subtitle')}
            </p>
            <Link
              to="/app"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {t('forPatientsPage.hero.cta')}
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-3 sm:mb-4">
            {t('forPatientsPage.benefitsSection.heading')}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            {t('forPatientsPage.benefitsSection.subtitle')}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all">
                {/* Softened (difuminado) icon — pastel gradient with blur halo instead of solid dark navy */}
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-secondary/15 via-primary/10 to-secondary/20 flex items-center justify-center mb-3 sm:mb-4 ring-1 ring-secondary/10">
                  <div className="absolute inset-0 rounded-xl bg-secondary/20 blur-xl opacity-40" />
                  <benefit.icon className="relative w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-6 sm:mb-12">
            {t('forPatientsPage.howItWorks.heading')}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 max-w-4xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center mx-auto mb-3 sm:mb-4 text-white text-lg sm:text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-bold text-foreground mb-1 text-xs sm:text-base">{item.title}</h3>
                <p className="text-muted-foreground text-[10px] sm:text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust — fondo brand teal (mismo que header/footer) */}
      <section className="py-12 sm:py-24 bg-[#227787]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div className="bg-white/10 backdrop-blur-sm p-5 sm:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-white/15 order-2 md:order-1">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-3 sm:mb-4" />
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{t('forPatientsPage.trust.networkTitle')}</h3>
                <p className="text-white/85 mb-3 sm:mb-4 text-sm sm:text-base">
                  {t('forPatientsPage.trust.networkDescription')}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                    {t('forPatientsPage.trust.specialtyCardiologists')}
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                    {t('forPatientsPage.trust.specialtyNeurologists')}
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                    {t('forPatientsPage.trust.specialtyOncologists')}
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                    {t('forPatientsPage.trust.specialtyMore')}
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
                  {t('forPatientsPage.trust.heading')}
                </h2>
                <p className="text-white/85 mb-4 sm:mb-6 text-sm sm:text-base">
                  {t('forPatientsPage.trust.description')}
                </p>
                <Link
                  to="/doctors"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[#227787] font-semibold hover:bg-white/90 text-sm sm:text-base shadow-md hover:shadow-lg transition-all"
                >
                  {t('forPatientsPage.trust.exploreDoctorsCta')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-[#227787]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('forPatientsPage.cta.heading')}</h2>
          <p className="text-white/85 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('forPatientsPage.cta.description')}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {t('forPatientsPage.cta.button')}
          </Link>
        </div>
      </section>

      </MainLayout>
  );
}
