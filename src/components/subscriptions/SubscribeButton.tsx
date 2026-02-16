import React, { useState } from 'react';
import { Bell, BellOff, Check, UserPlus, Settings, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SubscribeButtonProps {
  doctorId: string;
  doctorName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showUpgrade?: boolean;
}

export function SubscribeButton({
  doctorId,
  doctorName,
  variant = 'default',
  size = 'default',
  showUpgrade = true,
}: SubscribeButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { isSubscribedTo, getSubscription, subscribe, unsubscribe, updateNotificationPrefs } =
    useSubscriptions();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const isSubscribed = isSubscribedTo(doctorId);
  const subscription = getSubscription(doctorId);

  // Don't show for own profile
  if (user?.id === doctorId) return null;

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Error',
        description: 'Debes iniciar sesión para suscribirte',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await subscribe(doctorId, 'free', 0);
    
    if (result.success) {
      // *** CRITICAL FIX: Refresh follower count after subscribe ***
      // Force a re-fetch of subscription data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: t('subscriptions.subscribed'),
        description: `Ahora sigues a ${doctorName || 'este doctor'}`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    const result = await unsubscribe(doctorId);
    setIsLoading(false);

    if (result.success) {
      toast({
        description: 'Has dejado de seguir a este doctor',
      });
    }
  };

  const handleToggleNotification = async (
    key: 'notifyOnLive' | 'notifyOnContent' | 'notifyOnAvailability',
    value: boolean
  ) => {
    if (!subscription) return;
    await updateNotificationPrefs(subscription.id, { [key]: value });
  };

  const handleUpgrade = async (tier: 'basic' | 'premium') => {
    setIsUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { creatorId: doctorId, tier },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        setShowUpgradeModal(false);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo iniciar el proceso de pago',
        variant: 'destructive',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  if (!isSubscribed) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleSubscribe}
        disabled={isLoading}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        {t('subscriptions.subscribe')}
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size}>
          <Check className="h-4 w-4 mr-2" />
          {t('subscriptions.subscribed')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Preferencias de notificación
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-live" className="text-sm flex items-center gap-2">
                <span className="text-red-500">🔴</span>
                {t('subscriptions.notifyLive')}
              </Label>
              <Switch
                id="notify-live"
                checked={subscription?.notifyOnLive ?? true}
                onCheckedChange={(checked) => handleToggleNotification('notifyOnLive', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-content" className="text-sm flex items-center gap-2">
                <span>📄</span>
                {t('subscriptions.notifyContent')}
              </Label>
              <Switch
                id="notify-content"
                checked={subscription?.notifyOnContent ?? true}
                onCheckedChange={(checked) => handleToggleNotification('notifyOnContent', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-availability" className="text-sm flex items-center gap-2">
                <span>📅</span>
                {t('subscriptions.notifyAvailability')}
              </Label>
              <Switch
                id="notify-availability"
                checked={subscription?.notifyOnAvailability ?? true}
                onCheckedChange={(checked) =>
                  handleToggleNotification('notifyOnAvailability', checked)
                }
              />
            </div>
          </div>

          {showUpgrade && subscription?.tier === 'free' && (
            <>
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Mejorar suscripción
                </Button>
              </div>
            </>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleUnsubscribe}
            disabled={isLoading}
          >
            <BellOff className="h-4 w-4 mr-2" />
            {t('subscriptions.unsubscribe')}
          </Button>
        </div>
      </PopoverContent>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Mejora tu suscripción
            </DialogTitle>
            <DialogDescription>
              Obtén beneficios exclusivos de {doctorName || 'este doctor'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Tier */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleUpgrade('basic')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Básico</h4>
                    <p className="text-sm text-muted-foreground">Contenido exclusivo y notificaciones</p>
                  </div>
                  <Badge variant="outline">{t('subscriptions.basicPrice') || '$99/mes'}</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>✓ {t('subscriptions.exclusiveContent') || 'Acceso a contenido exclusivo'}</li>
                  <li>✓ {t('subscriptions.priorityNotifications') || 'Notificaciones prioritarias'}</li>
                  <li>✓ {t('subscriptions.subscriberBadge') || 'Badge de suscriptor'}</li>
                </ul>
              </CardContent>
            </Card>

            {/* Premium Tier */}
            <Card className="cursor-pointer border-yellow-500/50 hover:border-yellow-500 transition-colors" onClick={() => handleUpgrade('premium')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Premium
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">Popular</Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">Todo lo básico + descuentos y más</p>
                  </div>
                  <Badge variant="default">{t('subscriptions.premiumPrice') || '$199/mes'}</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>✓ {t('subscriptions.allBasicFeatures') || 'Todo lo del plan Básico'}</li>
                  <li>✓ {t('subscriptions.recordingDiscount') || '20% descuento en grabaciones'}</li>
                  <li>✓ {t('subscriptions.priorityChat') || 'Chat prioritario'}</li>
                  <li>✓ {t('subscriptions.earlyAccess') || 'Acceso anticipado a lives'}</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {isUpgrading && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirigiendo al pago...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Popover>
  );
}
