import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type TutorialRole = 'patient' | 'doctor' | 'resident';

/**
 * Mapa rol → video de tutorial (archivos en public/tutoriales/).
 * Cuando el cliente entregue cada video, basta subirlo con este nombre a
 * public/tutoriales/ y desplegar: la tarjeta aparece automáticamente.
 * Si el archivo no existe (404) la tarjeta se oculta sola (onError).
 */
const TUTORIAL_VIDEOS: Record<TutorialRole, string> = {
  doctor: '/tutoriales/tutorial-doctores.mp4',
  patient: '/tutoriales/tutorial-pacientes.mp4',
  resident: '/tutoriales/tutorial-residentes.mp4',
};

interface ProfileTutorialCardProps {
  role: string;
}

export function ProfileTutorialCard({ role }: ProfileTutorialCardProps) {
  const { t } = useLanguage();
  const [hidden, setHidden] = useState(false);

  const src = TUTORIAL_VIDEOS[role as TutorialRole];
  if (!src || hidden) return null;

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
          <div className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-black">
            <video
              controls
              playsInline
              preload="metadata"
              className="w-full aspect-video object-cover"
              src={src}
              onError={() => setHidden(true)}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
