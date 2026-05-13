import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Server, CheckCircle, Key, FileCheck } from 'lucide-react';
import logoBlue from '@/assets/logo-medical-masters.png';
import { LandingFooter } from '@/components/landing/LandingFooter';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Encriptación de Extremo a Extremo',
    description: 'Todos los datos se encriptan usando AES-256, el estándar de encriptación más seguro utilizado por instituciones financieras y gobiernos.',
  },
  {
    icon: Shield,
    title: 'Cumplimiento HIPAA',
    description: 'Cumplimos con todas las regulaciones de la Ley de Portabilidad y Responsabilidad del Seguro Médico (HIPAA) para proteger tu información de salud.',
  },
  {
    icon: Eye,
    title: 'Privacidad por Diseño',
    description: 'La privacidad está integrada en cada aspecto de nuestra plataforma, desde el desarrollo hasta la implementación.',
  },
  {
    icon: Server,
    title: 'Infraestructura Segura',
    description: 'Nuestros servidores están alojados en centros de datos certificados SOC 2 Tipo II con redundancia geográfica.',
  },
  {
    icon: Key,
    title: 'Autenticación Multifactor',
    description: 'Protección adicional con verificación en dos pasos para todas las cuentas de usuario y acceso administrativo.',
  },
  {
    icon: FileCheck,
    title: 'Auditorías Regulares',
    description: 'Realizamos auditorías de seguridad trimestrales y pruebas de penetración por terceros independientes.',
  },
];

const certifications = [
  { name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
  { name: 'SOC 2', description: 'Service Organization Control Type II' },
  { name: 'ISO 27001', description: 'Information Security Management' },
  { name: 'GDPR', description: 'General Data Protection Regulation' },
];

export default function Security() {
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
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al inicio</span>
              <span className="sm:hidden">Volver</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-[#163a83] via-[#00768b] to-[#163a83]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Seguridad</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Tu seguridad es nuestra <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">prioridad</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto px-4">
              Protegemos tu información médica con los más altos estándares de seguridad de la industria.
            </p>
          </div>
        </div>
      </header>

      {/* Security Features */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mb-4 sm:mb-5">
                  <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-12 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            Certificaciones y Cumplimiento
          </h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 max-w-4xl mx-auto">
            {certifications.map((cert, index) => (
              <div key={index} className="bg-gray-50 p-3 sm:p-6 rounded-xl text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm sm:text-lg">{cert.name}</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">Nuestro Compromiso</h2>
          <p className="text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto text-sm sm:text-base">
            Nos comprometemos a mantener los más altos estándares de seguridad y privacidad. Si tienes preguntas sobre nuestras prácticas de seguridad, no dudes en contactarnos.
          </p>
          <Link 
            to="/contact" 
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            Contactar Seguridad
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
