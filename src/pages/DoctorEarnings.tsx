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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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
      // Fetch all earning transactions
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'earning')
        .order('created_at', { ascending: false });

      // Fetch payout history
      const { data: payoutData } = await supabase
        .from('doctor_payouts')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (payoutData) setPayouts(payoutData);

      // Fetch commission rate
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

        const totalEarnings = txData.reduce((sum, tx) => sum + tx.amount, 0);

        const { data: profile } = await supabase
          .from('doctor_profiles')
          .select('pending_earnings, total_earnings')
          .eq('user_id', user.id)
          .single();

          // total_earnings = already paid out, pending_earnings = waiting
          // Total ever earned = total_earnings + pending_earnings
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
      case 'consultation': return <MessageSquare className="w-4 h-4 text-info" />;
      case 'recording': return <Video className="w-4 h-4 text-primary" />;
      case 'subscription': 
      case 'subscription_renewal': return <Users className="w-4 h-4 text-warning" />;
      default: return <DollarSign className="w-4 h-4 text-success" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'consultation': return language === 'es' ? 'Orientación' : 'Consultation';
      case 'recording': return language === 'es' ? 'Grabación' : 'Recording';
      case 'subscription': return language === 'es' ? 'Suscripción' : 'Subscription';
      case 'subscription_renewal': return language === 'es' ? 'Renovación' : 'Renewal';
      default: return language === 'es' ? 'Otro' : 'Other';
    }
  };

  // FIX #9: CSV export
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.info(language === 'es' ? 'No hay datos para exportar' : 'No data to export');
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
    toast.success(language === 'es' ? 'CSV descargado' : 'CSV downloaded');
  };

  const getPayoutStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{language === 'es' ? 'Pagado' : 'Paid'}</Badge>;
      case 'processing': return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{language === 'es' ? 'En proceso' : 'Processing'}</Badge>;
      case 'failed': return <Badge className="gap-1 bg-destructive text-destructive-foreground">{language === 'es' ? 'Fallido' : 'Failed'}</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{language === 'es' ? 'Pendiente' : 'Pending'}</Badge>;
    }
  };

  const getPayoutMethodBadge = (transferId: string | null) => {
    if (transferId?.startsWith('manual_')) {
      return <Badge variant="secondary" className="text-xs">{language === 'es' ? 'Banco' : 'Bank'}</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Stripe</Badge>;
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/doctor/dashboard')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === 'es' ? 'Volver al panel' : 'Back to dashboard'}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {language === 'es' ? 'Mis Ganancias' : 'My Earnings'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' 
              ? 'Resumen detallado de tus ingresos en la plataforma' 
              : 'Detailed summary of your platform earnings'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card>
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {language === 'es' ? 'Total Ganado' : 'Total Earned'}
                      </p>
                      <p className="text-lg sm:text-2xl font-bold">${summary.totalEarnings.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {language === 'es' ? 'Pendiente' : 'Pending'}
                      </p>
                      <p className="text-lg sm:text-2xl font-bold">${summary.pendingEarnings.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-info/10">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-info" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {language === 'es' ? 'Este Mes' : 'This Month'}
                      </p>
                      <p className="text-lg sm:text-2xl font-bold">${summary.thisMonthEarnings.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {language === 'es' ? 'Pagado' : 'Paid'}
                      </p>
                      <p className="text-lg sm:text-2xl font-bold">${summary.paidEarnings.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts & Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Monthly Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'es' ? 'Ingresos Mensuales' : 'Monthly Earnings'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200} className="sm:!h-[250px]">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                      {language === 'es' ? 'Sin datos aún' : 'No data yet'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Breakdown by Type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'es' ? 'Por Tipo' : 'By Type'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-info" />
                      <span className="text-sm">{language === 'es' ? 'Orientaciones' : 'Consultations'}</span>
                    </div>
                    <span className="font-semibold">${summary.consultationEarnings.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      <span className="text-sm">{language === 'es' ? 'Grabaciones' : 'Recordings'}</span>
                    </div>
                    <span className="font-semibold">${summary.recordingEarnings.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-warning" />
                      <span className="text-sm">{language === 'es' ? 'Suscripciones' : 'Subscriptions'}</span>
                    </div>
                    <span className="font-semibold">${summary.subscriptionEarnings.toLocaleString()}</span>
                  </div>

                  {/* Commission info */}
                  <hr className="border-border" />
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {language === 'es' ? 'Comisión plataforma' : 'Platform commission'}
                      </span>
                    </div>
                    <span className="font-semibold text-muted-foreground">{commissionRate}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction History */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    {language === 'es' ? 'Historial de Transacciones' : 'Transaction History'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es' 
                      ? 'Todas tus ganancias detalladas' 
                      : 'All your detailed earnings'}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === 'es' ? 'No hay transacciones aún' : 'No transactions yet'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getSourceIcon(tx.metadata?.source)}
                          <div>
                            <p className="font-medium text-sm">{tx.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel((tx.metadata as Record<string, any>)?.source)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <span className="font-bold text-success">
                          +${tx.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payout History */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {language === 'es' ? 'Historial de Pagos' : 'Payout History'}
                </CardTitle>
                <CardDescription>
                  {language === 'es' 
                    ? 'Registro de todos los pagos que has recibido' 
                    : 'Record of all payouts you have received'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === 'es' ? 'No hay pagos registrados aún' : 'No payouts recorded yet'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payouts.map((payout) => (
                      <div 
                        key={payout.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-success/10">
                            <DollarSign className="w-4 h-4 text-success" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {language === 'es' ? 'Pago recibido' : 'Payout received'}
                              </p>
                              {getPayoutMethodBadge(payout.stripe_transfer_id)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(payout.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                              {getPayoutStatusBadge(payout.status)}
                            </div>
                            {payout.error_message && (
                              <p className="text-xs text-destructive mt-1">{payout.error_message}</p>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-success">
                          ${payout.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
