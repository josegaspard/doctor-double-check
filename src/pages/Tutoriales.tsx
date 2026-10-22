import { useState } from 'react';
import { GraduationCap, Clapperboard, User, Stethoscope, Check, PlayCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVideos } from '@/hooks/useSiteVideos';

// Sección de TUTORIALES por tipo de usuario (cliente 21-oct-2026): vídeos de ayuda
// a la mano, en una página propia, con diseño de marca. Cada vídeo sale de
// site_settings.videos.tutorial_<rol> (editable por el admin); si aún no hay vídeo,
// se muestra el aviso "muy pronto".

type TutorialRole = 'patient' | 'doctor' | 'resident';

const STATIC_FALLBACK: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

const TABS: { role: TutorialRole; label: string; icon: React.ElementType; chip: string; desc: string; points: string[] }[] = [
  {
    role: 'patient', label: 'Pacientes', icon: User, chip: 'Para pacientes',
    desc: 'Encuentra a tu médico, pide una orientación y lleva tu salud en un solo lugar.',
    points: [
      'Encuentra médicos certificados y pide una orientación',
      'Chatea con tu médico y recibe seguimiento',
      'Consulta y guarda tu expediente clínico',
      'Accede a lives y contenido de salud',
    ],
  },
  {
    role: 'doctor', label: 'Médicos', icon: Stethoscope, chip: 'Para médicos',
    desc: 'Comparte tu conocimiento, atiende a tus pacientes y haz crecer tu práctica.',
    points: [
      'Transmite en vivo o agenda tus sesiones',
      'Sube y gestiona tu contenido y grabaciones',
      'Lleva tu agenda y a tus pacientes',
      'Conéctate por chat con pacientes y colegas',
      'Monetiza y amplía el alcance de tu conocimiento',
    ],
  },
  {
    role: 'resident', label: 'Residentes', icon: GraduationCap, chip: 'Para residentes',
    desc: 'Aprende, explora casos clínicos y crece dentro de la comunidad médica.',
    points: [
      'Accede a contenido educativo premium',
      'Explora casos clínicos y masterclasses',
      'Únete a la comunidad y a las sesiones clínicas',
      'Lleva tu calendario y desarrollo profesional',
    ],
  },
];

function TutorialPlayer({ role }: { role: TutorialRole }) {
  const { videos } = useSiteVideos();
  const [unavailable, setUnavailable] = useState(false);
  const src = videos[`tutorial_${role}` as const] || STATIC_FALLBACK[role];

  if (unavailable) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
          <Clapperboard className="w-8 h-8 text-white/90" />
        </div>
        <p className="text-lg font-bold text-white">Muy pronto</p>
        <p className="text-sm text-white/70 mt-1 max-w-sm">Estamos preparando este tutorial. Vuelve en unos días.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
      <video
        key={src}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video object-contain bg-black"
        src={src}
        onError={() => setUnavailable(true)}
      />
    </div>
  );
}

export default function Tutoriales() {
  const { role } = useAuth();
  const initial: TutorialRole = (['patient', 'doctor', 'resident'] as string[]).includes(role || '')
    ? (role as TutorialRole) : 'patient';
  const [active, setActive] = useState<TutorialRole>(initial);
  const current = TABS.find(tb => tb.role === active)!;

  return (
    <MainLayout>
      {/* Hero */}
      <header className="relative pt-20 sm:pt-28 pb-10 sm:pb-14 overflow-hidden bg-gradient-to-br from-[#0f2d52] via-[#16436a] to-[#00768b]">
        <div aria-hidden className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#2fb6c9]/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[#163a83]/30 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4">
            <GraduationCap className="w-4 h-4 text-white" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Tutoriales</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Aprende a usar Medical Masters
          </h1>
          <p className="text-sm sm:text-lg text-white/80 max-w-xl mx-auto mt-4">
            Vídeos cortos según tu perfil. Elige el tuyo y empieza en minutos.
          </p>
        </div>
      </header>

      {/* Contenido */}
      <section className="relative -mt-6 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 max-w-5xl">
          {/* Selector de perfil */}
          <div className="flex flex-wrap justify-center gap-2 mb-8" role="tablist" aria-label="Tipo de usuario">
            {TABS.map(tb => {
              const Icon = tb.icon; const selected = tb.role === active;
              return (
                <button
                  key={tb.role} type="button" role="tab" aria-selected={selected}
                  onClick={() => setActive(tb.role)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold min-h-[44px] transition-all ${
                    selected
                      ? 'bg-white text-[#0f2d52] shadow-lg shadow-black/20'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tb.label}
                </button>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-5 lg:gap-6 items-start">
            {/* Reproductor */}
            <div>
              <TutorialPlayer role={active} />
            </div>

            {/* Tarjeta de lo que aprenderás */}
            <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-3 py-1">
                <current.icon className="w-3.5 h-3.5" /> {current.chip}
              </span>
              <h2 className="font-heading text-lg font-bold text-foreground mt-3">Lo que aprenderás</h2>
              <p className="text-sm text-muted-foreground mt-1">{current.desc}</p>
              <ul className="mt-4 space-y-2.5">
                {current.points.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground/90">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4">
                <PlayCircle className="w-4 h-4 text-primary" />
                Tutorial en vídeo · {current.label}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
