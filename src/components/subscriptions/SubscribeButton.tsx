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
        title: t('common.error'),
        description: t('paywall.loginRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await subscribe(doctorId, 'free', 0);
    
    if (result.success) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: t('subscriptions.subscribed'),
        description: `${t('subscriptions.nowFollowing')} ${doctorName || 'este doctor'}`,
      });
    } else {
      toast({
        title: t('common.error'),
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
        description: t('subscriptions.unsubscribe'),
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
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('paywall.checkoutError'),
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
            {t('subscriptions.notificationPreferences')}
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-live" className="text-sm flex items-center gap-2">
                <span className="text-destructive">🔴</span>
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
                  <Crown className="h-4 w-4 text-warning" />
                  {t('subscriptions.upgradeSubscription')}
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
              <Crown className="w-5 h-5 text-warning" />
              {t('subscriptions.upgradeTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('subscriptions.upgradeDescription')} {doctorName || 'este doctor'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Tier */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleUpgrade('basic')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{t('subscriptions.basicTierName')}</h4>
                    <p className="text-sm text-muted-foreground">{t('subscriptions.basicTierDescription')}</p>
                  </div>
                  <Badge variant="outline">{t('subscriptions.basicPrice')}</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>✓ {t('subscriptions.exclusiveContent')}</li>
                  <li>✓ {t('subscriptions.priorityNotifications')}</li>
                  <li>✓ {t('subscriptions.subscriberBadge')}</li>
                </ul>
              </CardContent>
            </Card>

            {/* Premium Tier */}
            <Card className="cursor-pointer border-warning/50 hover:border-warning transition-colors" onClick={() => handleUpgrade('premium')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {t('subscriptions.premiumTierName')}
                      <Badge variant="secondary" className="bg-warning/10 text-warning">{t('subscriptions.popular')}</Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">{t('subscriptions.premiumTierDescription')}</p>
                  </div>
                  <Badge variant="default">{t('subscriptions.premiumPrice')}</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  <li>✓ {t('subscriptions.allBasicFeatures')}</li>
                  <li>✓ {t('subscriptions.recordingDiscount')}</li>
                  <li>✓ {t('subscriptions.priorityChat')}</li>
                  <li>✓ {t('subscriptions.earlyAccess')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {isUpgrading && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('subscriptions.redirectingPayment')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Popover>
  );
}