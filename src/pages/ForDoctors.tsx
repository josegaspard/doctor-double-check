import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, DollarSign, Calendar, Video, MessageSquare, Users, GraduationCap, Shield, CheckCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

const benefits = [
  {
    icon: DollarSign,
    title: 'Monetiza tu práctica',
    description: 'Genera ingresos adicionales ofreciendo orientación médica, segundas opiniones y contenido educativo premium.',
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
    icon: GraduationCap,
    title: 'Cursos y Congresos',
    description: 'Accede a Medical Masters para cursos, congresos y educación médica continua.',
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
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">Para Médicos</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Únete a la <span className="text-white">red global de médicos VIP</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto mb-6 sm:mb-8 px-4">
              Únete a la plataforma líder de telemedicina y conecta con pacientes de todo el país mientras generas ingresos adicionales.
            </p>
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Registrarme como Médico
            </Link>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-12 sm:py-24 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-3 sm:mb-4">
            ¿Por qué unirte?
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-6 sm:mb-12 text-sm sm:text-base">
            Descubre las ventajas de ser parte de nuestra comunidad de profesionales de la salud.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-secondary/15 via-primary/10 to-secondary/20 flex items-center justify-center mb-3 sm:mb-4 ring-1 ring-secondary/10">
                  <div className="absolute inset-0 rounded-xl bg-secondary/20 blur-xl opacity-40" />
                  <benefit.icon className="relative w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-12 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 items-center">
              <div>
                <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
                  Todo lo que necesitas para crecer
                </h2>
                <ul className="space-y-3 sm:space-y-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />
                      </div>
                      <span className="text-foreground text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-secondary to-primary p-5 sm:p-8 rounded-xl sm:rounded-2xl text-white shadow-lg">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-light" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-white">100% Verificado</h3>
                <p className="text-white/85 text-xs sm:text-sm mb-4 sm:mb-6">
                  Todos los médicos en nuestra plataforma son verificados a través de sus credenciales profesionales oficiales, garantizando confianza para los pacientes.
                </p>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-light">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Verificación automática en minutos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-secondary to-primary">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">¿Listo para comenzar?</h2>
          <p className="text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            Regístrate hoy y comienza a ofrecer tus servicios a miles de pacientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link 
              to="/app" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-secondary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Crear mi Cuenta
            </Link>
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-white/15 backdrop-blur-sm border-2 border-white/60 rounded-xl hover:bg-white/25 hover:border-white shadow-md transition-all"
            >
              Hablar con Ventas
            </Link>
          </div>
        </div>
      </section>

      </MainLayout>
  );
}
