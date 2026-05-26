import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsSkeleton, TableSkeleton } from '@/components/skeletons/CardSkeleton';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, Users, DollarSign, Stethoscope, Video, ArrowLeft,
  Star, Download, Wallet, Building, CreditCard, Banknote, ShoppingCart,
} from 'lucide-react';
import { format, subMonths, subWeeks, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthData { month: string; revenue: number; transactions: number; purchases: number; subscriptions: number; consultations: number; marketplace: number; }
interface AnalyticsData {
  totalRevenue: number; totalUsers: number; totalDoctors: number; totalLives: number;
  purchasesRevenue: number; subscriptionsRevenue: number; walletTopupsRevenue: number;
  totalRecordings: number; totalPurchases: number; consultationsRevenue: number;
  marketplaceRevenue: number; marketplaceOrders: number;
  totalPaidToDoctors: number; totalPendingPayouts: number;
  platformCommission: number; grossRevenue: number;
  recordingsPurchased: number;
  revenueByMonth: MonthData[];
  usersByRole: { role: string; count: number }[];
  topDoctors: { name: string; consultations: number; rating: number; revenue: number; pending: number }[];
  livesByMonth: { month: string; count: number }[];
}

const COLORS = ['hsl(168, 84%, 32%)', 'hsl(199, 89%, 48%)', 'hsl(45, 93%, 47%)', 'hsl(142, 72%, 42%)', 'hsl(0, 84%, 60%)'];
const formatCurrency = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('year');
  const printRef = useRef<HTMLDivElement>(null);

  const chartConfig = {
    revenue: { label: t('adminAnalytics.chartConfig.revenue'), color: 'hsl(168, 84%, 32%)' },
    purchases: { label: t('adminAnalytics.chartConfig.purchases'), color: 'hsl(199, 89%, 48%)' },
    subscriptions: { label: t('adminAnalytics.chartConfig.subscriptions'), color: 'hsl(45, 93%, 47%)' },
    consultations: { label: t('adminAnalytics.chartConfig.consultations'), color: 'hsl(142, 72%, 42%)' },
    lives: { label: t('adminAnalytics.chartConfig.lives'), color: 'hsl(0, 84%, 60%)' },
  };

  useEffect(() => {
    if (role && role !== 'admin') { navigate('/'); return; }
  }, [role]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (role !== 'admin') return;
      setIsLoading(true);
      try {
        const now = new Date();
        let dateFrom: Date;
        let monthCount: number;
        if (period === 'week') { dateFrom = startOfWeek(subWeeks(now, 4)); monthCount = 4; }
        else if (period === 'month') { dateFrom = startOfMonth(subMonths(now, 6)); monthCount = 6; }
        else { dateFrom = startOfYear(subMonths(now, 11)); monthCount = 12; }
        const dateFromStr = dateFrom.toISOString();

        const [
          { data: transactions }, { data: allPurchases }, { data: subscriptions },
          { count: totalRecordings }, { count: totalUsers }, { count: totalDoctors },
          { count: totalLives }, { data: rolesData }, { data: livesData },
          { data: doctorStats }, { count: recordingsPurchased },
          { data: marketplaceData },
        ] = await Promise.all([
          supabase.from('wallet_transactions').select('amount, type, created_at, status, metadata').eq('status', 'paid').gte('created_at', dateFromStr),
          supabase.from('purchases').select('amount, created_at').gte('created_at', dateFromStr),
          supabase.from('subscriptions').select('price_paid, created_at').eq('is_active', true).gte('created_at', dateFromStr),
          supabase.from('recordings').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('lives').select('*', { count: 'exact', head: true }),
          supabase.from('user_roles').select('role'),
          supabase.from('lives').select('id, started_at').gte('started_at', dateFromStr),
          supabase.from('doctor_profiles').select('user_id, total_consultations, rating, consultation_fee, pending_earnings, total_earnings').eq('status', 'approved').order('total_consultations', { ascending: false }).limit(10),
          supabase.from('purchases').select('*', { count: 'exact', head: true }),
          supabase.from('marketplace_orders').select('total_amount, created_at').in('status', ['paid', 'shipped', 'delivered']).gte('created_at', dateFromStr),
        ]);

        const walletTopupsRevenue = transactions?.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0) || 0;
        const purchasesRevenue = allPurchases?.reduce((s, p) => s + Number(p.amount), 0) || 0;
        const subscriptionsRevenue = subscriptions?.reduce((s, s2) => s + Number(s2.price_paid), 0) || 0;
        const consultationsRevenue = transactions?.filter(t => t.type === 'earning' && (t.metadata as any)?.source === 'consultation').reduce((s, t) => s + Number(t.amount), 0) || 0;
        const marketplaceRevenue = marketplaceData?.reduce((s, o) => s + Number(o.total_amount), 0) || 0;
        const marketplaceOrders = marketplaceData?.length || 0;

        // Doctor payment metrics
        const totalPaidToDoctors = doctorStats?.reduce((s, d) => s + Number(d.total_earnings || 0), 0) || 0;
        const totalPendingPayouts = doctorStats?.reduce((s, d) => s + Number(d.pending_earnings || 0), 0) || 0;
        // grossRevenue = actual sales only (NOT topups — topups are deposits, not revenue)
        const grossRevenue = purchasesRevenue + subscriptionsRevenue + consultationsRevenue + marketplaceRevenue;
        const platformCommission = grossRevenue - totalPaidToDoctors - totalPendingPayouts;

        const rolesCounts = rolesData?.reduce((acc: Record<string, number>, r) => { acc[r.role] = (acc[r.role] || 0) + 1; return acc; }, {}) || {};
        const usersByRole = Object.entries(rolesCounts).map(([r, count]) => ({ role: r.charAt(0).toUpperCase() + r.slice(1), count: count as number }));

        let topDoctors: AnalyticsData['topDoctors'] = [];
        if (doctorStats?.length) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', doctorStats.map(d => d.user_id));
          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
          topDoctors = doctorStats.map(d => ({
            name: profileMap.get(d.user_id) || t('adminAnalytics.doctorFallback'),
            consultations: d.total_consultations,
            rating: Number(d.rating),
            revenue: Number(d.total_earnings || 0) + Number(d.pending_earnings || 0),
            pending: Number(d.pending_earnings || 0),
          }));
        }

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const revenueByMonth: MonthData[] = [];
        const livesByMonth: { month: string; count: number }[] = [];

        if (period === 'week') {
          for (let i = 3; i >= 0; i--) {
            const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
            const label = `S${4 - i}`;
            const weekTx = transactions?.filter(t => { const d = new Date(t.created_at); return d >= weekStart && d <= weekEnd; }) || [];
            const topups = weekTx.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0);
            const mPurchases = weekTx.filter(t => t.type === 'purchase').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
            const mEarnings = weekTx.filter(t => t.type === 'earning' && (t.metadata as any)?.source === 'consultation').reduce((s, t) => s + Number(t.amount), 0);
            const mSubs = weekTx.filter(t => t.type === 'earning' && ((t.metadata as any)?.source === 'subscription' || (t.metadata as any)?.source === 'subscription_renewal')).reduce((s, t) => s + Number(t.amount), 0);
            const mMarketplace = marketplaceData?.filter(o => { const d = new Date(o.created_at); return d >= weekStart && d <= weekEnd; }).reduce((s, o) => s + Number(o.total_amount), 0) || 0;
            revenueByMonth.push({ month: label, revenue: topups, transactions: weekTx.length, purchases: mPurchases, subscriptions: mSubs, consultations: mEarnings, marketplace: mMarketplace });
            const weekLives = livesData?.filter(l => { const d = new Date(l.started_at); return d >= weekStart && d <= weekEnd; }) || [];
            livesByMonth.push({ month: label, count: weekLives.length });
          }
        } else {
          for (let i = monthCount - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = monthNames[date.getMonth()];
            const y = date.getFullYear(); const m = date.getMonth();
            const monthTx = transactions?.filter(t => { const d = new Date(t.created_at); return d.getFullYear() === y && d.getMonth() === m; }) || [];
            const topups = monthTx.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0);
            const mPurchases = monthTx.filter(t => t.type === 'purchase').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
            const mEarnings = monthTx.filter(t => t.type === 'earning' && (t.metadata as any)?.source === 'consultation').reduce((s, t) => s + Number(t.amount), 0);
            const mSubs = monthTx.filter(t => t.type === 'earning' && ((t.metadata as any)?.source === 'subscription' || (t.metadata as any)?.source === 'subscription_renewal')).reduce((s, t) => s + Number(t.amount), 0);
            const mMarketplace = marketplaceData?.filter(o => { const d = new Date(o.created_at); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, o) => s + Number(o.total_amount), 0) || 0;
            revenueByMonth.push({ month: label, revenue: topups, transactions: monthTx.length, purchases: mPurchases, subscriptions: mSubs, consultations: mEarnings, marketplace: mMarketplace });
            const monthLives = livesData?.filter(l => { const d = new Date(l.started_at); return d.getFullYear() === y && d.getMonth() === m; }) || [];
            livesByMonth.push({ month: label, count: monthLives.length });
          }
        }

        setAnalytics({
          totalRevenue: grossRevenue, // actual sales revenue, not including wallet deposits
          totalUsers: totalUsers || 0, totalDoctors: totalDoctors || 0, totalLives: totalLives || 0,
          purchasesRevenue, subscriptionsRevenue, walletTopupsRevenue, consultationsRevenue,
          marketplaceRevenue, marketplaceOrders,
          totalRecordings: totalRecordings || 0, totalPurchases: allPurchases?.length || 0,
          totalPaidToDoctors, totalPendingPayouts, platformCommission, grossRevenue,
          recordingsPurchased: recordingsPurchased || 0,
          revenueByMonth, usersByRole, topDoctors, livesByMonth,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error(t('adminAnalytics.toast.loadError'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [role, period]);

  const handlePrintPDF = () => {
    if (!analytics) return;
    const periodLabel = period === 'week'
      ? t('adminAnalytics.period.last4Weeks')
      : period === 'month'
        ? t('adminAnalytics.period.last6Months')
        : t('adminAnalytics.period.lastYear');
    const periodColumnLabel = period === 'week' ? t('adminAnalytics.period.week') : t('adminAnalytics.period.month');
    const generatedAt = format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
    const footerDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const subtitle = t('adminAnalytics.pdf.subtitle')
      .replace('{period}', periodLabel)
      .replace('{date}', generatedAt);
    const revenueByPeriodHeading = t('adminAnalytics.pdf.revenueByPeriod').replace('{period}', periodColumnLabel);
    const purchasesLabel = t('adminAnalytics.pdf.purchases').replace('{count}', String(analytics.totalPurchases));
    const marketplaceLabel = t('adminAnalytics.pdf.marketplace').replace('{count}', String(analytics.marketplaceOrders));
    const footerLabel = t('adminAnalytics.pdf.footer').replace('{date}', footerDate);

    const html = `<!DOCTYPE html><html><head><title>${t('adminAnalytics.pdf.title')}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#333;max-width:900px;margin:0 auto}
    h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:30px;border-bottom:2px solid #0d9488;padding-bottom:6px}
    .subtitle{color:#666;font-size:14px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center}
    .kpi .value{font-size:24px;font-weight:700;color:#0d9488}.kpi .label{font-size:12px;color:#666}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
    th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}th{background:#f9fafb;font-weight:600}
    .text-right{text-align:right}.text-success{color:#0d9488}.footer{margin-top:40px;text-align:center;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}
    @media print{body{padding:20px}}</style></head><body>
    <h1>${t('adminAnalytics.pdf.heading')}</h1>
    <p class="subtitle">${subtitle}</p>
    <h2>${t('adminAnalytics.pdf.keyIndicators')}</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${formatCurrency(analytics.grossRevenue)}</div><div class="label">${t('adminAnalytics.pdf.grossRevenue')}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.platformCommission)}</div><div class="label">${t('adminAnalytics.pdf.netPlatformProfit')}</div></div>
      <div class="kpi"><div class="value">${analytics.totalUsers}</div><div class="label">${t('adminAnalytics.pdf.totalUsers')}</div></div>
      <div class="kpi"><div class="value">${analytics.totalDoctors}</div><div class="label">${t('adminAnalytics.pdf.verifiedDoctors')}</div></div>
    </div>
    <h2>${t('adminAnalytics.pdf.doctorPayments')}</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${formatCurrency(analytics.totalPaidToDoctors)}</div><div class="label">${t('adminAnalytics.pdf.totalPaid')}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.totalPendingPayouts)}</div><div class="label">${t('adminAnalytics.pdf.pendingPayment')}</div></div>
    </div>
    <h2>${t('adminAnalytics.pdf.revenueBreakdown')}</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${formatCurrency(analytics.purchasesRevenue)}</div><div class="label">${purchasesLabel}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.subscriptionsRevenue)}</div><div class="label">${t('adminAnalytics.pdf.subscriptions')}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.walletTopupsRevenue)}</div><div class="label">${t('adminAnalytics.pdf.walletTopups')}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.consultationsRevenue)}</div><div class="label">${t('adminAnalytics.pdf.consultations')}</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.marketplaceRevenue)}</div><div class="label">${marketplaceLabel}</div></div>
    </div>
    <h2>${revenueByPeriodHeading}</h2>
    <table><thead><tr><th>${periodColumnLabel}</th><th class="text-right">${t('adminAnalytics.pdf.colTopups')}</th><th class="text-right">${t('adminAnalytics.pdf.colPurchases')}</th><th class="text-right">${t('adminAnalytics.pdf.colSubscriptions')}</th><th class="text-right">${t('adminAnalytics.pdf.colConsultations')}</th><th class="text-right">${t('adminAnalytics.pdf.colMarketplace')}</th><th class="text-right">${t('adminAnalytics.pdf.colTx')}</th></tr></thead><tbody>
    ${analytics.revenueByMonth.map(m => `<tr><td>${m.month}</td><td class="text-right">${formatCurrency(m.revenue)}</td><td class="text-right">${formatCurrency(m.purchases)}</td><td class="text-right">${formatCurrency(m.subscriptions)}</td><td class="text-right">${formatCurrency(m.consultations)}</td><td class="text-right">${formatCurrency(m.marketplace)}</td><td class="text-right">${m.transactions}</td></tr>`).join('')}
    </tbody></table>
    <h2>${t('adminAnalytics.pdf.topDoctors')}</h2>
    <table><thead><tr><th>${t('adminAnalytics.pdf.colNumber')}</th><th>${t('adminAnalytics.pdf.colName')}</th><th class="text-right">${t('adminAnalytics.pdf.colConsultationsCount')}</th><th class="text-right">${t('adminAnalytics.pdf.colRating')}</th><th class="text-right">${t('adminAnalytics.pdf.colRevenue')}</th><th class="text-right">${t('adminAnalytics.pdf.colPending')}</th></tr></thead><tbody>
    ${analytics.topDoctors.map((d, i) => `<tr><td>${i + 1}</td><td>${d.name}</td><td class="text-right">${d.consultations}</td><td class="text-right">${d.rating.toFixed(1)}</td><td class="text-right text-success">${formatCurrency(d.revenue)}</td><td class="text-right">${formatCurrency(d.pending)}</td></tr>`).join('')}
    </tbody></table>
    <div class="footer">${footerLabel}</div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }
    iframeDoc.open(); iframeDoc.write(html); iframeDoc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="back" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0 h-9 w-9">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-base sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
                <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">{t('adminAnalytics.header.title')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('adminAnalytics.header.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList className="h-8">
                <TabsTrigger value="week" className="text-xs h-7 px-2.5">{t('adminAnalytics.period.week')}</TabsTrigger>
                <TabsTrigger value="month" className="text-xs h-7 px-2.5">{t('adminAnalytics.period.month')}</TabsTrigger>
                <TabsTrigger value="year" className="text-xs h-7 px-2.5">{t('adminAnalytics.period.year')}</TabsTrigger>
              </TabsList>
            </Tabs>
            {analytics && (
              <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-1 text-xs h-8">
                <Download className="w-3.5 h-3.5" />
                PDF
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <><StatsSkeleton /><div className="mt-6"><TableSkeleton rows={3} columns={4} /></div></>
        ) : analytics ? (
          <div ref={printRef}>
            {/* Section 1: Ingresos Brutos & Ganancia Neta */}
            <h2 className="text-sm sm:text-base font-bold mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-success" />
              {t('adminAnalytics.financialSummary')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { value: formatCurrency(analytics.grossRevenue), label: t('adminAnalytics.kpi.grossRevenue'), icon: DollarSign, bg: 'bg-success/10', color: 'text-success' },
                { value: formatCurrency(analytics.platformCommission), label: t('adminAnalytics.kpi.netProfit'), icon: TrendingUp, bg: 'bg-primary/10', color: 'text-primary' },
                { value: analytics.totalUsers, label: t('adminAnalytics.kpi.users'), icon: Users, bg: 'bg-info/10', color: 'text-info' },
                { value: analytics.totalDoctors, label: t('adminAnalytics.kpi.doctors'), icon: Stethoscope, bg: 'bg-premium/10', color: 'text-premium' },
              ].map((s, i) => (
              <Card key={i}><CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}><s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} /></div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-2xl font-bold truncate">{s.value}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.label}</p>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>

            {/* Section 2: Pagos a Médicos */}
            <h2 className="text-sm sm:text-base font-bold mb-2 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-warning" />
              {t('adminAnalytics.doctorPayments')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { label: t('adminAnalytics.payments.totalPaid'), value: formatCurrency(analytics.totalPaidToDoctors), border: 'border-l-success' },
                { label: t('adminAnalytics.payments.pending'), value: formatCurrency(analytics.totalPendingPayouts), border: 'border-l-warning' },
                { label: t('adminAnalytics.payments.totalLives'), value: analytics.totalLives.toString(), border: 'border-l-live' },
                { label: t('adminAnalytics.payments.recordings'), value: `${analytics.recordingsPurchased} / ${analytics.totalRecordings}`, sub: t('adminAnalytics.payments.recordingsSub'), border: 'border-l-info' },
              ].map((item, i) => (
              <Card key={i} className={`border-l-4 ${item.border}`}><CardContent className="p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 truncate">{item.label}</p>
                  <p className="text-sm sm:text-xl font-bold truncate">{item.value}</p>
                  {item.sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground">{item.sub}</p>}
                </CardContent></Card>
              ))}
            </div>

            {/* Section 3: Desglose por Fuente */}
            <h2 className="text-sm sm:text-base font-bold mb-2 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-info" />
              {t('adminAnalytics.breakdownBySource')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                { label: t('adminAnalytics.source.videoPurchases'), value: formatCurrency(analytics.purchasesRevenue), sub: t('adminAnalytics.source.purchasesSub').replace('{count}', String(analytics.totalPurchases)), border: 'border-l-premium' },
                { label: t('adminAnalytics.source.subscriptions'), value: formatCurrency(analytics.subscriptionsRevenue), border: 'border-l-info' },
                { label: t('adminAnalytics.source.walletTopups'), value: formatCurrency(analytics.walletTopupsRevenue), border: 'border-l-success' },
                { label: t('adminAnalytics.source.medicalConsultations'), value: formatCurrency(analytics.consultationsRevenue), border: 'border-l-primary' },
                { label: t('adminAnalytics.source.marketplace'), value: formatCurrency(analytics.marketplaceRevenue), sub: t('adminAnalytics.source.marketplaceSub').replace('{count}', String(analytics.marketplaceOrders)), border: 'border-l-warning' },
              ].map((item, i) => (
              <Card key={i} className={`border-l-4 ${item.border}`}><CardContent className="p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 truncate">{item.label}</p>
                  <p className="text-sm sm:text-xl font-bold truncate">{item.value}</p>
                  {item.sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground">{item.sub}</p>}
                </CardContent></Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <Card>
                <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg flex items-center gap-2"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />{t('adminAnalytics.charts.revenueByPeriod').replace('{period}', period === 'week' ? t('adminAnalytics.period.week') : t('adminAnalytics.period.month'))}</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px]">
                    <AreaChart data={analytics.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(168, 84%, 32%)" fill="hsl(168, 84%, 32%, 0.2)" name={t('adminAnalytics.charts.legend.topups')} />
                      <Area type="monotone" dataKey="purchases" stroke="hsl(199, 89%, 48%)" fill="hsl(199, 89%, 48%, 0.1)" name={t('adminAnalytics.charts.legend.purchases')} />
                      <Area type="monotone" dataKey="consultations" stroke="hsl(142, 72%, 42%)" fill="hsl(142, 72%, 42%, 0.1)" name={t('adminAnalytics.charts.legend.consultations')} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg flex items-center gap-2"><Users className="w-4 h-4 sm:w-5 sm:h-5" />{t('adminAnalytics.charts.usersByRole')}</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px]">
                    <PieChart>
                      <Pie data={analytics.usersByRole} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="count" nameKey="role"
                        label={({ role, percent }) => `${role} ${(percent * 100).toFixed(0)}%`}>
                        {analytics.usersByRole.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg flex items-center gap-2"><Video className="w-4 h-4 sm:w-5 sm:h-5" />{t('adminAnalytics.charts.livesByPeriod').replace('{period}', period === 'week' ? t('adminAnalytics.period.week') : t('adminAnalytics.period.month'))}</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px]">
                    <BarChart data={analytics.livesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name={t('adminAnalytics.charts.legend.lives')} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />{t('adminAnalytics.charts.topDoctors')}</CardTitle></CardHeader>
                <CardContent>
                  {analytics.topDoctors.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topDoctors.slice(0, 5).map((doctor, i) => (
                        <div key={i} className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs sm:text-sm truncate">{doctor.name}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{t('adminAnalytics.charts.consultationsCount').replace('{count}', String(doctor.consultations))}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs sm:text-sm font-medium text-success">{formatCurrency(doctor.revenue)}</p>
                            <div className="flex items-center gap-0.5 justify-end text-[10px] sm:text-xs text-muted-foreground">
                              <Star className="w-3 h-3 fill-premium text-premium" />{doctor.rating.toFixed(1)}
                              {doctor.pending > 0 && <span className="ml-1 text-warning">{t('adminAnalytics.charts.pendingShort').replace('{amount}', formatCurrency(doctor.pending))}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-center text-muted-foreground py-8 text-sm">{t('adminAnalytics.charts.noData')}</p>}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Table — responsive */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4"><CardTitle className="text-sm sm:text-lg">{t('adminAnalytics.table.title').replace('{period}', period === 'week' ? t('adminAnalytics.table.titleWeekly') : t('adminAnalytics.table.titleMonthly'))}</CardTitle></CardHeader>
              <CardContent>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-left p-2 font-semibold">{period === 'week' ? t('adminAnalytics.table.colPeriodWeek') : t('adminAnalytics.table.colPeriod')}</th>
                      <th className="text-right p-2 font-semibold">{t('adminAnalytics.table.colTopups')}</th>
                      <th className="text-right p-2 font-semibold">{t('adminAnalytics.table.colPurchases')}</th>
                      <th className="text-right p-2 font-semibold">{t('adminAnalytics.table.colSubscriptions')}</th>
                      <th className="text-right p-2 font-semibold">{t('adminAnalytics.table.colConsultations')}</th>
                      <th className="text-right p-2 font-semibold">{t('adminAnalytics.table.colTx')}</th>
                    </tr></thead>
                    <tbody>
                      {analytics.revenueByMonth.map((m, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium">{m.month}</td>
                          <td className="p-2 text-right text-success">{formatCurrency(m.revenue)}</td>
                          <td className="p-2 text-right">{formatCurrency(m.purchases)}</td>
                          <td className="p-2 text-right">{formatCurrency(m.subscriptions)}</td>
                          <td className="p-2 text-right">{formatCurrency(m.consultations)}</td>
                          <td className="p-2 text-right">{m.transactions}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-muted/50">
                        <td className="p-2">{t('adminAnalytics.table.total')}</td>
                        <td className="p-2 text-right text-success">{formatCurrency(analytics.revenueByMonth.reduce((s, m) => s + m.revenue, 0))}</td>
                        <td className="p-2 text-right">{formatCurrency(analytics.revenueByMonth.reduce((s, m) => s + m.purchases, 0))}</td>
                        <td className="p-2 text-right">{formatCurrency(analytics.revenueByMonth.reduce((s, m) => s + m.subscriptions, 0))}</td>
                        <td className="p-2 text-right">{formatCurrency(analytics.revenueByMonth.reduce((s, m) => s + m.consultations, 0))}</td>
                        <td className="p-2 text-right">{analytics.revenueByMonth.reduce((s, m) => s + m.transactions, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {analytics.revenueByMonth.map((m, i) => (
                    <div key={i} className="p-2.5 rounded-lg border bg-muted/20">
                      <p className="font-semibold text-xs mb-1.5">{m.month}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-muted-foreground">{t('adminAnalytics.table.mobile.topups')}</span>
                        <span className="text-right text-success font-medium">{formatCurrency(m.revenue)}</span>
                        <span className="text-muted-foreground">{t('adminAnalytics.table.mobile.purchases')}</span>
                        <span className="text-right font-medium">{formatCurrency(m.purchases)}</span>
                        <span className="text-muted-foreground">{t('adminAnalytics.table.mobile.subscriptions')}</span>
                        <span className="text-right font-medium">{formatCurrency(m.subscriptions)}</span>
                        <span className="text-muted-foreground">{t('adminAnalytics.table.mobile.consultations')}</span>
                        <span className="text-right font-medium">{formatCurrency(m.consultations)}</span>
                        <span className="text-muted-foreground">{t('adminAnalytics.table.mobile.transactions')}</span>
                        <span className="text-right font-medium">{m.transactions}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
