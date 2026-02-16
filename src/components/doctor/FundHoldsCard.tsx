import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FundHold {
  id: string;
  amount: number;
  reason: string;
  status: string;
  held_at: string;
  release_at: string | null;
  released_at: string | null;
}

export function FundHoldsCard() {
  const { user } = useAuth();
  const [holds, setHolds] = useState<FundHold[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHolds = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('fund_holds')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) setHolds(data as FundHold[]);
      setIsLoading(false);
    };
    fetchHolds();
  }, [user?.id]);

  const activeHolds = holds.filter(h => h.status === 'held');
  const totalHeld = activeHolds.reduce((sum, h) => sum + Number(h.amount), 0);

  if (isLoading || holds.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-warning" />
          Fondos en Retención
          {totalHeld > 0 && (
            <Badge variant="warning" className="ml-auto">${totalHeld.toLocaleString()}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {holds.slice(0, 5).map(hold => (
          <div key={hold.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              {hold.status === 'held' ? (
                <Clock className="w-3.5 h-3.5 text-warning" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-success" />
              )}
              <span className="text-foreground">{hold.reason}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">${Number(hold.amount).toLocaleString()}</span>
              <Badge variant={hold.status === 'held' ? 'warning' : 'success'} className="text-[10px]">
                {hold.status === 'held' ? 'Retenido' : 'Liberado'}
              </Badge>
            </div>
          </div>
        ))}
        {activeHolds.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Los fondos se liberan automáticamente tras 48h sin disputas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
