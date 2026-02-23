import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  isPending: boolean;
}

export function DoctorStatusAlert({ isPending }: Props) {
  return (
    <Card className={`mb-6 ${isPending ? 'border-warning/50 bg-warning/5' : 'border-destructive/50 bg-destructive/5'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {isPending ? (
            <Clock className="w-6 h-6 text-warning flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              {isPending ? 'Tu verificación está en proceso' : 'Verificación rechazada'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isPending
                ? 'Estamos revisando tu documentación. Este proceso puede tomar 24-48 horas. Mientras tanto, puedes explorar la plataforma pero no podrás crear contenido ni atender orientaciones.'
                : 'Tu solicitud de verificación fue rechazada. Por favor contacta a soporte para más información.'}
            </p>
            {isPending && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning w-1/2 animate-pulse" />
                </div>
                <span className="text-xs text-muted-foreground">En revisión</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
