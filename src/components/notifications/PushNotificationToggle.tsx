import React from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between opacity-50">
        <Label className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            Notificaciones Push
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            No disponible en este navegador
          </span>
        </Label>
        <Badge variant="secondary">No soportado</Badge>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between">
        <Label className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Notificaciones Push
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            Bloqueadas por el navegador. Habilita desde configuración.
          </span>
        </Label>
        <Badge variant="destructive">Bloqueado</Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor="push-toggle" className="flex flex-col gap-1 cursor-pointer">
        <span className="flex items-center gap-2">
          {isSubscribed ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          Notificaciones Push
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {isSubscribed 
            ? 'Recibirás alertas cuando un doctor inicie un live'
            : 'Activa para recibir alertas en tiempo real'
          }
        </span>
      </Label>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch
          id="push-toggle"
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      )}
    </div>
  );
}
