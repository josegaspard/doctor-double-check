import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CreditCard, 
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface EarningsData {
  pending_earnings: number;
  total_earnings: number;
  payouts_enabled: boolean;
}

interface PayoutData {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export function EarningsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [recentPayouts, setRecentPayouts] = useState<PayoutData[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchEarningsData();
    }
  }, [user?.id]);

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      // Fetch doctor profile earnings
      const { data: profile } = await supabase
        .from('doctor_profiles')
        .select('pending_earnings, total_earnings, payouts_enabled')
        .eq('user_id', user!.id)
        .single();

      if (profile) {
        setEarnings({
          pending_earnings: profile.pending_earnings || 0,
          total_earnings: profile.total_earnings || 0,
          payouts_enabled: profile.payouts_enabled || false,
        });
      }

      // Fetch recent payouts
      const { data: payouts } = await supabase
        .from('doctor_payouts')
        .select('id, amount, status, created_at')
        .eq('doctor_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (payouts) {
        setRecentPayouts(payouts);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="verified" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />{language === 'es' ? 'Pagado' : 'Paid'}</Badge>;
      case 'processing':
        return <Badge variant="warning" className="text-xs"><Clock className="w-3 h-3 mr-1" />{language === 'es' ? 'Procesando' : 'Processing'}</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" />{language === 'es' ? 'Fallido' : 'Failed'}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/doctor/earnings')}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-success" />
          <span className="flex-1">{language === 'es' ? 'Ganancias' : 'Earnings'}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Earnings Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">
                {language === 'es' ? 'Pendiente' : 'Pending'}
              </span>
            </div>
            <p className="text-xl font-bold text-success">
              {formatCurrency(earnings?.pending_earnings || 0)}
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                {language === 'es' ? 'Total' : 'Total'}
              </span>
            </div>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(earnings?.total_earnings || 0)}
            </p>
          </div>
        </div>

        {/* Payouts Status */}
        {!earnings?.payouts_enabled && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <p className="text-sm text-foreground">
                {language === 'es' 
                  ? 'Configura tu cuenta bancaria para recibir pagos'
                  : 'Set up your bank account to receive payments'}
              </p>
            </div>
          </div>
        )}

        {/* Recent Payouts */}
        {recentPayouts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              {language === 'es' ? 'Pagos recientes' : 'Recent payouts'}
            </h4>
            <div className="space-y-2">
              {recentPayouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatCurrency(payout.amount)}</span>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={() => navigate('/doctor/bank-account')}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {language === 'es' ? 'Cuenta bancaria' : 'Bank account'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-between"
            onClick={() => navigate('/doctor/invoices')}
          >
            <span>{language === 'es' ? 'Facturas y pagos' : 'Invoices & payments'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
