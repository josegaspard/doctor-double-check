import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertTriangle, Save, Radio } from 'lucide-react';

interface LiveDialogsProps {
  // End confirmation (unified single dialog)
  showEndDialog: boolean;
  onEndDialogChange: (open: boolean) => void;
  onConfirmEnd: (saveAsPremium: boolean) => void;
  isEnding: boolean;
  enableRecording: boolean;

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
  showNavigationWarning,
  onNavigationWarningChange,
  onConfirmNavigation,
  onCancelNavigation,
}: LiveDialogsProps) {
  const [saveAsPremium, setSaveAsPremium] = useState(true);

  return (
    <>
      {/* Unified end confirmation dialog — single window, no second modal */}
      <Dialog open={showEndDialog} onOpenChange={(open) => {
        if (!isEnding) onEndDialogChange(open);
      }}>
        <DialogContent className="sm:max-w-md" hideClose={isEnding}>
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              ¿Finalizar transmisión?
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              Tu transmisión terminará para todos los espectadores.
            </DialogDescription>
          </DialogHeader>

          {/* Save as premium option — only if recording is enabled */}
          {enableRecording && (
            <label className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 cursor-pointer mt-2">
              <Checkbox
                checked={saveAsPremium}
                onCheckedChange={(v) => setSaveAsPremium(!!v)}
                className="mt-0.5 h-5 w-5"
                disabled={isEnding}
              />
              <div>
                <p className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Guardar como contenido premium
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {saveAsPremium 
                    ? 'Se guardará en segundo plano y aparecerá en tus Grabaciones.'
                    : 'Las métricas del live quedarán en Lives pasados.'}
                </p>
              </div>
            </label>
          )}

          {/* Two big, always-clickable buttons */}
          <div className="flex flex-col gap-3 mt-4">
            <Button
              variant="outline"
              className="w-full min-h-[48px] text-base gap-2"
              onClick={() => onEndDialogChange(false)}
              disabled={isEnding}
            >
              <Radio className="w-4 h-4" />
              Continuar transmitiendo
            </Button>
            <Button
              variant="destructive"
              className="w-full min-h-[48px] text-base gap-2"
              onClick={() => onConfirmEnd(enableRecording ? saveAsPremium : false)}
              disabled={isEnding}
            >
              {isEnding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Finalizar y salir'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
