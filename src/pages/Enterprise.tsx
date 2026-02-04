import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Shield, Users, BarChart3, Headphones, Globe, CheckCircle, Zap } from 'lucide-react';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';

const features = [
  {
    icon: Users,
    title: 'Gestión de Empleados',
    description: 'Administra la salud de tu equipo con acceso a consultas médicas ilimitadas para todos tus colaboradores.',
  },
  {
    icon: Shield,
    title: 'Cumplimiento Normativo',
    description: 'Cumple con las regulaciones de salud ocupacional con expedientes digitales y reportes automatizados.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Avanzados',
    description: 'Dashboard ejecutivo con métricas de uso, satisfacción y ROI de tu programa de salud corporativa.',
  },
  {
    icon: Headphones,
    title: 'Soporte Dedicado',
    description: 'Account manager dedicado y soporte técnico prioritario 24/7 para tu organización.',
  },
  {
    icon: Globe,
    title: 'Multiubicación',
    description: 'Gestiona múltiples sucursales y equipos distribuidos geográficamente desde una sola plataforma.',
  },
  {
    icon: Zap,
    title: 'Integración API',
    description: 'Conecta con tus sistemas de RRHH, nómina y beneficios existentes mediante nuestra API robusta.',
  },
];

const stats = [
  { value: '40%', label: 'Reducción en ausentismo' },
  { value: '3x', label: 'ROI promedio' },
  { value: '95%', label: 'Satisfacción empleados' },
  { value: '24/7', label: 'Soporte disponible' },
];

const trustedBy = [
  'Grupo Bimbo', 'Cemex', 'FEMSA', 'Banorte', 'Liverpool', 'Televisa'
];

export default function Enterprise() {
  return (
    <div className="font-sans text-slate-800 bg-slate-50 min-h-screen selection:bg-[#00768b] selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoBlue} alt="Logo" className="h-8 sm:h-10 object-contain" />
            </Link>
            <Link 
              to="/" 
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#163a83] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al inicio</span>
              <span className="sm:hidden">Volver</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 bg-gradient-to-br from-[#0b1d45] via-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
              <Building2 className="w-4 h-4 text-[#aed3d9]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Enterprise</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Salud corporativa <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">de clase mundial</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-8">
              Potencia el bienestar de tu equipo con nuestra plataforma de telemedicina diseñada para empresas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                Solicitar Demo
              </Link>
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white border border-white/30 rounded-xl hover:bg-white/10 transition-all"
              >
                Hablar con Ventas
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#163a83]">{stat.value}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-4">
            Solución completa para tu empresa
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            Todo lo que necesitas para implementar un programa de salud digital exitoso.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-16 sm:py-24 bg-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-8">
            Empresas que confían en nosotros
          </h2>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-12">
            {trustedBy.map((company, index) => (
              <span key={index} className="text-lg sm:text-xl font-bold text-gray-400">
                {company}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-8 sm:mb-12">
            Planes Enterprise
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Starter</h3>
              <p className="text-sm text-gray-500 mb-4">Para equipos pequeños</p>
              <p className="text-3xl font-bold text-gray-800 mb-6">Desde $5,000<span className="text-sm font-normal text-gray-500">/mes</span></p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Hasta 50 empleados</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Consultas ilimitadas</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Soporte por email</li>
              </ul>
              <Link to="/contact" className="block text-center py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                Contactar
              </Link>
            </div>
            
            {/* Pro */}
            <div className="bg-gradient-to-br from-[#163a83] to-[#00768b] p-6 sm:p-8 rounded-2xl text-white relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#aed3d9] text-[#163a83] text-xs font-bold rounded-full">
                POPULAR
              </div>
              <h3 className="text-lg font-bold mb-2">Pro</h3>
              <p className="text-sm text-slate-300 mb-4">Para empresas en crecimiento</p>
              <p className="text-3xl font-bold mb-6">Desde $15,000<span className="text-sm font-normal text-slate-300">/mes</span></p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-[#aed3d9]" />Hasta 250 empleados</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-[#aed3d9]" />Analytics avanzados</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-[#aed3d9]" />Account manager</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-[#aed3d9]" />Integración API</li>
              </ul>
              <Link to="/contact" className="block text-center py-3 bg-white text-[#163a83] rounded-xl font-bold hover:bg-slate-100 transition-colors">
                Contactar
              </Link>
            </div>
            
            {/* Enterprise */}
            <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Enterprise</h3>
              <p className="text-sm text-gray-500 mb-4">Para grandes organizaciones</p>
              <p className="text-3xl font-bold text-gray-800 mb-6">Personalizado</p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Empleados ilimitados</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />SLA garantizado</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Despliegue on-premise</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />Soporte 24/7</li>
              </ul>
              <Link to="/contact" className="block text-center py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                Contactar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">¿Listo para transformar la salud de tu empresa?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Agenda una demo personalizada y descubre cómo podemos ayudar a tu organización.
          </p>
          <Link 
            to="/contact" 
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            Solicitar Demo Gratuita
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0b1d45] py-8">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <img src={logoWhite} alt="Logo" className="h-8 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">© 2026 Medical Platform Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
