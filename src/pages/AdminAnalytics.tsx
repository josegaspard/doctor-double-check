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
  Star, Download, Printer,
} from 'lucide-react';
import { format, subMonths, subWeeks, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthData { month: string; revenue: number; transactions: number; purchases: number; subscriptions: number; consultations: number; }
interface AnalyticsData {
  totalRevenue: number; totalUsers: number; totalDoctors: number; totalLives: number;
  purchasesRevenue: number; subscriptionsRevenue: number; walletTopupsRevenue: number;
  totalRecordings: number; totalPurchases: number; consultationsRevenue: number;
  revenueByMonth: MonthData[];
  usersByRole: { role: string; count: number }[];
  topDoctors: { name: string; consultations: number; rating: number; revenue: number }[];
  livesByMonth: { month: string; count: number }[];
}

const COLORS = ['hsl(168, 84%, 32%)', 'hsl(199, 89%, 48%)', 'hsl(45, 93%, 47%)', 'hsl(142, 72%, 42%)'];
const chartConfig = {
  revenue: { label: 'Ingresos', color: 'hsl(168, 84%, 32%)' },
  purchases: { label: 'Compras', color: 'hsl(199, 89%, 48%)' },
  subscriptions: { label: 'Suscripciones', color: 'hsl(45, 93%, 47%)' },
  consultations: { label: 'Consultas', color: 'hsl(142, 72%, 42%)' },
  lives: { label: 'Lives', color: 'hsl(0, 84%, 60%)' },
};

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('year');
  const printRef = useRef<HTMLDivElement>(null);

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
          { data: doctorStats },
        ] = await Promise.all([
          supabase.from('wallet_transactions').select('amount, type, created_at, status, metadata').eq('status', 'paid').gte('created_at', dateFromStr),
          supabase.from('purchases').select('amount, created_at'),
          supabase.from('subscriptions').select('price_paid, created_at').eq('is_active', true),
          supabase.from('recordings').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('lives').select('*', { count: 'exact', head: true }),
          supabase.from('user_roles').select('role'),
          supabase.from('lives').select('id, started_at').gte('started_at', dateFromStr),
          supabase.from('doctor_profiles').select('user_id, total_consultations, rating, consultation_fee, pending_earnings, total_earnings').eq('status', 'approved').order('total_consultations', { ascending: false }).limit(10),
        ]);

        const walletTopupsRevenue = transactions?.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0) || 0;
        const purchasesRevenue = allPurchases?.reduce((s, p) => s + Number(p.amount), 0) || 0;
        const subscriptionsRevenue = subscriptions?.reduce((s, s2) => s + Number(s2.price_paid), 0) || 0;
        
        // Calculate consultations revenue from earning transactions with source=consultation
        const consultationsRevenue = transactions?.filter(t => t.type === 'earning' && (t.metadata as any)?.source === 'consultation').reduce((s, t) => s + Number(t.amount), 0) || 0;

        const rolesCounts = rolesData?.reduce((acc: Record<string, number>, r) => { acc[r.role] = (acc[r.role] || 0) + 1; return acc; }, {}) || {};
        const usersByRole = Object.entries(rolesCounts).map(([r, count]) => ({ role: r.charAt(0).toUpperCase() + r.slice(1), count: count as number }));

        // Top doctors
        let topDoctors: AnalyticsData['topDoctors'] = [];
        if (doctorStats?.length) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', doctorStats.map(d => d.user_id));
          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
          topDoctors = doctorStats.map(d => ({
            name: profileMap.get(d.user_id) || 'Doctor',
            consultations: d.total_consultations,
            rating: Number(d.rating),
            revenue: Number(d.total_earnings || 0) + Number(d.pending_earnings || 0),
          }));
        }

        // Build month-by-month data
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const revenueByMonth: MonthData[] = [];
        const livesByMonth: { month: string; count: number }[] = [];

        for (let i = monthCount - 1; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = monthNames[date.getMonth()];
          const y = date.getFullYear(); const m = date.getMonth();

          const monthTx = transactions?.filter(t => { const d = new Date(t.created_at); return d.getFullYear() === y && d.getMonth() === m; }) || [];
          const topups = monthTx.filter(t => t.type === 'topup').reduce((s, t) => s + Number(t.amount), 0);
          const mPurchases = monthTx.filter(t => t.type === 'purchase').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
          const mEarnings = monthTx.filter(t => t.type === 'earning' && (t.metadata as any)?.source === 'consultation').reduce((s, t) => s + Number(t.amount), 0);
          const mSubs = monthTx.filter(t => t.type === 'earning' && ((t.metadata as any)?.source === 'subscription' || (t.metadata as any)?.source === 'subscription_renewal')).reduce((s, t) => s + Number(t.amount), 0);

          revenueByMonth.push({ month: label, revenue: topups, transactions: monthTx.length, purchases: mPurchases, subscriptions: mSubs, consultations: mEarnings });

          const monthLives = livesData?.filter(l => { const d = new Date(l.started_at); return d.getFullYear() === y && d.getMonth() === m; }) || [];
          livesByMonth.push({ month: label, count: monthLives.length });
        }

        setAnalytics({
          totalRevenue: walletTopupsRevenue,
          totalUsers: totalUsers || 0, totalDoctors: totalDoctors || 0, totalLives: totalLives || 0,
          purchasesRevenue, subscriptionsRevenue, walletTopupsRevenue, consultationsRevenue,
          totalRecordings: totalRecordings || 0, totalPurchases: allPurchases?.length || 0,
          revenueByMonth, usersByRole, topDoctors, livesByMonth,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Error al cargar analytics');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [role, period]);

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !analytics) return;
    const periodLabel = period === 'week' ? 'Últimas 4 semanas' : period === 'month' ? 'Últimos 6 meses' : 'Último año';
    const formatCurrency = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Reporte Analytics - Medical Masters</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#333;max-width:900px;margin:0 auto}
    h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:30px;border-bottom:2px solid #0d9488;padding-bottom:6px}
    .subtitle{color:#666;font-size:14px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center}
    .kpi .value{font-size:24px;font-weight:700;color:#0d9488}.kpi .label{font-size:12px;color:#666}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
    th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}th{background:#f9fafb;font-weight:600}
    .text-right{text-align:right}.text-success{color:#0d9488}.footer{margin-top:40px;text-align:center;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}
    @media print{body{padding:20px}}</style></head><body>
    <h1>📊 Reporte de Analytics</h1>
    <p class="subtitle">Medical Masters · Período: ${periodLabel} · Generado: ${format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
    
    <h2>Indicadores Clave</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${formatCurrency(analytics.totalRevenue)}</div><div class="label">Ingresos Totales (Recargas)</div></div>
      <div class="kpi"><div class="value">${analytics.totalUsers}</div><div class="label">Usuarios Totales</div></div>
      <div class="kpi"><div class="value">${analytics.totalDoctors}</div><div class="label">Médicos Verificados</div></div>
      <div class="kpi"><div class="value">${analytics.totalLives}</div><div class="label">Lives Totales</div></div>
    </div>
    
    <h2>Desglose de Ingresos</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${formatCurrency(analytics.purchasesRevenue)}</div><div class="label">Compras de Videos (${analytics.totalPurchases})</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.subscriptionsRevenue)}</div><div class="label">Suscripciones Activas</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.walletTopupsRevenue)}</div><div class="label">Recargas Wallet</div></div>
      <div class="kpi"><div class="value">${formatCurrency(analytics.consultationsRevenue)}</div><div class="label">Consultas Médicas</div></div>
    </div>
    
    <h2>Ingresos Mes a Mes</h2>
    <table><thead><tr><th>Mes</th><th class="text-right">Recargas</th><th class="text-right">Compras</th><th class="text-right">Suscripciones</th><th class="text-right">Consultas</th><th class="text-right">Transacciones</th></tr></thead><tbody>
    ${analytics.revenueByMonth.map(m => `<tr><td>${m.month}</td><td class="text-right">${formatCurrency(m.revenue)}</td><td class="text-right">${formatCurrency(m.purchases)}</td><td class="text-right">${formatCurrency(m.subscriptions)}</td><td class="text-right">${formatCurrency(m.consultations)}</td><td class="text-right">${m.transactions}</td></tr>`).join('')}
    <tr style="font-weight:700;background:#f0fdfa"><td>TOTAL</td><td class="text-right text-success">${formatCurrency(analytics.revenueByMonth.reduce((s,m)=>s+m.revenue,0))}</td><td class="text-right">${formatCurrency(analytics.revenueByMonth.reduce((s,m)=>s+m.purchases,0))}</td><td class="text-right">${formatCurrency(analytics.revenueByMonth.reduce((s,m)=>s+m.subscriptions,0))}</td><td class="text-right">${formatCurrency(analytics.revenueByMonth.reduce((s,m)=>s+m.consultations,0))}</td><td class="text-right">${analytics.revenueByMonth.reduce((s,m)=>s+m.transactions,0)}</td></tr>
    </tbody></table>
    
    <h2>Usuarios por Rol</h2>
    <table><thead><tr><th>Rol</th><th class="text-right">Cantidad</th></tr></thead><tbody>
    ${analytics.usersByRole.map(r => `<tr><td>${r.role}</td><td class="text-right">${r.count}</td></tr>`).join('')}
    </tbody></table>
    
    <h2>Top 10 Médicos</h2>
    <table><thead><tr><th>#</th><th>Nombre</th><th class="text-right">Consultas</th><th class="text-right">Rating</th><th class="text-right">Ingresos</th></tr></thead><tbody>
    ${analytics.topDoctors.map((d, i) => `<tr><td>${i + 1}</td><td>${d.name}</td><td class="text-right">${d.consultations}</td><td class="text-right">${d.rating.toFixed(1)}</td><td class="text-right text-success">${formatCurrency(d.revenue)}</td></tr>`).join('')}
    </tbody></table>
    
    <h2>Lives por Mes</h2>
    <table><thead><tr><th>Mes</th><th class="text-right">Cantidad</th></tr></thead><tbody>
    ${analytics.livesByMonth.map(m => `<tr><td>${m.month}</td><td class="text-right">${m.count}</td></tr>`).join('')}
    </tbody></table>
    
    <div class="footer">Medical Masters · Reporte generado automáticamente · ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Analytics y Reportes
            </h1>
            <p className="text-muted-foreground">Estadísticas de la plataforma</p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="year">Año</TabsTrigger>
              </TabsList>
            </Tabs>
            {analytics && (
              <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <><StatsSkeleton /><div className="mt-6"><TableSkeleton rows={3} columns={4} /></div></>
        ) : analytics ? (
          <div ref={printRef}>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { value: `$${analytics.totalRevenue.toLocaleString()}`, label: 'Ingresos totales', icon: DollarSign, bg: 'bg-success/10', color: 'text-success' },
                { value: analytics.totalUsers, label: 'Usuarios', icon: Users, bg: 'bg-info/10', color: 'text-info' },
                { value: analytics.totalDoctors, label: 'Médicos verificados', icon: Stethoscope, bg: 'bg-primary/10', color: 'text-primary' },
                { value: analytics.totalLives, label: 'Lives totales', icon: Video, bg: 'bg-live/10', color: 'text-live' },
              ].map((s, i) => (
                <Card key={i}><CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                    <div>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Compras de Videos', value: analytics.purchasesRevenue, sub: `${analytics.totalPurchases} compras`, border: 'border-l-premium' },
                { label: 'Suscripciones Activas', value: analytics.subscriptionsRevenue, border: 'border-l-info' },
                { label: 'Recargas Wallet', value: analytics.walletTopupsRevenue, border: 'border-l-success' },
                { label: 'Consultas Médicas', value: analytics.consultationsRevenue, border: 'border-l-primary' },
              ].map((item, i) => (
                <Card key={i} className={`border-l-4 ${item.border}`}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-xl font-bold">${item.value.toLocaleString()}</p>
                  {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                </CardContent></Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" />Ingresos por Mes</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <AreaChart data={analytics.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" /><YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(168, 84%, 32%)" fill="hsl(168, 84%, 32%, 0.2)" name="Recargas" />
                      <Area type="monotone" dataKey="purchases" stroke="hsl(199, 89%, 48%)" fill="hsl(199, 89%, 48%, 0.1)" name="Compras" />
                      <Area type="monotone" dataKey="consultations" stroke="hsl(142, 72%, 42%)" fill="hsl(142, 72%, 42%, 0.1)" name="Consultas" />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Usuarios por Rol</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <PieChart>
                      <Pie data={analytics.usersByRole} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="role"
                        label={({ role, percent }) => `${role} ${(percent * 100).toFixed(0)}%`}>
                        {analytics.usersByRole.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Video className="w-5 h-5" />Lives por Mes</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <BarChart data={analytics.livesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Lives" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star className="w-5 h-5" />Top Médicos</CardTitle></CardHeader>
                <CardContent>
                  {analytics.topDoctors.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.topDoctors.slice(0, 5).map((doctor, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doctor.name}</p>
                            <p className="text-xs text-muted-foreground">{doctor.consultations} consultas</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-success">${doctor.revenue.toLocaleString()}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="w-3 h-3 fill-premium text-premium" />{doctor.rating.toFixed(1)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-center text-muted-foreground py-8">No hay datos</p>}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Table */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Desglose Mes a Mes</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left p-2 font-semibold">Mes</th>
                    <th className="text-right p-2 font-semibold">Recargas</th>
                    <th className="text-right p-2 font-semibold">Compras</th>
                    <th className="text-right p-2 font-semibold">Suscripciones</th>
                    <th className="text-right p-2 font-semibold">Consultas</th>
                    <th className="text-right p-2 font-semibold">Transacciones</th>
                  </tr></thead>
                  <tbody>
                    {analytics.revenueByMonth.map((m, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{m.month}</td>
                        <td className="p-2 text-right text-success">${m.revenue.toLocaleString()}</td>
                        <td className="p-2 text-right">${m.purchases.toLocaleString()}</td>
                        <td className="p-2 text-right">${m.subscriptions.toLocaleString()}</td>
                        <td className="p-2 text-right">${m.consultations.toLocaleString()}</td>
                        <td className="p-2 text-right">{m.transactions}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-muted/50">
                      <td className="p-2">TOTAL</td>
                      <td className="p-2 text-right text-success">${analytics.revenueByMonth.reduce((s, m) => s + m.revenue, 0).toLocaleString()}</td>
                      <td className="p-2 text-right">${analytics.revenueByMonth.reduce((s, m) => s + m.purchases, 0).toLocaleString()}</td>
                      <td className="p-2 text-right">${analytics.revenueByMonth.reduce((s, m) => s + m.subscriptions, 0).toLocaleString()}</td>
                      <td className="p-2 text-right">${analytics.revenueByMonth.reduce((s, m) => s + m.consultations, 0).toLocaleString()}</td>
                      <td className="p-2 text-right">{analytics.revenueByMonth.reduce((s, m) => s + m.transactions, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
