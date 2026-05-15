import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, Sparkles, AlertTriangle } from 'lucide-react';
import { StorageUpgradeDialog } from './StorageUpgradeDialog';
import { setStorageUpgradeOpener } from '@/hooks/useStorageGuard';

function formatStorageSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

interface Props {
  variant?: 'compact' | 'card';
}

export function StorageWidget({ variant = 'card' }: Props) {
  const { supabaseUser } = useAuth();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(1073741824);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchStorage = async () => {
    if (!supabaseUser?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('storage_used_bytes, storage_limit_bytes')
      .eq('id', supabaseUser.id)
      .maybeSingle();
    if (data) {
      setUsed((data as any).storage_used_bytes || 0);
      setLimit((data as any).storage_limit_bytes || 1073741824);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStorage(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [supabaseUser?.id]);

  // Register global opener so useStorageGuard can trigger this dialog from anywhere
  useEffect(() => {
    setStorageUpgradeOpener(() => setUpgradeOpen(true));
    return () => setStorageUpgradeOpener(null);
  }, []);

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isFull = pct >= 95;
  const isWarn = pct >= 75 && !isFull;

  const barColor = isFull ? 'bg-destructive' : isWarn ? 'bg-warning' : 'bg-primary';

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-2 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HardDrive className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">Almacenamiento</span>
            <span className="text-muted-foreground font-mono">{formatStorageSize(used)} / {formatStorageSize(limit)}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setUpgradeOpen(true)}>
          <Sparkles className="w-3 h-3" /> Ampliar
        </Button>
        <StorageUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} onUpgraded={fetchStorage} />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Almacenamiento</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{formatStorageSize(used)}</span> de <span className="font-mono">{formatStorageSize(limit)}</span> usados
            </p>
          </div>
          <span className={`text-sm font-bold font-mono ${isFull ? 'text-destructive' : isWarn ? 'text-warning' : 'text-primary'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>

        {isFull && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30 mb-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-destructive">Almacenamiento lleno. Amplía tu plan para seguir subiendo archivos.</p>
          </div>
        )}
        {isWarn && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/30 mb-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-warning">Estás cerca del límite. Considera ampliar pronto.</p>
          </div>
        )}

        <Button onClick={() => setUpgradeOpen(true)} className="w-full gap-1.5" size="sm" variant={isFull ? 'default' : 'outline'}>
          <Sparkles className="w-4 h-4" />
          {isFull ? 'Ampliar ahora' : 'Ampliar espacio'}
        </Button>
      </CardContent>
      <StorageUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} onUpgraded={fetchStorage} />
    </Card>
  );
}
