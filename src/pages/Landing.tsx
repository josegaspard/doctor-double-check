import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoVideoModal } from '@/components/landing/DemoVideoModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';
import heroBgDesktop from '@/assets/landing/hero-bg-desktop.png';
import heroBgMobile from '@/assets/landing/hero-bg-mobile.png';
import iconConsultas from '@/assets/landing/icons/CONSULTAS.svg';
import iconEducacion from '@/assets/landing/icons/EDUCACION.svg';
import iconUsuarios from '@/assets/landing/icons/USUARIOS.svg';
import iconRetransmision from '@/assets/landing/icons/RETRANSMISION.svg';
import iconGlobal from '@/assets/landing/icons/GLOBAL.svg';
import iconMedicos from '@/assets/landing/icons/MEDICOS.svg';
import iconStream from '@/assets/landing/icons/STREAM.svg';
import surgeryPhoto from '@/assets/landing/people/surgery.jpg';
import doctorLivePhoto from '@/assets/landing/people/live-doctor.jpeg';
import livesGridPhoto from '@/assets/landing/people/fotos-lives.jpg';
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
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { useSiteVideos } from '@/hooks/useSiteVideos';

export default function Landing() {
  const { t } = useLanguage();
  const { isAuthenticated, role } = useAuth();
  // Con sesión activa el logo lleva al home de la app (/lives); sin sesión,
  // recarga el landing (cliente 2026-07-02).
  const homeHref = isAuthenticated && role && role !== 'visitor' ? '/lives' : '/';
  const [scrolled, setScrolled] = useState(false);

  const [showDemoModal, setShowDemoModal] = useState(false);

  // Video del home: SIN autoplay (cliente 2026-06-29). Se reproduce solo cuando
  // el usuario pulsa play en los controles nativos del <video>.
  // Editable desde el súper admin (site_settings.videos.home); fallback al asset estático.
  const videoRef = useRef<HTMLVideoElement>(null);
  const { videos } = useSiteVideos();
  const homeVideoSrc = videos.home || '/landing-mm-2026.mp4';
  // Poster para que en móvil (iOS Safari con preload="metadata") se muestre el
  // primer frame del video igual que en PC, en vez de un reproductor NEGRO
  // (cliente 2026-07-08). Si el video resuelto es el de por defecto (venga del
  // fallback o guardado tal cual en site_settings.videos.home) usamos el frame
  // extraído; si el admin sube un video propio, forzamos el frame con el
  // fragmento #t=0.1 (truco iOS) ya que no tenemos un poster que coincida.
  const isDefaultHomeVideo = homeVideoSrc.split('?')[0].endsWith('/landing-mm-2026.mp4');
  const homeVideoPoster = isDefaultHomeVideo ? '/landing-mm-2026-poster.jpg' : undefined;

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <div className="landing-page font-sans text-slate-800 bg-slate-50 overflow-x-hidden relative selection:bg-[#227787] selection:text-white">
      {/* Demo Video Modal */}
      <DemoVideoModal open={showDemoModal} onOpenChange={setShowDemoModal} />

      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#aed3d9]/30 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#839ed5]/30 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-[#227787]/20 rounded-full mix-blend-multiply filter blur-xl sm:blur-3xl opacity-70 animate-pulse will-change-transform" style={{ animationDelay: '4s' }} />
      </div>

      {/* Navigation */}
      <nav className={`landing-nav fixed w-full z-50 transition-all duration-500 top-0 ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="landing-nav-surface absolute inset-0 transition-all duration-500" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
          <div className="relative flex justify-between items-center h-20 md:h-24">
            {/* Móvil/tablet: idioma a la izquierda para equilibrar el logo centrado (cliente 10-jul) */}
            <div className="lg:hidden">
              <LanguageSwitcher unstyled className={`rounded-full p-2 border transition-colors ${scrolled ? 'text-gray-700 border-gray-200 bg-white hover:bg-gray-100' : 'text-white border-white/40 bg-white/15 hover:bg-white/25'}`} />
            </div>
            {/* Logo: centrado y grande en móvil/tablet, a la izquierda en desktop; misma altura en todos los breakpoints */}
            <Link to={homeHref} className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex items-center gap-2 group">
              <div className="relative h-14">
                <img src={logoWhite} alt={t('landing.nav.logoAlt')} className={`h-full object-contain transition-all duration-500 group-hover:scale-105 ${scrolled ? 'opacity-0' : 'opacity-100'}`} />
                <img src={logoBlue} alt={t('landing.nav.logoAlt')} className={`h-full object-contain absolute top-0 left-0 transition-all duration-500 group-hover:scale-105 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-1">
              <div className={`flex items-center backdrop-blur-md rounded-full p-1 mr-6 transition-all duration-300 ${scrolled ? 'bg-gray-100 border-gray-200' : 'bg-white/10 border-white/20'} border`}>
                <a href="#red-global" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.globalNetwork')}</a>
                <a href="#features" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.technology')}</a>
                <a href="#workflow" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.process')}</a>
                <a href="#reviews" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>{t('landing.nav.reviews')}</a>
              </div>

              <LanguageSwitcher unstyled className={`mr-3 rounded-full p-2 border transition-colors ${scrolled ? 'text-gray-700 border-gray-200 bg-white hover:bg-gray-100' : 'text-white border-white/40 bg-white/15 hover:bg-white/25'}`} />

              <Link
                to="/app"
                className="relative overflow-hidden group bg-[#227787] hover:bg-white text-white hover:text-[#163a83] font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(0,118,139,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] border border-transparent hover:border-[#163a83]"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm uppercase tracking-wider">
                  {t('landing.nav.enterApp')} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <Link
                to="/app"
                className={`font-bold py-2 px-4 sm:px-6 rounded-full transition-all duration-300 text-sm ${
                  scrolled
                    ? 'bg-[#227787] text-white'
                    : 'bg-white/20 backdrop-blur-md text-white border border-white/30'
                }`}
              >
                {t('landing.nav.enter')}
              </Link>
            </div>
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
          {/* Top stats bar — visible md+. Restaurada 2026-06-02 con SOLO títulos (sin números/datos). */}
          <div className="hidden md:flex absolute top-24 lg:top-24 left-1/2 -translate-x-1/2 items-center gap-5 lg:gap-8 px-5 py-2.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
            <div className="flex items-center gap-2">
              <img src={iconGlobal} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-slate-200 font-semibold">{t('landing.hero.countriesConnected')}</p>
            </div>
            <div className="w-px h-7 bg-white/15" />
            <div className="flex items-center gap-2">
              <img src={iconMedicos} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-slate-200 font-semibold">{t('landing.hero.activeDoctors')}</p>
            </div>
            <div className="w-px h-7 bg-white/15" />
            <div className="flex items-center gap-2">
              <img src={iconStream} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <div className="leading-tight">
                <p className="text-[10px] lg:text-[11px] uppercase tracking-wider text-slate-200 font-semibold">{t('landing.hero.streaming')}</p>
                <p className="text-[9px] lg:text-[10px] text-slate-300/80 normal-case tracking-normal">{t('landing.hero.streamingSub')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-10 items-start lg:items-center flex-1 min-h-0">
            {/* LEFT: copy + CTAs (kept narrower so floating cards have room beside it) */}
            <div className="relative z-20 animate-fade-in space-y-2.5 sm:space-y-3 lg:space-y-5 max-w-md xl:max-w-lg 2xl:max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#227787]/15 border border-[#aed3d9]/30 backdrop-blur-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#aed3d9] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#aed3d9]" />
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#aed3d9]">{t('landing.hero.liveBadge')}</span>
                <span className="text-[10px] sm:text-[11px] font-medium text-white/80 hidden xs:inline">{t('landing.hero.liveTagline')}</span>
              </div>

              <h1 className="text-[26px] sm:text-3xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                {t('landing.hero.titleLine1')}<br />
                {/* titleLine3 vacío (cliente 2026-06-19: quitar "VIP") → el gradiente
                    pasa a la línea 2 para que el título no quede sin acento. */}
                {t('landing.hero.titleLine3') ? (
                  <>
                    {t('landing.hero.titleLine2')}<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] via-[#227787] to-[#839ed5]">{t('landing.hero.titleLine3')}</span>
                  </>
                ) : (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] via-[#227787] to-[#839ed5]">{t('landing.hero.titleLine2')}</span>
                )}
              </h1>

              <p className="text-xs sm:text-sm lg:text-base text-slate-200/90 font-light leading-relaxed">
                {t('landing.hero.subtitle')}
              </p>
              <p className="text-xs sm:text-sm text-slate-300/80 font-light leading-relaxed hidden lg:block">
                {t('landing.hero.description')}
              </p>

              {/* Video corto en autoplay debajo del texto del hero (cliente 2026-07-29):
                  sin sonido, sin controles/botones, loop continuo. Poster = frame 0 para
                  evitar el reproductor negro en iOS Safari (mismo patrón que landing-mm-2026).
                  Oculto en móvil (cliente 2026-07-29): solo desktop/tablet md+. */}
              <div className="hidden md:block md:w-48 lg:w-60 xl:w-64 rounded-xl lg:rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-black/20 mt-1">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  disablePictureInPicture
                  controlsList="nodownload nofullscreen noremoteplayback"
                  preload="auto"
                  poster="/hero-intro-loop-poster.jpg"
                  className="block w-full h-auto aspect-video object-cover pointer-events-none"
                  src="/hero-intro-loop.mp4"
                />
              </div>

              {/* Mobile stat chips — restaurados 2026-06-02 con SOLO títulos (sin números). */}
              <div className="grid grid-cols-3 gap-2 mt-3 md:hidden">
                {[
                  { img: iconGlobal, label: t('landing.hero.countriesConnected') },
                  { img: iconMedicos, label: t('landing.hero.activeDoctors') },
                  { img: iconStream, label: t('landing.hero.streaming') },
                ].map((s, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-xl px-2 py-2.5 rounded-xl border border-white/15 shadow-lg flex flex-col items-center text-center gap-1.5">
                    <img src={s.img} alt="" className="w-5 h-5" />
                    <p className="text-[9px] leading-tight text-slate-200 font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* CTA móvil — el hero no tenía botón de acción en móvil (cliente 2026-06-17). Solo móvil; desktop intacto. */}
              <div className="flex flex-col gap-2.5 pt-1 md:hidden">
                <Link
                  to="/app"
                  className="group inline-flex items-center justify-center gap-2 w-full bg-[#227787] hover:bg-[#1a606e] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-full shadow-[0_10px_30px_-6px_rgba(34,119,135,0.65)] ring-1 ring-[#aed3d9]/30 transition-all text-sm uppercase tracking-wider"
                >
                  {t('landing.hero.ctaPrimary')}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="inline-flex items-center justify-center gap-2 w-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-full border border-white/25 transition-all text-sm"
                >
                  <PlayCircle className="w-4 h-4 text-[#aed3d9]" />
                  {t('landing.hero.ctaSecondary')}
                </button>
              </div>
            </div>

            {/* RIGHT column placeholder so the grid stays balanced. Cards live in the absolute layer below. */}
            <div className="hidden md:block" />
          </div>

          {/* Floating cards — absolute over the whole hero, spread to extreme left/right so the doctor stays clear */}
          <div className="hidden md:block absolute inset-0 pointer-events-none z-10">
            {/* MID LEFT-OF-DOCTOR — Tarjeta tipo FaceTime: 4 médicos en directo.
                Reposicionada 2026-06-16 (cliente): DEBAJO de la barra de stats y a la izquierda del doctor,
                igual que el diseño de referencia (no en la esquina superior, ya no choca con el titular). */}
            <div className="absolute top-[160px] lg:top-[168px] xl:top-[184px] left-1/2 lg:left-[47%] xl:left-[44%] 2xl:left-[40%] -translate-x-1/2 pointer-events-auto bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-float overflow-hidden w-[170px] lg:w-[190px]" style={{ animationDuration: '6s' }}>
              <img
                src={livesGridPhoto}
                alt=""
                loading="lazy"
                className="block w-full h-auto"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            {/* Right-side cards — restauradas 2026-06-02 con fotos ilustrativas y SIN números/datos. */}

            {/* TOP RIGHT — LIVE doctor card (foto de doctor en directo) */}
            <div className="absolute top-24 lg:top-28 right-3 lg:right-6 xl:right-10 pointer-events-auto bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-float overflow-hidden w-[150px] lg:w-[170px]" style={{ animationDuration: '6s', animationDelay: '0.4s' }}>
              <div className="aspect-video bg-gradient-to-br from-[#227787] to-[#163a83] relative flex items-center justify-center">
                <img
                  src={doctorLivePhoto}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>

            {/* MID RIGHT — Signos Vitales (sin número de bpm, solo waveform + texto).
                z-20 + posición al 42% para que NUNCA quede oculta detrás de la tarjeta
                de Retransmisión Quirúrgica en pantallas de menor altura (fix 2026-06-29). */}
            <div className="absolute top-[42%] -translate-y-1/2 right-3 lg:right-6 xl:right-10 z-20 pointer-events-auto bg-white/10 backdrop-blur-xl p-2.5 lg:p-3 rounded-xl border border-white/15 shadow-2xl animate-float w-[150px] lg:w-[170px]" style={{ animationDuration: '5s', animationDelay: '0.8s' }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-white/85">{t('landing.hero.vitalSigns')}</span>
                <HeartPulse className="w-3 h-3 text-primary" />
              </div>
              <p className="text-[9px] text-slate-300/80 mb-1">{t('landing.hero.realTime')}</p>
              <svg className="w-full h-6 text-primary mt-1" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M0 10 Q10 10, 15 5 T25 10 T35 15 T45 10 T55 5 T65 10 T75 15 T85 10 T100 10" />
              </svg>
            </div>

            {/* BOTTOM RIGHT — Retransmisión Quirúrgica (foto real de quirófano, sin número de espectadores) */}
            <div className="absolute bottom-32 lg:bottom-32 right-3 lg:right-6 xl:right-10 pointer-events-auto bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-float overflow-hidden w-[170px] lg:w-[190px]" style={{ animationDuration: '5.5s', animationDelay: '1.6s' }}>
              <div className="aspect-[16/8] bg-gradient-to-br from-[#163a83] via-[#0b1d45] to-[#227787] relative">
                <img
                  src={surgeryPhoto}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />{t('landing.hero.liveBadge')}
                </span>
              </div>
              <div className="p-2">
                <p className="text-[10px] font-bold text-white leading-tight">{t('landing.hero.surgicalLive')}</p>
                <p className="text-[9px] text-slate-300/80 mt-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-primary" />
                  {t('landing.hero.watchingNow')}
                </p>
              </div>
            </div>

            {/* BOTTOM LEFT-OF-DOCTOR — Actividad Global. Restaurada 2026-06-02 SIN números (solo gráfico decorativo + texto). */}
            <div className="absolute bottom-32 xl:bottom-36 left-1/2 xl:left-[44%] 2xl:left-[40%] -translate-x-1/2 xl:translate-x-0 hidden xl:block pointer-events-auto bg-white/10 backdrop-blur-xl p-2.5 lg:p-3 rounded-xl border border-white/15 shadow-2xl animate-float w-[150px] 2xl:w-[170px]" style={{ animationDuration: '6.5s', animationDelay: '1.2s' }}>
              <p className="text-[11px] font-medium text-white/85 mb-1.5">{t('landing.hero.globalActivity')}</p>
              <div className="h-8 rounded bg-[#0b1d45]/40 mb-1.5 flex items-end justify-around px-1 gap-0.5">
                {[40, 70, 55, 85, 60, 90, 45, 75, 65, 95].map((h, i) => (
                  <div key={i} className="w-0.5 lg:w-1 bg-[#aed3d9]/80 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-[9px] text-slate-300/80 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                {t('landing.hero.realTime')}
              </p>
            </div>
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
                  <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-[#227787]/40 to-[#163a83]/40 border border-[#aed3d9]/20 flex items-center justify-center">
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
              <span className="text-[#227787] font-bold tracking-widest text-xs uppercase mb-4 block">{t('landing.ecosystem.eyebrow')}</span>
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
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#227787] to-[#0b1d45] flex items-center justify-center text-white text-xs font-bold"><Hospital className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#aed3d9] to-[#227787] flex items-center justify-center text-white text-xs font-bold"><UserRound className="w-4 h-4" /></div>
                    </div>
                    <span className="text-sm font-bold text-[#227787]">{t('landing.ecosystem.vip.verifiedCredentials')}</span>
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

            {/* Video del Home SIN autoplay (cliente 2026-06-29): se reproduce SOLO al
                dar clic en el botón play de los controles nativos, con sonido. */}
            <div className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-black">
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={homeVideoPoster}
                className="w-full aspect-video object-cover"
                src={homeVideoPoster ? homeVideoSrc : `${homeVideoSrc}#t=0.1`}
                key={homeVideoSrc}
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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#227787]/10 border border-[#227787]/20 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#227787]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#227787]">{t('landing.profiles.residents.badge')}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('landing.profiles.residents.title')}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {t('landing.profiles.residents.desc')}
                  </p>
                  <ul className="space-y-2.5 text-sm text-gray-700">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#227787] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature1')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#227787] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature2')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#227787] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature3')}</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#227787] flex-shrink-0 mt-0.5" /> {t('landing.profiles.residents.feature4')}</li>
                  </ul>
                  <Link to="/for-residents" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#227787] hover:text-[#163a83] transition-colors">
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
                { title: t('landing.includes.records.title'), desc: t('landing.includes.records.desc'), icon: <Lock className="w-5 h-5" /> },
                { title: t('landing.includes.hospitals.title'), desc: t('landing.includes.hospitals.desc'), icon: <Hospital className="w-5 h-5" /> },
                { title: t('landing.includes.verification.title'), desc: t('landing.includes.verification.desc'), icon: <ShieldCheck className="w-5 h-5" /> },
              ].map((f) => (
                <div key={f.title} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg hover:border-[#227787]/30 transition-all duration-300">
                  <div className="w-11 h-11 rounded-xl bg-[#163a83]/10 text-[#163a83] flex items-center justify-center mb-4">{f.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sección "Modelo transparente" (precios) ELIMINADA por completo a pedido del cliente 2026-06-17. */}

        {/* Final CTA */}
        <section className="py-32 relative overflow-hidden bg-[#163a83]">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#227787]/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#839ed5]/20 rounded-full blur-[80px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
              {t('landing.finalCta.title')}
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto font-light">
               {t('landing.finalCta.subtitle')}
            </p>

            {/* Los DOS botones CTA de abajo ELIMINADOS a pedido del cliente 2026-06-16:
                el único acceso a la app queda en el botón de la barra superior. */}

            <p className="mt-8 text-sm text-blue-200/60">
               {t('landing.finalCta.footnote')}
            </p>
          </div>

          {/* Borde SUPERIOR uniforme (mismo efecto que el footer, ahora arriba): tapa el blob
              teal y deja el borde de arriba en #163a83 puro a lo ancho, para que se una SIN
              costura con la sección de precios de arriba (que termina en ese mismo navy). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-56"
            style={{ backgroundImage: 'linear-gradient(to top, rgba(22,58,131,0) 0%, #163a83 78%)' }}
          />

          {/* Borde inferior uniforme: tapa los blobs y deja el fondo en #163a83 puro a lo ancho,
              para que el footer (que arranca en ese mismo navy) se una SIN costura. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
            style={{ backgroundImage: 'linear-gradient(to bottom, rgba(22,58,131,0) 0%, #163a83 78%)' }}
          />
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
