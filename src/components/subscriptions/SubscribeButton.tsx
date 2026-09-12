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
import { AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import {
  useDoctorSubscriptionPlans,
  resolveTierPlan,
  type DoctorSubscriptionPlan,
  type PlanTier,
} from '@/hooks/useDoctorSubscriptionPlans';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { money2, fill } from '@/lib/proFormat';

interface SubscribeButtonProps {
  doctorId: string;
  doctorName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showUpgrade?: boolean;
  className?: string;
  onSubscriptionChange?: () => void;
  /**
   * Modo «un plan» (tarjeta Suscripciones del perfil público, F2 13-sep-2026):
   * pinta solo el «Suscribirme» de ese nivel y abre directamente su resumen de
   * pago. Quien ya paga ese nivel ve «Tu plan actual»; quien paga el otro nivel,
   * cómo cambiarse (nunca un segundo cobro).
   */
  planTier?: PlanTier;
}

export function SubscribeButton({
  doctorId,
  doctorName,
  variant = 'default',
  size = 'default',
  showUpgrade = true,
  className,
  onSubscriptionChange,
  planTier,
}: SubscribeButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { isSubscribedTo, getSubscription, subscribe, unsubscribe, updateNotificationPrefs, isLoading: subsLoading } =
    useSubscriptions();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { pricing } = useSubscriptionPricing();
  // Planes con nombre propio del médico (F2). Sin plan activo en un nivel, o sin
  // la migración, se usan el nombre y el precio globales de siempre.
  const { plans: doctorPlans, fetchFresh } = useDoctorSubscriptionPlans(doctorId);
  // El primer clic nunca suscribe ni manda a la pasarela: pasa por el resumen.
  const { confirm, dialog } = useConfirmAction();
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isSubscribed = isSubscribedTo(doctorId);
  const subscription = getSubscription(doctorId);
  const doctorLabel = doctorName || t('subscribeButton.thisDoctorFallback');
  // El nombre y el precio que se enseñan son los que cobra la función
  // create-subscription-checkout: el plan activo del médico para ese nivel o,
  // si no tiene, el precio global.
  const tierPlan = (tier: PlanTier, source: DoctorSubscriptionPlan[] = doctorPlans) =>
    resolveTierPlan(tier, source, pricing, t);
  const tierPrice = (tier: PlanTier, source?: DoctorSubscriptionPlan[]) =>
    money2(tierPlan(tier, source).priceCents / 100, language);

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

    const ok = await confirm({
      title: t('mm2.confirm.subscribe.title'),
      description: t('mm2.confirm.subscribe.description'),
      details: [
        { label: t('mm2.confirm.subscribe.doctorLabel'), value: doctorLabel },
        { label: t('mm2.confirm.subscribe.planLabel'), value: t('mm2.confirm.subscribe.planFree') },
        { label: t('mm2.confirm.subscribe.noticesLabel'), value: t('mm2.confirm.subscribe.noticesValue') },
      ],
      confirmLabel: t('mm2.confirm.subscribe.confirmLabel'),
    });
    if (!ok) return;

    setIsLoading(true);
    const result = await subscribe(doctorId, 'free', 0);

    if (result.success) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      onSubscriptionChange?.();
      toast({
        title: t('subscriptions.subscribed'),
        description: `${t('subscriptions.nowFollowing')} ${doctorName || t('subscribeButton.thisDoctorFallback')}`,
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

    if (result.success) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      onSubscriptionChange?.();
      if (subscription?.tier !== 'free' && subscription?.expiresAt) {
        toast({
          title: t('subscribeButton.subscriptionCancelled'),
          description: t('subscribeButton.keepAccessUntilPeriodEnd'),
        });
      } else {
        toast({ description: t('subscriptions.unsubscribe') });
      }
    }
    setShowCancelConfirm(false);
    setIsLoading(false);
  };

  const handleToggleNotification = async (
    key: 'notifyOnLive' | 'notifyOnContent' | 'notifyOnAvailability',
    value: boolean
  ) => {
    if (!subscription) return;
    await updateNotificationPrefs(subscription.id, { [key]: value });
  };

  const handleUpgrade = async (tier: PlanTier) => {
    if (!isAuthenticated) {
      toast({
        title: t('common.error'),
        description: t('paywall.loginRequired'),
        variant: 'destructive',
      });
      return;
    }

    // Plan recién leído de la base: el resumen tiene que enseñar el nombre y el
    // precio que la Edge Function va a cobrar. Si no se puede confirmar, no se
    // enseña un precio dudoso.
    const fresh = await fetchFresh();
    if (!fresh.ok) {
      toast({
        title: t('common.error'),
        description: t('mm2.planes.card.priceLoadError'),
        variant: 'destructive',
      });
      return;
    }
    const plan = tierPlan(tier, fresh.plans);

    // Tono «payment»: la tarjeta ya no cobra, solo selecciona el plan.
    const ok = await confirm({
      title: t('mm2.confirm.subscribeUpgrade.title'),
      description: t('mm2.confirm.subscribeUpgrade.description'),
      tone: 'payment',
      details: [
        { label: t('mm2.confirm.subscribeUpgrade.doctorLabel'), value: doctorLabel },
        {
          label: t('mm2.confirm.subscribeUpgrade.planLabel'),
          value: plan.name,
        },
        {
          label: t('mm2.confirm.subscribeUpgrade.billingLabel'),
          value: t('mm2.confirm.subscribeUpgrade.billingMonthly'),
        },
        {
          label: t('mm2.confirm.subscribeUpgrade.priceLabel'),
          value: fill(t('mm2.confirm.subscribeUpgrade.pricePerMonth'), { price: money2(plan.priceCents / 100, language) }),
          emphasis: true,
        },
      ],
      confirmLabel: t('mm2.confirm.subscribeUpgrade.confirmLabel'),
    });
    if (!ok) return;

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

  // Nombre, descripción, precio y ventajas de cada nivel: los del médico si los
  // personalizó; si no, los globales de siempre (mismos textos que antes).
  const basicPlan = tierPlan('basic');
  const premiumPlan = tierPlan('premium');

  // ---------------------------------------------------------- modo «un plan»
  if (planTier) {
    const paidTier = subscription?.tier === 'basic' || subscription?.tier === 'premium' ? subscription.tier : null;
    if (paidTier === planTier) {
      return (
        <span className={`pp-plan-current ${className || ''}`}>
          <Check /> {t('mm2.planes.card.currentPlan')}
        </span>
      );
    }
    if (paidTier) {
      return <span className={`pp-plan-switch ${className || ''}`}>{t('mm2.planes.card.switchHint')}</span>;
    }
    // Con sesión iniciada, el botón espera a saber si ya paga un plan con este
    // médico: así nunca se abre un segundo cobro por error.
    const waiting = isAuthenticated && subsLoading;
    return (
      <>
        <button
          type="button"
          className={`pro-btn pro-btn-teal ${className || ''}`}
          onClick={() => handleUpgrade(planTier)}
          disabled={waiting || isUpgrading}
          aria-label={fill(t('mm2.planes.card.subscribeAria'), { plan: tierPlan(planTier).name })}
        >
          {isUpgrading && <Loader2 className="animate-spin" />}
          {t('mm2.planes.card.subscribe')}
        </button>
        {dialog}
      </>
    );
  }

  if (!isSubscribed) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={handleSubscribe}
          disabled={isLoading}
          className={className}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {t('subscriptions.subscribe')}
        </Button>
        {dialog}
      </>
    );
  }

  // User is subscribed — show split UI for free followers
  const isFreeFollower = subscription?.tier === 'free';
  const isPaid = subscription?.tier === 'basic' || subscription?.tier === 'premium';

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
        {/* Following button with settings popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size={size}>
              <Check className="h-4 w-4 mr-2" />
              {isPaid ? (
                <span className="flex items-center gap-1">
                  <Crown className="h-3 w-3 text-warning" />
                  {subscription?.tier === 'premium' ? t('subscribeButton.premiumTierLabel') : t('subscribeButton.basicTierLabel')}
                </span>
              ) : (
                t('subscriptions.subscribed')
              )}
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

              {showUpgrade && isFreeFollower && (
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
              )}

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isLoading}
              >
                <BellOff className="h-4 w-4 mr-2" />
                {t('subscriptions.unsubscribe')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Prominent upgrade CTA for free followers */}
        {showUpgrade && isFreeFollower && (
          <Button
            variant="premium"
            size={size}
            onClick={() => setShowUpgradeModal(true)}
            className="gap-1.5"
          >
            <Crown className="h-4 w-4" />
            {t('subscribeButton.proSubscriptionCta')}
          </Button>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscribeButton.cancelSubscriptionTitle')}</DialogTitle>
            <DialogDescription>
              {subscription?.tier !== 'free' ? (
                <div className="space-y-3 mt-2">
                  <p>{t('subscribeButton.cancelPaidIntro')} <strong>{doctorName || t('subscribeButton.thisDoctorFallback')}</strong>:</p>
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
                    <p className="font-medium text-warning">{t('subscribeButton.cancelPaidWarning')}</p>
                    <p className="text-muted-foreground mt-1">{t('subscribeButton.cancelPaidNoMoreCharges')}</p>
                  </div>
                </div>
              ) : (
                <p>{t('subscribeButton.cancelFreeMessagePrefix')} <strong>{doctorName || t('subscribeButton.thisDoctorFallback')}</strong> {t('subscribeButton.cancelFreeMessageSuffix')}</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              {t('subscribeButton.keepSubscription')}
            </Button>
            <Button variant="destructive" onClick={handleUnsubscribe} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('subscribeButton.confirmCancellation')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-warning" />
              {t('subscriptions.upgradeTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('subscriptions.upgradeDescription')} {doctorName || t('subscribeButton.thisDoctorFallback')}
            </DialogDescription>
          </DialogHeader>

          {/* Explainer */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground border">
            <p><strong>{t('subscribeButton.explainerFollowFreeBold')}</strong> {t('subscribeButton.explainerFollowFree')}</p>
            <p className="mt-1"><strong>{t('subscribeButton.explainerSubscribeBold')}</strong> {t('subscribeButton.explainerSubscribe')}</p>
          </div>

          <div className="grid gap-4 py-2">
            {/* Basic Tier */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleUpgrade('basic')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold">{basicPlan.name}</h4>
                    {basicPlan.isCustom ? (
                      basicPlan.description && <p className="text-sm text-muted-foreground">{basicPlan.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('subscriptions.basicTierDescription')}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {fill(t('mm2.confirm.subscribeUpgrade.pricePerMonth'), { price: tierPrice('basic') })}
                  </Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  {basicPlan.isCustom ? (
                    basicPlan.perks.map((perk, i) => <li key={`${i}-${perk}`}>✓ {perk}</li>)
                  ) : (
                    <>
                      <li>✓ {t('subscriptions.exclusiveContent')}</li>
                      <li>✓ {t('subscriptions.priorityNotifications')}</li>
                      <li>✓ {t('subscriptions.subscriberBadge')}</li>
                    </>
                  )}
                </ul>
              </CardContent>
            </Card>

            {/* Premium Tier */}
            <Card className="cursor-pointer border-warning/50 hover:border-warning transition-colors" onClick={() => handleUpgrade('premium')}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold flex items-center gap-2 flex-wrap">
                      {premiumPlan.name}
                      <Badge variant="secondary" className="bg-warning/10 text-warning">{t('subscriptions.popular')}</Badge>
                    </h4>
                    {premiumPlan.isCustom ? (
                      premiumPlan.description && <p className="text-sm text-muted-foreground">{premiumPlan.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('subscriptions.premiumTierDescription')}</p>
                    )}
                  </div>
                  <Badge variant="default" className="shrink-0">
                    {fill(t('mm2.confirm.subscribeUpgrade.pricePerMonth'), { price: tierPrice('premium') })}
                  </Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mt-3">
                  {premiumPlan.isCustom ? (
                    premiumPlan.perks.map((perk, i) => <li key={`${i}-${perk}`}>✓ {perk}</li>)
                  ) : (
                    <>
                      <li>✓ {t('subscriptions.allBasicFeatures')}</li>
                      <li>✓ {t('subscriptions.recordingDiscount')}</li>
                      <li>✓ {t('subscriptions.priorityChat')}</li>
                      <li>✓ {t('subscriptions.earlyAccess')}</li>
                    </>
                  )}
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

      {dialog}
    </>
  );
}
