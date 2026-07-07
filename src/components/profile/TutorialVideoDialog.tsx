import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { GraduationCap, Clapperboard } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteVideos } from '@/hooks/useSiteVideos';

type TutorialRole = 'patient' | 'doctor' | 'resident';

/**
 * Video de tutorial por rol, mostrado en un modal desde el menú del usuario
 * (debajo de "Configuración"). La URL se edita desde el súper admin
 * (site_settings.videos.tutorial_<rol>). Si no hay video configurado, cae al
 * asset estático de public/tutoriales/; y si tampoco existe, el <video> falla
 * y mostramos el aviso "muy pronto".
 */
const STATIC_FALLBACK: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

interface TutorialVideoDialogProps {
  role: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialVideoDialog({ role, open, onOpenChange }: TutorialVideoDialogProps) {
  const { t } = useLanguage();
  const { videos } = useSiteVideos();
  // Si el archivo aún no existe, el server (SPA rewrite de Vercel) devuelve el
  // index.html en vez del .mp4 → el <video> no puede decodificarlo y dispara
  // onError. En ese caso mostramos el aviso "muy pronto" en lugar del video.
  const [unavailable, setUnavailable] = useState(false);

  if (!(['doctor', 'patient', 'resident'] as string[]).includes(role)) return null;
  const r = role as TutorialRole;

  const configured = videos[`tutorial_${r}` as const];
  const src = configured || STATIC_FALLBACK[r];

  const subtitleKey = `profileTutorial.subtitle.${role}`;
  const subtitle = t(subtitleKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl p-4 sm:p-6 gap-3 sm:gap-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-[#163a83] text-base sm:text-lg">
            <GraduationCap className="w-5 h-5 flex-shrink-0" />
            <span className="min-w-0">{t('profileTutorial.title')}</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {subtitle === subtitleKey ? t('profileTutorial.subtitle.default') : subtitle}
          </DialogDescription>
        </DialogHeader>

        {unavailable ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-dashed border-[#227787]/40 bg-gradient-to-br from-[#227787]/5 to-[#163a83]/5 flex flex-col items-center justify-center text-center px-4 sm:px-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#227787]/10 flex items-center justify-center mb-3 sm:mb-4">
              <Clapperboard className="w-6 h-6 sm:w-7 sm:h-7 text-[#227787]" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#163a83]">
              {t('profileTutorial.comingSoonTitle')}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm">
              {t('profileTutorial.comingSoonDesc')}
            </p>
          </div>
        ) : (
          <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-black">
            <video
              key={src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="w-full aspect-video object-contain"
              src={src}
              onError={() => setUnavailable(true)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
