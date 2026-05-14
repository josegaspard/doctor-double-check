import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  isPending: boolean;
}

export function DoctorStatusAlert({ isPending }: Props) {
  return (
    <Card
      className={`mb-6 border-l-4 shadow-md overflow-hidden bg-card ${
        isPending ? 'border-l-primary' : 'border-l-destructive'
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPending ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
            }`}
          >
            {isPending ? (
              <Clock className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base">
              {isPending ? 'Tu verificación está en proceso' : 'Verificación rechazada'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {isPending
                ? 'Estamos revisando tu documentación. Este proceso puede tomar 24-48 horas. Mientras tanto, puedes explorar la plataforma pero no podrás crear contenido ni atender orientaciones.'
                : 'Tu solicitud de verificación fue rechazada. Por favor contacta a soporte para más información.'}
            </p>
            {isPending && (
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 bg-primary/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary w-1/2 animate-pulse rounded-full" />
                </div>
                <span className="text-xs font-medium text-primary">En revisión</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
