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
    },
  ];

  return (
    <div className="grid gap-2.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const disabled = action.requiresApproval && !isApproved;

        return (
          <Card
            key={action.title}
            className={`overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : 'hover:shadow-md transition-all cursor-pointer'}`}
            onClick={() => !disabled && action.onClick()}
          >
            <div className={`h-1 bg-${action.color}/30`} />
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-3 sm:items-start sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-${action.color}/10 flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${action.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">{action.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 mt-0.5 sm:mt-1">
                    {action.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                      size="sm"
                      className="h-7 sm:h-8 text-xs px-3"
                    >
                      {disabled ? 'No disponible' : action.buttonLabel}
                    </Button>
                    {action.extraButton && (
                      <Button
                        variant="ghost"
                        disabled={disabled}
                        onClick={(e) => { e.stopPropagation(); action.extraButton!.onClick(); }}
                        size="sm"
                        className="h-7 sm:h-8 text-xs px-2"
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
