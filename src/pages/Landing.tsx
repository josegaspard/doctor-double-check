import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';

export default function Landing() {
  const navigate = useNavigate();
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingMode, setBillingMode] = useState<'monthly' | 'annual'>('monthly');

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

  const getPricing = () => {
    if (billingMode === 'annual') {
      return { personal: '$279', personalPeriod: '/año', family: '$759', familyPeriod: '/año' };
    }
    return { personal: '$29', personalPeriod: '/mes', family: '$79', familyPeriod: '/mes' };
  };

  const pricing = getPricing();

  return (
    <div className="font-sans text-slate-800 bg-slate-50 overflow-x-hidden relative selection:bg-[#00768b] selection:text-white">
      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#aed3d9]/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#839ed5]/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-[#00768b]/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-500 top-0 border-b ${scrolled ? 'border-gray-100' : 'border-transparent'}`}>
        <div className={`absolute inset-0 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'}`} />
        <div className="container mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex justify-between items-center h-20 md:h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative h-10 md:h-12 overflow-hidden">
                <img 
                  src={logoWhite} 
                  alt="Logo" 
                  className={`h-full object-contain transition-all duration-500 group-hover:scale-105 ${scrolled ? 'opacity-0' : 'opacity-100'}`} 
                />
                <img 
                  src={logoBlue} 
                  alt="Logo" 
                  className={`h-full object-contain absolute top-0 left-0 transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} 
                />
              </div>
            </Link>

            {/* Desktop Menu */}
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
                  Entrar a la App <i className="fa-solid fa-arrow-right-long transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>

            {/* Mobile Trigger */}
            <button 
              className={`lg:hidden text-3xl focus:outline-none relative z-[60] ${mobileMenuOpen ? 'text-white' : scrolled ? 'text-[#163a83]' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <i className={mobileMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars-staggered'} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`fixed inset-0 bg-[#0b1d45]/95 backdrop-blur-xl z-40 transform transition-transform duration-500 flex flex-col items-center justify-center space-y-8 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <a href="#ecosistema" onClick={() => setMobileMenuOpen(false)} className="text-3xl text-white font-light hover:text-[#aed3d9] transition-colors">Ecosistema</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-3xl text-white font-light hover:text-[#aed3d9] transition-colors">Módulos</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-3xl text-white font-light hover:text-[#aed3d9] transition-colors">Planes</a>
          <hr className="w-24 border-white/20" />
          <Link to="/app" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">
            Acceder a Plataforma
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-end pt-20 overflow-hidden bg-[#163a83]">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1d45] via-[#163a83] to-[#00768b] opacity-90" />
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%23163a83' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E\")" }} />
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-20 mix-blend-overlay">
            <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-glitch-heart-heartbeat-32454-large.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="container mx-auto px-6 lg:px-12 relative z-10 h-full">
          <div className="flex flex-col lg:flex-row items-center h-full">
            {/* Left Content */}
            <div className="w-full lg:w-1/2 space-y-8 py-12 lg:py-24 animate-fade-in relative z-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-[#aed3d9]">v4.0 Live System</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
                Siempre una <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] via-white to-[#839ed5]">Segunda Opinión.</span>
              </h1>

              <p className="text-lg lg:text-xl text-slate-300 font-light max-w-xl leading-relaxed">
                Orquestación clínica inteligente. Conectamos talento médico, datos de pacientes y flujos financieros en una única interfaz segura y elegante.
              </p>

              {/* Social Proof */}
              <div className="flex items-center gap-4 pt-2 pb-2">
                <div className="flex -space-x-3">
                  <img className="w-10 h-10 rounded-full border-2 border-[#0b1d45] object-cover" src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop" alt="User 1" />
                  <img className="w-10 h-10 rounded-full border-2 border-[#0b1d45] object-cover" src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=150&h=150&fit=crop" alt="User 2" />
                  <img className="w-10 h-10 rounded-full border-2 border-[#0b1d45] object-cover" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop" alt="User 3" />
                  <img className="w-10 h-10 rounded-full border-2 border-[#0b1d45] object-cover" src="https://randomuser.me/api/portraits/men/32.jpg" alt="User 4" />
                  <div className="w-10 h-10 rounded-full border-2 border-[#0b1d45] bg-[#00768b] text-white flex items-center justify-center text-xs font-bold">+5k</div>
                </div>
                <div className="flex flex-col">
                  <div className="flex text-yellow-400 text-[10px] gap-0.5">
                    <i className="fa-solid fa-star" /><i className="fa-solid fa-star" /><i className="fa-solid fa-star" /><i className="fa-solid fa-star" /><i className="fa-solid fa-star" />
                  </div>
                  <span className="text-sm font-medium text-white">Usuarios activos</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-5 pt-4">
                <Link 
                  to="/app" 
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#163a83] bg-white rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:-translate-y-1 transition-all duration-300"
                >
                  <span>Entrar a la aplicación</span>
                  <i className="fa-solid fa-arrow-right ml-3" />
                </Link>
                
                <button className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white border border-white/20 rounded-xl hover:bg-white/10 transition-all backdrop-blur-md group">
                  <i className="fa-solid fa-circle-play mr-3 text-[#aed3d9] group-hover:scale-110 transition-transform" />
                  Demo Interactiva
                </button>
              </div>

              {/* Stats */}
              <div className="pt-8 flex gap-8 border-t border-white/10">
                <div>
                  <p className="text-3xl font-bold text-white">98<span className="text-[#aed3d9] text-xl">%</span></p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Precisión Dx</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">15<span className="text-[#aed3d9] text-xl">m+</span></p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Pacientes</p>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="w-full lg:w-1/2 relative h-[600px] lg:h-screen flex items-end justify-center lg:justify-end">
              <div className="absolute bottom-0 right-10 w-[80%] h-[70%] bg-[#00768b]/20 rounded-full filter blur-[100px] animate-pulse" />
              
              <div className="relative z-10 w-full h-full flex items-end justify-center lg:justify-end">
                <img 
                  src="https://i.imgur.com/YqgQSDV.png" 
                  alt="Doctora Especialista" 
                  className="absolute bottom-0 h-auto w-auto max-h-[85vh] lg:max-h-[115vh] lg:scale-[1.35] lg:origin-bottom-right lg:-right-10 object-contain drop-shadow-2xl z-10 pointer-events-none"
                />

                {/* Floating Card - Heart Rate */}
                <div className="absolute top-[30%] left-0 lg:left-0 bg-white/65 backdrop-blur-xl p-4 rounded-2xl z-20 max-w-[160px] border border-white/50 shadow-xl animate-bounce" style={{ animationDuration: '6s' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-red-100 rounded-lg text-red-500"><i className="fa-solid fa-heart-pulse" /></div>
                    <span className="text-xs font-bold text-gray-500">Live</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">72 <span className="text-sm font-normal text-gray-500">bpm</span></p>
                  <svg className="w-full h-8 text-red-400" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M0 10 Q10 10, 15 5 T25 10 T35 15 T45 10 T55 5 T65 10 T75 15 T85 10 T100 10" />
                  </svg>
                </div>

                {/* Floating Card - Record Ready */}
                <div className="absolute bottom-24 right-4 lg:right-12 bg-white/65 backdrop-blur-xl p-4 rounded-2xl z-30 flex items-center gap-3 border-l-4 border-green-500 shadow-2xl animate-bounce" style={{ animationDuration: '4s' }}>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                    <i className="fa-solid fa-check" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Expediente Listo</p>
                    <p className="text-xs text-gray-500">Sincronizado</p>
                  </div>
                </div>

                {/* Floating Card - App Status */}
                <div className="absolute top-[20%] right-0 lg:-right-8 bg-white/65 backdrop-blur-xl p-3 rounded-xl z-20 flex flex-col gap-2 border border-white/50 shadow-lg animate-bounce" style={{ animationDuration: '5s' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#163a83] flex items-center justify-center text-white shadow-md">
                      <i className="fa-solid fa-mobile-screen-button" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">Medical App</p>
                      <p className="text-[10px] text-green-600 font-bold"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1" />Activa</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between h-6 w-full gap-1 mt-1 px-1">
                    <div className="w-1.5 bg-blue-200 h-[40%] rounded-t-sm" />
                    <div className="w-1.5 bg-blue-300 h-[70%] rounded-t-sm" />
                    <div className="w-1.5 bg-[#00768b] h-[50%] rounded-t-sm" />
                    <div className="w-1.5 bg-[#163a83] h-[90%] rounded-t-sm" />
                    <div className="w-1.5 bg-blue-300 h-[60%] rounded-t-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="bg-white border-b border-gray-100 py-6 overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <div className="flex w-[200%] animate-scroll">
          {[1, 2].map((i) => (
            <div key={i} className="flex w-1/2 justify-around items-center">
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-hospital" /> Mayo Clinic</span>
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-staff-snake" /> Johns Hopkins</span>
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-user-doctor" /> Cleveland Clinic</span>
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-heart-pulse" /> Cedars-Sinai</span>
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-dna" /> Stanford Med</span>
              <span className="text-xl font-bold text-gray-400 flex items-center gap-2 grayscale hover:grayscale-0 transition-all"><i className="fa-solid fa-hospital-user" /> Mass General</span>
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
              {/* Large Feature Block */}
              <div className="md:col-span-3 lg:col-span-2 row-span-2 bg-white rounded-3xl p-8 shadow-lg border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-[#163a83] rounded-2xl flex items-center justify-center text-white text-2xl mb-8 shadow-lg shadow-[#163a83]/30">
                    <i className="fa-solid fa-network-wired" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">Interconexión Neural</h3>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    Algoritmos de enrutamiento clínico que dirigen cada caso al especialista más adecuado en milisegundos. La plataforma aprende de cada interacción para mejorar la precisión diagnóstica.
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                    <div className="flex -space-x-3">
                      <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop" alt="Doctor 1" />
                      <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=150&h=150&fit=crop" alt="Doctor 2" />
                      <img className="w-10 h-10 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop" alt="Doctor 3" />
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-[#00768b] text-white flex items-center justify-center text-xs font-bold">+5k</div>
                    </div>
                    <span className="text-sm font-bold text-[#00768b]">Red de +5,000 expertos</span>
                  </div>
                </div>
              </div>

              {/* Security Block */}
              <div className="md:col-span-3 lg:col-span-2 bg-gradient-to-br from-[#163a83] to-[#0b1d45] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                <i className="fa-solid fa-shield-virus absolute -bottom-4 -right-4 text-9xl text-white/5 group-hover:text-white/10 transition-colors" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold">Seguridad Militar</h3>
                    <i className="fa-solid fa-lock text-[#aed3d9] text-xl" />
                  </div>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    Encriptación AES-256 en reposo y tránsito. Cumplimiento total HIPAA, GDPR y HITECH. Sus datos son inviolables.
                  </p>
                </div>
              </div>

              {/* Speed Block */}
              <div className="md:col-span-2 lg:col-span-1 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 group hover:border-[#839ed5]/50 transition-colors">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-6 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-bolt" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Velocidad Real</h3>
                <p className="text-sm text-gray-500">Latencia &lt; 20ms en videoconsultas HD.</p>
              </div>

              {/* AI Block */}
              <div className="md:col-span-2 lg:col-span-1 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 group hover:border-[#839ed5]/50 transition-colors">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">AI Assistant</h3>
                <p className="text-sm text-gray-500">Pre-diagnóstico y triaje automatizado.</p>
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
            
            <div className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-black group">
              <video
                src="https://gestomarketing.com.mx/wp-content/uploads/2026/01/Video_de_Landing_Page_Hiperrealista.mp4"
                className="w-full h-full object-cover"
                autoPlay 
                muted 
                loop 
                playsInline
                controls
              />
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-24 bg-white relative">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-16">
              {/* Sticky Sidebar */}
              <div className="lg:w-1/3">
                <div className="lg:sticky lg:top-32">
                  <h2 className="text-4xl font-bold text-[#163a83] mb-6">Implementación sin fricción</h2>
                  <p className="text-slate-600 mb-8 leading-relaxed">
                    Sabemos que cambiar de software es doloroso. Por eso hemos creado un proceso de migración asistida que garantiza <span className="font-bold">cero pérdida de datos</span> y una curva de aprendizaje mínima.
                  </p>
                  <Link to="/app" className="group inline-flex items-center gap-3 text-lg font-bold text-[#00768b]">
                    Agendar migración <span className="bg-blue-50 p-2 rounded-full group-hover:translate-x-2 transition-transform"><i className="fa-solid fa-arrow-right" /></span>
                  </Link>
                </div>
              </div>

              {/* Timeline */}
              <div className="lg:w-2/3 space-y-12 relative pl-8 border-l-2 border-slate-100">
                {[
                  { step: '01', title: 'Onboarding & Configuración', desc: 'Personalizamos la plataforma con tu identidad corporativa (Marca blanca). Configuramos las sedes, consultorios y especialidades.', color: 'border-[#00768b]' },
                  { step: '02', title: 'Migración de Datos HL7', desc: 'Nuestro equipo de ingeniería importa tus expedientes antiguos, limpiando duplicados y estandarizando formatos bajo norma HL7/FHIR.', color: 'border-[#aed3d9]' },
                  { step: '03', title: 'Capacitación & Go Live', desc: 'Sesiones de entrenamiento por roles. Lanzamiento controlado y soporte 24/7 durante la primera semana operativa.', color: 'border-[#163a83]' },
                ].map((item) => (
                  <div key={item.step} className="relative group">
                    <span className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-white border-4 ${item.color} group-hover:scale-125 transition-transform`} />
                    <div className="bg-slate-50 p-8 rounded-2xl group-hover:bg-white group-hover:shadow-xl transition-all border border-transparent group-hover:border-slate-100">
                      <span className="text-xs font-bold text-[#00768b] uppercase tracking-widest mb-2 block">Paso {item.step}</span>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                      <p className="text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="reviews" className="py-24 bg-white border-t border-slate-100">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl lg:text-4xl font-bold text-center mb-16 text-[#163a83]">Colegas y Pacientes Confían en Nosotros</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { text: '"He reducido mi tiempo administrativo en un 40%. La herramienta de IA para notas clínicas es impresionante, entiende perfectamente la terminología médica."', name: 'Dr. Carlos Méndez', role: 'Cardiólogo, Hospital Angeles', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
                { text: '"El sistema de videoconsultas es increíble. Mis pacientes en zonas rurales ahora tienen acceso a especialistas sin viajar cientos de kilómetros."', name: 'Dra. Lucía Fernández', role: 'Médico General, Clínica Satélite', avatar: 'https://randomuser.me/api/portraits/women/68.jpg' },
                { text: '"Por primera vez siento que tengo el control de mi salud. Puedo ver mi historial, mis estudios y hablar con mi médico sin esperas."', name: 'María Rodríguez', role: 'Paciente, CDMX', avatar: 'https://randomuser.me/api/portraits/women/45.jpg' },
              ].map((review, idx) => (
                <div key={idx} className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-1 text-yellow-400 mb-4 text-sm">
                    {[1,2,3,4,5].map(s => <i key={s} className="fa-solid fa-star" />)}
                  </div>
                  <p className="text-slate-600 mb-6 italic leading-relaxed">{review.text}</p>
                  <div className="flex items-center gap-4">
                    <img src={review.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt={review.name} />
                    <div>
                      <p className="font-bold text-slate-900">{review.name}</p>
                      <p className="text-sm text-slate-500">{review.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-gradient-to-b from-[#0b1d45] to-[#163a83] relative overflow-hidden">
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">Planes para cada necesidad</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">Desde profesionales independientes hasta grandes redes hospitalarias.</p>
              
              {/* Toggle */}
              <div className="mt-8 inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                <button 
                  onClick={() => setBillingMode('monthly')}
                  className={`px-6 py-2 rounded-lg text-sm transition-all ${billingMode === 'monthly' ? 'bg-[#00768b] text-white font-bold shadow-lg' : 'text-slate-300 hover:text-white'}`}
                >
                  Mensual
                </button>
                <button 
                  onClick={() => setBillingMode('annual')}
                  className={`px-6 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${billingMode === 'annual' ? 'bg-[#00768b] text-white font-bold shadow-lg' : 'text-slate-300 hover:text-white'}`}
                >
                  Anual <span className="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold">-20%</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Personal Plan */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">Personal</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">{pricing.personal}</span>
                  <span className="text-slate-400">{pricing.personalPeriod}</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Para profesionales de salud independientes.</p>
                <Link to="/app" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">Empezar Ahora</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> 50 Consultas / Mes</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> Historia Clínica Electrónica</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> Recordatorios SMS</li>
                </ul>
              </div>

              {/* Family Plan */}
              <div className="bg-gradient-to-b from-[#00768b] to-[#163a83] rounded-3xl p-8 border-2 border-[#aed3d9]/50 shadow-2xl relative transform scale-105 z-10">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-xs font-bold text-black rounded-full uppercase tracking-wider">Más Popular</span>
                <h3 className="text-xl font-bold text-white">Familiar / Clínica</h3>
                <div className="my-4">
                  <span className="text-4xl font-bold text-white">{pricing.family}</span>
                  <span className="text-blue-100">{pricing.familyPeriod}</span>
                </div>
                <p className="text-blue-100 text-sm mb-6">Para clínicas con múltiples profesionales.</p>
                <Link to="/app" className="block w-full py-3 rounded-xl bg-white text-[#163a83] text-center font-bold hover:shadow-xl transition-all">Seleccionar Plan</Link>
                <ul className="mt-8 space-y-3 text-sm text-blue-50">
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#aed3d9]" /> Consultas Ilimitadas</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#aed3d9]" /> Asistente IA 24/7</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#aed3d9]" /> Monitoreo Remoto</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#aed3d9]" /> Prioridad en Urgencias</li>
                </ul>
              </div>

              {/* Corporate Plan */}
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-[#00768b]/50 transition-all duration-300">
                <h3 className="text-xl font-bold text-[#aed3d9]">Corporativo</h3>
                <div className="my-4"><span className="text-4xl font-bold text-white">Custom</span></div>
                <p className="text-slate-400 text-sm mb-6">Para empresas y grandes colectivos.</p>
                <Link to="/contact" className="block w-full py-3 rounded-xl border border-white/20 text-center font-bold hover:bg-white/10 text-white transition-all">Contactar Ventas</Link>
                <ul className="mt-8 space-y-3 text-sm text-slate-300">
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> API Empresarial</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> Dashboard de Analytics</li>
                  <li className="flex gap-2"><i className="fa-solid fa-check text-[#00768b]" /> Gestor de Cuenta Dedicado</li>
                </ul>
              </div>
            </div>
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
              ¿Listo para elevar el estándar?
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto font-light">
              Únete a las más de 500 instituciones que ya han digitalizado su futuro con nosotros.
            </p>
            
            <div className="flex flex-col md:flex-row justify-center gap-6">
              <Link 
                to="/app" 
                className="px-10 py-5 bg-white text-[#163a83] font-bold text-lg rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:shadow-[0_0_60px_rgba(255,255,255,0.6)] hover:scale-105 transition-all duration-300"
              >
                Acceder a la Plataforma
              </Link>
              <Link to="/contact" className="px-10 py-5 border border-white/30 text-white font-bold text-lg rounded-full hover:bg-white/10 transition-all">
                Hablar con Ventas
              </Link>
            </div>
            
            <p className="mt-8 text-sm text-blue-200/60">
              No credit card required for demo • HIPAA Compliant • Cancel anytime
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0b1d45] pt-20 pb-10 text-slate-300 border-t border-white/5 font-light text-sm">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
            {/* Brand Column */}
            <div className="col-span-2 lg:col-span-2">
              <img src={logoWhite} alt="Medical Logo" className="h-8 mb-6 opacity-90" />
              <p className="mb-6 max-w-sm text-slate-400">
                Revolucionando la atención médica a través de la tecnología. Comprometidos con la ética, la seguridad y la excelencia clínica.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fa-brands fa-linkedin-in" /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fa-brands fa-twitter" /></a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fa-brands fa-instagram" /></a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-bold mb-6">Plataforma</h4>
              <ul className="space-y-4">
                <li><Link to="/app" className="hover:text-[#aed3d9] transition-colors">Para Médicos</Link></li>
                <li><Link to="/app" className="hover:text-[#aed3d9] transition-colors">Para Pacientes</Link></li>
                <li><Link to="/contact" className="hover:text-[#aed3d9] transition-colors">Enterprise</Link></li>
                <li><a href="#pricing" className="hover:text-[#aed3d9] transition-colors">Precios</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Recursos</h4>
              <ul className="space-y-4">
                <li><a href="#" className="hover:text-[#aed3d9] transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-[#aed3d9] transition-colors">Casos de Éxito</a></li>
                <li><Link to="/contact" className="hover:text-[#aed3d9] transition-colors">Ayuda</Link></li>
                <li><a href="#" className="hover:text-[#aed3d9] transition-colors">API Docs</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Legal</h4>
              <ul className="space-y-4">
                <li><Link to="/privacy" className="hover:text-[#aed3d9] transition-colors">Privacidad</Link></li>
                <li><Link to="/terms" className="hover:text-[#aed3d9] transition-colors">Términos</Link></li>
                <li><a href="#" className="hover:text-[#aed3d9] transition-colors">Seguridad</a></li>
                <li><a href="#" className="hover:text-[#aed3d9] transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p>&copy; 2026 Medical Platform Inc. All rights reserved.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-500 font-bold text-xs">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Add Font Awesome */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      
      {/* Custom Styles */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
