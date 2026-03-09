import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wallet as WalletIcon, Plus, CreditCard, Loader2, ExternalLink, TrendingUp } from 'lucide-react';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { UserBankAccountForm } from '@/components/wallet/UserBankAccountForm';
import { motion, AnimatePresence } from 'framer-motion';

const TOPUP_AMOUNTS = [100, 250, 500, 1000];
const MIN_TOPUP_AMOUNT = 50;
const MAX_TOPUP_AMOUNT = 999999;

export default function Wallet() {
  
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

  // Detect balance increase and trigger animation
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
      // Polling to catch the webhook-triggered balance update
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
      toast({
        title: t('wallet.invalidAmount'),
        description: t('wallet.minAmount'),
        variant: 'destructive',
      });
      return;
    }

    if (amount > MAX_TOPUP_AMOUNT) {
      toast({
        title: t('wallet.invalidAmount'),
        description: `${t('wallet.maxAmount')} $${MAX_TOPUP_AMOUNT.toLocaleString()} MXN`,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-wallet-checkout', {
        body: { amount },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: t('common.error'),
        description: t('wallet.checkoutError'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
          <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          {t('wallet.title')}
        </h1>

        {/* Explanatory hero banner */}
        <div className="mb-4 sm:mb-6 p-4 sm:p-5 rounded-xl bg-muted/50 border border-border">
          <p className="text-sm text-foreground font-medium mb-3">
            Tu billetera te permite comprar grabaciones, contenido premium y consultas de forma instantánea sin necesidad de ingresar tu tarjeta cada vez.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-foreground font-medium">Compras instantáneas</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-foreground font-medium">Sin tarjeta cada vez</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <WalletIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs text-foreground font-medium">Historial completo</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <p className="text-primary-foreground text-xs sm:text-sm mb-1 font-medium">{t('wallet.balance')}</p>
              <motion.p
                key={balance}
                initial={{ scale: 1 }}
                animate={showTopUpAnimation ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="text-3xl sm:text-4xl font-bold"
              >
                ${balance.toLocaleString()} MXN
              </motion.p>
              <p className="text-primary-foreground text-xs mt-2 truncate">{user?.name}</p>
              {role === 'resident' && (
                <div className="mt-2 sm:mt-3 px-2 py-1 bg-white/20 rounded-full text-xs inline-block">
                  🎓 {t('wallet.residentDiscount')}
                </div>
              )}
              
              {/* Top-up animation overlay */}
              <AnimatePresence>
                {showTopUpAnimation && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: -10 }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="absolute top-3 right-4 flex items-center gap-1 text-lg font-bold text-white drop-shadow-lg"
                  >
                    <TrendingUp className="w-5 h-5" />
                    +${topUpAmount.toLocaleString()}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Top Up Card */}
          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('wallet.topUp')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="grid grid-cols-2 gap-2">
                {TOPUP_AMOUNTS.map(amount => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                    className="h-10 sm:h-12 text-sm"
                  >
                    ${amount} MXN
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
                  className="pl-7 h-10"
                  min={MIN_TOPUP_AMOUNT}
                  max={MAX_TOPUP_AMOUNT}
                />
              </div>

              <Button 
                onClick={handleStripeCheckout} 
                disabled={isProcessing || (!selectedAmount && !customAmount)}
                className="w-full h-10 sm:h-12 gap-2 text-sm"
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

              <p className="text-xs text-muted-foreground text-center">
                {t('wallet.securePayment')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bank Account Section */}
        <div className="mt-4 sm:mt-6">
          <UserBankAccountForm />
        </div>

        {/* Detailed Transaction History */}
        <div className="mt-4 sm:mt-6">
          <TransactionHistory />
        </div>
      </div>
    </MainLayout>
  );
}