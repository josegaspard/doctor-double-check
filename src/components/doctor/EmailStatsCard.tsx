import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Video, Radio, Calendar, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EmailStats {
  type: string;
  sent: number;
  failed: number;
  total: number;
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

export function EmailStatsCard() {
  const { supabaseUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rawEmails, setRawEmails] = useState<{ email_type: string; status: string }[]>([]);

  useEffect(() => {
    if (!supabaseUser?.id) return;

    const fetchEmailStats = async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('email_type, status')
        .eq('doctor_id', supabaseUser.id);

      if (!error && data) {
        setRawEmails(data);
      }
      setIsLoading(false);
    };

    fetchEmailStats();
  }, [supabaseUser?.id]);

  const stats = useMemo(() => {
    const grouped: Record<string, EmailStats> = {};

    for (const email of rawEmails) {
      const type = email.email_type;
      if (!grouped[type]) {
        grouped[type] = { type, sent: 0, failed: 0, total: 0 };
      }
      grouped[type].total++;
      if (email.status === 'sent') {
        grouped[type].sent++;
      } else {
        grouped[type].failed++;
      }
    }

    return Object.values(grouped);
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
        {/* Summary Stats */}
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
            <span className="text-sm text-muted-foreground">Tasa de éxito</span>
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
