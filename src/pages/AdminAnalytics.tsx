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
import { StatsSkeleton, TableSkeleton } from '@/components/skeletons/CardSkeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { toast } from 'sonner';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Stethoscope,
  Video,
  ArrowLeft,
  Calendar,
  Star,
  Activity,
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  totalUsers: number;
  totalDoctors: number;
  totalLives: number;
  revenueByMonth: { month: string; revenue: number; transactions: number }[];
  usersByRole: { role: string; count: number }[];
  topDoctors: { name: string; consultations: number; rating: number; revenue: number }[];
  livesByMonth: { month: string; count: number }[];
}

const COLORS = ['hsl(168, 84%, 32%)', 'hsl(199, 89%, 48%)', 'hsl(45, 93%, 47%)', 'hsl(142, 72%, 42%)'];

const chartConfig = {
  revenue: { label: 'Ingresos', color: 'hsl(168, 84%, 32%)' },
  transactions: { label: 'Transacciones', color: 'hsl(199, 89%, 48%)' },
  users: { label: 'Usuarios', color: 'hsl(45, 93%, 47%)' },
  lives: { label: 'Lives', color: 'hsl(142, 72%, 42%)' },
};

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (role !== 'admin') return;
      
      setIsLoading(true);
      try {
        // Fetch total revenue from wallet transactions
        const { data: transactions } = await supabase
          .from('wallet_transactions')
          .select('amount, type, created_at')
          .eq('status', 'paid');

        const totalRevenue = transactions?.reduce((sum, t) => {
          return t.type === 'topup' ? sum + t.amount : sum;
        }, 0) || 0;

        // Fetch users count
        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch doctors count
        const { count: totalDoctors } = await supabase
          .from('doctor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        // Fetch lives count
        const { count: totalLives } = await supabase
          .from('lives')
          .select('*', { count: 'exact', head: true });

        // Fetch users by role
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role');

        const rolesCounts = rolesData?.reduce((acc: Record<string, number>, r) => {
          acc[r.role] = (acc[r.role] || 0) + 1;
          return acc;
        }, {}) || {};

        const usersByRole = Object.entries(rolesCounts).map(([role, count]) => ({
          role: role.charAt(0).toUpperCase() + role.slice(1),
          count: count as number,
        }));

        // Fetch top doctors by consultations
        const { data: doctorStats } = await supabase
          .from('doctor_profiles')
          .select('user_id, total_consultations, rating, consultation_fee')
          .eq('status', 'approved')
          .order('total_consultations', { ascending: false })
          .limit(5);

        let topDoctors: AnalyticsData['topDoctors'] = [];
        if (doctorStats && doctorStats.length > 0) {
          const userIds = doctorStats.map(d => d.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
          
          topDoctors = doctorStats.map(d => ({
            name: profileMap.get(d.user_id) || 'Doctor',
            consultations: d.total_consultations,
            rating: Number(d.rating),
            revenue: d.total_consultations * Number(d.consultation_fee),
          }));
        }

        // Generate monthly data (mock for demo)
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
        const revenueByMonth = months.map((month, i) => ({
          month,
          revenue: Math.floor(Math.random() * 50000) + 10000,
          transactions: Math.floor(Math.random() * 100) + 20,
        }));

        const livesByMonth = months.map((month) => ({
          month,
          count: Math.floor(Math.random() * 30) + 5,
        }));

        setAnalytics({
          totalRevenue,
          totalUsers: totalUsers || 0,
          totalDoctors: totalDoctors || 0,
          totalLives: totalLives || 0,
          revenueByMonth,
          usersByRole,
          topDoctors,
          livesByMonth,
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

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              {language === 'es' ? 'Analytics y Reportes' : 'Analytics & Reports'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' ? 'Estadísticas de la plataforma' : 'Platform statistics'}
            </p>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
              <TabsTrigger value="year">Año</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <>
            <StatsSkeleton />
            <div className="mt-6">
              <TableSkeleton rows={3} columns={4} />
            </div>
          </>
        ) : analytics ? (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        ${analytics.totalRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Ingresos totales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-info" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{analytics.totalUsers}</p>
                      <p className="text-xs text-muted-foreground">Usuarios</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{analytics.totalDoctors}</p>
                      <p className="text-xs text-muted-foreground">Médicos verificados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-live/10 flex items-center justify-center">
                      <Video className="w-5 h-5 text-live" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{analytics.totalLives}</p>
                      <p className="text-xs text-muted-foreground">Lives totales</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Ingresos por Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <AreaChart data={analytics.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="hsl(168, 84%, 32%)" 
                        fill="hsl(168, 84%, 32%, 0.2)"
                        name="Ingresos"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Users by Role */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Usuarios por Rol
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <PieChart>
                      <Pie
                        data={analytics.usersByRole}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="role"
                        label={({ role, percent }) => `${role} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analytics.usersByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Lives Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Lives por Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <BarChart data={analytics.livesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Lives" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Top Doctors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Top Médicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.topDoctors.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.topDoctors.map((doctor, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doctor.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doctor.consultations} consultas
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-success">
                              ${doctor.revenue.toLocaleString()}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="w-3 h-3 fill-premium text-premium" />
                              {doctor.rating.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No hay datos de médicos
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
