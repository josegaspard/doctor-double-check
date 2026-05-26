import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchases } from '@/hooks/usePurchases';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Lock,
  Wallet,
  Clock,
  PlayCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  CreditCard,
  Crown,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { Recording } from '@/types/database';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  recording: Recording | null;
  onPurchase?: () => void;
  isPurchasing?: boolean;
  canAfford: boolean;
  balance: number;
}

export default function PaywallModal({
  open,
  onClose,
  recording,
  onPurchase,
  isPurchasing: externalIsPurchasing,
  canAfford,
  balance,
}: PaywallModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { purchaseWithWallet, isPurchasing: walletIsPurchasing } = usePurchases();
  const { getEffectiveRecordingPrice, hasPremiumTo } = useSubscriptions();

  const isPurchasing = externalIsPurchasing || walletIsPurchasing;

  if (!recording) return null;

  const hasPremiumDiscount = recording.doctor_id && hasPremiumTo(recording.doctor_id);
  const effectivePrice = recording.doctor_id 
    ? getEffectiveRecordingPrice(recording.price, recording.doctor_id)
    : recording.price;

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return t('paywall.processing') || 'Procesando...';
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} ${t('paywall.minutes')}`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleWalletPurchase = async () => {
    if (recording) {
      const result = await purchaseWithWallet(recording.id);
      if (result.success) {
        onClose();
        navigate(`/recording/${recording.id}`);
      }
    }
  };

  const walletDeficit = Math.max(0, effectivePrice - balance);

  const PrimaryAction = canAfford ? (
    <Button
      onClick={handleWalletPurchase}
      disabled={isPurchasing}
      className="w-full h-12 gap-2 text-base"
      variant="default"
    >
      {isPurchasing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Zap className="w-4 h-4" />
          {t('paywall.payWithWallet')} — ${effectivePrice.toFixed(0)} MXN
        </>
      )}
    </Button>
  ) : (
    <Button
      onClick={() => { onClose(); navigate('/wallet'); }}
      className="w-full h-12 gap-2 text-base"
      variant="default"
    >
      <CreditCard className="w-4 h-4" />
      {t('paywall.rechargeWallet')}
    </Button>
  );

  const SecondarySection = canAfford ? (
    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
      <Wallet className="w-3 h-3" />
      {t('paywall.walletBalance')}: <span className="font-semibold text-foreground">${balance.toLocaleString()} MXN</span>
    </p>
  ) : (
    <div className="flex items-start gap-2.5 p-3 bg-warning/10 rounded-lg border border-warning/30">
      <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
      <div className="text-sm space-y-1">
        <p className="font-medium text-foreground">{t('paywall.insufficientBalance')}</p>
        <p className="text-muted-foreground text-xs">
          {t('paywall.youHave')} <span className="font-semibold text-foreground">${balance.toLocaleString()}</span> — {t('paywall.needMore')} <span className="font-semibold text-foreground">${walletDeficit.toLocaleString()}</span> {t('paywall.more')}
        </p>
        <p className="text-muted-foreground text-[11px] pt-0.5">{t('recordingPaywall.walletOnlyNotice')}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-premium/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-premium" />
            </div>
            <Badge variant="premium">{t('paywall.premiumContent')}</Badge>
          </div>
          <DialogTitle className="text-xl">{recording.title}</DialogTitle>
          <DialogDescription>
            {t('paywall.chooseMethod')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recording Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-premium/20 to-primary/20 flex items-center justify-center">
                <PlayCircle className="w-8 h-8 text-premium/60" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">{recording.doctor?.name || 'Doctor'}</p>
                <p className="text-sm text-muted-foreground">{recording.specialty}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDuration(recording.duration)}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Price Display */}
          <div className="text-center py-2">
            <p className="text-sm text-foreground font-medium">{t('paywall.price')}</p>
            {hasPremiumDiscount ? (
              <div className="space-y-1">
                <p className="text-lg text-muted-foreground line-through">${recording.price} MXN</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-3xl font-bold text-success">${effectivePrice.toFixed(0)} MXN</p>
                  <Badge className="bg-warning/10 text-foreground gap-1">
                    <Crown className="w-3 h-3 text-warning" />
                    {t('paywall.premiumDiscount')}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-3xl font-bold text-foreground">${recording.price} MXN</p>
            )}
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                {t('paywall.unlimitedAccess')}
              </li>
              <li className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                {t('paywall.anyDevice')}
              </li>
              <li className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                {t('paywall.noExpiration')}
              </li>
            </ul>
          </div>

          <Separator />

          {/* Payment Options — smart priority */}
          <div className="space-y-3">
            {canAfford && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 text-success" />
                {t('wallet.instantPayNote')}
              </p>
            )}
            {PrimaryAction}
            {SecondarySection}
          </div>

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {t('wallet.securePaymentShort')}
          </p>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full">
          {t('paywall.cancel')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
