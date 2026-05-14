import { Link } from 'react-router-dom';
import { ArrowLeft, Star, Users, TrendingUp, Award, Quote } from 'lucide-react';
import logoBlue from '@/assets/logo-medical-masters.png';
import { LandingFooter } from '@/components/landing/LandingFooter';

const stories = [
  {
    name: 'Dr. María González',
    specialty: 'Cardiología',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop',
    quote: 'Gracias a la plataforma, he podido ayudar a más de 500 pacientes con segundas opiniones de manera eficiente y segura.',
    stats: { patients: 500, rating: 4.9, consultations: 1200 },
  },
  {
    name: 'Dr. Carlos Mendoza',
    specialty: 'Neurología',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop',
    quote: 'La tecnología de Medical Masters me permite ofrecer atención de calidad sin importar la ubicación del paciente.',
    stats: { patients: 350, rating: 4.8, consultations: 890 },
  },
  {
    name: 'Dra. Ana López',
    specialty: 'Oncología',
    image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=150&h=150&fit=crop',
    quote: 'El sistema de expedientes digitales ha revolucionado la forma en que manejo los casos de mis pacientes.',
    stats: { patients: 420, rating: 5.0, consultations: 1050 },
  },
];

export default function SuccessStories() {
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
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Casos de Éxito</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Historias que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">Inspiran</span>
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto px-4">
              Conoce cómo médicos y pacientes están transformando la atención médica con nuestra plataforma.
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="py-8 sm:py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-[#163a83]">5,000+</p>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-1">Médicos activos</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-[#00768b]">15M+</p>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-1">Pacientes atendidos</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-[#163a83]">98%</p>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-1">Satisfacción</p>
            </div>
            <div className="text-center">
              <p className="text-xl sm:text-3xl font-bold text-[#00768b]">24/7</p>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-1">Disponibilidad</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid gap-6 sm:gap-12">
            {stories.map((story, index) => (
              <div 
                key={index}
                className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-4 sm:gap-12 items-center bg-white rounded-xl sm:rounded-2xl p-4 sm:p-10 shadow-lg border border-gray-100`}
              >
                <div className="w-full md:w-1/3 flex flex-col items-center">
                  <img 
                    src={story.image} 
                    alt={story.name}
                    className="w-20 h-20 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-[#aed3d9] shadow-lg"
                  />
                  <h3 className="mt-3 sm:mt-4 text-base sm:text-xl font-bold text-gray-800 text-center">{story.name}</h3>
                  <p className="text-xs sm:text-sm text-[#00768b] font-medium">{story.specialty}</p>
                  
                  <div className="flex items-center gap-0.5 sm:gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 sm:w-4 sm:h-4 text-warning fill-warning" />
                    ))}
                    <span className="text-xs sm:text-sm font-bold text-gray-600 ml-1">{story.stats.rating}</span>
                  </div>
                </div>
                
                <div className="w-full md:w-2/3">
                  <Quote className="w-6 h-6 sm:w-10 sm:h-10 text-[#aed3d9] mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-xl text-gray-700 italic leading-relaxed mb-4 sm:mb-6">
                    "{story.quote}"
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-4 text-center">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#163a83] mx-auto mb-1" />
                      <p className="text-sm sm:text-xl font-bold text-gray-800">{story.stats.patients}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Pacientes</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-4 text-center">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#00768b] mx-auto mb-1" />
                      <p className="text-sm sm:text-xl font-bold text-gray-800">{story.stats.consultations}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Consultas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-4 text-center">
                      <Star className="w-4 h-4 sm:w-5 sm:h-5 text-warning mx-auto mb-1" />
                      <p className="text-sm sm:text-xl font-bold text-gray-800">{story.stats.rating}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Rating</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-24 bg-gradient-to-br from-[#163a83] to-[#00768b]">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">¿Listo para ser parte del éxito?</h2>
          <p className="text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            Únete a miles de profesionales que ya están transformando la atención médica.
          </p>
          <Link 
            to="/app" 
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-[#163a83] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            Comenzar Ahora
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
