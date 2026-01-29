import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Star,
  PlayCircle,
  Eye,
  MessageSquare,
  Calendar,
  Loader2
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface AnalyticsData {
  totalEarnings: number;
  pendingEarnings: number;
  totalViews: number;
  totalConsultations: number;
  avgRating: number;
  totalRatings: number;
  subscriberCount: number;
  recordingsCount: number;
  livesCount: number;
  earningsHistory: { date: string; amount: number }[];
  consultationsHistory: { date: string; count: number }[];
  ratingDistribution: { rating: number; count: number }[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

export function DoctorAnalytics() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (!user?.id) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const startDate = subDays(new Date(), daysAgo).toISOString();

        // Fetch doctor profile
        const { data: profile } = await supabase
          .from('doctor_profiles')
          .select('total_earnings, pending_earnings, rating, total_consultations, followers_count')
          .eq('user_id', user.id)
          .single();

        // Fetch recordings count
        const { count: recordingsCount } = await supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id);

        // Fetch lives count
        const { count: livesCount } = await supabase
          .from('lives')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id);

        // Fetch total views from lives
        const { data: livesViews } = await supabase
          .from('lives')
          .select('viewer_count')
          .eq('doctor_id', user.id);

        const totalViews = livesViews?.reduce((sum, l) => sum + (l.viewer_count || 0), 0) || 0;

        // Fetch ratings
        const { data: ratings } = await supabase
          .from('consultation_ratings')
          .select('rating')
          .eq('doctor_id', user.id);

        // Calculate rating distribution
        const ratingDist = [1, 2, 3, 4, 5].map(r => ({
          rating: r,
          count: ratings?.filter(rt => rt.rating === r).length || 0
        }));

        // Fetch earnings history
        const { data: transactions } = await supabase
          .from('wallet_transactions')
          .select('amount, created_at')
          .eq('user_id', user.id)
          .eq('type', 'earning')
          .gte('created_at', startDate)
          .order('created_at', { ascending: true });

        // Group by day
        const earningsMap = new Map<string, number>();
        transactions?.forEach(tx => {
          const day = format(new Date(tx.created_at), 'dd MMM', { locale: es });
          earningsMap.set(day, (earningsMap.get(day) || 0) + tx.amount);
        });

        const earningsHistory = Array.from(earningsMap.entries()).map(([date, amount]) => ({
          date,
          amount
        }));

        // Fetch consultations history
        const { data: consultations } = await supabase
          .from('consultations')
          .select('started_at')
          .eq('doctor_id', user.id)
          .gte('started_at', startDate)
          .order('started_at', { ascending: true });

        const consultationsMap = new Map<string, number>();
        consultations?.forEach(c => {
          const day = format(new Date(c.started_at), 'dd MMM', { locale: es });
          consultationsMap.set(day, (consultationsMap.get(day) || 0) + 1);
        });

        const consultationsHistory = Array.from(consultationsMap.entries()).map(([date, count]) => ({
          date,
          count
        }));

        setData({
          totalEarnings: profile?.total_earnings || 0,
          pendingEarnings: profile?.pending_earnings || 0,
          totalViews,
          totalConsultations: profile?.total_consultations || 0,
          avgRating: profile?.rating || 0,
          totalRatings: ratings?.length || 0,
          subscriberCount: profile?.followers_count || 0,
          recordingsCount: recordingsCount || 0,
          livesCount: livesCount || 0,
          earningsHistory,
          consultationsHistory,
          ratingDistribution: ratingDist,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [user?.id, period]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Analytics Dashboard
        </h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7 días</TabsTrigger>
            <TabsTrigger value="30d">30 días</TabsTrigger>
            <TabsTrigger value="90d">90 días</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">${data.totalEarnings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Ganancias Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">${data.pendingEarnings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Pendiente de Cobro</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.subscriberCount}</p>
                <p className="text-xs text-muted-foreground">Suscriptores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.avgRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{data.totalRatings} calificaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ganancias por Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.earningsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.earningsHistory}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ganancias']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#22c55e" 
                    fillOpacity={1} 
                    fill="url(#colorEarnings)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No hay datos para este período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consultations Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Consultas por Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.consultationsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.consultationsHistory}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Consultas']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No hay datos para este período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4" />
              Distribución de Calificaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalRatings > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={data.ratingDistribution.filter(r => r.count > 0)}
                      dataKey="count"
                      nameKey="rating"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                    >
                      {data.ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} votos`, `${name} ⭐`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 ml-4">
                  {data.ratingDistribution.reverse().map((r) => (
                    <div key={r.rating} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[r.rating - 1] }} 
                      />
                      <span>{r.rating}⭐</span>
                      <span className="text-muted-foreground">({r.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                Sin calificaciones aún
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              Contenido Creado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-primary" />
                Grabaciones
              </span>
              <Badge variant="secondary">{data.recordingsCount}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-destructive" />
                Lives realizados
              </span>
              <Badge variant="secondary">{data.livesCount}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-info" />
                Vistas totales
              </span>
              <Badge variant="secondary">{data.totalViews.toLocaleString()}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Consultation Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Consultas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>Total consultas</span>
              <Badge variant="secondary">{data.totalConsultations}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>Promedio de rating</span>
              <Badge variant="secondary">{data.avgRating.toFixed(1)} ⭐</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
              <span className="text-success">Tasa de satisfacción</span>
              <Badge className="bg-success">
                {data.totalRatings > 0 
                  ? Math.round((data.ratingDistribution.filter(r => r.rating >= 4).reduce((s, r) => s + r.count, 0) / data.totalRatings) * 100)
                  : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
