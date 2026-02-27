import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Upload, UserCircle, Newspaper, MessageSquare } from 'lucide-react';

interface Props {
  isApproved: boolean;
  userId?: string;
  canPublishNews?: boolean;
}

export function DoctorQuickActions({ isApproved, userId, canPublishNews }: Props) {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Iniciar Live',
      description: 'Comienza una transmisión en vivo',
      icon: Radio,
      color: 'live',
      requiresApproval: true,
      onClick: () => navigate('/doctor/go-live'),
      buttonLabel: 'Iniciar',
    },
    {
      title: 'Subir Contenido',
      description: 'Sube videos, PDFs o imágenes',
      icon: Upload,
      color: 'primary',
      requiresApproval: true,
      onClick: () => navigate('/doctor/upload'),
      buttonLabel: 'Subir',
      extraButton: { label: 'Biblioteca', onClick: () => navigate('/doctor/content') },
    },
    {
      title: 'Mi Perfil Profesional',
      description: 'Edita tu educación, certificaciones y experiencia',
      icon: UserCircle,
      color: 'accent',
      requiresApproval: false,
      onClick: () => navigate(`/doctor/${userId}`),
      buttonLabel: 'Ver y editar perfil',
    },
    ...(canPublishNews ? [{
      title: 'Escribir Artículo',
      description: 'Publica noticias y artículos médicos para la comunidad',
      icon: Newspaper,
      color: 'warning',
      requiresApproval: true,
      onClick: () => navigate('/doctor/news'),
      buttonLabel: 'Escribir',
    }] : []),
    {
      title: 'Orientaciones',
      description: 'Revisa tus chats con pacientes',
      icon: MessageSquare,
      color: 'info',
      requiresApproval: false,
      onClick: () => navigate('/chat'),
      buttonLabel: 'Ver Chats',
      className: 'md:col-span-2 lg:col-span-1',
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const disabled = action.requiresApproval && !isApproved;

        return (
          <Card
            key={action.title}
            className={`${disabled ? 'opacity-50 pointer-events-none' : `hover:shadow-lg transition-all cursor-pointer border-2 hover:border-${action.color}/30`} ${action.className || ''}`}
            onClick={() => !disabled && action.onClick()}
          >
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-start gap-3 sm:gap-5">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-${action.color}/10 flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 sm:w-8 sm:h-8 text-${action.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">{action.title}</h3>
                  <p className="text-muted-foreground mb-2 sm:mb-4 text-xs sm:text-sm line-clamp-2">
                    {action.description}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                      className="h-8 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                    >
                      {disabled ? 'No disponible' : action.buttonLabel}
                    </Button>
                    {action.extraButton && (
                      <Button
                        variant="ghost"
                        disabled={disabled}
                        onClick={(e) => { e.stopPropagation(); action.extraButton!.onClick(); }}
                        className="h-8 sm:h-10 text-xs sm:text-sm px-2 sm:px-4"
                      >
                        {action.extraButton.label}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
