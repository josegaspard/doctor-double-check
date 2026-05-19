import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Users, BookOpen, Video, MessageSquare, Award, Shield, CheckCircle, Microscope, Share2, PlayCircle, Briefcase, UserPlus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForResidents() {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Users,
      title: t('forResidentsPage.benefits.items.networking.title'),
      description: t('forResidentsPage.benefits.items.networking.description'),
    },
    {
      icon: Microscope,
      title: t('forResidentsPage.benefits.items.specialtyGroups.title'),
      description: t('forResidentsPage.benefits.items.specialtyGroups.description'),
    },
    {
      icon: Video,
      title: t('forResidentsPage.benefits.items.medicalMeets.title'),
      description: t('forResidentsPage.benefits.items.medicalMeets.description'),
    },
    {
      icon: BookOpen,
      title: t('forResidentsPage.benefits.items.clinicalCases.title'),
      description: t('forResidentsPage.benefits.items.clinicalCases.description'),
    },
    {
      icon: MessageSquare,
      title: t('forResidentsPage.benefits.items.mentorship.title'),
      description: t('forResidentsPage.benefits.items.mentorship.description'),
    },
    {
      icon: Award,
      title: t('forResidentsPage.benefits.items.certificates.title'),
      description: t('forResidentsPage.benefits.items.certificates.description'),
    },
    {
      icon: Share2,
      title: t('forResidentsPage.benefits.items.socialNetwork.title'),
      description: t('forResidentsPage.benefits.items.socialNetwork.description'),
    },
    {
      icon: PlayCircle,
      title: t('forResidentsPage.benefits.items.tutorials.title'),
      description: t('forResidentsPage.benefits.items.tutorials.description'),
    },
    {
      icon: Briefcase,
      title: t('forResidentsPage.benefits.items.fellowships.title'),
      description: t('forResidentsPage.benefits.items.fellowships.description'),
    },
    {
      icon: UserPlus,
      title: t('forResidentsPage.benefits.items.meet.title'),
      description: t('forResidentsPage.benefits.items.meet.description'),
    },
  ];

  const features = [
    t('forResidentsPage.features.items.specialtyAccess'),
    t('forResidentsPage.features.items.realCases'),
    t('forResidentsPage.features.items.networking'),
    t('forResidentsPage.features.items.medicalMeets'),
    t('forResidentsPage.features.items.dedicatedSupport'),
    t('forResidentsPage.features.items.noFees'),
  ];

  const howItWorksSteps = [
    { step: '1', title: t('forResidentsPage.howItWorks.steps.register.title'), desc: t('forResidentsPage.howItWorks.steps.register.desc') },
    { step: '2', title: t('forResidentsPage.howItWorks.steps.joinGroups.title'), desc: t('forResidentsPage.howItWorks.steps.joinGroups.desc') },
    { step: '3', title: t('forResidentsPage.howItWorks.steps.participate.title'), desc: t('forResidentsPage.howItWorks.steps.participate.desc') },
    { step: '4', title: t('forResidentsPage.howItWorks.steps.grow.title'), desc: t('forResidentsPage.howItWorks.steps.grow.desc') },
  ];

  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('forResidentsPage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('forResidentsPage.hero.titlePart1')} <span className="text-white">{t('forResidentsPage.hero.titlePart2')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-white/85 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              {t('forResidentsPage.hero.subtitle')}
            </p>
            <Link
              to="/app"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {t('forResidentsPage.hero.ctaRegister')}
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-3 sm:mb-4">
            {t('forResidentsPage.benefits.heading')}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            {t('forResidentsPage.benefits.subtitle')}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/20 flex items-center justify-center mb-3 sm:mb-4 ring-1 ring-primary/10">
                  <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl opacity-40" />
                  <benefit.icon className="relative w-5 h-5 sm:w-6 sm:h-6 text-primary" />
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
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12">
            {t('forResidentsPage.howItWorks.heading')}
          </h2>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6 sm:gap-8">
            {howItWorksSteps.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
                  <span className="text-lg sm:text-xl font-bold text-primary-foreground">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-12 sm:py-24 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 items-center">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
                  {t('forResidentsPage.features.heading')}
                </h2>
                <ul className="space-y-3 sm:space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                      </div>
                      <span className="text-foreground text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#00768b] p-5 sm:p-8 rounded-xl sm:rounded-2xl text-white shadow-lg">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-white" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">{t('forResidentsPage.features.academicCard.title')}</h3>
                <p className="text-white/85 text-xs sm:text-sm mb-4 sm:mb-6">
                  {t('forResidentsPage.features.academicCard.description')}
                </p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-light">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{t('forResidentsPage.features.academicCard.verification')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('forResidentsPage.cta.heading')}</h2>
          <p className="text-white/85 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('forResidentsPage.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/app"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {t('forResidentsPage.cta.createAccount')}
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-white/15 backdrop-blur-sm border-2 border-white/60 rounded-xl hover:bg-white/25 hover:border-white shadow-md transition-all"
            >
              {t('forResidentsPage.cta.contact')}
            </Link>
          </div>
        </div>
      </section>

      </MainLayout>
  );
}
