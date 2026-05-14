import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, MessageCircle, Mail, Phone, Book, Video, FileText, ChevronRight } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

// FAQ items moved to i18n
// Resources moved to i18n


import { useLanguage } from '@/contexts/LanguageContext';

export default function Help() {
  const { t } = useLanguage();

  const faqItems = [
    {
      question: t('help.faq1_q'),
      answer: t('help.faq1_a'),
    },
    {
      question: t('help.faq2_q'),
      answer: t('help.faq2_a'),
    },
    {
      question: t('help.faq3_q'),
      answer: t('help.faq3_a'),
    },
    {
      question: t('help.faq4_q'),
      answer: t('help.faq4_a'),
    },
  ];

  const resources = [
    { icon: Book, title: t('help.userGuides'), description: t('help.learnFunctions'), link: '#' },
    { icon: Video, title: t('help.videoTutorials'), description: t('help.stepByStep'), link: '#' },
    { icon: FileText, title: t('help.documentation'), description: t('help.techInfo'), link: '#' },
  ];

  return (
    <MainLayout>

      {/* Hero */}
      <header className="relative pt-20 sm:pt-32 pb-12 sm:pb-24 bg-gradient-to-br from-[#163a83] via-[#00768b] to-[#163a83]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#aed3d9]" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#aed3d9]">{t('help.center')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('help.title')}
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 max-w-xl mx-auto px-4">
              {t('help.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Contact Options */}
      <section className="py-8 sm:py-12 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
            <Link to="/contact" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#163a83]/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#163a83]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{t('help.liveChat')}</h3>
                <p className="text-xs sm:text-sm text-gray-500">{t('help.immediateResponse')}</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#163a83] transition-colors" />
            </Link>
            
            <a href="mailto:soporte@medicalplatform.com" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#00768b]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#00768b]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{t('help.email')}</h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate">soporte@medical.com</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#00768b] transition-colors" />
            </a>
            
            <a href="tel:+525551234567" className="flex items-center gap-3 sm:gap-4 p-3 sm:p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#163a83]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-[#163a83]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{t('help.phone')}</h3>
                <p className="text-xs sm:text-sm text-gray-500">+52 55 5123 4567</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#163a83] transition-colors" />
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            {t('help.faq')}
          </h2>
          
          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            {faqItems.map((item, index) => (
              <details 
                key={index}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
              >
                <summary className="flex items-center justify-between p-3 sm:p-6 cursor-pointer list-none">
                  <span className="font-semibold text-gray-800 pr-4 text-sm sm:text-base">{item.question}</span>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0" />
                </summary>
                <div className="px-3 sm:px-6 pb-3 sm:pb-6 text-gray-600 text-sm">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-12 sm:py-24 bg-gray-100">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-gray-800 mb-6 sm:mb-12">
            {t('help.resources')}
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {resources.map((resource, index) => (
              <a 
                key={index}
                href={resource.link}
                className="bg-white p-4 sm:p-6 rounded-xl text-center hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#163a83] to-[#00768b] flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <resource.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">{resource.title}</h3>
                <p className="text-xs sm:text-sm text-gray-500">{resource.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      </MainLayout>
  );
}
