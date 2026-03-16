import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet as WalletIcon,
  Plus,
  CreditCard,
  Loader2,
  ExternalLink,
  TrendingUp,
  PlayCircle,
  FileText,
  Stethoscope,
  CheckCheck,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { UserBankAccountForm } from '@/components/wallet/UserBankAccountForm';
import { motion, AnimatePresence } from 'framer-motion';

const TOPUP_AMOUNTS = [100, 250, 500, 1000];
const MIN_TOPUP_AMOUNT = 50;
const MAX_TOPUP_AMOUNT = 999999;

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { balance, transactions, isLoading, refreshWallet } = useWallet();
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTopUpAnimation, setShowTopUpAnimation] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const prevBalanceRef = useRef(balance);

  useEffect(() => {
    if (balance > prevBalanceRef.current && prevBalanceRef.current > 0) {
      const diff = balance - prevBalanceRef.current;
      setTopUpAmount(diff);
      setShowTopUpAnimation(true);
      setTimeout(() => setShowTopUpAnimation(false), 3000);
    }
    prevBalanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const amount = searchParams.get('amount');

    if (success === 'true') {
      toast({
        title: t('wallet.paymentSuccess'),
        description: `$${amount} MXN ${t('wallet.paymentSuccessMessage')}`,
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        await refreshWallet();
        attempts++;
        if (attempts >= 10) clearInterval(poll);
      }, 2000);
      setSearchParams({});
      return () => clearInterval(poll);
    } else if (canceled === 'true') {
      toast({
        title: t('wallet.paymentCanceled'),
        description: t('wallet.paymentCanceledMessage'),
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshWallet, toast, t]);

  if (role !== 'patient' && role !== 'resident') {
    return <Navigate to="/lives" replace />;
  }

  const handleStripeCheckout = async () => {
    const amount = selectedAmount ?? Number.parseInt(customAmount, 10);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP_AMOUNT) {
      toast({ title: t('wallet.invalidAmount'), description: t('wallet.minAmount'), variant: 'destructive' });
      return;
    }
    if (amount > MAX_TOPUP_AMOUNT) {
      toast({ title: t('wallet.invalidAmount'), description: `${t('wallet.maxAmount')} $${MAX_TOPUP_AMOUNT.toLocaleString()} MXN`, variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-wallet-checkout', { body: { amount } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({ title: t('common.error'), description: t('wallet.checkoutError'), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const whereToUse = [
    { icon: PlayCircle, label: t('wallet.useRecordings'), desc: t('wallet.useRecordingsDesc'), href: '/recordings' },
    { icon: FileText, label: t('wallet.useContent'), desc: t('wallet.useContentDesc'), href: '/content' },
    { icon: Stethoscope, label: t('wallet.useConsultations'), desc: t('wallet.useConsultationsDesc'), href: '/lives' },
    { icon: CheckCheck, label: t('wallet.useDoubleCheck'), desc: t('wallet.useDoubleCheckDesc'), href: '/doctors' },
  ];

  const isEmptyBalance = balance === 0 && transactions.length === 0;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Page header */}
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
          <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          {t('wallet.title')}
        </h1>

        {/* Balance Card — full width hero */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden mb-4 sm:mb-6">
          <CardContent className="p-5 sm:p-8">
            <p className="text-primary-foreground/80 text-xs sm:text-sm mb-1 font-medium">{t('wallet.balance')}</p>
            <motion.p
              key={balance}
              initial={{ scale: 1 }}
              animate={showTopUpAnimation ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-bold tracking-tight"
            >
              ${balance.toLocaleString()} <span className="text-xl sm:text-2xl font-normal opacity-70">MXN</span>
            </motion.p>
            <p className="text-primary-foreground/60 text-xs sm:text-sm mt-2 truncate">{user?.name}</p>
            {role === 'resident' && (
              <div className="mt-3 px-2.5 py-1 bg-white/20 rounded-full text-xs inline-flex items-center gap-1">
                🎓 {t('wallet.residentDiscount')}
              </div>
            )}
            <AnimatePresence>
              {showTopUpAnimation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: -10 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="absolute top-4 right-5 flex items-center gap-1 text-lg font-bold text-white drop-shadow-lg"
                >
                  <TrendingUp className="w-5 h-5" />
                  +${topUpAmount.toLocaleString()}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Empty state — first time user */}
        {isEmptyBalance && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-5 sm:p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-center"
          >
            <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
            <h3 className="font-semibold text-base sm:text-lg text-foreground mb-1">{t('wallet.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{t('wallet.emptyDescription')}</p>
          </motion.div>
        )}

        {/* How it works stepper — collapsible for returning users */}
        {isEmptyBalance && (
          <div className="mb-4 sm:mb-6 p-4 sm:p-5 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('wallet.howItWorks')}</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { step: '1', icon: CreditCard, label: t('wallet.step1') },
                { step: '2', icon: WalletIcon, label: t('wallet.step2') },
                { step: '3', icon: ShieldCheck, label: t('wallet.step3') },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center gap-1.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                    <s.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{s.step}</span>
                  </div>
                  <span className="text-xs text-foreground font-medium leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Up Card */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('wallet.topUp')}
            </h2>

            {/* Amount chips — horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x -mx-1 px-1">
              {TOPUP_AMOUNTS.map(amount => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "default" : "outline"}
                  onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                  className="h-11 min-h-[44px] min-w-[90px] flex-shrink-0 snap-start text-sm font-semibold"
                >
                  ${amount}
                </Button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                placeholder={t('wallet.otherAmount')}
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                className="pl-7 h-11"
                min={MIN_TOPUP_AMOUNT}
                max={MAX_TOPUP_AMOUNT}
              />
            </div>

            <Button
              onClick={handleStripeCheckout}
              disabled={isProcessing || (!selectedAmount && !customAmount)}
              className="w-full h-12 gap-2 text-sm font-semibold"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {t('wallet.payWithStripe')}
                  <ExternalLink className="w-3 h-3" />
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {t('wallet.securePayment')}
            </p>
          </CardContent>
        </Card>

        {/* Where to use your wallet */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('wallet.whereToUse')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {whereToUse.map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bank Account Section */}
        <div className="mb-4 sm:mb-6">
          <UserBankAccountForm />
        </div>

        {/* Transaction History */}
        <TransactionHistory />
      </div>
    </MainLayout>
  );
}
