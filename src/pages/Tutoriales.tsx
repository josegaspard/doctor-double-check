import { useState } from 'react';
import { GraduationCap, Clapperboard, User, Stethoscope, Check } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVideos } from '@/hooks/useSiteVideos';
import { SectionTabs } from '@/components/common/SectionTabs';

// Sección de TUTORIALES por tipo de usuario (cliente 21-oct-2026). Usa el chrome
// NATIVO de la app (pro-page / pro-card / SectionTabs) para verse igual que el resto.
// El vídeo sale de site_settings.videos.tutorial_<rol>; si no hay, "muy pronto".

type TutorialRole = 'patient' | 'doctor' | 'resident';

const STATIC_FALLBACK: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

const TABS: { role: TutorialRole; label: string; icon: React.ElementType; chip: string; desc: string; points: string[] }[] = [
  { role: 'patient', label: 'Pacientes', icon: User, chip: 'Para pacientes',
    desc: 'Encuentra a tu médico, pide una orientación y lleva tu salud en un solo lugar.',
    points: ['Encuentra médicos certificados y pide una orientación','Chatea con tu médico y recibe seguimiento','Consulta y guarda tu expediente clínico','Accede a lives y contenido de salud'] },
  { role: 'doctor', label: 'Médicos', icon: Stethoscope, chip: 'Para médicos',
    desc: 'Comparte tu conocimiento, atiende a tus pacientes y haz crecer tu práctica.',
    points: ['Transmite en vivo o agenda tus sesiones','Sube y gestiona tu contenido y grabaciones','Lleva tu agenda y a tus pacientes','Conéctate por chat con pacientes y colegas','Monetiza y amplía el alcance de tu conocimiento'] },
  { role: 'resident', label: 'Residentes', icon: GraduationCap, chip: 'Para residentes',
    desc: 'Aprende, explora casos clínicos y crece dentro de la comunidad médica.',
    points: ['Accede a contenido educativo premium','Explora casos clínicos y masterclasses','Únete a la comunidad y a las sesiones clínicas','Lleva tu calendario y desarrollo profesional'] },
];

function TutorialPlayer({ role }: { role: TutorialRole }) {
  const { videos } = useSiteVideos();
  const [unavailable, setUnavailable] = useState(false);
  const src = videos[`tutorial_${role}` as const] || STATIC_FALLBACK[role];
  if (unavailable) {
    return (
      <section className="pro-card pro-card-pad bg-card text-center py-14">
        <span className="pro-icon-box mx-auto mb-3"><Clapperboard /></span>
        <p className="pro-ink font-semibold">Muy pronto</p>
        <p className="pro-muted text-sm mt-1">Estamos preparando este tutorial. Vuelve en unos días.</p>
      </section>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden bg-black ring-1 ring-black/20 shadow-sm">
      <video key={src} controls playsInline preload="metadata" className="w-full aspect-video bg-black object-contain"
        src={src} onError={() => setUnavailable(true)} />
    </div>
  );
}

export default function Tutoriales() {
  const { role } = useAuth();
  const initial: TutorialRole = (['patient', 'doctor', 'resident'] as string[]).includes(role || '')
    ? (role as TutorialRole) : 'patient';
  const [active, setActive] = useState<TutorialRole>(initial);
  const current = TABS.find(tb => tb.role === active)!;
  const tabItems = TABS.map(tb => ({ id: tb.role, label: tb.label, icon: tb.icon }));

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><GraduationCap className="w-7 h-7" /> <span className="truncate">Tutoriales</span></h1>
            <p className="pro-page-sub">Vídeos cortos según tu perfil. Elige el tuyo y empieza.</p>
          </div>
        </div>

        <SectionTabs value={active} onChange={setActive} items={tabItems} ariaLabel="Perfil" className="mb-4" />

        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          <TutorialPlayer role={active} />
          <aside className="pro-card pro-card-pad bg-card">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-3 py-1">
              <current.icon className="w-3.5 h-3.5" /> {current.chip}
            </span>
            <h2 className="pro-ink font-bold text-lg mt-3">Lo que aprenderás</h2>
            <p className="pro-muted text-sm mt-1">{current.desc}</p>
            <ul className="mt-4 space-y-2.5">
              {current.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm pro-ink">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
