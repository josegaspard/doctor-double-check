import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface EndingLiveModalProps {
  isOpen: boolean;
  stage: 'ending' | 'saving' | 'uploading';
  enableRecording: boolean;
  uploadProgress?: number;
}

export function EndingLiveModal({ isOpen, stage, enableRecording, uploadProgress = 0 }: EndingLiveModalProps) {
  const getContent = () => {
    switch (stage) {
      case 'ending':
        return {
          title: 'Finalizando transmisión...',
          description: 'Cerrando la sala de transmisión',
        };
      case 'saving':
        return {
          title: enableRecording ? 'Guardando grabación...' : 'Procesando...',
          description: enableRecording 
            ? 'Tu grabación se está guardando. Esto puede tomar unos segundos.'
            : 'Limpiando recursos de la transmisión.',
        };
      case 'uploading':
        return {
          title: 'Subiendo grabación...',
          description: `${uploadProgress}% completado`,
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-sm" hideClose>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{content.title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
