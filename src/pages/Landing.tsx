import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoVideoModal } from '@/components/landing/DemoVideoModal';
import { useLanguage } from '@/contexts/LanguageContext';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';
import heroBgDesktop from '@/assets/landing/hero-bg-desktop.png';
import heroBgMobile from '@/assets/landing/hero-bg-mobile.png';
import iconConsultas from '@/assets/landing/icons/CONSULTAS.svg';
import iconEducacion from '@/assets/landing/icons/EDUCACION.svg';
import iconUsuarios from '@/assets/landing/icons/USUARIOS.svg';
import iconRetransmision from '@/assets/landing/icons/RETRANSMISION.svg';
import {
  ArrowRight,
  Star,
  PlayCircle,
  HeartPulse,
  Check,
  Smartphone,
  Network,
  ShieldCheck,
  Lock,
  Zap,
  Sparkles,
  Building2,
  Stethoscope,
  UserRound,
  Dna,
  Hospital,
  Video,
} from 'lucide-react';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Landing() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  const [showDemoModal, setShowDemoModal] = useState(false);

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <div className="font-sans text-slate-800 bg-slate-50 overflow-x-hidden relative selection:bg-[#00768b] selection:text-white">
      {/* Demo Video Modal */}
      <DemoVideoModal open={showDemoModal} onOpenChange={setShowDemoModal} />

      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#aed3d9]/30 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#839ed5]/30 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-[#00768b]/20 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" style={{ animationDelay: '4s' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-500 top-0 border-b ${scrolled ? 'border-gray-100' : 'border-transparent'}`}>
        <div className={`absolute inset-0 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
          <div className="flex justify-between items-center h-16 sm:h-20 md:h-24">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative h-8 sm:h-10 md:h-12 overflow-hidden">
                <img src={logoWhite} alt={t('landing.nav.logoAlt')} className={`h-full object-contain transition-all duration-500 group-hover:scale-105 ${scrolled ? 'opacity-0' : 'opacity-100'}`} />
                <img src={logoBlue} alt={t('landing.nav.logoAlt')} className={`h-full object-contain absolute top-0 left-0 transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-1">
              <div className={`flex items-center backdrop-blur-md rounded-full p-1 mr-6 transition-all duration-300 ${scrolled ? 'bg-gray-100 border-gray-200' : 'bg-white/10 border-white/20'} border`}>
                <a href="#red-global" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.globalNetwork')}</a>
                <a href="#features" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.technology')}</a>
                <a href="#workflow" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.process')}</a>
                <a href="#reviews" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.reviews')}</a>
              </div>

              <Link
                to="/app"
                className="relative overflow-hidden group bg-[#00768b] hover:bg-white text-white hover:text-[#163a83] font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(0,118,139,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] border border-transparent hover:border-[#163a83]"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm uppercase tracking-wider">
                  {t('landing.nav.enterApp')} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>

            <Link
              to="/app"
              className={`lg:hidden font-bold py-2 px-4 sm:px-6 rounded-full transition-all duration-300 text-sm ${
                scrolled
                  ? 'bg-[#00768b] text-white'
                  : 'bg-white/20 backdrop-blur-md text-white border border-white/30'
              }`}
            >
              {t('landing.nav.enter')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative h-[100svh] min-h-[640px] max-h-[1024px] overflow-hidden bg-[#0b1d45] mb-[-1px]">
        {/* Background image — desktop + mobile */}
        <picture className="absolute inset-0 z-0">
          <source media="(max-width: 767px)" srcSet={heroBgMobile} />
          <img src={heroBgDesktop} alt="" className="w-full h-full object-cover object-center" />
        </picture>

        {/* Gradient overlay for readability of left-side text */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0b1d45]/95 via-[#0b1d45]/70 to-[#0b1d45]/10 md:from-[#0b1d45]/85 md:via-[#0b1d45]/40 md:to-transparent" />
        {/* Bottom fade so the floating row of feature cards sits on a dark base */}
        <div className="absolute inset-x-0 bottom-0 h-40 z-[1] bg-gradient-to-t from-[#0b1d45]/95 to-transparent" />

        <div className="container mx-auto px-5 sm:px-6 lg:px-12 relative z-10 h-full flex flex-col pt-16 sm:pt-20 lg:pt-24 pb-44 sm:pb-44 lg:pb-32">
          {/* Stats bar removed per client request 2026-05-18 — sin estadísticas en el hero. */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-10 items-start lg:items-center flex-1 min-h-0">
            {/* LEFT: copy + CTAs (kept narrower so floating cards have room beside it) */}
            <div className="relative z-20 animate-fade-in space-y-2.5 sm:space-y-3 lg:space-y-5 max-w-md xl:max-w-lg 2xl:max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00768b]/15 border border-[#aed3d9]/30 backdrop-blur-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#aed3d9] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#aed3d9]" />
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#aed3d9]">{t('landing.hero.liveBadge')}</span>
                <span className="text-[10px] sm:text-[11px] font-medium text-white/80 hidden xs:inline">{t('landing.hero.liveTagline')}</span>
              </div>

              <h1 className="text-[26px] sm:text-3xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                {t('landing.hero.titleLine1')}<br />{t('landing.hero.titleLine2')}<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] via-[#00768b] to-[#839ed5]">{t('landing.hero.titleLine3')}</span>
              </h1>

              <p className="text-xs sm:text-sm lg:text-base text-slate-200/90 font-light leading-relaxed">
                {t('landing.hero.subtitle')}
              </p>
              <p className="text-xs sm:text-sm text-slate-300/80 font-light leading-relaxed hidden lg:block">
                {t('landing.hero.description')}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white bg-[#00768b] rounded-full shadow-[0_0_30px_rgba(0,118,139,0.45)] hover:bg-[#00879f] hover:shadow-[0_0_45px_rgba(0,118,139,0.7)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <ArrowRight className="w-4 h-4 mr-2 -ml-0.5 rotate-[-45deg]" />
                  <span>{t('landing.hero.ctaPrimary')}</span>
                </Link>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-white border border-white/25 rounded-full hover:bg-white/10 hover:border-white/50 transition-all backdrop-blur-md group"
                >
                  <PlayCircle className="w-4 h-4 mr-2 text-[#aed3d9] group-hover:scale-110 transition-transform" />
                  {t('landing.hero.ctaSecondary')}
                </button>
              </div>

              {/* Mobile stat cards removed per client request 2026-05-18 — sin números/estadísticas. */}
            </div>

            {/* RIGHT column placeholder so the grid stays balanced. Cards live in the absolute layer below. */}
            <div className="hidden md:block" />
          </div>

          {/* Floating cards — absolute over the whole hero, spread to extreme left/right so the doctor stays clear */}
          <div className="hidden md:block absolute inset-0 pointer-events-none z-10">
            {/* TOP LEFT-OF-DOCTOR — Mosaic of 4 doctors. Sits in the gap between text and doctor body, hidden on lg where there is no gap */}
            <div className="absolute top-[172px] xl:top-[188px] left-1/2 xl:left-[44%] 2xl:left-[40%] -translate-x-1/2 xl:translate-x-0 hidden xl:block pointer-events-auto bg-white/10 backdrop-blur-xl p-2.5 rounded-xl border border-white/15 shadow-2xl animate-float w-[150px] 2xl:w-[170px]" style={{ animationDuration: '7s' }}>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { from: '#839ed5', to: '#163a83', initials: 'CM' },
                  { from: '#00768b', to: '#0b1d45', initials: 'LF' },
                  { from: '#aed3d9', to: '#00768b', initials: 'MR' },
                  { from: '#163a83', to: '#839ed5', initials: 'JP' },
                ].map((d, i) => (
                  <div key={i} className="aspect-video rounded flex items-center justify-center text-white text-[9px] font-bold relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})` }}>
                    <span className="opacity-90">{d.initials}</span>
                    <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-emerald-400" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/75 font-medium mt-1.5">{t('landing.hero.doctorsOnline')}</p>
            </div>

            {/* Right-side LIVE cards removed per client request 2026-05-18 —
                cubrían la cara del doctor. La esencia "live" se mantiene en el
                badge del eyebrow y en la fila inferior de features. */}

            {/* "Actividad Global" floating card removed per client request 2026-05-18 — sin estadísticas. */}
          </div>

          {/* Bottom feature row - 4 cards */}
          <div className="absolute left-4 right-4 sm:left-6 sm:right-6 lg:left-12 lg:right-12 bottom-3 sm:bottom-4 lg:bottom-6 z-20">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl lg:rounded-2xl p-2.5 sm:p-3 lg:p-4 shadow-2xl">
              {[
                { icon: iconEducacion, title: t('landing.heroFeatures.education.title'), desc: t('landing.heroFeatures.education.desc') },
                { icon: iconConsultas, title: t('landing.heroFeatures.consults.title'), desc: t('landing.heroFeatures.consults.desc') },
                { icon: iconUsuarios, title: t('landing.heroFeatures.network.title'), desc: t('landing.heroFeatures.network.desc') },
                { icon: iconRetransmision, title: t('landing.heroFeatures.live.title'), desc: t('landing.heroFeatures.live.desc') },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-2.5 lg:gap-3">
                  <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-[#00768b]/40 to-[#163a83]/40 border border-[#aed3d9]/20 flex items-center justify-center">
                    <img src={f.icon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs lg:text-sm font-bold text-white leading-tight">{f.title}</p>
                    <p className="text-[9px] sm:text-[10px] lg:text-[11px] text-slate-300/85 leading-snug mt-0.5 hidden lg:block">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Ticker - Tech & compliance partners (real) */}
      <div className="bg-white border-b border-gray-100 py-4 sm:py-6 overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full w-8 sm:w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-8 sm:w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div className="flex w-[300%] sm:w-[200%] animate-scroll">
          {[1, 2].map((i) => (
            <div key={i} className="flex w-1/2 justify-around items-center gap-4 sm:gap-0 px-4 sm:px-0">
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.licenseValidated')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><UserRound className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.biometricId')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Video className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.doctorLives')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.premiumContent')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Lock className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.clinicalVault')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Check className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.digitalPrescriptions')}</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><HeartPulse className="w-3 h-3 sm:w-4 sm:h-4" /> {t('landing.ticker.paymentsMxn')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 bg-slate-50">
        {/* Ecosystem Section */}
        <section id="red-global" className="py-24 lg:py-32 relative overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto mb-20">
              <span className="text-[#00768b] font-bold tracking-widest text-xs uppercase mb-4 block">{t('landing.ecosystem.eyebrow')}</span>
              <h2 className="text-4xl lg:text-5xl font-bold text-[#163a83] mb-6">{t('landing.ecosystem.title')}</h2>
              <p className="text-xl text-slate-500 font-light leading-relaxed">
                {t('landing.ecosystem.descriptionPart1')} <span className="font-bold text-[#163a83]">{t('landing.ecosystem.descriptionLabs')}</span>{t('landing.ecosystem.descriptionComma1')} <span className="font-bold text-[#163a83]">{t('landing.ecosystem.descriptionSpecialists')}</span> {t('landing.ecosystem.descriptionAnd')} <span className="font-bold text-[#163a83]">{t('landing.ecosystem.descriptionPatients')}</span> {t('landing.ecosystem.descriptionPart2')}
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-4 gap-6">
              <div className="md:col-span-3 lg:col-span-2 row-span-2 bg-white rounded-3xl p-8 shadow-lg border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-[#163a83] rounded-2xl flex items-center justify-center text-white text-2xl mb-8 shadow-lg shadow-[#163a83]/30">
                    <Network className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('landing.ecosystem.vip.title')}</h3>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    {t('landing.ecosystem.vip.desc')}
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                    <div className="flex -space-x-3">
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#839ed5] to-[#163a83] flex items-center justify-center text-white text-xs font-bold"><Stethoscope className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#00768b] to-[#0b1d45] flex items-center justify-center text-white text-xs font-bold"><Hospital className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#aed3d9] to-[#00768b] flex items-center justify-center text-white text-xs font-bold"><UserRound className="w-4 h-4" /></div>
                    </div>
                    <span className="text-sm font-bold text-[#00768b]">{t('landing.ecosystem.vip.verifiedCredentials')}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 lg:col-span-2 bg-gradient-to-br from-[#163a83] to-[#0b1d45] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                <ShieldCheck className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 group-hover:text-white/10 transition-colors" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold">{t('landing.ecosystem.security.title')}</h3>
                    <Lock className="w-5 h-5 text-[#aed3d9]" />
                  </div>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    {t('landing.ecosystem.security.desc')}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 group hover:border-[#839ed5]/50 transition-colors">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('landing.ecosystem.video.title')}</h3>
                <p className="text-sm text-gray-500">{t('landing.ecosystem.video.desc')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Video Section */}
        <section id="features" className="py-24 bg-slate-100/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-[#163a83] mb-4">{t('landing.video.title')}</h2>
              <p className="text-slate-600 text-lg">
                {t('landing.video.subtitle')}
              </p>
            </div>

            <div className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-black">
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full aspect-video object-cover"
                src="https://gestomarketing.com.mx/wp-content/uploads/2026/03/Video_de_Landing_Page_Hiperrealista-1-1.mp4"
              />
            </div>
          </div>
        </section>

        {/* Para cada perfil — Doctores, Residentes, Pacientes */}
        <section id="workflow" className="py-24 bg-white relative">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-[#163a83] mb-4">{t('landing.profiles.title')}</h2>
              <p className="text-slate-600 leading-relaxed">
                {t('landing.profiles.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {/* Doctores */}
              <div className="group relative bg-gradient-to-br from-[#163a83] to-[#0b1d45] rounded-3xl p-8 text-white shadow-xl overflow-hidden">
                <Stethoscope className="absolute -bottom-6 -right-6 w-40 h-40 text-white/5 group-hover:text-white/10 transition-colors" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#aed3d9]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#aed3d9]">{t('landing.profiles.doctors.badge')}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{t('landing.profiles.doctors.title')}</h3>
                  <p className="text-blue-100/90 text-sm leading-relaxed mb-6">
                    {t('landing.profiles.doctors.desc')}
                  </p>
                  <ul className="space-y-2.5 text-sm text-blue-50">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> {t('landing.profiles.doctors.feature1')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> {t('landing.profiles.doctors.feature2')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> {t('landing.profiles.doctors.feature3')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> {t('landing.profiles.doctors.feature4')}</li>
                  </ul>
                  <Link to="/for-doctors" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#aed3d9] hover:text-white transition-colors">
                    {t('landing.profiles.doctors.cta')} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Residentes */}
              <div className="group relative bg-white rounded-3xl p-8 border border-slate-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#aed3d9]/30 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-700" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00768b]/10 border border-[#00768b]/20 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00768b]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#00768b]">{t('landing.profiles.residents.badge')}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('landing.profiles.residents.title')}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {t('landing.profiles.residents.desc')}
                  </p>
                  <ul className="space-y-2.5 text-sm text-gray-700">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature1')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature2')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature3')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature4')}</li>
                  </ul>
                  <Link to="/for-residents" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#00768b] hover:text-[#163a83] transition-colors">
                    {t('landing.profiles.residents.cta')} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="mt-3 text-[11px] text-slate-500">{t('landing.profiles.residents.note')}</p>
                </div>
              </div>

              {/* Pacientes */}
              <div className="group relative bg-gradient-to-br from-[#aed3d9]/40 to-[#839ed5]/30 rounded-3xl p-8 border border-[#aed3d9]/40 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <HeartPulse className="absolute -bottom-6 -right-6 w-40 h-40 text-white/30 group-hover:text-white/50 transition-colors" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-white/80 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#163a83]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#163a83]">{t('landing.profiles.patients.badge')}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('landing.profiles.patients.title')}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6">
                    {t('landing.profiles.patients.desc')}
                  </p>
                  <ul className="space-y-2.5 text-sm text-gray-800">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> {t('landing.profiles.patients.feature1')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> {t('landing.profiles.patients.feature2')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> {t('landing.profiles.patients.feature3')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> {t('landing.profiles.patients.feature4')}</li>
                  </ul>
                  <Link to="/for-patients" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#163a83] hover:text-[#0b1d45] transition-colors">
                    {t('landing.profiles.patients.cta')} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lo que incluye Medical Masters */}
        <section id="reviews" className="py-24 bg-white border-t border-slate-100">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-[#163a83]">{t('landing.includes.title')}</h2>
            <p className="text-center text-slate-500 mb-16 max-w-2xl mx-auto">{t('landing.includes.subtitle')}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: t('landing.includes.video.title'), desc: t('landing.includes.video.desc'), icon: <Video className="w-5 h-5" /> },
                { title: t('landing.includes.lives.title'), desc: t('landing.includes.lives.desc'), icon: <PlayCircle className="w-5 h-5" /> },
                { title: t('landing.includes.prescriptions.title'), desc: t('landing.includes.prescriptions.desc'), icon: <Check className="w-5 h-5" /> },
                { title: t('landing.includes.records.title'), desc: t('landing.includes.records.desc'), icon: <Lock className="w-5 h-5" /> },
                { title: t('landing.includes.hospitals.title'), desc: t('landing.includes.hospitals.desc'), icon: <Hospital className="w-5 h-5" /> },
                { title: t('landing.includes.verification.title'), desc: t('landing.includes.verification.desc'), icon: <ShieldCheck className="w-5 h-5" /> },
              ].map((f) => (
                <div key={f.title} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg hover:border-[#00768b]/30 transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-[#163a83]/10 text-[#163a83] flex items-center justify-center mb-4">{f.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing / Modelo de negocio REAL */}
        <section id="pricing" className="py-24 bg-gradient-to-b from-[#0b1d45] to-[#163a83] relative overflow-hidden">
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <span className="text-[#aed3d9] font-bold tracking-widest text-xs uppercase mb-4 block">{t('landing.pricing.eyebrow')}</span>
              <h2 className="text-4xl font-bold text-white mb-4">{t('landing.pricing.title')}</h2>
              <p className="text-slate-300 max-w-2xl mx-auto">
                {t('landing.pricing.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Pacientes */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">{t('landing.pricing.patients.title')}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">{t('landing.pricing.patients.price')}</span>
                  <span className="text-slate-400"> {t('landing.pricing.patients.priceSuffix')}</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">{t('landing.pricing.patients.desc')}</p>
                <Link to="/app" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">{t('landing.pricing.patients.cta')}</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.patients.feature1')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.patients.feature2')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.patients.feature3')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.patients.feature4')}</li>
                </ul>
              </div>

              {/* Doctores */}
              <div className="bg-gradient-to-b from-[#00768b] to-[#163a83] rounded-3xl p-8 border-2 border-[#aed3d9]/50 shadow-2xl relative transform scale-105 z-10">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-xs font-bold text-black rounded-full uppercase tracking-wider">{t('landing.pricing.doctors.popularBadge')}</span>
                <h3 className="text-xl font-bold text-white">{t('landing.pricing.doctors.title')}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">{t('landing.pricing.doctors.price')}</span>
                  <span className="text-blue-100"> {t('landing.pricing.doctors.priceSuffix')}</span>
                </div>
                <p className="text-blue-100 text-sm mb-6">{t('landing.pricing.doctors.desc')}</p>
                <Link to="/app" className="block w-full py-3 rounded-xl bg-white text-[#163a83] text-center font-bold hover:shadow-xl transition-all">{t('landing.pricing.doctors.cta')}</Link>
                <ul className="mt-8 space-y-3 text-sm text-blue-50">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> {t('landing.pricing.doctors.feature1')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> {t('landing.pricing.doctors.feature2')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> {t('landing.pricing.doctors.feature3')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> {t('landing.pricing.doctors.feature4')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> {t('landing.pricing.doctors.feature5')}</li>
                </ul>
              </div>

              {/* Residentes */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">{t('landing.pricing.residents.title')}</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">{t('landing.pricing.residents.price')}</span>
                  <span className="text-slate-400"> {t('landing.pricing.residents.priceSuffix')}</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">{t('landing.pricing.residents.desc')}</p>
                <Link to="/app" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">{t('landing.pricing.residents.cta')}</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.residents.feature1')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.residents.feature2')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.residents.feature3')}</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> {t('landing.pricing.residents.feature4')}</li>
                </ul>
              </div>
            </div>

            <p className="text-center text-slate-400 text-xs mt-10 max-w-2xl mx-auto">
               {t('landing.pricing.disclaimer')}
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 relative overflow-hidden bg-[#163a83] border-t border-white/10">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00768b]/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#839ed5]/20 rounded-full blur-[80px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
              {t('landing.finalCta.title')}
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto font-light">
               {t('landing.finalCta.subtitle')}
            </p>

            <div className="flex flex-col md:flex-row justify-center gap-6">
              <Link
                to="/app"
                className="px-10 py-5 bg-white text-[#163a83] font-bold text-lg rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:shadow-[0_0_60px_rgba(255,255,255,0.6)] hover:scale-105 transition-all duration-300"
              >
                {t('landing.finalCta.ctaPrimary')}
              </Link>
              <Link to="/contact" className="px-10 py-5 border border-white/30 text-white font-bold text-lg rounded-full hover:bg-white/10 transition-all">
                {t('landing.finalCta.ctaSecondary')}
              </Link>
            </div>

            <p className="mt-8 text-sm text-blue-200/60">
               {t('landing.finalCta.footnote')}
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
