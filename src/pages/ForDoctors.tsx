import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, DollarSign, Calendar, Video, MessageSquare, Users, GraduationCap, Shield, CheckCircle, Percent, Banknote, Wallet, Store } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useCoherenceText } from '@/lib/coherence/i18n';
import { getIntlLocale } from '@/lib/dateLocale';

// Condiciones reales de la plataforma (24-nov-2026). Se leen de la base cuando
// el visitante tiene permiso; si no, quedan los valores vigentes comprobados ese
// dia en produccion: payout_settings.commission_percentage = 20,
// minimum_payout_amount = 100 (RPC get_payout_minimum), site_settings/app_config
// wallet_min = 50 y marketplace_config.fee_rate = 0.10.
const EXAMPLE_FEE = 800;
function useDoctorTerms() {
  const [terms, setTerms] = useState({ commission: 20, minPayout: 100, walletMin: 50, marketFee: 10 });
  useEffect(() => {
    let alive = true;
    const sb = supabase as any;
    const safe = (q: PromiseLike<any>) => Promise.resolve(q).then((r) => r, () => ({}));
    Promise.all([
      safe(sb.from('payout_settings_public').select('commission_percentage').limit(1).maybeSingle()),
      safe(sb.rpc('get_payout_minimum')),
      safe(sb.from('site_settings').select('value').eq('id', 'app_config').maybeSingle()),
      safe(sb.from('marketplace_config').select('fee_rate').limit(1).maybeSingle()),
    ]).then(([ps, min, app, mk]: any[]) => {
      if (!alive) return;
      setTerms((prev) => ({
        commission: Number(ps?.data?.commission_percentage) || prev.commission,
        minPayout: Number(min?.data) || prev.minPayout,
        walletMin: Number(app?.data?.value?.wallet_min) || prev.walletMin,
        marketFee: mk?.data?.fee_rate != null ? Math.round(Number(mk.data.fee_rate) * 1000) / 10 : prev.marketFee,
      }));
    });
    return () => { alive = false; };
  }, []);
  return terms;
}

function DoctorPricingBlock() {
  const ct = useCoherenceText();
  const { language } = useLanguage();
  const terms = useDoctorTerms();
  const money = (n: number) => `$${n.toLocaleString(getIntlLocale(language), { maximumFractionDigits: 2 })} MXN`;
  const net = Math.round(EXAMPLE_FEE * (100 - terms.commission)) / 100;
  const rows = [
    { icon: Percent, t: ct('fd.commission', { pct: terms.commission }), d: ct('fd.commissionD', { rest: 100 - terms.commission }) },
    { icon: Banknote, t: ct('fd.payout', { min: money(terms.minPayout) }), d: ct('fd.payoutD') },
    { icon: Wallet, t: ct('fd.wallet', { min: money(terms.walletMin) }), d: ct('fd.walletD') },
    { icon: Store, t: ct('fd.market', { pct: terms.marketFee }), d: ct('fd.marketD') },
  ];
  return (
    <section className="py-12 sm:py-20 bg-card border-b border-border" data-doctor-pricing>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground">{ct('fd.pricingTitle')}</h2>
          <p className="mt-2 mb-6 sm:mb-10 text-center text-sm sm:text-base text-muted-foreground">{ct('fd.pricingSub')}</p>
          <div className="rounded-2xl bg-[#163a83] text-white px-5 py-4 sm:px-8 sm:py-5 text-center text-base sm:text-xl font-bold mb-4 sm:mb-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {ct('fd.example', { fee: money(EXAMPLE_FEE), net: money(net) })}
          </div>
          <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {rows.map(({ icon: Icon, t: title, d }) => (
              <li key={title} className="flex gap-3 rounded-xl border border-border bg-background p-4">
                <Icon className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>{title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function ForDoctors() {
  const { t } = useLanguage();
  const ct = useCoherenceText();

  const benefits = [
    {
      icon: DollarSign,
      title: t('forDoctorsPage.benefits.monetize.title'),
      description: t('forDoctorsPage.benefits.monetize.description'),
    },
    {
      icon: Calendar,
      title: t('forDoctorsPage.benefits.flexibleSchedule.title'),
      description: t('forDoctorsPage.benefits.flexibleSchedule.description'),
    },
    {
      icon: Video,
      title: t('forDoctorsPage.benefits.interactiveLives.title'),
      description: t('forDoctorsPage.benefits.interactiveLives.description'),
    },
    {
      icon: MessageSquare,
      title: t('forDoctorsPage.benefits.secureChat.title'),
      description: t('forDoctorsPage.benefits.secureChat.description'),
    },
    {
      icon: Users,
      title: t('forDoctorsPage.benefits.community.title'),
      description: t('forDoctorsPage.benefits.community.description'),
    },
    {
      icon: GraduationCap,
      title: t('forDoctorsPage.benefits.coursesCongresses.title'),
      description: t('forDoctorsPage.benefits.coursesCongresses.description'),
    },
  ];

  const features = [
    t('forDoctorsPage.features.licenseVerification'),
    t('forDoctorsPage.features.stripePayments'),
    t('forDoctorsPage.features.digitalRecords'),
    t('forDoctorsPage.features.smartNotifications'),
    t('forDoctorsPage.features.prioritySupport'),
    t('forDoctorsPage.features.noEnrollmentFees'),
  ];

  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">{t('forDoctorsPage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('forDoctorsPage.hero.titleStart')} <span className="text-white">{t('forDoctorsPage.hero.titleHighlight')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-white max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              {/* Antes: «Unete a la plataforma lider de telemedicina…» (sin respaldo). */}
              {ct('fd.subtitle')}
            </p>
            <Link
              to="/app"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {t('forDoctorsPage.hero.ctaRegister')}
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-3 sm:mb-4">
            {t('forDoctorsPage.benefits.heading')}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            {t('forDoctorsPage.benefits.subheading')}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-secondary/15 via-primary/10 to-secondary/20 flex items-center justify-center mb-3 sm:mb-4 ring-1 ring-secondary/10">
                  <div className="absolute inset-0 rounded-xl bg-secondary/20 blur-xl opacity-40" />
                  <benefit.icon className="relative w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DoctorPricingBlock />

      {/* Features List */}
      <section className="py-12 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 items-center">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
                  {t('forDoctorsPage.features.heading')}
                </h2>
                <ul className="space-y-3 sm:space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                      </div>
                      <span className="text-foreground text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#227787] p-5 sm:p-8 rounded-xl sm:rounded-2xl text-white shadow-lg">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-white" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">{t('forDoctorsPage.verified.title')}</h3>
                <p className="text-white text-xs sm:text-sm mb-4 sm:mb-6">
                  {t('forDoctorsPage.verified.description')}
                </p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-white">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{t('forDoctorsPage.verified.bullet')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-[#227787]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('forDoctorsPage.cta.heading')}</h2>
          <p className="text-white mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('forDoctorsPage.cta.subheading')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/app"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {t('forDoctorsPage.cta.createAccount')}
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-white/5 backdrop-blur-sm border-2 border-white/60 rounded-xl hover:bg-white/25 hover:border-white shadow-md transition-all"
            >
              {t('forDoctorsPage.cta.talkToSales')}
            </Link>
          </div>
        </div>
      </section>

      </MainLayout>
  );
}
