import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, Clapperboard } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteVideos } from '@/hooks/useSiteVideos';

type TutorialRole = 'patient' | 'doctor' | 'resident';

/**
 * Video de tutorial por rol. La URL se edita desde el súper admin
 * (site_settings.videos.tutorial_<rol>). Si no hay video configurado, cae al
 * asset estático de public/tutoriales/; y si tampoco existe, el <video> falla
 * y mostramos el aviso "muy pronto".
 */
const STATIC_FALLBACK: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

interface ProfileTutorialCardProps {
  role: string;
}

export function ProfileTutorialCard({ role }: ProfileTutorialCardProps) {
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="mb-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#163a83]">
            <GraduationCap className="w-5 h-5" />
            {t('profileTutorial.title')}
          </CardTitle>
          <CardDescription>
            {subtitle === subtitleKey ? t('profileTutorial.subtitle.default') : subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unavailable ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-dashed border-[#227787]/40 bg-gradient-to-br from-[#227787]/5 to-[#163a83]/5 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-full bg-[#227787]/10 flex items-center justify-center mb-4">
                <Clapperboard className="w-7 h-7 text-[#227787]" />
              </div>
              <p className="text-base font-semibold text-[#163a83]">
                {t('profileTutorial.comingSoonTitle')}
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                {t('profileTutorial.comingSoonDesc')}
              </p>
            </div>
          ) : (
            <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-black">
              <video
                key={src}
                controls
                playsInline
                preload="metadata"
                className="w-full aspect-video object-cover"
                src={src}
                onError={() => setUnavailable(true)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
