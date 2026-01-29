import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wallet as WalletIcon, Plus, CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';

const TOPUP_AMOUNTS = [100, 250, 500, 1000];

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

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const amount = searchParams.get('amount');

    if (success === 'true') {
      toast({
        title: t('wallet.paymentSuccess'),
        description: `$${amount} MXN ${t('wallet.paymentSuccessMessage')}`,
      });
      refreshWallet();
      setSearchParams({});
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
    navigate('/lives');
    return null;
  }

  const handleStripeCheckout = async () => {
    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount < 50) {
      toast({
        title: t('wallet.invalidAmount'),
        description: t('wallet.minAmount'),
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
        window.open(data.url, '_blank');
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <WalletIcon className="w-6 h-6 text-primary" />
          {t('wallet.title')}
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <p className="text-primary-foreground/80 text-sm mb-1">{t('wallet.balance')}</p>
              <p className="text-4xl font-bold">${balance.toLocaleString()} MXN</p>
              <p className="text-primary-foreground/60 text-xs mt-2">{user?.name}</p>
              {role === 'resident' && (
                <div className="mt-3 px-2 py-1 bg-white/20 rounded-full text-xs inline-block">
                  🎓 {t('wallet.residentDiscount')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {t('wallet.topUp')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {TOPUP_AMOUNTS.map(amount => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                    className="h-12"
                  >
                    ${amount} MXN
                  </Button>
                ))}
              </div>
              
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder={t('wallet.otherAmount')}
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                  className="pl-7"
                  min={50}
                />
              </div>

              <Button 
                onClick={handleStripeCheckout} 
                disabled={isProcessing || (!selectedAmount && !customAmount)}
                className="w-full h-12 gap-2"
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

        {/* Detailed Transaction History */}
        <div className="mt-6">
          <TransactionHistory />
        </div>
      </div>
    </MainLayout>
  );
}