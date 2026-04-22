import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  Eye,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  History,
  FilterX,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

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
}

interface VaultAuditPanelProps {
  /** 'patient' = ver historial de mi expediente, 'doctor' = ver mis acciones como autorizado */
  mode: 'patient' | 'doctor';
  userId: string;
}

const PAGE_SIZE = 100;

const ACTION_OPTIONS: { value: AuditAction | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas las acciones' },
  { value: 'accessed', label: 'Acceso al archivo' },
  { value: 'access_granted', label: 'Permiso otorgado' },
  { value: 'access_revoked', label: 'Permiso revocado' },
  { value: 'access_denied', label: 'Acceso denegado' },
  { value: 'otp_required', label: 'OTP requerido' },
  { value: 'otp_verified', label: 'OTP verificado' },
  { value: 'otp_failed', label: 'OTP fallido' },
];

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VaultAuditPanel({ mode, userId }: VaultAuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<Record<string, string>>({});

  // Filtros
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [fileFilter, setFileFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>(defaultFromDate());
  const [toDate, setToDate] = useState<string>(todayStr());
  const [limit, setLimit] = useState<number>(PAGE_SIZE);
  const [availableFiles, setAvailableFiles] = useState<{ id: string; name: string }[]>([]);

  const fetchAvailableFiles = async () => {
    try {
      if (mode === 'patient') {
        const { data } = await supabase
          .from('vault_files')
          .select('id, name')
          .eq('patient_id', userId)
          .order('created_at', { ascending: false })
          .limit(200);
        setAvailableFiles((data || []) as any);
      } else {
        // For doctor: files from their audit history
        const { data } = await supabase
          .from('vault_audit_log' as any)
          .select('file_id')
          .eq('actor_id', userId)
          .not('file_id', 'is', null)
          .limit(500);
        const uniq = Array.from(new Set(((data || []) as any[]).map((d) => d.file_id))) as string[];
        if (uniq.length) {
          const { data: vf } = await supabase
            .from('vault_files')
            .select('id, name')
            .in('id', uniq);
          setAvailableFiles((vf || []) as any);
        }
      }
    } catch (err) {
      console.warn('[VaultAuditPanel] file list fetch failed', err);
    }
  };

  const buildBaseQuery = (withCount: boolean) => {
    const filterCol = mode === 'patient' ? 'patient_id' : 'actor_id';
    let q = withCount
      ? supabase.from('vault_audit_log' as any).select('*', { count: 'exact', head: true }).eq(filterCol, userId)
      : supabase.from('vault_audit_log' as any).select('*').eq(filterCol, userId);

    if (actionFilter !== 'all') q = q.eq('action', actionFilter);
    if (fileFilter !== 'all') q = q.eq('file_id', fileFilter);
    if (fromDate) q = q.gte('created_at', new Date(fromDate + 'T00:00:00').toISOString());
    if (toDate) q = q.lte('created_at', new Date(toDate + 'T23:59:59').toISOString());
    return q;
  };

  const fetchCount = async () => {
    try {
      const { count, error } = await buildBaseQuery(true);
      if (error) throw error;
      setTotalCount(count || 0);
    } catch (err) {
      console.warn('[VaultAuditPanel] count fetch error', err);
    }
  };

  const fetchAudit = async () => {
    setIsLoading(true);
    try {
      const q = buildBaseQuery(false).order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await q;
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
      setFileMap((prev) => ({
        ...prev,
        ...Object.fromEntries((files || []).map((f: any) => [f.id, f.name])),
      }));
    } catch (err) {
      console.error('[VaultAuditPanel] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAvailableFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  // Re-cuenta total sólo cuando cambian los filtros (no al cargar más)
  useEffect(() => {
    if (userId) fetchCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, actionFilter, fileFilter, fromDate, toDate]);

  // Re-fetch eventos cuando cambian filtros o limit
  useEffect(() => {
    if (userId) fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, actionFilter, fileFilter, fromDate, toDate, limit]);

  // Realtime: refrescar al recibir nuevos eventos en mi alcance
  useEffect(() => {
    if (!userId) return;
    const filterCol = mode === 'patient' ? 'patient_id' : 'actor_id';
    const channel = supabase
      .channel(`vault_audit_${mode}_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vault_audit_log',
          filter: `${filterCol}=eq.${userId}`,
        },
        () => {
          fetchCount();
          fetchAudit();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, actionFilter, fileFilter, fromDate, toDate, limit]);

  /**
   * QA manual end-to-end:
   * 1) Paciente sube un archivo → al compartir con doctor → trigger inserta `access_granted`.
   * 2) Doctor abre preview en VaultFilePreviewModal → RPC log_vault_action registra `accessed`.
   * 3) Paciente revoca acceso → trigger inserta `access_revoked`.
   * 4) Doctor intenta abrir tras revocación → 403 → catch llama log_vault_action con `access_denied`.
   * 5) Adicional: si llega a /access-denied?file_id=…&patient_id=… se registra `access_denied` desde la página.
   * Los 5 eventos deben listarse en este panel y filtrarse por archivo, acción y rango de fecha.
   */

  const clearFilters = () => {
    setActionFilter('all');
    setFileFilter('all');
    setFromDate(defaultFromDate());
    setToDate(todayStr());
    setLimit(PAGE_SIZE);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][]; totalRows: number } | null>(null);

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  // Build CSV content from current filters; returns headers, rows and full csv string
  const buildCsvContent = async (): Promise<{ headers: string[]; rows: string[][]; csv: string }> => {
    const q = buildBaseQuery(false).order('created_at', { ascending: false }).range(0, 4999);
    const { data, error } = await q;
    if (error) throw error;
    const list = (data || []) as unknown as AuditEntry[];

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
    const aMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.name]));
    const fMap = Object.fromEntries((files || []).map((f: any) => [f.id, f.name]));

    const labels: Record<AuditAction, string> = {
      accessed: 'Acceso al archivo',
      access_denied: 'Acceso denegado',
      access_granted: 'Permiso otorgado',
      access_revoked: 'Permiso revocado',
      otp_required: 'OTP requerido',
      otp_failed: 'OTP fallido',
      otp_verified: 'OTP verificado',
    };

    // Doctor mode: omit/truncate sensitive patient_id and metadata
    const isDoctorMode = mode === 'doctor';
    const headers = isDoctorMode
      ? ['Fecha', 'Acción', 'Archivo', 'Actor']
      : ['Fecha', 'Acción', 'Archivo', 'Actor', 'Patient ID', 'Metadata'];
    const rows = list.map((e) => {
      const base = [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
        labels[e.action] || e.action,
        e.file_id ? fMap[e.file_id] || '(eliminado)' : '',
        e.actor_id ? aMap[e.actor_id] || e.actor_id : '',
      ];
      if (isDoctorMode) return base;
      return [
        ...base,
        e.patient_id || '',
        e.metadata ? JSON.stringify(e.metadata) : '',
      ];
    });

    const csv =
      '\uFEFF' +
      [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');

    const bytes = new TextEncoder().encode(csv);
    if (!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) {
      throw new Error('Encoding inválido: falta BOM UTF-8');
    }

    return { headers, rows, csv };
  };

  const openPreview = async () => {
    setIsExporting(true);
    try {
      const { headers, rows } = await buildCsvContent();
      setPreviewData({ headers, rows: rows.slice(0, 5), totalRows: rows.length });
      setPreviewOpen(true);
    } catch (err: any) {
      console.error('[VaultAuditPanel] preview error', err);
      toast.error(err?.message || 'Error generando vista previa');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const { rows, csv } = await buildCsvContent();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filterTag = actionFilter !== 'all' ? actionFilter : 'todos';
      link.href = url;
      link.download = `auditoria_${dateStr}_${filterTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPreviewOpen(false);

      toast.success(`Exportadas ${rows.length} filas a CSV`);
    } catch (err: any) {
      console.error('[VaultAuditPanel] export error', err);
      toast.error(err?.message || 'Error de encoding al exportar');
    } finally {
      setIsExporting(false);
    }
  };

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
  const hasActiveFilters =
    actionFilter !== 'all' ||
    fileFilter !== 'all' ||
    fromDate !== defaultFromDate() ||
    toDate !== todayStr();

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Auditoría de Vault
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={openPreview}
            disabled={isExporting || isLoading || totalCount === 0}
            className="h-8 gap-1"
            data-testid="csv-preview-btn"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vista previa</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            disabled={isExporting || isLoading || totalCount === 0}
            className="h-8 gap-1"
            data-testid="csv-export-btn"
            aria-disabled={isExporting || isLoading || totalCount === 0}
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAudit}
            disabled={isLoading}
            className="h-8 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Archivo</Label>
            <Select value={fileFilter} onValueChange={setFileFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos los archivos</SelectItem>
                {availableFiles.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">
                    {f.name.length > 40 ? f.name.slice(0, 40) + '…' : f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Acción</Label>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              max={todayStr()}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <span>
            Mostrando {grouped.length} de {totalCount} eventos
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1 text-[11px]"
            >
              <FilterX className="w-3 h-3" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {hasActiveFilters
              ? 'No hay eventos que coincidan con los filtros seleccionados.'
              : mode === 'patient'
              ? 'Aún no hay actividad registrada en tu expediente.'
              : 'Aún no has realizado acciones sobre expedientes de pacientes.'}
          </p>
        ) : (
          <>
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
                        {format(new Date(e.created_at), "d MMM yyyy 'a las' HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">
                      {e.file_id && fileMap[e.file_id] ? (
                        <>
                          Archivo:{' '}
                          <span className="font-medium">{fileMap[e.file_id]}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Archivo eliminado o no disponible
                        </span>
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

            {grouped.length < totalCount && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  disabled={isLoading}
                >
                  Cargar más ({totalCount - grouped.length} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
