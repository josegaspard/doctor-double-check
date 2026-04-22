import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  XCircle,
  Eye,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type AuditAction =
  | 'accessed'
  | 'access_denied'
  | 'access_granted'
  | 'access_revoked'
  | 'otp_required'
  | 'otp_failed'
  | 'otp_verified';

interface AuditEntry {
  id: string;
  file_id: string | null;
  actor_id: string | null;
  patient_id: string;
  action: AuditAction;
  metadata: Record<string, any>;
  created_at: string;
  actor_name?: string;
  file_name?: string;
}

interface VaultAuditPanelProps {
  /** 'patient' = ver historial de mi expediente, 'doctor' = ver mis acciones como autorizado */
  mode: 'patient' | 'doctor';
  userId: string;
}

export function VaultAuditPanel({ mode, userId }: VaultAuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<Record<string, string>>({});

  const fetchAudit = async () => {
    setIsLoading(true);
    try {
      const filter = mode === 'patient' ? 'patient_id' : 'actor_id';
      const { data, error } = await supabase
        .from('vault_audit_log' as any)
        .select('*')
        .eq(filter, userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (data || []) as unknown as AuditEntry[];
      setEntries(list);

      // Resolver nombres de actores y archivos
      const actorIds = Array.from(new Set(list.map((e) => e.actor_id).filter(Boolean))) as string[];
      const fileIds = Array.from(new Set(list.map((e) => e.file_id).filter(Boolean))) as string[];

      const [{ data: profs }, { data: files }] = await Promise.all([
        actorIds.length
          ? supabase.from('profiles').select('id, name').in('id', actorIds)
          : Promise.resolve({ data: [] as any[] }),
        fileIds.length
          ? supabase.from('vault_files').select('id, name').in('id', fileIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      setActorMap(Object.fromEntries((profs || []).map((p: any) => [p.id, p.name])));
      setFileMap(Object.fromEntries((files || []).map((f: any) => [f.id, f.name])));
    } catch (err) {
      console.error('[VaultAuditPanel] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  const renderAction = (action: AuditAction) => {
    const cfg: Record<AuditAction, { label: string; icon: React.ElementType; variant: any }> = {
      accessed: { label: 'Acceso al archivo', icon: Eye, variant: 'info' },
      access_denied: { label: 'Acceso denegado', icon: ShieldOff, variant: 'destructive' },
      access_granted: { label: 'Permiso otorgado', icon: ShieldCheck, variant: 'success' },
      access_revoked: { label: 'Permiso revocado', icon: XCircle, variant: 'warning' },
      otp_required: { label: 'OTP requerido', icon: KeyRound, variant: 'secondary' },
      otp_failed: { label: 'OTP fallido', icon: XCircle, variant: 'destructive' },
      otp_verified: { label: 'OTP verificado', icon: CheckCircle2, variant: 'success' },
    };
    const c = cfg[action] || cfg.accessed;
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="gap-1 text-[10px] whitespace-nowrap">
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const grouped = useMemo(() => entries, [entries]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Auditoría de Vault
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchAudit} disabled={isLoading} className="h-8 gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {mode === 'patient'
              ? 'Aún no hay actividad registrada en tu expediente.'
              : 'Aún no has realizado acciones sobre expedientes de pacientes.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {grouped.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderAction(e.action)}
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(e.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground truncate">
                    {e.file_id && fileMap[e.file_id] ? (
                      <>
                        Archivo: <span className="font-medium">{fileMap[e.file_id]}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Archivo eliminado o no disponible</span>
                    )}
                  </p>
                  {mode === 'patient' && e.actor_id && actorMap[e.actor_id] && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Por: {actorMap[e.actor_id]}
                    </p>
                  )}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <p className="text-[10px] text-muted-foreground/80 font-mono truncate">
                      {Object.entries(e.metadata)
                        .filter(([k]) => !['doctor_id'].includes(k))
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${String(v).slice(0, 24)}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
