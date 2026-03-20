import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Video, Radio, Calendar, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailRecord {
  email_type: string;
  status: string;
  created_at: string;
}

interface MonthStats {
  total: number;
  sent: number;
  failed: number;
}

const EMAIL_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  new_content: {
    label: 'Contenido',
    icon: <Video className="w-4 h-4" />,
    color: 'bg-primary/10 text-primary',
  },
  live_started: {
    label: 'Lives',
    icon: <Radio className="w-4 h-4" />,
    color: 'bg-destructive/10 text-destructive',
  },
  availability_reminder: {
    label: 'Recordatorios',
    icon: <Calendar className="w-4 h-4" />,
    color: 'bg-warning/10 text-warning',
  },
};

function calculateChange(current: number, previous: number): { value: number; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    value: Math.abs(change),
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const { value, trend } = calculateChange(current, previous);
  
  if (trend === 'neutral') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        <span>Sin cambios</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-success' : 'text-destructive'}`}>
      {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>{value}% vs mes anterior</span>
    </div>
  );
}

export function EmailStatsCard() {
  const { supabaseUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rawEmails, setRawEmails] = useState<EmailRecord[]>([]);

  useEffect(() => {
    if (!supabaseUser?.id) return;

    const fetchEmailStats = async () => {
      // Fetch emails from last 2 months for comparison
      const twoMonthsAgo = startOfMonth(subMonths(new Date(), 1));
      
      const { data, error } = await supabase
        .from('email_history')
        .select('email_type, status, created_at')
        .eq('doctor_id', supabaseUser.id)
        .gte('created_at', twoMonthsAgo.toISOString());

      if (!error && data) {
        setRawEmails(data);
      }
      setIsLoading(false);
    };

    fetchEmailStats();
  }, [supabaseUser?.id]);

  const { currentMonth, previousMonth, stats, currentMonthName, previousMonthName } = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const current: MonthStats = { total: 0, sent: 0, failed: 0 };
    const previous: MonthStats = { total: 0, sent: 0, failed: 0 };
    const grouped: Record<string, { type: string; sent: number; failed: number; total: number }> = {};

    for (const email of rawEmails) {
      const emailDate = new Date(email.created_at);
      const type = email.email_type;
      
      // Group by type (all time for the type breakdown)
      if (!grouped[type]) {
        grouped[type] = { type, sent: 0, failed: 0, total: 0 };
      }
      grouped[type].total++;
      if (email.status === 'sent') {
        grouped[type].sent++;
      } else {
        grouped[type].failed++;
      }

      // Current month
      if (emailDate >= currentMonthStart && emailDate <= currentMonthEnd) {
        current.total++;
        if (email.status === 'sent') {
          current.sent++;
        } else {
          current.failed++;
        }
      }
      
      // Previous month
      if (emailDate >= prevMonthStart && emailDate <= prevMonthEnd) {
        previous.total++;
        if (email.status === 'sent') {
          previous.sent++;
        } else {
          previous.failed++;
        }
      }
    }

    return {
      currentMonth: current,
      previousMonth: previous,
      stats: Object.values(grouped),
      currentMonthName: format(now, 'MMMM', { locale: es }),
      previousMonthName: format(subMonths(now, 1), 'MMMM', { locale: es }),
    };
  }, [rawEmails]);

  const totalSent = stats.reduce((acc, s) => acc + s.sent, 0);
  const totalFailed = stats.reduce((acc, s) => acc + s.failed, 0);
  const totalEmails = totalSent + totalFailed;
  const successRate = totalEmails > 0 ? Math.round((totalSent / totalEmails) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Estadísticas de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalEmails === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Estadísticas de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aún no has enviado emails</p>
            <p className="text-xs mt-1">Las estadísticas aparecerán cuando envíes notificaciones</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Estadísticas de Emails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month-over-Month Comparison */}
        <div className="p-3 bg-muted/30 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground capitalize">{currentMonthName}</span>
            <TrendBadge current={currentMonth.total} previous={previousMonth.total} label="total" />
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-base sm:text-xl font-bold text-foreground">{currentMonth.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-base sm:text-xl font-bold text-success">{currentMonth.sent}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
            </div>
            <div>
              <p className="text-base sm:text-xl font-bold text-destructive">{currentMonth.failed}</p>
              <p className="text-xs text-muted-foreground">Fallidos</p>
            </div>
          </div>

          {/* Previous month comparison */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">{previousMonthName}</span>
              <span>{previousMonth.total} emails ({previousMonth.sent} enviados)</span>
            </div>
          </div>
        </div>

        {/* Overall Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{totalEmails}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 bg-success/10 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <p className="text-2xl font-bold text-success">{totalSent}</p>
            </div>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="w-4 h-4 text-destructive" />
              <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
            </div>
            <p className="text-xs text-muted-foreground">Fallidos</p>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Tasa de éxito global</span>
            <span className="text-sm font-semibold text-foreground">{successRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        {/* By Type */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Por tipo de email</p>
          <div className="space-y-2">
            {stats.map((stat) => {
              const config = EMAIL_TYPE_CONFIG[stat.type] || {
                label: stat.type,
                icon: <Mail className="w-4 h-4" />,
                color: 'bg-muted text-muted-foreground',
              };
              const typeSuccessRate = stat.total > 0 ? Math.round((stat.sent / stat.total) * 100) : 0;

              return (
                <div key={stat.type} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {stat.sent}/{stat.total} ({typeSuccessRate}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div 
                        className="h-full bg-success transition-all duration-500"
                        style={{ width: `${typeSuccessRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
