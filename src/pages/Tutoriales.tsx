import { useState } from 'react';
import { GraduationCap, Clapperboard, User, Stethoscope } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVideos } from '@/hooks/useSiteVideos';

// Sección de TUTORIALES por tipo de usuario (cliente 21-oct-2026): los vídeos de
// ayuda a la mano, en una página propia, no escondidos en un modal del menú. Cada
// vídeo sale del mismo sitio que el modal de tutorial (site_settings.videos.
// tutorial_<rol>, editable por el súper admin); si aún no hay vídeo subido, se
// muestra el aviso "muy pronto" y el cliente sube el suyo desde el panel.

type TutorialRole = 'patient' | 'doctor' | 'resident';

const STATIC_FALLBACK: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

const TABS: { role: TutorialRole; label: string; icon: React.ElementType; desc: string }[] = [
  {
    role: 'patient',
    label: 'Pacientes',
    icon: User,
    desc: 'Cómo encontrar a tu médico, pedir una orientación, usar el chat y guardar tu expediente.',
  },
  {
    role: 'doctor',
    label: 'Médicos',
    icon: Stethoscope,
    desc: 'Cómo transmitir en vivo, subir contenido, llevar tu agenda y cobrar tus consultas.',
  },
  {
    role: 'resident',
    label: 'Residentes',
    icon: GraduationCap,
    desc: 'Cómo acceder a la comunidad, al contenido educativo y a las sesiones clínicas.',
  },
];

function TutorialVideo({ role }: { role: TutorialRole }) {
  const { videos } = useSiteVideos();
  const [unavailable, setUnavailable] = useState(false);
  const src = videos[`tutorial_${role}` as const] || STATIC_FALLBACK[role];

  if (unavailable) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Clapperboard className="w-7 h-7 text-primary" />
        </div>
        <p className="text-base font-semibold text-foreground">Muy pronto</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Estamos preparando este tutorial. Vuelve en unos días.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-border bg-black">
      <video
        key={src}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video object-contain"
        src={src}
        onError={() => setUnavailable(true)}
      />
    </div>
  );
}

export default function Tutoriales() {
  const { role } = useAuth();
  const initial: TutorialRole = (['patient', 'doctor', 'resident'] as string[]).includes(role || '')
    ? (role as TutorialRole)
    : 'patient';
  const [active, setActive] = useState<TutorialRole>(initial);
  const current = TABS.find(tb => tb.role === active)!;

  return (
    <MainLayout>
      <header className="relative pt-20 sm:pt-28 pb-10 sm:pb-16 bg-gradient-to-br from-secondary via-primary to-secondary overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-light/20 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/20 backdrop-blur-sm mb-4">
            <GraduationCap className="w-4 h-4 text-light" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">Tutoriales</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Aprende a usar Medical Masters
          </h1>
          <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto">
            Tutoriales en vídeo según tu perfil. Elige el tuyo y empieza.
          </p>
        </div>
      </header>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 max-w-3xl">
          {/* Selector por tipo de usuario */}
          <div className="flex flex-wrap gap-2 justify-center mb-6" role="tablist" aria-label="Tipo de usuario">
            {TABS.map(tb => {
              const Icon = tb.icon;
              const selected = tb.role === active;
              return (
                <button
                  key={tb.role}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(tb.role)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium min-h-[44px] transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground/80 hover:bg-muted/70'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tb.label}
                </button>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground text-center mb-5 max-w-xl mx-auto">{current.desc}</p>

          <TutorialVideo role={active} />
        </div>
      </section>
    </MainLayout>
  );
}
