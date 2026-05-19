import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  title: string;
  description: string;
  icon: React.ElementType;
  cta: string;
  to: string;
  tone: 'doctor' | 'resident' | 'event' | 'live';
}

const cards: ForoCard[] = [
  {
    title: 'Videoconferencia médico ↔ residente',
    description: 'Sesiones 1:1 entre un médico y un residente para mentoría, revisión de caso o tutoría clínica.',
    icon: GraduationCap,
    cta: 'Iniciar sesión de mentoría',
    to: '/meetings?type=resident_class',
    tone: 'resident',
  },
  {
    title: 'Videoconferencia médico ↔ médico',
    description: 'Reuniones entre colegas para discusión de casos, segundas opiniones y juntas de especialidad.',
    icon: Stethoscope,
    cta: 'Crear reunión de caso',
    to: '/meetings?type=case_discussion',
    tone: 'doctor',
  },
  {
    title: 'Eventos y convocatorias',
    description: 'Calendario de congresos, simposios, fellowships y convocatorias abiertas para la red.',
    icon: Megaphone,
    cta: 'Ver eventos activos',
    to: '/news',
    tone: 'event',
  },
  {
    title: 'Lives clínicos',
    description: 'Transmisiones en vivo de cirugías, casos quirúrgicos, conferencias y talleres en directo.',
    icon: Radio,
    cta: 'Ver lives ahora',
    to: '/lives',
    tone: 'live',
  },
  {
    title: 'Zooms abiertos',
    description: 'Reuniones públicas de la red — cualquier médico verificado puede unirse desde la lista pública.',
    icon: Video,
    cta: 'Explorar zooms públicos',
    to: '/meetings?visibility=public',
    tone: 'doctor',
  },
  {
    title: 'Red de residentes',
    description: 'Conoce mentores, encuentra colegas y comparte hallazgos con otros residentes verificados.',
    icon: Users,
    cta: 'Entrar a la red',
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
  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl">
        <header className="mb-6 sm:mb-10 text-center sm:text-left rounded-2xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#163a83]/12 text-[#163a83] dark:bg-cyan-400/15 dark:text-cyan-200 text-xs font-semibold mb-3">
            <MessageSquare className="w-3.5 h-3.5" /> Foro Medical Masters
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            La sala común de la red médica
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 mt-2 max-w-2xl">
            Videoconferencias médico-residente y médico-médico, eventos, convocatorias, lives y zooms
            — todo en un mismo lugar para la comunidad verificada de Medical Masters.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button onClick={() => navigate('/meetings?new=1')} className="gap-1.5">
              <Calendar className="w-4 h-4" /> Crear reunión
            </Button>
            <Button variant="outline" onClick={() => navigate('/lives?new=1')} className="gap-1.5 bg-white/90 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20">
              <Radio className="w-4 h-4" /> Iniciar live
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${TONE_CLASSES[c.tone]}`} />
                <CardHeader className="pb-2">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${TONE_CLASSES[c.tone]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{c.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="px-0 gap-1" onClick={() => navigate(c.to)}>
                    {c.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 p-4 sm:p-6 rounded-xl bg-white/95 dark:bg-slate-900/85 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/70 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg">
          <p className="text-sm font-semibold mb-1 text-slate-900 dark:text-white">Próximamente en el Foro</p>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            Hilos de discusión asincrónica por especialidad, biblioteca de presentaciones, tablero de
            convocatorias internacionales y agenda compartida con tus colegas.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
