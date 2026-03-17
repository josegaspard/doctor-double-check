import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Save, Trash2 } from 'lucide-react';

interface EndingLiveModalProps {
  isOpen: boolean;
  stage: 'ending' | 'saving' | 'uploading' | 'choose' | 'done';
  enableRecording: boolean;
  uploadProgress?: number;
  onKeepDecision?: (keep: boolean) => void;
}

export function EndingLiveModal({ isOpen, stage, enableRecording, uploadProgress = 0, onKeepDecision }: EndingLiveModalProps) {
  const getContent = () => {
    switch (stage) {
      case 'ending':
        return {
          title: 'Finalizando transmisión...',
          description: 'Cerrando la sala de transmisión',
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'saving':
        return {
          title: enableRecording ? 'Guardando grabación...' : 'Procesando...',
          description: enableRecording 
            ? 'Tu grabación se está guardando. Esto puede tomar unos segundos.'
            : 'Limpiando recursos de la transmisión.',
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'uploading':
        return {
          title: 'Subiendo grabación local...',
          description: `La grabación de respaldo se está subiendo. ${uploadProgress}% completado.`,
          icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
        };
      case 'choose':
        return {
          title: '¿Guardar grabación en tu perfil?',
          description: 'Elige si quieres que esta grabación esté disponible para la venta en tu perfil o si prefieres eliminarla.',
          icon: <Save className="w-8 h-8 text-primary" />,
        };
      case 'done':
        return {
          title: '¡Listo!',
          description: enableRecording 
            ? 'Tu grabación está disponible en Mis Grabaciones'
            : 'La transmisión ha finalizado correctamente',
          icon: <CheckCircle className="w-8 h-8 text-success" />,
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            {content.icon}
          </div>
          <DialogTitle className="text-center">{content.title}</DialogTitle>
          <DialogDescription className="text-center">
            {content.description}
          </DialogDescription>
        </DialogHeader>
        {stage === 'choose' && (
          <div className="flex flex-col gap-3 mt-2">
            <Button
              onClick={() => onKeepDecision?.(true)}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar en mi perfil
            </Button>
            <Button
              variant="outline"
              onClick={() => onKeepDecision?.(false)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              No guardar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
