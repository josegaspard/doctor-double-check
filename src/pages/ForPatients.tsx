import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Video, FileText, Shield, Clock, Smartphone, Users, CheckCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

const benefits = [
  {
    icon: MessageSquare,
    title: 'Consultas 1:1',
    description: 'Chatea directamente con especialistas certificados desde la comodidad de tu hogar.',
  },
  {
    icon: Video,
    title: 'Lives Educativos',
    description: 'Accede a transmisiones en vivo de médicos expertos sobre diversos temas de salud.',
  },
  {
    icon: FileText,
    title: 'Segunda Opinión',
    description: 'Obtén una segunda opinión médica para tomar decisiones informadas sobre tu salud.',
  },
  {
    icon: Shield,
    title: 'Médicos Verificados',
    description: 'Todos nuestros médicos están verificados por la SEP con su cédula profesional.',
  },
  {
    icon: Clock,
    title: 'Disponibilidad 24/7',
    description: 'Accede a la plataforma en cualquier momento, desde cualquier lugar.',
  },
  {
    icon: Smartphone,
    title: 'App Móvil',
    description: 'Gestiona tu salud desde tu smartphone con nuestra aplicación optimizada.',
  },
];

const howItWorks = [
  { step: 1, title: 'Regístrate', description: 'Crea tu cuenta en menos de 2 minutos' },
  { step: 2, title: 'Elige un médico', description: 'Explora perfiles de especialistas verificados' },
  { step: 3, title: 'Inicia tu consulta', description: 'Conecta vía chat o videollamada' },
  { step: 4, title: 'Recibe seguimiento', description: 'Mantén comunicación continua' },
];

export default function ForPatients() {
  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-[#163a83] via-[#00768b] to-[#163a83]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Para Pacientes</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Tu salud, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">nuestra prioridad</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              Accede a los mejores especialistas médicos desde cualquier lugar. Obtén consultas, segundas opiniones y contenido educativo de calidad.
            </p>
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Comenzar Ahora
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-3 sm:mb-4">
            Todo lo que necesitas
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            Una plataforma completa para cuidar de tu salud y la de tu familia.
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

      {/* How it works */}
      <section className="py-12 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            ¿Cómo funciona?
          </h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 max-w-4xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mx-auto mb-3 sm:mb-4 text-white text-lg sm:text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-800 mb-1 text-xs sm:text-base">{item.title}</h3>
                <p className="text-gray-500 text-[10px] sm:text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12 sm:py-24 bg-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
              <div className="bg-white p-5 sm:p-8 rounded-xl sm:rounded-2xl shadow-lg order-2 md:order-1">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-[#163a83] mb-3 sm:mb-4" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">+5,000 Médicos</h3>
                <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                  Accede a la red más grande de especialistas verificados en México.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
                    Cardiólogos
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
                    Neurólogos
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
                    Oncólogos
                  </li>
                  <li className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
                    Y muchos más...
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">
                  Confía en los expertos
                </h2>
                <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
                  Cada médico en nuestra plataforma pasa por un riguroso proceso de verificación. 
                  Validamos su cédula profesional directamente con la SEP para garantizar que 
                  solo recibas atención de profesionales certificados.
                </p>
                <Link 
                  to="/doctors" 
                  className="inline-flex items-center text-[#00768b] font-semibold hover:underline text-sm sm:text-base"
                >
                  Explorar médicos →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">Cuida tu salud hoy</h2>
          <p className="text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            Regístrate gratis y accede a contenido educativo, lives y consultas con los mejores especialistas.
          </p>
          <Link 
            to="/app" 
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            Crear mi Cuenta Gratis
          </Link>
        </div>
      </section>

      </MainLayout>
  );
}
