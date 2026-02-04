import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, DollarSign, Calendar, Video, MessageSquare, Users, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';

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
              <Stethoscope className="w-4 h-4 text-[#aed3d9]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Para Médicos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Expande tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">práctica médica</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-8">
              Únete a la plataforma líder de telemedicina y conecta con pacientes de todo el país mientras generas ingresos adicionales.
            </p>
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Registrarme como Médico
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-4">
            ¿Por qué unirte?
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            Descubre las ventajas de ser parte de nuestra comunidad de profesionales de la salud.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
                  Todo lo que necesitas para crecer
                </h2>
                <ul className="space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-[#163a83] to-[#00768b] p-6 sm:p-8 rounded-2xl text-white">
                <Shield className="w-12 h-12 mb-4 text-[#aed3d9]" />
                <h3 className="text-xl font-bold mb-3">100% Verificado</h3>
                <p className="text-slate-300 text-sm mb-6">
                  Todos los médicos en nuestra plataforma son verificados a través de su cédula profesional con la SEP, garantizando confianza para los pacientes.
                </p>
                <div className="flex items-center gap-2 text-sm text-[#aed3d9]">
                  <CheckCircle className="w-4 h-4" />
                  <span>Verificación automática en minutos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">¿Listo para comenzar?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Regístrate hoy y comienza a ofrecer tus servicios a miles de pacientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Crear mi Cuenta
            </Link>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white border border-white/30 rounded-xl hover:bg-white/10 transition-all"
            >
              Hablar con Ventas
            </Link>
          </div>
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
