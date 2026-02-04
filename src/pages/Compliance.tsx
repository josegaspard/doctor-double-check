import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, FileText, Globe, Building, CheckCircle2, AlertCircle } from 'lucide-react';
import logoBlue from '@/assets/logo-medical-masters.png';
import { LandingFooter } from '@/components/landing/LandingFooter';

const complianceAreas = [
  {
    icon: FileText,
    title: 'HIPAA',
    region: 'Estados Unidos',
    description: 'Cumplimiento total con la Ley de Portabilidad y Responsabilidad del Seguro Médico para la protección de información de salud.',
  },
  {
    icon: Globe,
    title: 'GDPR',
    region: 'Unión Europea',
    description: 'Adherencia al Reglamento General de Protección de Datos para usuarios europeos.',
  },
  {
    icon: Building,
    title: 'NOM-024-SSA3',
    region: 'México',
    description: 'Cumplimiento con la Norma Oficial Mexicana para sistemas de información en salud.',
  },
  {
    icon: Scale,
    title: 'SOC 2 Tipo II',
    region: 'Global',
    description: 'Certificación de controles de seguridad, disponibilidad y confidencialidad.',
  },
];

const policies = [
  { title: 'Política de Privacidad', link: '/privacy', description: 'Cómo recopilamos y usamos tus datos' },
  { title: 'Términos de Servicio', link: '/terms', description: 'Condiciones de uso de la plataforma' },
  { title: 'Política de Cookies', link: '/privacy', description: 'Uso de cookies y tecnologías similares' },
  { title: 'Política de Seguridad', link: '/security', description: 'Medidas de protección implementadas' },
];

export default function Compliance() {
  return (
    <div className="font-sans text-slate-800 bg-slate-50 min-h-screen selection:bg-[#00768b] selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-14 sm:h-20">
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
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-[#0b1d45] via-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Cumplimiento <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">Normativo</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto px-4">
              Nos adherimos a los más altos estándares regulatorios en cada jurisdicción donde operamos.
            </p>
          </div>
        </div>
      </header>

      {/* Compliance Areas */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            Áreas de Cumplimiento
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {complianceAreas.map((area, index) => (
              <div key={index} className="bg-white p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center">
                    <area.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-green-100">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                    <span className="text-[10px] sm:text-xs font-semibold text-green-700">Cumple</span>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1">{area.title}</h3>
                <p className="text-xs sm:text-sm text-[#00768b] font-medium mb-2 sm:mb-3">{area.region}</p>
                <p className="text-gray-600 text-xs sm:text-sm">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="py-12 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            Políticas y Documentación
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {policies.map((policy, index) => (
              <Link 
                key={index}
                to={policy.link}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#163a83]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#163a83]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 group-hover:text-[#163a83] transition-colors text-sm sm:text-base">{policy.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{policy.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting */}
      <section className="py-12 sm:py-24 bg-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600" />
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">
              Reportar una Preocupación
            </h2>
            <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
              Si tienes alguna preocupación sobre el cumplimiento normativo o deseas reportar una posible violación, 
              nuestro equipo de compliance está disponible para ayudarte de manera confidencial.
            </p>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-[#163a83] to-[#00768b] rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Contactar Compliance
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
