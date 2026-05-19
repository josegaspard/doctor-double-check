import React, { useState } from 'react';
import { useSubscriptions, Subscription } from '@/hooks/useSubscriptions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { 
  Users, 
  Crown, 
  Star, 
  Bell, 
  BellOff, 
  Loader2,
  XCircle,
  Calendar,
  Stethoscope
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MySubscriptions() {
  const { t } = useLanguage();
  const { subscriptions, isLoading, unsubscribe, updateNotificationPrefs, refresh } = useSubscriptions();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmCancelSub, setConfirmCancelSub] = useState<Subscription | null>(null);
  const [updatingPrefs, setUpdatingPrefs] = useState<string | null>(null);

  const handleCancelSubscription = async () => {
    if (!confirmCancelSub) return;
    
    setCancelingId(confirmCancelSub.id);
    const result = await unsubscribe(confirmCancelSub.creatorId);
    setCancelingId(null);
    setConfirmCancelSub(null);

    if (result.success) {
      if (confirmCancelSub.tier !== 'free' && confirmCancelSub.expiresAt) {
        toast.success(`${t('mySubscriptions.cancelSuccessKeepAccess')} ${format(confirmCancelSub.expiresAt, "dd 'de' MMMM", { locale: es })}`);
      } else {
        toast.success(t('mySubscriptions.cancelSuccess'));
      }
      refresh();
    } else {
      toast.error(result.error || t('mySubscriptions.cancelError'));
    }
  };

  const handleUpdateNotification = async (
    sub: Subscription,
    key: 'notifyOnLive' | 'notifyOnContent' | 'notifyOnAvailability',
    value: boolean
  ) => {
    setUpdatingPrefs(sub.id);
    const result = await updateNotificationPrefs(sub.id, { [key]: value });
    setUpdatingPrefs(null);

    if (!result.success) {
      toast.error(result.error || t('mySubscriptions.updatePrefsError'));
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white gap-1">
            <Crown className="w-3 h-3" />
            {t('mySubscriptions.tierPremium')}
          </Badge>
        );
      case 'basic':
        return (
          <Badge variant="secondary" className="gap-1">
            <Star className="w-3 h-3" />
            {t('mySubscriptions.tierBasic')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {t('mySubscriptions.tierFree')}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('mySubscriptions.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('mySubscriptions.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('mySubscriptions.emptyDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('mySubscriptions.title')} ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptions.map((sub) => (
            <div 
              key={sub.id} 
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={sub.creatorAvatar} />
                  <AvatarFallback>
                    <Stethoscope className="w-6 h-6 text-primary" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold truncate">{sub.creatorName || t('mySubscriptions.defaultDoctorName')}</h4>
                    {getTierBadge(sub.tier)}
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('mySubscriptions.since')} {format(sub.createdAt, 'dd MMM yyyy', { locale: es })}
                    </span>
                    {sub.tier !== 'free' && sub.pricePaid > 0 && (
                      <span>${sub.pricePaid}{t('mySubscriptions.perMonth')}</span>
                    )}
                  </div>

                  {/* Notification preferences */}
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={sub.notifyOnLive}
                        onCheckedChange={(v) => handleUpdateNotification(sub, 'notifyOnLive', v)}
                        disabled={updatingPrefs === sub.id}
                      />
                      <span className="flex items-center gap-1">
                        🔴 {t('mySubscriptions.notifyLives')}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={sub.notifyOnContent}
                        onCheckedChange={(v) => handleUpdateNotification(sub, 'notifyOnContent', v)}
                        disabled={updatingPrefs === sub.id}
                      />
                      <span>📄 {t('mySubscriptions.notifyContent')}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={sub.notifyOnAvailability}
                        onCheckedChange={(v) => handleUpdateNotification(sub, 'notifyOnAvailability', v)}
                        disabled={updatingPrefs === sub.id}
                      />
                      <span>📅 {t('mySubscriptions.notifySchedule')}</span>
                    </label>
                  </div>
                </div>

                {/* Cancel button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmCancelSub(sub)}
                  disabled={cancelingId === sub.id}
                >
                  {cancelingId === sub.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!confirmCancelSub} onOpenChange={() => setConfirmCancelSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mySubscriptions.confirmCancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {t('mySubscriptions.confirmCancelDescriptionPrefix')} <strong>{confirmCancelSub?.creatorName}</strong> {t('mySubscriptions.confirmCancelDescriptionSuffix')}
                </p>
                {confirmCancelSub?.tier !== 'free' && confirmCancelSub?.expiresAt && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-sm font-medium text-warning flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {t('mySubscriptions.paidActiveUntil')}{' '}
                      <strong>{format(confirmCancelSub.expiresAt, "dd 'de' MMMM yyyy", { locale: es })}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('mySubscriptions.afterDateNoChargesPrefix')} {confirmCancelSub.tier === 'premium' ? t('mySubscriptions.tierPremium') : t('mySubscriptions.tierBasic')}.
                    </p>
                  </div>
                )}
                {confirmCancelSub?.tier !== 'free' && !confirmCancelSub?.expiresAt && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-sm text-warning">
                      {t('mySubscriptions.paidCancelEndOfPeriod')}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('mySubscriptions.keepSubscription')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelingId ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t('mySubscriptions.cancelSubscription')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
