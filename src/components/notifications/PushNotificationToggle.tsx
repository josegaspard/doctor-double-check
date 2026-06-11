import React from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { language, t } = useLanguage();

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
            {t('autoI18n.pushToggle1')}
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {t('autoI18n.pushToggle2')}
          </span>
        </Label>
        <Badge variant="secondary">{t('autoI18n.pushToggle3')}</Badge>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {t('autoI18n.pushToggle1')}
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {t('autoI18n.pushToggle4')}
          </span>
        </Label>
        <Badge variant="destructive" className="shrink-0 text-[10px] px-2">{t('autoI18n.pushToggle5')}</Badge>
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
          {t('autoI18n.pushToggle1')}
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {isSubscribed
            ? t('autoI18n.pushToggle6')
            : t('autoI18n.pushToggle7')
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
