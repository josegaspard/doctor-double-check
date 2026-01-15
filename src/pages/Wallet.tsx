import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wallet as WalletIcon, Plus, CreditCard, ArrowUpRight, ArrowDownLeft, Loader2, CheckCircle, ExternalLink } from 'lucide-react';

const TOPUP_AMOUNTS = [100, 250, 500, 1000];

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { balance, transactions, isLoading, refreshWallet } = useWallet();
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle Stripe redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const amount = searchParams.get('amount');

    if (success === 'true') {
      toast({
        title: '¡Pago exitoso!',
        description: `Se han añadido $${amount} MXN a tu wallet`,
      });
      refreshWallet();
      // Clear URL params
      setSearchParams({});
    } else if (canceled === 'true') {
      toast({
        title: 'Pago cancelado',
        description: 'No se realizó ningún cargo',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshWallet, toast]);

  if (role !== 'patient' && role !== 'resident') {
    navigate('/lives');
    return null;
  }

  const handleStripeCheckout = async () => {
    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount < 50) {
      toast({
        title: 'Monto inválido',
        description: 'El monto mínimo es de $50 MXN',
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
        // Open Stripe Checkout in new tab
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar el proceso de pago',
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
          Mi Wallet
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <p className="text-primary-foreground/80 text-sm mb-1">Saldo disponible</p>
              <p className="text-4xl font-bold">${balance.toLocaleString()} MXN</p>
              <p className="text-primary-foreground/60 text-xs mt-2">{user?.name}</p>
              {role === 'resident' && (
                <div className="mt-3 px-2 py-1 bg-white/20 rounded-full text-xs inline-block">
                  🎓 50% descuento en compras
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Up Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Recargar con Tarjeta
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
                  placeholder="Otro monto (mín. $50)"
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
                    Pagar con Stripe
                    <ExternalLink className="w-3 h-3" />
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Pago seguro procesado por Stripe. Se aceptan tarjetas de crédito y débito.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Movimientos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-100' : 'bg-muted'}`}>
                      {tx.amount > 0 ? (
                        <ArrowDownLeft className="w-5 h-5 text-green-600" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-foreground'}`}>
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                      </span>
                      <p className="text-xs text-muted-foreground">{tx.status === 'paid' ? '✓ Completado' : tx.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <WalletIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay movimientos aún</p>
                <p className="text-sm text-muted-foreground">Recarga tu wallet para empezar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
