import { Link } from 'react-router-dom';
import { Star, Users, TrendingUp, Award, Quote } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SuccessStories() {
  const { t } = useLanguage();

  const stories = [
    {
      name: t('successStoriesPage.stories.0.name'),
      specialty: t('successStoriesPage.stories.0.specialty'),
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop',
      quote: t('successStoriesPage.stories.0.quote'),
      stats: { patients: 500, rating: 4.9, consultations: 1200 },
    },
    {
      name: t('successStoriesPage.stories.1.name'),
      specialty: t('successStoriesPage.stories.1.specialty'),
      image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop',
      quote: t('successStoriesPage.stories.1.quote'),
      stats: { patients: 350, rating: 4.8, consultations: 890 },
    },
    {
      name: t('successStoriesPage.stories.2.name'),
      specialty: t('successStoriesPage.stories.2.specialty'),
      image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=150&h=150&fit=crop',
      quote: t('successStoriesPage.stories.2.quote'),
      stats: { patients: 420, rating: 5.0, consultations: 1050 },
    },
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
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('successStoriesPage.hero.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('successStoriesPage.hero.titlePart1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-light to-white">{t('successStoriesPage.hero.titlePart2')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto px-4">
              {t('successStoriesPage.hero.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="py-8 sm:py-12 bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-primary">5,000+</p>
              <p className="text-xs sm:text-sm text-foreground/70 font-medium mt-1">{t('successStoriesPage.stats.activeDoctors')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-secondary">15M+</p>
              <p className="text-xs sm:text-sm text-foreground/70 font-medium mt-1">{t('successStoriesPage.stats.patientsServed')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-primary">98%</p>
              <p className="text-xs sm:text-sm text-foreground/70 font-medium mt-1">{t('successStoriesPage.stats.satisfaction')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-5xl font-extrabold text-secondary">24/7</p>
              <p className="text-xs sm:text-sm text-foreground/70 font-medium mt-1">{t('successStoriesPage.stats.availability')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid gap-6 sm:gap-10 max-w-5xl mx-auto">
            {stories.map((story, index) => (
              <div
                key={index}
                className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-5 sm:gap-10 items-center bg-card rounded-2xl p-5 sm:p-10 shadow-md border border-border`}
              >
                <div className="w-full md:w-1/3 flex flex-col items-center">
                  <div className="relative">
                    <div aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-secondary blur-md opacity-60" />
                    <img
                      src={story.image}
                      alt={story.name}
                      className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-card shadow-lg"
                    />
                  </div>
                  <h3 className="mt-3 sm:mt-4 text-base sm:text-xl font-bold text-foreground text-center">{story.name}</h3>
                  <p className="text-xs sm:text-sm text-primary font-medium">{story.specialty}</p>

                  <div className="flex items-center gap-0.5 sm:gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent fill-accent" />
                    ))}
                    <span className="text-xs sm:text-sm font-bold text-foreground ml-1">{story.stats.rating}</span>
                  </div>
                </div>

                <div className="w-full md:w-2/3">
                  <Quote className="w-7 h-7 sm:w-10 sm:h-10 text-light mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-lg text-foreground italic leading-relaxed mb-4 sm:mb-6">
                    "{story.quote}"
                  </p>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 sm:p-4 text-center">
                      <Users className="w-5 h-5 text-primary mx-auto mb-1.5" />
                      <p className="text-base sm:text-xl font-bold text-foreground">{story.stats.patients}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('successStoriesPage.storyCard.patients')}</p>
                    </div>
                    <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-3 sm:p-4 text-center">
                      <TrendingUp className="w-5 h-5 text-secondary mx-auto mb-1.5" />
                      <p className="text-base sm:text-xl font-bold text-foreground">{story.stats.consultations}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('successStoriesPage.storyCard.consultations')}</p>
                    </div>
                    <div className="bg-accent/10 border border-accent/25 rounded-xl p-3 sm:p-4 text-center">
                      <Star className="w-5 h-5 text-accent fill-accent mx-auto mb-1.5" />
                      <p className="text-base sm:text-xl font-bold text-foreground">{story.stats.rating}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('successStoriesPage.storyCard.rating')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 bg-gradient-to-br from-secondary to-primary">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('successStoriesPage.cta.title')}</h2>
          <p className="text-light/90 mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {t('successStoriesPage.cta.subtitle')}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-primary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {t('successStoriesPage.cta.button')}
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
