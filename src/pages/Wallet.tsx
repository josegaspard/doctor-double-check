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
  Receipt,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { UserBankAccountForm } from '@/components/wallet/UserBankAccountForm';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { doctorHref } from '@/lib/doctorSections';
import { money } from '@/lib/proFormat';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Banknote } from 'lucide-react';

const TOPUP_AMOUNTS = [100, 250, 500, 1000];
const MIN_TOPUP_AMOUNT = 50;
const MAX_TOPUP_AMOUNT = 999999;

export interface WalletProps {
  /** Dentro de Cuenta > Finanzas: sin MainLayout ni título propio. */
  embedded?: boolean;
}

export default function Wallet({ embedded = false }: WalletProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { balance, transactions, isLoading, refreshWallet } = useWallet();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirmAction();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTopUpAnimation, setShowTopUpAnimation] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [showBalance, setShowBalance] = useState(false);
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

    // 🚨 Solo se limpian los parámetros de la vuelta de Stripe: si se vacía toda
    // la query, dentro de Cuenta > Finanzas se pierde ?s=finanzas&f=wallet.
    const clearStripeParams = () => {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        ['success', 'canceled', 'amount'].forEach(k => p.delete(k));
        return p;
      }, { replace: true });
    };

    if (success === 'true') {
      toast({
        title: t('wallet.paymentSuccess'),
        description: `${money(Number(amount) || 0, language)} ${t('wallet.paymentSuccessMessage')}`,
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        await refreshWallet();
        attempts++;
        if (attempts >= 10) clearInterval(poll);
      }, 2000);
      clearStripeParams();
      return () => clearInterval(poll);
    } else if (canceled === 'true') {
      toast({
        title: t('wallet.paymentCanceled'),
        description: t('wallet.paymentCanceledMessage'),
        variant: 'destructive',
      });
      clearStripeParams();
    }
  }, [searchParams, setSearchParams, refreshWallet, toast, t, language]);

  // Doctores también acceden a wallet: pueden cargar saldo para comprar
  // contenido de colegas, pagar reuniones premium, etc. Sus ganancias siguen
  // en /doctor/earnings (panel separado de payouts).
  if (role !== 'patient' && role !== 'resident' && role !== 'doctor') {
    return embedded ? null : <Navigate to="/lives" replace />;
  }

  const handleStripeCheckout = async () => {
    const amount = selectedAmount ?? Number.parseInt(customAmount, 10);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP_AMOUNT) {
      toast({ title: t('wallet.invalidAmount'), description: t('wallet.minAmount'), variant: 'destructive' });
      return;
    }
    if (amount > MAX_TOPUP_AMOUNT) {
      toast({ title: t('wallet.invalidAmount'), description: `${t('wallet.maxAmount')} ${money(MAX_TOPUP_AMOUNT, language)}`, variant: 'destructive' });
      return;
    }

    // El primer clic NUNCA salta a Stripe: antes se enseña importe, método y
    // saldo resultante.
    const ok = await confirm({
      title: t('mm2.finance.topupConfirmTitle'),
      description: t('mm2.finance.topupConfirmDesc'),
      tone: 'payment',
      confirmLabel: t('wallet.payWithStripe'),
      details: [
        { label: t('mm2.finance.topupMethod'), value: t('mm2.finance.topupMethodStripe') },
        { label: t('mm2.finance.balanceNow'), value: money(balance, language) },
        { label: t('mm2.finance.balanceAfter'), value: money(balance + amount, language) },
        { label: t('mm2.finance.topupAmount'), value: money(amount, language), emphasis: true },
      ],
    });
    if (!ok) return;

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
  const Wrapper = embedded ? React.Fragment : MainLayout;

  return (
    <Wrapper>
      <div className={embedded ? '' : 'container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl'}>
        {/* Page header */}
        {!embedded && (
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2">
            <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            {t('wallet.title')}
          </h1>
        )}

        {/* Médico: el monedero es SOLO para gastar. Lo que tiene por COBRAR vive
            en Cuenta > Finanzas > Cobrar, y aquí queda una línea que lleva allí:
            antes esta página enseñaba la tarjeta de ganancias y se mezclaban. */}
        {role === 'doctor' && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-white border border-border shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/25">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-secondary">{t('fix20.pages.walletSpendTitle')}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">{t('fix20.pages.walletSpendDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' }))}
                className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/25 text-left hover:border-success/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-4 h-4 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-secondary">{t('fix20.pages.walletEarningsTitle')}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">{t('mm2.finance.goCollect')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-success flex-shrink-0 mt-1" />
              </button>
            </div>
          </div>
        )}

        {/* Balance Card — full width hero (gradient primary → secondary) */}
        <Card className="bg-gradient-to-br from-primary via-primary to-secondary text-primary-foreground relative overflow-hidden mb-4 sm:mb-6 shadow-xl shadow-primary/30 border-0">
          <CardContent className="p-5 sm:p-8">
            <p className="text-primary-foreground/80 text-xs sm:text-sm mb-1 font-medium">
              {role === 'doctor' ? t('fix20.pages.walletSpendTitle') : t('wallet.balance')}
            </p>
            <div className="flex items-center gap-3">
              <motion.p
                key={balance}
                initial={{ scale: 1 }}
                animate={showTopUpAnimation ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="text-4xl sm:text-5xl font-bold tracking-tight"
              >
                {showBalance ? (
                  <>{money(balance, language)}</>
                ) : (
                  <span className="tracking-widest">••••••</span>
                )}
              </motion.p>
              <button
                type="button"
                onClick={() => setShowBalance((v) => !v)}
                aria-label={showBalance ? t('fix20.pages.walletHideBalance') : t('fix20.pages.walletShowBalance')}
                className="flex-shrink-0 p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              >
                {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
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
                  +{money(topUpAmount, language)}
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
            className="mb-4 sm:mb-6 p-5 sm:p-6 rounded-xl border-2 border-dashed border-primary/50 bg-white text-center shadow-sm"
          >
            <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
            <h3 className="font-semibold text-base sm:text-lg text-secondary mb-1">{t('wallet.emptyTitle')}</h3>
            <p className="text-sm text-secondary/70 max-w-sm mx-auto mb-4">{t('wallet.emptyDescription')}</p>
          </motion.div>
        )}

        {/* How it works stepper — collapsible for returning users */}
        {isEmptyBalance && (
          <div className="mb-4 sm:mb-6 p-4 sm:p-5 rounded-xl bg-white border border-primary/20 shadow-sm">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{t('wallet.howItWorks')}</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { step: '1', icon: CreditCard, label: t('wallet.step1') },
                { step: '2', icon: WalletIcon, label: t('wallet.step2') },
                { step: '3', icon: ShieldCheck, label: t('wallet.step3') },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center gap-1.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center relative shadow-sm">
                    <s.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{s.step}</span>
                  </div>
                  <span className="text-xs text-secondary font-medium leading-tight">{s.label}</span>
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

        {/* Cuenta para REEMBOLSOS (user_bank_accounts). No es la cuenta de cobro
            del médico: esa vive en Cuenta > Finanzas > Cobrar > Cuenta bancaria. */}
        <div className="mb-4 sm:mb-6">
          <UserBankAccountForm />
        </div>

        {/* Movimientos del monedero. Para el médico, sin ganancias: no son saldo. */}
        <TransactionHistory excludeEarnings={role === 'doctor'} />

        {/* Link to full ledger */}
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate(role === 'doctor'
              ? doctorHref('cuenta', { tab: 'finanzas', f: 'recargas' })
              : '/wallet/ledger')}
          >
            <Receipt className="w-4 h-4" />
            {t('fix20.pages.walletFullHistory')}
          </Button>
        </div>
      </div>
      {dialog}
    </Wrapper>
  );
}
