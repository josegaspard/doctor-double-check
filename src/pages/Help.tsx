import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, MessageCircle, Mail, Phone, Book, Video, FileText, ChevronRight } from 'lucide-react';
import logoWhite from '@/assets/logo-medical-masters-white.png';
import logoBlue from '@/assets/logo-medical-masters.png';

const faqItems = [
  {
    question: '¿Cómo inicio una consulta con un médico?',
    answer: 'Navega a la sección de médicos, selecciona el especialista de tu preferencia y haz clic en "Iniciar Consulta". Serás guiado al proceso de pago y luego podrás chatear directamente.',
  },
  {
    question: '¿Es segura mi información médica?',
    answer: 'Absolutamente. Utilizamos encriptación de grado militar y cumplimos con todas las normativas de protección de datos de salud (HIPAA, GDPR).',
  },
  {
    question: '¿Cómo funciona el sistema de segunda opinión?',
    answer: 'Puedes solicitar una segunda opinión sobre tu diagnóstico. Un especialista revisará tu caso y te proporcionará su evaluación profesional.',
  },
  {
    question: '¿Puedo cancelar mi suscripción?',
    answer: 'Sí, puedes cancelar en cualquier momento desde la configuración de tu cuenta. Tu acceso continuará hasta el final del período de facturación.',
  },
];

const resources = [
  { icon: Book, title: 'Guías de Usuario', description: 'Aprende a usar todas las funciones', link: '#' },
  { icon: Video, title: 'Video Tutoriales', description: 'Tutoriales paso a paso', link: '#' },
  { icon: FileText, title: 'Documentación', description: 'Información técnica detallada', link: '#' },
];

export default function Help() {
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
              <HelpCircle className="w-4 h-4 text-[#aed3d9]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#aed3d9]">Centro de Ayuda</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              ¿Cómo podemos <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aed3d9] to-white">ayudarte?</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
              Encuentra respuestas a tus preguntas o contacta a nuestro equipo de soporte.
            </p>
          </div>
        </div>
      </header>

      {/* Contact Options */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            <Link to="/contact" className="flex items-center gap-4 p-4 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-12 h-12 rounded-full bg-[#163a83]/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-[#163a83]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800">Chat en Vivo</h3>
                <p className="text-sm text-gray-500">Respuesta inmediata</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#163a83] transition-colors" />
            </Link>
            
            <a href="mailto:soporte@medicalplatform.com" className="flex items-center gap-4 p-4 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-12 h-12 rounded-full bg-[#00768b]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-[#00768b]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800">Email</h3>
                <p className="text-sm text-gray-500 truncate">soporte@medicalplatform.com</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#00768b] transition-colors" />
            </a>
            
            <a href="tel:+525551234567" className="flex items-center gap-4 p-4 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-12 h-12 rounded-full bg-[#163a83]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-[#163a83]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800">Teléfono</h3>
                <p className="text-sm text-gray-500">+52 55 5123 4567</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#163a83] transition-colors" />
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-8 sm:mb-12">
            Preguntas Frecuentes
          </h2>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {faqItems.map((item, index) => (
              <details 
                key={index}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
              >
                <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer list-none">
                  <span className="font-semibold text-gray-800 pr-4">{item.question}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0" />
                </summary>
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-gray-600">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16 sm:py-24 bg-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-8 sm:mb-12">
            Recursos
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {resources.map((resource, index) => (
              <a 
                key={index}
                href={resource.link}
                className="bg-white p-6 rounded-xl text-center hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mx-auto mb-4">
                  <resource.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{resource.title}</h3>
                <p className="text-sm text-gray-500">{resource.description}</p>
              </a>
            ))}
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
