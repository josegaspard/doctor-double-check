import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MessageSquare,
  Video,
  Users,
  Calendar,
  Megaphone,
  Radio,
  Stethoscope,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';

interface ForoCard {
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  icon: React.ElementType;
  to: string;
  tone: 'doctor' | 'resident' | 'event' | 'live';
}

const cards: ForoCard[] = [
  {
    titleKey: 'foroPage.cards.residentMentoring.title',
    descriptionKey: 'foroPage.cards.residentMentoring.description',
    ctaKey: 'foroPage.cards.residentMentoring.cta',
    icon: GraduationCap,
    to: '/meetings?type=resident_class',
    tone: 'resident',
  },
  {
    titleKey: 'foroPage.cards.doctorToDoctor.title',
    descriptionKey: 'foroPage.cards.doctorToDoctor.description',
    ctaKey: 'foroPage.cards.doctorToDoctor.cta',
    icon: Stethoscope,
    to: '/meetings?type=case_discussion',
    tone: 'doctor',
  },
  {
    titleKey: 'foroPage.cards.events.title',
    descriptionKey: 'foroPage.cards.events.description',
    ctaKey: 'foroPage.cards.events.cta',
    icon: Megaphone,
    to: '/news',
    tone: 'event',
  },
  {
    titleKey: 'foroPage.cards.clinicalLives.title',
    descriptionKey: 'foroPage.cards.clinicalLives.description',
    ctaKey: 'foroPage.cards.clinicalLives.cta',
    icon: Radio,
    to: '/lives',
    tone: 'live',
  },
  {
    titleKey: 'foroPage.cards.openZooms.title',
    descriptionKey: 'foroPage.cards.openZooms.description',
    ctaKey: 'foroPage.cards.openZooms.cta',
    icon: Video,
    to: '/meetings?visibility=public',
    tone: 'doctor',
  },
  {
    titleKey: 'foroPage.cards.residentNetwork.title',
    descriptionKey: 'foroPage.cards.residentNetwork.description',
    ctaKey: 'foroPage.cards.residentNetwork.cta',
    icon: Users,
    to: '/doctors?role=resident',
    tone: 'resident',
  },
];

const TONE_CLASSES: Record<ForoCard['tone'], string> = {
  doctor:   'from-[#163a83]/15 to-[#00768b]/10 text-[#163a83]',
  resident: 'from-emerald-500/15 to-emerald-700/10 text-emerald-700',
  event:    'from-amber-500/15 to-amber-700/10 text-amber-700',
  live:     'from-rose-500/15 to-rose-700/10 text-rose-700',
};

export default function Foro() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl">
        <header className="mb-6 sm:mb-10 text-center sm:text-left rounded-2xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#163a83]/12 text-[#163a83] dark:bg-cyan-400/15 dark:text-cyan-200 text-xs font-semibold mb-3">
            <MessageSquare className="w-3.5 h-3.5" /> {t('foroPage.badge')}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('foroPage.heroTitle')}
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 mt-2 max-w-2xl">
            {t('foroPage.heroSubtitle')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button onClick={() => navigate('/meetings?new=1')} className="gap-1.5">
              <Calendar className="w-4 h-4" /> {t('foroPage.createMeeting')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/lives?new=1')} className="gap-1.5 bg-white/90 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20">
              <Radio className="w-4 h-4" /> {t('foroPage.startLive')}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.titleKey} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${TONE_CLASSES[c.tone]}`} />
                <CardHeader className="pb-2">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TONE_CLASSES[c.tone]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base mt-2">{t(c.titleKey)}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{t(c.descriptionKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="px-0 gap-1" onClick={() => navigate(c.to)}>
                    {t(c.ctaKey)} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 p-4 sm:p-6 rounded-xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg">
          <p className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">{t('foroPage.comingSoonTitle')}</p>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {t('foroPage.comingSoonBody')}
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
