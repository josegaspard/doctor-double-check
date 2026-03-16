import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Users, BookOpen, Video, MessageSquare, Award, Shield, CheckCircle, Microscope } from 'lucide-react';
import logoBlue from '@/assets/logo-medical-masters.png';
import { LandingFooter } from '@/components/landing/LandingFooter';

const benefits = [
  {
    icon: Users,
    title: 'Networking Médico',
    description: 'Conecta con residentes y especialistas de todo el país para compartir conocimientos y experiencias.',
  },
  {
    icon: Microscope,
    title: 'Grupos de Especialidad',
    description: 'Únete a grupos de tu especialidad para discusión de casos, estudios y avances médicos.',
  },
  {
    icon: Video,
    title: 'Meets Médicos',
    description: 'Participa en sesiones clínicas virtuales con médicos experimentados y mentores.',
  },
  {
    icon: BookOpen,
    title: 'Casos Clínicos',
    description: 'Accede a una biblioteca de casos clínicos reales para fortalecer tu formación práctica.',
  },
  {
    icon: MessageSquare,
    title: 'Mentorías',
    description: 'Recibe orientación directa de especialistas y médicos con años de experiencia.',
  },
  {
    icon: Award,
    title: 'Certificados',
    description: 'Obtén certificados de participación en sesiones clínicas y actividades académicas.',
  },
];

const features = [
  'Acceso a grupos de especialidad médica',
  'Sesiones clínicas con casos reales',
  'Networking con residentes de todo el país',
  'Meets médicos con especialistas',
  'Soporte técnico dedicado',
  'Sin costos de inscripción',
];

export default function ForResidents() {
  return (
    <div className="font-sans text-slate-800 bg-slate-50 min-h-screen selection:bg-teal-600 selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-14 sm:h-20">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoBlue} alt="Logo" className="h-8 sm:h-10 object-contain" />
            </Link>
            <Link 
              to="/" 
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al inicio</span>
              <span className="sm:hidden">Volver</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-teal-900 via-teal-700 to-emerald-600">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-200" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-teal-200">Para Residentes</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Potencia tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-white">formación médica</span>
            </h1>
            <p className="text-sm sm:text-lg text-teal-100 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              Únete a la comunidad académica más grande de residentes médicos. Aprende, colabora y crece profesionalmente.
            </p>
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-teal-800 bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Registrarme como Residente
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
            Descubre las ventajas de formar parte de nuestra comunidad académica de residentes.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center mb-3 sm:mb-4">
                  <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-xs sm:text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-8 sm:mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6 sm:gap-8">
            {[
              { step: '1', title: 'Regístrate', desc: 'Crea tu cuenta y selecciona tu especialidad y año de residencia.' },
              { step: '2', title: 'Únete a Grupos', desc: 'Encuentra y únete a grupos de tu especialidad para colaborar.' },
              { step: '3', title: 'Participa', desc: 'Asiste a sesiones clínicas, meets médicos y discusiones de casos.' },
              { step: '4', title: 'Crece', desc: 'Obtén certificados, networking y fortalece tu formación profesional.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg sm:text-xl font-bold text-teal-700">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-12 sm:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 items-center">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">
                  Todo para tu formación
                </h2>
                <ul className="space-y-3 sm:space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-teal-600" />
                      </div>
                      <span className="text-gray-700 text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-teal-700 to-emerald-600 p-5 sm:p-8 rounded-xl sm:rounded-2xl text-white">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-teal-200" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">Enfoque Académico</h3>
                <p className="text-teal-100 text-xs sm:text-sm mb-4 sm:mb-6">
                  Los residentes participan en un entorno 100% educativo y de networking profesional. Sin cobros ni orientaciones clínicas directas a pacientes.
                </p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-teal-200">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Verificación institucional</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-teal-800 to-emerald-600">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">¿Listo para comenzar?</h2>
          <p className="text-teal-100 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            Regístrate hoy y comienza a conectar con la comunidad de residentes más grande.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-teal-800 bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Crear mi Cuenta
            </Link>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium text-white border border-white/30 rounded-xl hover:bg-white/10 transition-all"
            >
              Contactar
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
