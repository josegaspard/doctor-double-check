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
import { useLanguage } from '@/contexts/LanguageContext';

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

const ACTION_OPTION_VALUES: (AuditAction | 'all')[] = [
  'all',
  'accessed',
  'access_granted',
  'access_revoked',
  'access_denied',
  'otp_required',
  'otp_verified',
  'otp_failed',
];

const ACTION_LABEL_KEY: Record<AuditAction | 'all', string> = {
  all: 'vaultAuditPanel.actions.all',
  accessed: 'vaultAuditPanel.actions.accessed',
  access_granted: 'vaultAuditPanel.actions.accessGranted',
  access_revoked: 'vaultAuditPanel.actions.accessRevoked',
  access_denied: 'vaultAuditPanel.actions.accessDenied',
  otp_required: 'vaultAuditPanel.actions.otpRequired',
  otp_verified: 'vaultAuditPanel.actions.otpVerified',
  otp_failed: 'vaultAuditPanel.actions.otpFailed',
};

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VaultAuditPanel({ mode, userId }: VaultAuditPanelProps) {
  const { t, language } = useLanguage();
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
      accessed: t('vaultAuditPanel.actions.accessed'),
      access_denied: t('vaultAuditPanel.actions.accessDenied'),
      access_granted: t('vaultAuditPanel.actions.accessGranted'),
      access_revoked: t('vaultAuditPanel.actions.accessRevoked'),
      otp_required: t('vaultAuditPanel.actions.otpRequired'),
      otp_failed: t('vaultAuditPanel.actions.otpFailed'),
      otp_verified: t('vaultAuditPanel.actions.otpVerified'),
    };

    // Doctor mode: omit/truncate sensitive patient_id and metadata
    const isDoctorMode = mode === 'doctor';
    const headers = isDoctorMode
      ? [
          t('vaultAuditPanel.csv.headers.date'),
          t('vaultAuditPanel.csv.headers.action'),
          t('vaultAuditPanel.csv.headers.file'),
          t('vaultAuditPanel.csv.headers.actor'),
        ]
      : [
          t('vaultAuditPanel.csv.headers.date'),
          t('vaultAuditPanel.csv.headers.action'),
          t('vaultAuditPanel.csv.headers.file'),
          t('vaultAuditPanel.csv.headers.actor'),
          t('vaultAuditPanel.csv.headers.patientId'),
          t('vaultAuditPanel.csv.headers.metadata'),
        ];
    const rows = list.map((e) => {
      const base = [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
        labels[e.action] || e.action,
        e.file_id ? fMap[e.file_id] || t('vaultAuditPanel.csv.deleted') : '',
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
      throw new Error(t('vaultAuditPanel.csv.errorEncodingMissingBom'));
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
      toast.error(err?.message || t('vaultAuditPanel.csv.errorPreview'));
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
      const filterTag = actionFilter !== 'all' ? actionFilter : t('vaultAuditPanel.csv.filterAll');
      link.href = url;
      link.download = `${t('vaultAuditPanel.csv.downloadFilename')}_${dateStr}_${filterTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPreviewOpen(false);

      toast.success(
        t('vaultAuditPanel.csv.exportSuccess').replace('{count}', String(rows.length))
      );
    } catch (err: any) {
      console.error('[VaultAuditPanel] export error', err);
      toast.error(err?.message || t('vaultAuditPanel.csv.errorEncoding'));
    } finally {
      setIsExporting(false);
    }
  };

  const renderAction = (action: AuditAction) => {
    const cfg: Record<AuditAction, { label: string; icon: React.ElementType; variant: any }> = {
      accessed: { label: t('vaultAuditPanel.actions.accessed'), icon: Eye, variant: 'info' },
      access_denied: { label: t('vaultAuditPanel.actions.accessDenied'), icon: ShieldOff, variant: 'destructive' },
      access_granted: { label: t('vaultAuditPanel.actions.accessGranted'), icon: ShieldCheck, variant: 'success' },
      access_revoked: { label: t('vaultAuditPanel.actions.accessRevoked'), icon: XCircle, variant: 'warning' },
      otp_required: { label: t('vaultAuditPanel.actions.otpRequired'), icon: KeyRound, variant: 'secondary' },
      otp_failed: { label: t('vaultAuditPanel.actions.otpFailed'), icon: XCircle, variant: 'destructive' },
      otp_verified: { label: t('vaultAuditPanel.actions.otpVerified'), icon: CheckCircle2, variant: 'success' },
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
          {t('vaultAuditPanel.title')}
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
            <span className="hidden sm:inline">{t('vaultAuditPanel.buttons.preview')}</span>
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
            <span className="hidden sm:inline">{t('vaultAuditPanel.buttons.exportCsv')}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAudit}
            disabled={isLoading}
            className="h-8 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('vaultAuditPanel.buttons.refresh')}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t('vaultAuditPanel.filters.file')}</Label>
            <Select value={fileFilter} onValueChange={setFileFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">{t('vaultAuditPanel.filters.allFiles')}</SelectItem>
                {availableFiles.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">
                    {f.name.length > 40 ? f.name.slice(0, 40) + '…' : f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t('vaultAuditPanel.filters.action')}</Label>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTION_VALUES.map((value) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {t(ACTION_LABEL_KEY[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t('vaultAuditPanel.filters.from')}</Label>
            <Input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t('vaultAuditPanel.filters.to')}</Label>
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
            {t('vaultAuditPanel.showingEvents')
              .replace('{shown}', String(grouped.length))
              .replace('{total}', String(totalCount))}
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1 text-[11px]"
            >
              <FilterX className="w-3 h-3" />
              {t('vaultAuditPanel.buttons.clearFilters')}
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
              ? t('vaultAuditPanel.empty.noMatches')
              : mode === 'patient'
              ? t('vaultAuditPanel.empty.patient')
              : t('vaultAuditPanel.empty.doctor')}
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
                        {format(
                          new Date(e.created_at),
                          t('vaultAuditPanel.entry.dateFormat'),
                          language === 'es' ? { locale: es } : undefined
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">
                      {e.file_id && fileMap[e.file_id] ? (
                        <>
                          {t('vaultAuditPanel.entry.fileLabel')}{' '}
                          <span className="font-medium">{fileMap[e.file_id]}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('vaultAuditPanel.entry.fileUnavailable')}
                        </span>
                      )}
                    </p>
                    {mode === 'patient' && e.actor_id && actorMap[e.actor_id] && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t('vaultAuditPanel.entry.by')} {actorMap[e.actor_id]}
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
                  {t('vaultAuditPanel.loadMore').replace(
                    '{remaining}',
                    String(totalCount - grouped.length)
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* CSV Preview Modal */}
      {previewOpen && previewData && (
        <div
          data-testid="csv-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">
                  {t('vaultAuditPanel.preview.title')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('vaultAuditPanel.preview.rowsColumns')
                    .replace('{rows}', String(previewData.totalRows))
                    .replace('{cols}', String(previewData.headers.length))}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            {previewData.totalRows > 5 && (
              <div className="px-4 py-2 bg-warning/10 border-b border-warning/20">
                <p
                  className="text-xs text-warning-foreground"
                  dangerouslySetInnerHTML={{
                    __html: t('vaultAuditPanel.preview.truncatedWarning').replace(
                      '{total}',
                      String(previewData.totalRows)
                    ),
                  }}
                />
              </div>
            )}

            <div className="px-4 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <strong>{t('vaultAuditPanel.preview.activeFilters')}</strong>{' '}
              {actionFilter !== 'all'
                ? t('vaultAuditPanel.preview.actionPrefix').replace('{action}', t(ACTION_LABEL_KEY[actionFilter]))
                : t('vaultAuditPanel.actions.all')}
              {' • '}
              {fileFilter !== 'all'
                ? t('vaultAuditPanel.preview.fileFiltered')
                : t('vaultAuditPanel.filters.allFiles')}
              {' • '}
              {fromDate} → {toDate}
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-xs" data-testid="csv-preview-table">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {previewData.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-foreground max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                {t('vaultAuditPanel.buttons.cancel')}
              </Button>
              <Button onClick={exportCsv} disabled={isExporting} className="gap-2" data-testid="csv-confirm-download">
                <Download className="w-4 h-4" />
                {t('vaultAuditPanel.buttons.downloadCsv')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
