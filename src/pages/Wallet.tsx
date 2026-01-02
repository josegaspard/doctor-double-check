import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wallet as WalletIcon, Plus, CreditCard, ArrowUpRight, ArrowDownLeft, Loader2, CheckCircle } from 'lucide-react';

const TOPUP_AMOUNTS = [500, 1000, 2000, 5000];

export default function Wallet() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { balance, transactions, topUp, isLoading } = useWallet();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  if (role !== 'patient' && role !== 'resident') {
    navigate('/lives');
    return null;
  }

  const handleTopUp = async () => {
    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount <= 0) return;

    const result = await topUp(amount);
    if (result.success) {
      setShowSuccess(true);
      setSelectedAmount(null);
      setCustomAmount('');
      setTimeout(() => setShowSuccess(false), 3000);
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
              <p className="text-4xl font-bold">${balance.toLocaleString()}</p>
              <p className="text-primary-foreground/60 text-xs mt-2">{user?.name}</p>
            </CardContent>
          </Card>

          {/* Top Up Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Recargar Saldo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {TOPUP_AMOUNTS.map(amount => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Otro monto"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                />
                <Button onClick={handleTopUp} disabled={isLoading || (!selectedAmount && !customAmount)}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                </Button>
              </div>
              {showSuccess && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Recarga exitosa
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-success/10' : 'bg-muted'}`}>
                      {tx.amount > 0 ? <ArrowDownLeft className="w-5 h-5 text-success" /> : <ArrowUpRight className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className={`font-semibold ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay movimientos</p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
