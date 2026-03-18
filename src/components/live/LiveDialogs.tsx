import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EndingLiveModal } from './EndingLiveModal';
import { Loader2, AlertTriangle } from 'lucide-react';

interface LiveDialogsProps {
  // End confirmation
  showEndDialog: boolean;
  onEndDialogChange: (open: boolean) => void;
  onConfirmEnd: () => void;
  isEnding: boolean;
  enableRecording: boolean;

  // Ending modal
  showEndingModal: boolean;
  endingStage: 'ending' | 'saving' | 'uploading' | 'choose' | 'done';
  uploadProgress: number | null;
  liveId?: string;
  onKeepDecision?: (keep: boolean) => void;

  // Navigation warning
  showNavigationWarning: boolean;
  onNavigationWarningChange: (open: boolean) => void;
  onConfirmNavigation: () => void;
  onCancelNavigation: () => void;
}

export function LiveDialogs({
  showEndDialog,
  onEndDialogChange,
  onConfirmEnd,
  isEnding,
  enableRecording,
  showEndingModal,
  endingStage,
  uploadProgress,
  liveId,
  onKeepDecision,
  showNavigationWarning,
  onNavigationWarningChange,
  onConfirmNavigation,
  onCancelNavigation,
}: LiveDialogsProps) {
  return (
    <>
      {/* End confirmation dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={onEndDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ¿Finalizar transmisión?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enableRecording
                ? 'La grabación se procesará y podrás elegir si quieres guardarla en tu perfil.'
                : 'Esta acción finalizará la transmisión para todos los espectadores.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEnding}>Continuar transmitiendo</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmEnd}
              disabled={isEnding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEnding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Sí, finalizar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ending modal */}
      <EndingLiveModal
        isOpen={showEndingModal}
        stage={endingStage}
        enableRecording={enableRecording}
        uploadProgress={uploadProgress}
        liveId={liveId}
        onKeepDecision={onKeepDecision}
      />

      {/* Navigation warning dialog */}
      <AlertDialog open={showNavigationWarning} onOpenChange={onNavigationWarningChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              ¡Transmisión en curso!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Si sales de esta página, tu transmisión en vivo terminará automáticamente.
              {enableRecording && ' La grabación se guardará y estará disponible en tu biblioteca.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelNavigation} disabled={isEnding}>
              Continuar transmitiendo
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmNavigation}
              disabled={isEnding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEnding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Terminar y salir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
