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
  const { language, t } = useLanguage();
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
        return <Badge variant="verified" className="text-[10px] sm:text-xs"><CheckCircle className="w-3 h-3 mr-1" />{t('autoI18n.earningsCard1')}</Badge>;
      case 'processing':
        return <Badge variant="warning" className="text-[10px] sm:text-xs"><Clock className="w-3 h-3 mr-1" />{t('autoI18n.earningsCard2')}</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-[10px] sm:text-xs"><AlertCircle className="w-3 h-3 mr-1" />{t('autoI18n.earningsCard3')}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] sm:text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/doctor/earnings')}
    >
      <CardHeader className="pb-1.5 sm:pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
          <span className="flex-1">{t('autoI18n.earningsCard4')}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {/* Earnings Summary */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {t('autoI18n.earningsCard5')}
              </span>
            </div>
            <p className="text-base sm:text-xl font-bold text-success">
              {formatCurrency(earnings?.pending_earnings || 0)}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {t('autoI18n.earningsCard6')}
              </span>
            </div>
            <p className="text-base sm:text-xl font-bold text-primary">
              {formatCurrency(earnings?.total_earnings || 0)}
            </p>
          </div>
        </div>

        {/* Payouts Status */}
        {!earnings?.payouts_enabled && (
          <div className="p-2.5 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-xs sm:text-sm text-foreground">
                {t('autoI18n.earningsCard7')}
              </p>
            </div>
          </div>
        )}

        {/* Recent Payouts */}
        {recentPayouts.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-1.5 text-muted-foreground">
              {t('autoI18n.earningsCard8')}
            </h4>
            <div className="space-y-1.5">
              {recentPayouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs sm:text-sm font-medium">{formatCurrency(payout.amount)}</span>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs justify-center"
            onClick={(e) => { e.stopPropagation(); navigate('/doctor/bank-account'); }}
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            {t('autoI18n.earningsCard9')}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs justify-center"
            onClick={(e) => { e.stopPropagation(); navigate('/doctor/invoices'); }}
          >
            {t('autoI18n.earningsCard10')}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
