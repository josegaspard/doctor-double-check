import { Link } from 'react-router-dom';
import { HelpCircle, MessageCircle, Mail, ChevronRight } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Help() {
  const { t } = useLanguage();

  const faqItems = [
    { question: t('help.faq1_q'), answer: t('help.faq1_a') },
    { question: t('help.faq2_q'), answer: t('help.faq2_a') },
    { question: t('help.faq3_q'), answer: t('help.faq3_a') },
    { question: t('help.faq4_q'), answer: t('help.faq4_a') },
  ];

  return (
    <MainLayout>
      {/* Hero */}
      <header className="relative pt-20 sm:pt-28 pb-12 sm:pb-20 bg-gradient-to-br from-secondary via-primary to-secondary overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-light/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('help.center')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('help.title')}
            </h1>
            <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto px-4">
              {t('help.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Contact Options */}
      <section className="py-8 sm:py-12 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
            <Link to="/contact" className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-primary/5 border border-primary/15 rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-colors group">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('help.liveChat')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('help.immediateResponse')}</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary/60 group-hover:text-primary transition-colors" />
            </Link>

            <a href="mailto:soporte@medical-masters.com" className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-secondary/5 border border-secondary/15 rounded-xl hover:bg-secondary/10 hover:border-secondary/30 transition-colors group">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/25 transition-colors">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('help.email')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">soporte@medical-masters.com</p>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-secondary/60 group-hover:text-secondary transition-colors" />
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12">
            {t('help.faq')}
          </h2>

          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            {faqItems.map((item, index) => (
              <details
                key={index}
                className="group bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:border-primary/30 transition-colors"
              >
                <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none">
                  <span className="font-semibold text-foreground pr-4 text-sm sm:text-base">{item.question}</span>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary transition-transform group-open:rotate-90 flex-shrink-0" />
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-muted-foreground text-sm leading-relaxed">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
