import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Clock, 
  CheckCircle,
  Video,
  MessageSquare,
  Users,
  Loader2,
  Calendar,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  metadata: any;
}

interface PayoutRecord {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_transfer_id: string | null;
  error_message: string | null;
}

interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  thisMonthEarnings: number;
  consultationEarnings: number;
  recordingEarnings: number;
  subscriptionEarnings: number;
}

export default function DoctorEarnings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [commissionRate, setCommissionRate] = useState(20);
  const [summary, setSummary] = useState<EarningsSummary>({
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    thisMonthEarnings: 0,
    consultationEarnings: 0,
    recordingEarnings: 0,
    subscriptionEarnings: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const locale = language === 'es' ? es : enUS;

  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/');
      return;
    }
    loadEarningsData();
  }, [role, navigate]);

  const loadEarningsData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'earning')
        .order('created_at', { ascending: false });

      const { data: payoutData } = await supabase
        .from('doctor_payouts')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (payoutData) setPayouts(payoutData);

      const { data: settingsData } = await supabase
        .from('payout_settings_public')
        .select('commission_percentage')
        .limit(1)
        .maybeSingle();
      if (settingsData?.commission_percentage) setCommissionRate(settingsData.commission_percentage);

      if (txData) {
        setTransactions(txData);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let consultation = 0, recording = 0, subscription = 0;
        let thisMonth = 0;

        txData.forEach(tx => {
          const metadata = tx.metadata as Record<string, any> | null;
          const source = metadata?.source || '';
          if (source === 'consultation') consultation += tx.amount;
          else if (source === 'recording') recording += tx.amount;
          else if (source === 'subscription' || source === 'subscription_renewal') subscription += tx.amount;

          if (new Date(tx.created_at) >= startOfMonth) {
            thisMonth += tx.amount;
          }
        });

        const { data: profile } = await supabase
          .from('doctor_profiles')
          .select('pending_earnings, total_earnings')
          .eq('user_id', user.id)
          .single();

        const totalPaid = profile?.total_earnings || 0;
        const pending = profile?.pending_earnings || 0;
        setSummary({
          totalEarnings: totalPaid + pending,
          pendingEarnings: pending,
          paidEarnings: totalPaid,
          thisMonthEarnings: thisMonth,
          consultationEarnings: consultation,
          recordingEarnings: recording,
          subscriptionEarnings: subscription,
        });

        const monthlyMap = new Map<string, number>();
        txData.forEach(tx => {
          const monthKey = format(new Date(tx.created_at), 'MMM yyyy', { locale });
          const current = monthlyMap.get(monthKey) || 0;
          monthlyMap.set(monthKey, current + tx.amount);
        });

        const chartData = Array.from(monthlyMap.entries())
          .slice(0, 6)
          .reverse()
          .map(([month, amount]) => ({ month, amount }));

        setMonthlyData(chartData);
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'consultation': return <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-info" />;
      case 'recording': return <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />;
      case 'subscription': 
      case 'subscription_renewal': return <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />;
      default: return <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'consultation': return t('autoI18n.doctorEarnings1');
      case 'recording': return t('autoI18n.doctorEarnings2');
      case 'subscription': return t('autoI18n.doctorEarnings3');
      case 'subscription_renewal': return t('autoI18n.doctorEarnings4');
      default: return t('autoI18n.doctorEarnings5');
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.info(t('autoI18n.doctorEarnings6'));
      return;
    }
    const headers = ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Estado'];
    const rows = transactions.map(tx => [
      format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
      tx.description,
      getSourceLabel((tx.metadata as Record<string, any>)?.source),
      tx.amount.toFixed(2),
      tx.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ganancias_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('autoI18n.doctorEarnings7'));
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="verified" className="gap-0.5 text-[10px] sm:text-xs"><CheckCircle className="w-3 h-3" />{t('autoI18n.doctorEarnings8')}</Badge>;
      case 'processing': return <Badge variant="warning" className="gap-0.5 text-[10px] sm:text-xs"><Clock className="w-3 h-3" />{t('autoI18n.doctorEarnings9')}</Badge>;
      case 'failed': return <Badge className="gap-0.5 text-[10px] sm:text-xs bg-destructive text-destructive-foreground">{t('autoI18n.doctorEarnings10')}</Badge>;
      default: return <Badge variant="outline" className="gap-0.5 text-[10px] sm:text-xs"><Clock className="w-3 h-3" />{t('autoI18n.doctorEarnings11')}</Badge>;
    }
  };

  const getPayoutMethodBadge = (transferId: string | null) => {
    if (transferId?.startsWith('manual_')) {
      return <Badge variant="secondary" className="text-[10px]">{t('autoI18n.doctorEarnings12')}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Stripe</Badge>;
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button
            variant="back"
            size="icon"
            onClick={() => navigate('/doctor/dashboard')}
            className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground truncate">
              {t('autoI18n.doctorEarnings13')}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {t('autoI18n.doctorEarnings14')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards - 2x2 on mobile, 4 cols on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { label: t('autoI18n.doctorEarnings15'), value: summary.totalEarnings, icon: DollarSign, colorClass: 'text-success', bgClass: 'bg-success/10' },
                { label: t('autoI18n.doctorEarnings16'), value: summary.pendingEarnings, icon: Clock, colorClass: 'text-warning', bgClass: 'bg-warning/10' },
                { label: t('autoI18n.doctorEarnings17'), value: summary.thisMonthEarnings, icon: TrendingUp, colorClass: 'text-info', bgClass: 'bg-info/10' },
                { label: t('autoI18n.doctorEarnings18'), value: summary.paidEarnings, icon: CheckCircle, colorClass: 'text-success', bgClass: 'bg-success/10' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.label}>
                    <CardContent className="p-2.5 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1 sm:p-1.5 rounded-md ${card.bgClass}`}>
                          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${card.colorClass}`} />
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.label}</p>
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-foreground pl-0.5">${card.value.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Chart + Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Monthly Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg">
                    {t('autoI18n.doctorEarnings19')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pr-1 sm:pr-6">
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160} className="sm:!h-[220px]">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <Tooltip 
                          formatter={(value: number) => [`$${value.toLocaleString()}`, t('autoI18n.doctorEarnings20')]}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[160px] sm:h-[220px] text-muted-foreground text-sm">
                      {t('autoI18n.doctorEarnings21')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Breakdown by Type */}
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg">
                    {t('autoI18n.doctorEarnings22')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3">
                  {[
                    { icon: MessageSquare, label: t('autoI18n.doctorEarnings23'), value: summary.consultationEarnings, colorClass: 'text-info', bgClass: 'bg-info/10' },
                    { icon: Video, label: t('autoI18n.doctorEarnings24'), value: summary.recordingEarnings, colorClass: 'text-primary', bgClass: 'bg-primary/10' },
                    { icon: Users, label: t('autoI18n.doctorEarnings25'), value: summary.subscriptionEarnings, colorClass: 'text-warning', bgClass: 'bg-warning/10' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className={`flex items-center justify-between p-2.5 sm:p-3 ${item.bgClass} rounded-lg`}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${item.colorClass}`} />
                          <span className="text-xs sm:text-sm">{item.label}</span>
                        </div>
                        <span className="font-semibold text-sm">${item.value.toLocaleString()}</span>
                      </div>
                    );
                  })}

                  <hr className="border-border" />
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {t('autoI18n.doctorEarnings26')}
                      </span>
                    </div>
                    <span className="font-semibold text-sm text-muted-foreground">{commissionRate}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transactions & Payouts in Tabs on mobile */}
            <Tabs defaultValue="transactions" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <TabsList className="grid grid-cols-2 w-full sm:w-auto">
                  <TabsTrigger value="transactions" className="text-xs sm:text-sm gap-1">
                    <Wallet className="w-3.5 h-3.5" />
                    {t('autoI18n.doctorEarnings27')}
                  </TabsTrigger>
                  <TabsTrigger value="payouts" className="text-xs sm:text-sm gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('autoI18n.doctorEarnings28')}
                  </TabsTrigger>
                </TabsList>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 h-8 text-xs flex-shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>

              <TabsContent value="transactions">
                <Card>
                  <CardContent className="p-0">
                    {transactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {t('autoI18n.doctorEarnings29')}
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {transactions.map((tx) => (
                          <div 
                            key={tx.id} 
                            className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {getSourceIcon(tx.metadata?.source)}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs sm:text-sm truncate">{tx.description}</p>
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                  <span>{format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale })}</span>
                                  <span>·</span>
                                  <span>{getSourceLabel((tx.metadata as Record<string, any>)?.source)}</span>
                                </div>
                              </div>
                            </div>
                            <span className="font-bold text-sm text-success flex-shrink-0 ml-2">
                              +${tx.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payouts">
                <Card>
                  <CardContent className="p-0">
                    {payouts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {t('autoI18n.doctorEarnings30')}
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {payouts.map((payout) => (
                          <div 
                            key={payout.id} 
                            className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="p-1.5 rounded-md bg-success/10 flex-shrink-0">
                                <DollarSign className="w-3.5 h-3.5 text-success" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-medium">
                                    {t('autoI18n.doctorEarnings31')}
                                  </span>
                                  {getPayoutMethodBadge(payout.stripe_transfer_id)}
                                  {getPayoutStatusBadge(payout.status)}
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(payout.created_at), 'dd MMM yyyy', { locale })}
                                </p>
                                {payout.error_message && (
                                  <p className="text-[10px] text-destructive mt-0.5 truncate">{payout.error_message}</p>
                                )}
                              </div>
                            </div>
                            <span className="font-bold text-sm text-success flex-shrink-0 ml-2">
                              ${payout.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  );
}
