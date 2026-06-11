import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft, MessageSquare, FileText, Video, Wrench, ShoppingBag, Radio, Calendar, Folder, PlayCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type FeatureKey = 'chat' | 'prescriptions' | 'videoCalls' | 'marketplace' | 'lives' | 'events' | 'vault' | 'recordings';

const ICONS: Record<FeatureKey, React.ElementType> = {
  chat: MessageSquare,
  prescriptions: FileText,
  videoCalls: Video,
  marketplace: ShoppingBag,
  lives: Radio,
  events: Calendar,
  vault: Folder,
  recordings: PlayCircle,
};

// Fallback en español por si la clave i18n no existe en algún idioma.
const FALLBACK: Record<FeatureKey, { title: string; description: string }> = {
  chat: {
    title: 'Chat temporalmente no disponible',
    description:
      'El chat entre médico y paciente está en mantenimiento. Lo reactivaremos muy pronto. Gracias por tu paciencia.',
  },
  prescriptions: {
    title: 'Recetas temporalmente no disponibles',
    description:
      'La emisión y consulta de recetas está en mantenimiento. Estará disponible de nuevo muy pronto.',
  },
  videoCalls: {
    title: 'Videollamadas temporalmente no disponibles',
    description:
      'Las videollamadas con pacientes están en mantenimiento. Las reactivaremos muy pronto.',
  },
  marketplace: {
    title: 'Tienda temporalmente no disponible',
    description:
      'La tienda de insumos médicos está en mantenimiento. Estará disponible de nuevo muy pronto.',
  },
  lives: {
    title: 'Transmisiones temporalmente no disponibles',
    description:
      'Las transmisiones en vivo están en mantenimiento. Las reactivaremos muy pronto.',
  },
  events: {
    title: 'Eventos temporalmente no disponibles',
    description:
      'La sección de eventos está en mantenimiento. Estará disponible de nuevo muy pronto.',
  },
  vault: {
    title: 'Expediente temporalmente no disponible',
    description:
      'El expediente clínico está en mantenimiento. Estará disponible de nuevo muy pronto.',
  },
  recordings: {
    title: 'Grabaciones temporalmente no disponibles',
    description:
      'La sección de grabaciones está en mantenimiento. Estará disponible de nuevo muy pronto.',
  },
};

export default function FeatureUnavailable({ feature }: { feature: FeatureKey }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const Icon = ICONS[feature] || Wrench;

  // Usa i18n si existe la clave; si no, cae al texto en español.
  const tk = (suffix: string, fb: string) => {
    const key = `featureUnavailable.${feature}.${suffix}`;
    const val = t(key);
    return val === key ? fb : val;
  };
  const title = tk('title', FALLBACK[feature].title);
  const description = tk('description', FALLBACK[feature].description);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-9 h-9 text-primary" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                {description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('common.back') === 'common.back' ? 'Volver' : t('common.back')}
              </Button>
              <Button asChild>
                <Link to="/help">
                  {t('accessDeniedPage.actions.contactSupport') === 'accessDeniedPage.actions.contactSupport'
                    ? 'Contactar soporte'
                    : t('accessDeniedPage.actions.contactSupport')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
