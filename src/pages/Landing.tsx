import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DemoVideoModal } from '@/components/landing/DemoVideoModal';
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
  Activity,
  Video,
} from 'lucide-react';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Landing() {
  const navigate = useNavigate();
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  
  const [showDemoModal, setShowDemoModal] = useState(false);

  // If user is already logged in, redirect to app
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;

    if (role === 'doctor') {
      navigate('/doctor/dashboard', { replace: true });
    } else if (role === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate('/lives', { replace: true });
    }
  }, [isLoading, isAuthenticated, user?.id, role, navigate]);

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
                <img src={logoWhite} alt="Logo" className={`h-full object-contain transition-all duration-500 group-hover:scale-105 ${scrolled ? 'opacity-0' : 'opacity-100'}`} />
                <img src={logoBlue} alt="Logo" className={`h-full object-contain absolute top-0 left-0 transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-1">
              <div className={`flex items-center backdrop-blur-md rounded-full p-1 mr-6 transition-all duration-300 ${scrolled ? 'bg-gray-100 border-gray-200' : 'bg-white/10 border-white/20'} border`}>
                <a href="#ecosistema" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>Ecosistema</a>
                <a href="#features" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>Tecnología</a>
                <a href="#workflow" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>Proceso</a>
                <a href="#reviews" className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${scrolled ? 'text-gray-700 hover:bg-gray-200' : 'text-white hover:bg-white/20'}`}>Reseñas</a>
              </div>
              
              <Link 
                to="/app" 
                className="relative overflow-hidden group bg-[#00768b] hover:bg-white text-white hover:text-[#163a83] font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(0,118,139,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)] border border-transparent hover:border-[#163a83]"
              >
                <span className="relative z-10 flex items-center gap-2 text-sm uppercase tracking-wider">
                  Entrar a la App <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
              Entrar
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
          {/* Top stats bar — visible md+ */}
          <div className="hidden md:flex absolute top-24 lg:top-24 left-1/2 -translate-x-1/2 items-center gap-5 lg:gap-8 px-5 py-2.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
            <div className="flex items-center gap-2">
              <img src={iconGlobal} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <div className="leading-tight">
                <p className="text-sm lg:text-base font-bold text-white">+120</p>
                <p className="text-[9px] lg:text-[10px] uppercase tracking-wider text-slate-300">Países conectados</p>
              </div>
            </div>
            <div className="w-px h-7 bg-white/15" />
            <div className="flex items-center gap-2">
              <img src={iconMedicos} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <div className="leading-tight">
                <p className="text-sm lg:text-base font-bold text-white">+50,000</p>
                <p className="text-[9px] lg:text-[10px] uppercase tracking-wider text-slate-300">Médicos activos</p>
              </div>
            </div>
            <div className="w-px h-7 bg-white/15" />
            <div className="flex items-center gap-2">
              <img src={iconStream} alt="" className="w-4 h-4 lg:w-5 lg:h-5" />
              <div className="leading-tight">
                <p className="text-sm lg:text-base font-bold text-white">Streaming</p>
                <p className="text-[9px] lg:text-[10px] uppercase tracking-wider text-slate-300">en tiempo real</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-10 items-start lg:items-center flex-1 min-h-0">
            {/* LEFT: copy + CTAs (kept narrower so floating cards have room beside it) */}
            <div className="relative z-20 animate-fade-in space-y-2.5 sm:space-y-3 lg:space-y-5 max-w-md xl:max-w-lg 2xl:max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00768b]/15 border border-[#aed3d9]/30 backdrop-blur-md">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#aed3d9] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#aed3d9]" />
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#aed3d9]">LIVE</span>
                <span className="text-[10px] sm:text-[11px] font-medium text-white/80 hidden xs:inline">· Consultas y retransmisiones en tiempo real</span>
              </div>

              <h1 className="text-[26px] sm:text-3xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.05] tracking-tight">
                La Medicina,<br />Sin Fronteras.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] via-[#00768b] to-[#839ed5]">En Tiempo Real.</span>
              </h1>

              <p className="text-xs sm:text-sm lg:text-base text-slate-200/90 font-light leading-relaxed">
                Consultas en vivo, formación médica y colaboración global en una única plataforma inteligente.
              </p>
              <p className="text-xs sm:text-sm text-slate-300/80 font-light leading-relaxed hidden lg:block">
                Conectamos médicos, hospitales y conocimiento en todo el mundo. Desde una segunda opinión hasta retransmisiones quirúrgicas en directo.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white bg-[#00768b] rounded-full shadow-[0_0_30px_rgba(0,118,139,0.45)] hover:bg-[#00879f] hover:shadow-[0_0_45px_rgba(0,118,139,0.7)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <ArrowRight className="w-4 h-4 mr-2 -ml-0.5 rotate-[-45deg]" />
                  <span>Acceder a la Plataforma</span>
                </Link>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="inline-flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-white border border-white/25 rounded-full hover:bg-white/10 hover:border-white/50 transition-all backdrop-blur-md group"
                >
                  <PlayCircle className="w-4 h-4 mr-2 text-[#aed3d9] group-hover:scale-110 transition-transform" />
                  Ver Demo en Vivo
                </button>
              </div>

              {/* MOBILE-only stat cards 2x2 — clean, readable, doctor stays visible behind */}
              <div className="grid grid-cols-2 gap-2.5 mt-3 md:hidden">
                {[
                  { img: iconGlobal, value: '+120', label: 'Países conectados' },
                  { img: iconMedicos, value: '+50K', label: 'Médicos activos' },
                  { img: iconStream, value: '1,248', label: 'Consultas hoy', trend: '+15%' },
                  { img: iconRetransmision, value: 'LIVE', label: '3.2K viendo ahora', live: true },
                ].map((s, i) => (
                  <div key={i} className="relative bg-white/10 backdrop-blur-xl px-3 py-2.5 rounded-xl border border-white/15 shadow-xl flex items-center gap-2.5">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-[#00768b]/40 to-[#163a83]/40 border border-[#aed3d9]/20 flex items-center justify-center">
                      <img src={s.img} alt="" className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-base font-bold text-white leading-none">{s.value}</p>
                        {s.trend && <span className="text-[10px] font-bold text-emerald-300">{s.trend}</span>}
                        {s.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-slate-300/85 mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-white/85">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium">122 médicos conectados</span>
              </div>
            </div>

            {/* TOP RIGHT — LIVE doctor card */}
            <div className="absolute top-24 lg:top-28 right-3 lg:right-6 xl:right-10 pointer-events-auto bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-float overflow-hidden w-[150px] lg:w-[170px]" style={{ animationDuration: '6s', animationDelay: '0.4s' }}>
              <div className="aspect-video bg-gradient-to-br from-[#00768b] to-[#163a83] relative flex items-center justify-center">
                <Stethoscope className="w-8 h-8 text-white/70" />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
                </span>
              </div>
            </div>

            {/* MID RIGHT — Vital signs (further right edge) */}
            <div className="absolute top-1/2 -translate-y-1/2 right-3 lg:right-6 xl:right-10 pointer-events-auto bg-white/10 backdrop-blur-xl p-2.5 lg:p-3 rounded-xl border border-white/15 shadow-2xl animate-float w-[150px] lg:w-[170px]" style={{ animationDuration: '5s', animationDelay: '0.8s' }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-white/85">Signos Vitales</span>
                <HeartPulse className="w-3 h-3 text-rose-300" />
              </div>
              <p className="text-[9px] text-slate-300/80 mb-0.5">En tiempo real</p>
              <p className="text-xl font-bold text-white leading-none">72 <span className="text-[10px] font-normal text-slate-300/80">bpm</span></p>
              <svg className="w-full h-5 text-rose-300 mt-1" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M0 10 Q10 10, 15 5 T25 10 T35 15 T45 10 T55 5 T65 10 T75 15 T85 10 T100 10" />
              </svg>
            </div>

            {/* BOTTOM RIGHT — Surgical Live */}
            <div className="absolute bottom-32 lg:bottom-32 right-3 lg:right-6 xl:right-10 pointer-events-auto bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-float overflow-hidden w-[170px] lg:w-[190px]" style={{ animationDuration: '5.5s', animationDelay: '1.6s' }}>
              <div className="aspect-[16/8] bg-gradient-to-br from-[#163a83] via-[#0b1d45] to-[#00768b] relative">
                <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
                </span>
                <Activity className="absolute inset-0 m-auto w-7 h-7 text-white/40" />
              </div>
              <div className="p-2">
                <p className="text-[10px] font-bold text-white leading-tight">Retransmisión Quirúrgica</p>
                <p className="text-[9px] text-slate-300/80 mt-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  3.2K Espectadores
                </p>
              </div>
            </div>

            {/* BOTTOM LEFT-OF-DOCTOR — Activity Global. Same gap rules as Mosaic */}
            <div className="absolute bottom-32 xl:bottom-36 left-1/2 xl:left-[44%] 2xl:left-[40%] -translate-x-1/2 xl:translate-x-0 hidden xl:block pointer-events-auto bg-white/10 backdrop-blur-xl p-2.5 lg:p-3 rounded-xl border border-white/15 shadow-2xl animate-float w-[150px] 2xl:w-[170px]" style={{ animationDuration: '6.5s', animationDelay: '1.2s' }}>
              <p className="text-[11px] font-medium text-white/85 mb-1.5">Actividad Global</p>
              <div className="h-8 rounded bg-[#0b1d45]/40 mb-1.5 flex items-end justify-around px-1 gap-0.5">
                {[40, 70, 55, 85, 60, 90, 45, 75, 65, 95].map((h, i) => (
                  <div key={i} className="w-0.5 lg:w-1 bg-[#aed3d9]/80 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] text-slate-300/80">Consultas hoy</p>
                <p className="text-xs font-bold text-white">1,248 <span className="text-[9px] text-emerald-300">+15%</span></p>
              </div>
            </div>
          </div>

          {/* Bottom feature row - 4 cards */}
          <div className="absolute left-4 right-4 sm:left-6 sm:right-6 lg:left-12 lg:right-12 bottom-3 sm:bottom-4 lg:bottom-6 z-20">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl lg:rounded-2xl p-2.5 sm:p-3 lg:p-4 shadow-2xl">
              {[
                { icon: iconEducacion, title: 'Educación Médica', desc: 'Accede a cursos, webinars y contenidos de expertos líderes.' },
                { icon: iconConsultas, title: 'Consultas en Línea', desc: 'Segundas opiniones y consultas especializadas en tiempo real.' },
                { icon: iconUsuarios, title: 'Red de Residentes', desc: 'Conecta, colabora y crece junto a miles de médicos residentes.' },
                { icon: iconRetransmision, title: 'Retransmisiones Live', desc: 'Cirugías, eventos y conferencias en vivo desde cualquier parte.' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-2 sm:gap-2.5 lg:gap-3">
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
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" /> Cédula validada</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><UserRound className="w-3 h-3 sm:w-4 sm:h-4" /> Identidad biométrica</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Video className="w-3 h-3 sm:w-4 sm:h-4" /> Lives de doctores</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><PlayCircle className="w-3 h-3 sm:w-4 sm:h-4" /> Contenido premium</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Lock className="w-3 h-3 sm:w-4 sm:h-4" /> Vault clínico</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><Check className="w-3 h-3 sm:w-4 sm:h-4" /> Recetas digitales</span>
              <span className="text-xs sm:text-xl font-bold text-gray-400 flex items-center gap-1.5 sm:gap-2 grayscale hover:grayscale-0 transition-all whitespace-nowrap"><HeartPulse className="w-3 h-3 sm:w-4 sm:h-4" /> Pagos en MXN</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 bg-slate-50">
        {/* Ecosystem Section */}
        <section id="ecosistema" className="py-24 lg:py-32 relative overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto mb-20">
              <span className="text-[#00768b] font-bold tracking-widest text-xs uppercase mb-4 block">El Nuevo Estándar</span>
              <h2 className="text-4xl lg:text-5xl font-bold text-[#163a83] mb-6">Un sistema operativo para la salud moderna</h2>
              <p className="text-xl text-slate-500 font-light leading-relaxed">
                Eliminamos las barreras entre la tecnología y la atención humana. Nuestra infraestructura conecta <span className="font-bold text-[#163a83]">laboratorios</span>, <span className="font-bold text-[#163a83]">especialistas</span> y <span className="font-bold text-[#163a83]">pacientes</span> en un flujo continuo de información segura.
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Un ecosistema, no una app</h3>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    Orientación médica por video, contenido premium grabado, recetas digitales con firma, vault clínico privado y directorio de hospitales — todo en una sola plataforma para doctores, residentes y pacientes en México.
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                    <div className="flex -space-x-3">
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#839ed5] to-[#163a83] flex items-center justify-center text-white text-xs font-bold"><Stethoscope className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#00768b] to-[#0b1d45] flex items-center justify-center text-white text-xs font-bold"><Hospital className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#aed3d9] to-[#00768b] flex items-center justify-center text-white text-xs font-bold"><UserRound className="w-4 h-4" /></div>
                    </div>
                    <span className="text-sm font-bold text-[#00768b]">Doctores con cédula validada por SEP</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 lg:col-span-2 bg-gradient-to-br from-[#163a83] to-[#0b1d45] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                <ShieldCheck className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 group-hover:text-white/10 transition-colors" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold">Seguridad de grado bancario</h3>
                    <Lock className="w-5 h-5 text-[#aed3d9]" />
                  </div>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    Cifrado AES-256 en reposo y TLS 1.3 en tránsito. Row-Level Security por usuario, auditoría completa de accesos al expediente y cumplimiento NOM-024-SSA3.
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 group hover:border-[#839ed5]/50 transition-colors">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Video en HD sin descargas</h3>
                <p className="text-sm text-gray-500">Lives y orientaciones por Daily.co con baja latencia. Contenido protegido: nada se puede descargar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Video Section */}
        <section id="features" className="py-24 bg-slate-100/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-[#163a83] mb-4">Experiencia Inmersiva</h2>
              <p className="text-slate-600 text-lg">
                Descubre cómo nuestra interfaz intuitiva transforma la gestión clínica.
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
              <span className="text-[#00768b] font-bold tracking-widest text-xs uppercase mb-4 block">Una plataforma, tres perfiles</span>
              <h2 className="text-4xl font-bold text-[#163a83] mb-4">Hecho para doctores, residentes y pacientes</h2>
              <p className="text-slate-600 leading-relaxed">
                Desde una segunda opinión hasta retransmisiones quirúrgicas en directo: cada perfil entra a la misma red con las herramientas que necesita.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {/* Doctores */}
              <div className="group relative bg-gradient-to-br from-[#163a83] to-[#0b1d45] rounded-3xl p-8 text-white shadow-xl overflow-hidden">
                <Stethoscope className="absolute -bottom-6 -right-6 w-40 h-40 text-white/5 group-hover:text-white/10 transition-colors" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#aed3d9]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#aed3d9]">Doctores</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Atiende, transmite y monetiza</h3>
                  <p className="text-blue-100/90 text-sm leading-relaxed mb-6">
                    Cédula validada por SEP, identidad opcional con Veriff. Construye tu práctica digital y cobra en MXN con depósitos SPEI directos a tu CLABE.
                  </p>
                  <ul className="space-y-2.5 text-sm text-blue-50">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> Orientación médica 1:1 por video</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> Lives en HD y contenido premium grabado</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> Recetas firmadas con cédula y QR</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0 mt-0.5" /> Suscriptores, wallet y facturación</li>
                  </ul>
                  <Link to="/for-doctors" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#aed3d9] hover:text-white transition-colors">
                    Soy doctor <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Residentes */}
              <div className="group relative bg-white rounded-3xl p-8 border border-slate-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#aed3d9]/30 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 duration-700" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00768b]/10 border border-[#00768b]/20 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00768b]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#00768b]">Residentes</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Aprende y conecta con la red</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    Acceso reducido al ecosistema con 50% de descuento en lives y contenido premium. Networking formal con doctores verificados.
                  </p>
                  <ul className="space-y-2.5 text-sm text-gray-700">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> 50% off en todo el contenido</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> Sesiones clínicas y grupos privados</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> Solicitud formal a doctores tratantes</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0 mt-0.5" /> Expedientes clínicos personales</li>
                  </ul>
                  <Link to="/for-residents" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#00768b] hover:text-[#163a83] transition-colors">
                    Soy residente <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="mt-3 text-[11px] text-slate-500">Los residentes no pueden cobrar ni emitir recetas.</p>
                </div>
              </div>

              {/* Pacientes */}
              <div className="group relative bg-gradient-to-br from-[#aed3d9]/40 to-[#839ed5]/30 rounded-3xl p-8 border border-[#aed3d9]/40 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <HeartPulse className="absolute -bottom-6 -right-6 w-40 h-40 text-white/30 group-hover:text-white/50 transition-colors" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-white/80 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#163a83]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#163a83]">Pacientes</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Tu salud, en tus manos</h3>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6">
                    Encuentra doctores con cédula validada, agenda orientación por video y guarda tu expediente cifrado. Tú decides quién accede y por cuánto tiempo.
                  </p>
                  <ul className="space-y-2.5 text-sm text-gray-800">
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> Segunda opinión con especialistas</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> Chat persistente 30 días tras la sesión</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> Vault clínico con autorización OTP</li>
                    <li className="flex gap-2 items-start"><Check className="w-4 h-4 text-[#163a83] flex-shrink-0 mt-0.5" /> Recetas digitales válidas en tu país</li>
                  </ul>
                  <Link to="/for-patients" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#163a83] hover:text-[#0b1d45] transition-colors">
                    Soy paciente <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lo que incluye Medical Masters */}
        <section id="reviews" className="py-24 bg-white border-t border-slate-100">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4 text-[#163a83]">Todo lo que incluye Medical Masters</h2>
            <p className="text-center text-slate-500 mb-16 max-w-2xl mx-auto">Funciones que hoy ya están en producción dentro de la plataforma.</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Orientación médica por video', desc: 'Sesiones 1:1 por Daily.co con grabación opcional, chat persistente 30 días y resumen clínico al cierre.', icon: <Video className="w-5 h-5" /> },
                { title: 'Lives y Contenido Premium', desc: 'Transmite en vivo en HD con chat moderado y monetiza grabaciones por compra única o suscripción.', icon: <PlayCircle className="w-5 h-5" /> },
                { title: 'Reuniones (Recetas digitales)', desc: 'Recetas firmadas con cédula y QR de validación. Restringidas al país del paciente.', icon: <Check className="w-5 h-5" /> },
                { title: 'Vault clínico privado', desc: 'Pacientes guardan estudios y autorizan acceso por OTP. Auditoría completa de accesos.', icon: <Lock className="w-5 h-5" /> },
                { title: 'Directorio de hospitales', desc: 'Hospitales privados de México con doctores relacionados, distancia y reseñas.', icon: <Hospital className="w-5 h-5" /> },
                { title: 'Verificación de cédula SEP', desc: 'Validación oficial de cédula profesional y permisos COFEPRIS antes de aprobar al doctor.', icon: <ShieldCheck className="w-5 h-5" /> },
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
              <span className="text-[#aed3d9] font-bold tracking-widest text-xs uppercase mb-4 block">Modelo transparente</span>
              <h2 className="text-4xl font-bold text-white mb-4">Sin mensualidades. Pagas solo lo que usas.</h2>
              <p className="text-slate-300 max-w-2xl mx-auto">
                Crear cuenta es gratis para doctores, residentes y pacientes. Cada doctor define el precio de sus servicios.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Pacientes */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">Pacientes</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">Gratis</span>
                  <span className="text-slate-400"> registro</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Pagas por orientación o contenido que consumes, en MXN.</p>
                <Link to="/app" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">Crear cuenta</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Vault clínico privado con OTP</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Chat de 30 días tras orientación</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Wallet en MXN, multimoneda en display</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Recetas digitales firmadas</li>
                </ul>
              </div>

              {/* Doctores */}
              <div className="bg-gradient-to-b from-[#00768b] to-[#163a83] rounded-3xl p-8 border-2 border-[#aed3d9]/50 shadow-2xl relative transform scale-105 z-10">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-xs font-bold text-black rounded-full uppercase tracking-wider">Para médicos</span>
                <h3 className="text-xl font-bold text-white">Doctores verificados</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">0%</span>
                  <span className="text-blue-100"> alta · comisión por transacción</span>
                </div>
                <p className="text-blue-100 text-sm mb-6">Define tus precios. Cobra por orientación, suscripciones y contenido premium.</p>
                <Link to="/app" className="block w-full py-3 rounded-xl bg-white text-[#163a83] text-center font-bold hover:shadow-xl transition-all">Verificar mi cédula</Link>
                <ul className="mt-8 space-y-3 text-sm text-blue-50">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> Validación oficial SEP + Veriff</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> Orientación 1:1 + lives en HD</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> Contenido premium por compra o suscripción</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> Depósitos SPEI a tu CLABE</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#aed3d9] flex-shrink-0" /> Wallet interno + facturación</li>
                </ul>
              </div>

              {/* Residentes */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">Residentes</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">-50%</span>
                  <span className="text-slate-400"> en todo</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Acceso reducido a contenido y networking médico verificado.</p>
                <Link to="/app" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">Soy residente</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> 50% off en contenido y lives</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Networking con doctores verificados</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Expedientes clínicos personales</li>
                  <li className="flex gap-2 items-center"><Check className="w-4 h-4 text-[#00768b] flex-shrink-0" /> Grupos y sesiones clínicas</li>
                </ul>
              </div>
            </div>

            <p className="text-center text-slate-400 text-xs mt-10 max-w-2xl mx-auto">
              Recetas restringidas al país del paciente. Residentes no pueden cobrar consultas. Pacientes no acceden al marketplace B2B médico.
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
              Medicina verificada, en México.
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto font-light">
              Doctores con cédula validada por SEP, pacientes con expediente cifrado y residentes conectados a la red. Todo en una sola plataforma.
            </p>
            
            <div className="flex flex-col md:flex-row justify-center gap-6">
              <Link 
                to="/app" 
                className="px-10 py-5 bg-white text-[#163a83] font-bold text-lg rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:shadow-[0_0_60px_rgba(255,255,255,0.6)] hover:scale-105 transition-all duration-300"
              >
                Crear cuenta gratis
              </Link>
              <Link to="/contact" className="px-10 py-5 border border-white/30 text-white font-bold text-lg rounded-full hover:bg-white/10 transition-all">
                Hablar con el equipo
              </Link>
            </div>
            
            <p className="mt-8 text-sm text-blue-200/60">
              Registro gratis • Validación SEP en minutos • Cumplimiento NOM-024-SSA3
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
