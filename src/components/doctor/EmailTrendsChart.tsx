import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type PeriodFilter = '7d' | '14d' | '30d';

interface EmailRecord {
  email_type: string;
  status: string;
  created_at: string;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  new_content: number;
  live_started: number;
  availability_reminder: number;
  total: number;
  sent: number;
  failed: number;
}

const PERIOD_OPTIONS: { value: PeriodFilter; label: string; days: number }[] = [
  { value: '7d', label: 'Últimos 7 días', days: 7 },
  { value: '14d', label: 'Últimos 14 días', days: 14 },
  { value: '30d', label: 'Últimos 30 días', days: 30 },
];

const EMAIL_TYPE_COLORS = {
  new_content: 'hsl(var(--primary))',
  live_started: 'hsl(var(--destructive))',
  availability_reminder: 'hsl(var(--warning, 38 92% 50%))',
};

export function EmailTrendsChart() {
  const { supabaseUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rawEmails, setRawEmails] = useState<EmailRecord[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('14d');

  useEffect(() => {
    if (!supabaseUser?.id) return;

    const fetchEmails = async () => {
      setIsLoading(true);
      const daysAgo = PERIOD_OPTIONS.find(p => p.value === period)?.days || 14;
      const startDate = subDays(new Date(), daysAgo);

      const { data, error } = await supabase
        .from('email_history')
        .select('email_type, status, created_at')
        .eq('doctor_id', supabaseUser.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!error && data) {
        setRawEmails(data);
      }
      setIsLoading(false);
    };

    fetchEmails();
  }, [supabaseUser?.id, period]);

  const chartData = useMemo(() => {
    const daysAgo = PERIOD_OPTIONS.find(p => p.value === period)?.days || 14;
    const startDate = startOfDay(subDays(new Date(), daysAgo - 1));
    const endDate = startOfDay(new Date());

    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const dataByDate: Record<string, ChartDataPoint> = {};
    
    dateRange.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      dataByDate[dateKey] = {
        date: dateKey,
        displayDate: format(date, 'd MMM', { locale: es }),
        new_content: 0,
        live_started: 0,
        availability_reminder: 0,
        total: 0,
        sent: 0,
        failed: 0,
      };
    });

    rawEmails.forEach(email => {
      const dateKey = format(new Date(email.created_at), 'yyyy-MM-dd');
      if (dataByDate[dateKey]) {
        dataByDate[dateKey].total++;
        
        if (email.status === 'sent') {
          dataByDate[dateKey].sent++;
        } else {
          dataByDate[dateKey].failed++;
        }

        if (email.email_type === 'new_content') {
          dataByDate[dateKey].new_content++;
        } else if (email.email_type === 'live_started') {
          dataByDate[dateKey].live_started++;
        } else if (email.email_type === 'availability_reminder') {
          dataByDate[dateKey].availability_reminder++;
        }
      }
    });

    return Object.values(dataByDate);
  }, [rawEmails, period]);

  const totalEmails = chartData.reduce((acc, d) => acc + d.total, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencia de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (totalEmails === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencia de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay datos para mostrar en este período</p>
            <p className="text-xs mt-1">Los gráficos aparecerán cuando envíes emails</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendencia de Emails
          </CardTitle>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Emails by Type Chart */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Por tipo de email</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      new_content: 'Contenido',
                      live_started: 'Lives',
                      availability_reminder: 'Recordatorios',
                    };
                    return labels[value] || value;
                  }}
                />
                <Bar 
                  dataKey="new_content" 
                  stackId="a" 
                  fill={EMAIL_TYPE_COLORS.new_content}
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="live_started" 
                  stackId="a" 
                  fill={EMAIL_TYPE_COLORS.live_started}
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="availability_reminder" 
                  stackId="a" 
                  fill={EMAIL_TYPE_COLORS.availability_reminder}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success vs Failed Chart */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Enviados vs Fallidos</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  name="Enviados"
                  stroke="hsl(var(--success, 142 76% 36%))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="failed" 
                  name="Fallidos"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
