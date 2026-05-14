import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, DollarSign, Calendar, Video, MessageSquare, Users, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import logoBlue from '@/assets/logo-medical-masters.png';
import { LandingFooter } from '@/components/landing/LandingFooter';

const benefits = [
  {
    icon: DollarSign,
    title: 'Monetiza tu Expertise',
    description: 'Genera ingresos adicionales ofreciendo consultas, segundas opiniones y contenido educativo premium.',
  },
  {
    icon: Calendar,
    title: 'Horarios Flexibles',
    description: 'Define tus propios horarios de disponibilidad y gestiona tu agenda de forma autónoma.',
  },
  {
    icon: Video,
    title: 'Lives Interactivos',
    description: 'Transmite en vivo sobre temas de tu especialidad y conecta con miles de pacientes.',
  },
  {
    icon: MessageSquare,
    title: 'Chat Seguro',
    description: 'Comunícate con pacientes a través de un sistema de mensajería encriptado y confidencial.',
  },
  {
    icon: Users,
    title: 'Construye tu Comunidad',
    description: 'Desarrolla tu marca personal y crea una base de pacientes y seguidores leales.',
  },
  {
    icon: TrendingUp,
    title: 'Analytics Detallados',
    description: 'Accede a métricas de rendimiento, satisfacción de pacientes y tendencias de consulta.',
  },
];

const features = [
  'Verificación de cédula profesional automatizada',
  'Sistema de pagos integrado con Stripe',
  'Expedientes digitales seguros',
  'Notificaciones inteligentes',
  'Soporte técnico prioritario',
  'Sin costos de inscripción',
];

export default function ForDoctors() {
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
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-[#163a83] via-[#00768b] to-[#163a83]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Para Médicos</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Expande tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">práctica médica</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              Únete a la plataforma líder de telemedicina y conecta con pacientes de todo el país mientras generas ingresos adicionales.
            </p>
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Registrarme como Médico
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-3 sm:mb-4">
            ¿Por qué unirte?
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            Descubre las ventajas de ser parte de nuestra comunidad de profesionales de la salud.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mb-3 sm:mb-4">
                  <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-xs sm:text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-12 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 items-center">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">
                  Todo lo que necesitas para crecer
                </h2>
                <ul className="space-y-3 sm:space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-success" />
                      </div>
                      <span className="text-gray-700 text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-[#163a83] to-[#00768b] p-5 sm:p-8 rounded-xl sm:rounded-2xl text-white">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-[#aed3d9]" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">100% Verificado</h3>
                <p className="text-slate-300 text-xs sm:text-sm mb-4 sm:mb-6">
                  Todos los médicos en nuestra plataforma son verificados a través de su cédula profesional con la SEP, garantizando confianza para los pacientes.
                </p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#aed3d9]">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Verificación automática en minutos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">¿Listo para comenzar?</h2>
          <p className="text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            Regístrate hoy y comienza a ofrecer tus servicios a miles de pacientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Crear mi Cuenta
            </Link>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium text-white border border-white/30 rounded-xl hover:bg-white/10 transition-all"
            >
              Hablar con Ventas
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
