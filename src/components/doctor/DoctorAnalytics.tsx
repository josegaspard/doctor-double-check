import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, DollarSign, Users, Star, PlayCircle, Eye, MessageSquare, Calendar, Loader2
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

        const { data: profile } = await supabase
          .from('doctor_profiles')
          .select('total_earnings, pending_earnings, rating, total_consultations, followers_count')
          .eq('user_id', user.id)
          .single();

        const { count: recordingsCount } = await supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id);

        const { count: livesCount } = await supabase
          .from('lives')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id);

        const { data: livesViews } = await supabase
          .from('lives')
          .select('viewer_count')
          .eq('doctor_id', user.id);

        const totalViews = livesViews?.reduce((sum, l) => sum + (l.viewer_count || 0), 0) || 0;

        const { data: ratings } = await supabase
          .from('consultation_ratings')
          .select('rating')
          .eq('doctor_id', user.id);

        const ratingDist = [1, 2, 3, 4, 5].map(r => ({
          rating: r,
          count: ratings?.filter(rt => rt.rating === r).length || 0
        }));

        const { data: transactions } = await supabase
          .from('wallet_transactions')
          .select('amount, created_at')
          .eq('user_id', user.id)
          .eq('type', 'earning')
          .gte('created_at', startDate)
          .order('created_at', { ascending: true });

        const earningsMap = new Map<string, number>();
        transactions?.forEach(tx => {
          const day = format(new Date(tx.created_at), 'dd MMM', { locale: es });
          earningsMap.set(day, (earningsMap.get(day) || 0) + tx.amount);
        });

        const earningsHistory = Array.from(earningsMap.entries()).map(([date, amount]) => ({ date, amount }));

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

        const consultationsHistory = Array.from(consultationsMap.entries()).map(([date, count]) => ({ date, count }));

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

  if (!data) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with period selector — stacks vertically on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Analytics Dashboard
        </h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList className="h-8 sm:h-9">
            <TabsTrigger value="7d" className="text-xs px-2.5 sm:px-3">7d</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-2.5 sm:px-3">30d</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs px-2.5 sm:px-3">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Grid — responsive sizes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { icon: DollarSign, iconClass: 'text-success', bg: 'bg-success/10', value: `$${data.totalEarnings.toLocaleString()}`, label: 'Ganancias Totales' },
          { icon: DollarSign, iconClass: 'text-warning', bg: 'bg-warning/10', value: `$${data.pendingEarnings.toLocaleString()}`, label: 'Pendiente de Cobro' },
          { icon: Users, iconClass: 'text-primary', bg: 'bg-primary/10', value: data.subscriberCount, label: 'Suscriptores' },
          { icon: Star, iconClass: 'text-amber-500', bg: 'bg-amber-500/10', value: data.avgRating.toFixed(1), label: `${data.totalRatings} calificaciones` },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.iconClass}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-2xl font-bold leading-tight truncate">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-0.5">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ganancias por Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.earningsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.earningsHistory}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={10} tick={{ fontSize: 10 }} />
                  <YAxis fontSize={10} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ganancias']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="amount" stroke="#22c55e" fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No hay datos para este período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Consultas por Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.consultationsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.consultationsHistory}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={10} tick={{ fontSize: 10 }} />
                  <YAxis fontSize={10} tick={{ fontSize: 10 }} width={30} />
                  <Tooltip formatter={(value: number) => [value, 'Consultas']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No hay datos para este período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stats — single column on mobile */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Star className="w-4 h-4" />
              Distribución de Calificaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalRatings > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie
                      data={data.ratingDistribution.filter(r => r.count > 0)}
                      dataKey="count"
                      nameKey="rating"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                    >
                      {data.ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} votos`, `${name} ⭐`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 ml-3">
                  {[...data.ratingDistribution].reverse().map((r) => (
                    <div key={r.rating} className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[r.rating - 1] }} />
                      <span>{r.rating}⭐</span>
                      <span className="text-muted-foreground">({r.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[130px] flex items-center justify-center text-muted-foreground text-sm">
                Sin calificaciones aún
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              Contenido Creado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { icon: PlayCircle, iconClass: 'text-primary', label: 'Grabaciones', value: data.recordingsCount },
              { icon: Eye, iconClass: 'text-destructive', label: 'Lives realizados', value: data.livesCount },
              { icon: Eye, iconClass: 'text-info', label: 'Vistas totales', value: data.totalViews.toLocaleString() },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                  <span className="flex items-center gap-2 text-xs sm:text-sm">
                    <Icon className={`w-3.5 h-3.5 ${item.iconClass}`} />
                    {item.label}
                  </span>
                  <Badge variant="secondary" className="text-xs">{item.value}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Consultas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
              <span className="text-xs sm:text-sm">Total consultas</span>
              <Badge variant="secondary" className="text-xs">{data.totalConsultations}</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
              <span className="text-xs sm:text-sm">Promedio de rating</span>
              <Badge variant="secondary" className="text-xs">{data.avgRating.toFixed(1)} ⭐</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-success/10 rounded-lg">
              <span className="text-xs sm:text-sm text-success">Tasa de satisfacción</span>
              <Badge className="bg-success text-xs">
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
