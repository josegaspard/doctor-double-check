import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HardDrive, CreditCard, Wallet, Loader2, ExternalLink, ArrowLeft, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  gb: number;
  price?: number;
  label?: string;
  badge?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgraded?: () => void;
}

function formatStorageSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function StorageUpgradeDialog({ open, onOpenChange, onUpgraded }: Props) {
  const { supabaseUser } = useAuth();
  const { t } = useLanguage();
  const { balance, canAfford, getEffectivePrice } = useWallet();

  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(1073741824);
  const [storagePlans, setStoragePlans] = useState<Plan[]>([
    { gb: 1, label: '+1 GB' },
    { gb: 5, label: '+5 GB', badge: 'Popular' },
    { gb: 10, label: '+10 GB', badge: 'Mejor valor' },
  ]);
  const [pricePerGb, setPricePerGb] = useState(49);
  const [selectedPlan, setSelectedPlan] = useState<{ gb: number; price: number; label?: string } | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supabaseUser?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('storage_used_bytes, storage_limit_bytes')
          .eq('id', supabaseUser.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile) {
          setStorageUsed((profile as any).storage_used_bytes || 0);
          setStorageLimit((profile as any).storage_limit_bytes || 1073741824);
        }

        const { data: pricing } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'storage_pricing')
          .maybeSingle();
        if (cancelled) return;
        if (pricing?.value) {
          const p = pricing.value as any;
          if (Array.isArray(p.plans) && p.plans.length > 0) setStoragePlans(p.plans);
          if (p.price_per_gb) setPricePerGb(p.price_per_gb);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, supabaseUser?.id]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) setSelectedPlan(null);
  }, [open]);

  const handlePayWithWallet = async () => {
    if (!selectedPlan || !supabaseUser?.id) return;
    setIsUpgrading(true);
    try {
      const effectiveCost = getEffectivePrice(selectedPlan.price);
      const { data, error } = await supabase.rpc('process_wallet_purchase' as any, {
        p_amount: effectiveCost,
        p_description: `Expansión de almacenamiento: +${selectedPlan.gb}GB`,
        p_metadata: { type: 'storage_upgrade', extra_gb: selectedPlan.gb },
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error === 'Insufficient balance' ? t('ads.insufficientBalance') : (result?.error || t('ads.purchaseError')));
        setIsUpgrading(false);
        return;
      }
      toast.success(`${t('ads.walletDebited')} $${result.amount_charged}`);
      const newLimit = storageLimit + (selectedPlan.gb * 1073741824);
      await supabase.from('profiles').update({ storage_limit_bytes: newLimit }).eq('id', supabaseUser.id);
      setStorageLimit(newLimit);
      toast.success(`${t('ads.storageExpandedTo')} ${formatStorageSize(newLimit)}!`);
      onUpgraded?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Upgrade error:', err);
      toast.error(err.message || t('ads.purchaseError'));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePayWithStripe = async () => {
    if (!selectedPlan) return;
    setIsStripeProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-storage-checkout', {
        body: { extraGB: selectedPlan.gb, price: selectedPlan.price },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Stripe checkout error:', err);
      toast.error(err.message || t('ads.checkoutStorageError'));
      setIsStripeProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            {t('ads.upgradeStorage')}
          </DialogTitle>
          <DialogDescription>
            {t('ads.storageCurrentUsage')} {formatStorageSize(storageUsed)} {t('common.of')} {formatStorageSize(storageLimit)} {t('ads.used')}
            {!selectedPlan && ` · ${t('ads.selectPlan')}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !selectedPlan ? (
          <div className="space-y-2 mt-2">
            {storagePlans.map((plan) => {
              const price = plan.price != null ? plan.price : plan.gb * pricePerGb;
              return (
                <button
                  key={plan.gb}
                  onClick={() => setSelectedPlan({ gb: plan.gb, price, label: plan.label })}
                  className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <HardDrive className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{plan.label || `+${plan.gb} GB`}</p>
                      <p className="text-xs text-muted-foreground">Total: {formatStorageSize(storageLimit + plan.gb * 1073741824)}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2 flex-shrink-0">
                    {plan.badge && <Badge variant="secondary" className="text-[10px]">{plan.badge}</Badge>}
                    <span className="font-bold text-primary">${getEffectivePrice(price)}</span>
                  </div>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground text-center mt-2">{t('ads.residentDiscount')}</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <button
              onClick={() => setSelectedPlan(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> {t('common.back') || 'Volver'}
            </button>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{selectedPlan.label || `+${selectedPlan.gb} GB`}</p>
                  <p className="text-xs text-muted-foreground">Total: {formatStorageSize(storageLimit + selectedPlan.gb * 1073741824)}</p>
                </div>
              </div>
              <p className="text-lg font-bold text-primary">${getEffectivePrice(selectedPlan.price)}</p>
            </div>

            <Button onClick={handlePayWithStripe} disabled={isStripeProcessing} className="w-full h-12 gap-2">
              {isStripeProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {t('ads.payWithCard')}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('ads.orUseBalance')}</span>
              </div>
            </div>

            {canAfford(selectedPlan.price) ? (
              <Button onClick={handlePayWithWallet} disabled={isUpgrading} variant="outline" className="w-full h-12 gap-2">
                {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <Wallet className="w-4 h-4" />
                    {t('ads.payWithBalance')} (${balance.toLocaleString()})
                  </>
                )}
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-xs text-muted-foreground">
                  {t('ads.youHave')} ${balance.toLocaleString()} — {t('ads.needMore')} ${(getEffectivePrice(selectedPlan.price) - balance).toLocaleString()} {t('ads.more')}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
