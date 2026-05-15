import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { MobileBackHeader } from '@/components/layout/MobileBackHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Mail, CheckCircle, XCircle, Video, Calendar as CalendarIcon, Filter, X, Download, Trash2, SquareCheck, Square, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailItem {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  emailType: string;
  subject: string;
  contentTitle: string | null;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
}

type EmailTypeFilter = 'all' | 'new_content' | 'live_started' | 'availability_reminder';
type DateRangeFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

const EMAIL_TYPES: { value: EmailTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'new_content', label: 'Nuevo contenido' },
  { value: 'live_started', label: 'Live iniciado' },
  { value: 'availability_reminder', label: 'Recordatorios' },
];

const DATE_RANGES: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'Todo el tiempo' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mes' },
  { value: 'custom', label: 'Rango personalizado' },
];

const getEmailTypeIcon = (type: string) => {
  switch (type) {
    case 'new_content': return <Video className="w-4 h-4" />;
    case 'live_started': return <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />;
    case 'availability_reminder': return <CalendarIcon className="w-4 h-4" />;
    default: return <Mail className="w-4 h-4" />;
  }
};

const getEmailTypeLabel = (type: string) => {
  switch (type) {
    case 'new_content': return 'Nuevo contenido';
    case 'live_started': return 'Live iniciado';
    case 'availability_reminder': return 'Recordatorio';
    default: return type;
  }
};

export default function DoctorEmailHistory() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuth();
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<EmailTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!supabaseUser?.id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq('doctor_id', supabaseUser.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && data) {
        setEmails(data.map(e => ({
          id: e.id,
          recipientEmail: e.recipient_email,
          recipientName: e.recipient_name,
          emailType: e.email_type,
          subject: e.subject,
          contentTitle: e.content_title,
          status: e.status as 'sent' | 'failed',
          errorMessage: e.error_message,
          createdAt: new Date(e.created_at),
        })));
      }
      setIsLoading(false);
    };
    fetch();
  }, [supabaseUser?.id]);

  const filteredEmails = useMemo(() => {
    let result = [...emails];
    if (typeFilter !== 'all') result = result.filter(e => e.emailType === typeFilter);
    const now = new Date();
    if (dateFilter === 'today') result = result.filter(e => isAfter(e.createdAt, startOfDay(now)));
    else if (dateFilter === 'week') result = result.filter(e => isAfter(e.createdAt, new Date(now.getTime() - 7 * 86400000)));
    else if (dateFilter === 'month') result = result.filter(e => isAfter(e.createdAt, new Date(now.getTime() - 30 * 86400000)));
    else if (dateFilter === 'custom') {
      if (customDateFrom) result = result.filter(e => isAfter(e.createdAt, startOfDay(customDateFrom)));
      if (customDateTo) result = result.filter(e => isBefore(e.createdAt, endOfDay(customDateTo)));
    }
    return result;
  }, [emails, typeFilter, dateFilter, customDateFrom, customDateTo]);

  const hasActiveFilters = typeFilter !== 'all' || dateFilter !== 'all';
  const clearFilters = () => { setTypeFilter('all'); setDateFilter('all'); setCustomDateFrom(undefined); setCustomDateTo(undefined); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    setSelectedIds(prev => prev.size === filteredEmails.length ? new Set() : new Set(filteredEmails.map(e => e.id)));
  };

  const handleDelete = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('email_history').delete().in('id', ids);
      if (error) throw error;
      setEmails(prev => prev.filter(e => !ids.includes(e.id)));
      setSelectedIds(new Set());
      toast({ title: `${ids.length} email(s) eliminado(s)` });
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Destinatario', 'Email', 'Tipo', 'Contenido', 'Estado', 'Error'];
    const rows = filteredEmails.map(e => [
      format(e.createdAt, "yyyy-MM-dd HH:mm:ss"),
      e.recipientName || '', e.recipientEmail,
      getEmailTypeLabel(e.emailType), e.contentTitle || '',
      e.status === 'sent' ? 'Enviado' : 'Fallido', e.errorMessage || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `historial-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sentCount = filteredEmails.filter(e => e.status === 'sent').length;
  const failedCount = filteredEmails.filter(e => e.status === 'failed').length;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="hidden sm:inline-flex -ml-2 text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <MobileBackHeader />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{filteredEmails.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Fallidos</p>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={selectionMode ? "secondary" : "outline"} size="sm" onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }} className="gap-1.5">
            {selectionMode ? <SquareCheck className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectionMode ? 'Cancelar' : 'Seleccionar'}
          </Button>
          {selectionMode && (
            <>
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                {selectedIds.size === filteredEmails.length ? 'Deseleccionar' : 'Todos'}
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting} className="gap-1">
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar ({selectedIds.size})
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1 ml-auto">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant={showFilters ? "secondary" : "ghost"} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
            <Filter className="w-3.5 h-3.5" />
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as EmailTypeFilter)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{EMAIL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateRangeFilter)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DATE_RANGES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {dateFilter === 'custom' && (
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} locale={es} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} locale={es} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" /> Limpiar filtros
              </Button>
            )}
          </Card>
        )}

        {/* Email list */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filteredEmails.length === 0 ? (
          <Card className="p-8 text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay emails que mostrar</p>
            {hasActiveFilters && <Button variant="link" size="sm" onClick={clearFilters}>Limpiar filtros</Button>}
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredEmails.map(email => (
              <Card
                key={email.id}
                className={cn(
                  "p-3 transition-colors",
                  selectionMode && "cursor-pointer",
                  selectedIds.has(email.id) && "ring-1 ring-primary/40 bg-primary/5"
                )}
                onClick={() => selectionMode && toggleSelect(email.id)}
              >
                <div className="flex items-start gap-3">
                  {selectionMode && (
                    <input type="checkbox" checked={selectedIds.has(email.id)} onChange={() => toggleSelect(email.id)}
                      className="mt-2 accent-primary shrink-0" onClick={e => e.stopPropagation()} />
                  )}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {getEmailTypeIcon(email.emailType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{email.recipientName || email.recipientEmail}</span>
                      <Badge variant="outline" className="text-[10px]">{getEmailTypeLabel(email.emailType)}</Badge>
                      {email.status === 'sent' ? <CheckCircle className="w-3 h-3 text-success" /> : <XCircle className="w-3 h-3 text-destructive" />}
                    </div>
                    {email.contentTitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{email.contentTitle}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{format(email.createdAt, "d MMM yyyy, HH:mm", { locale: es })}</p>
                    {email.status === 'failed' && email.errorMessage && <p className="text-xs text-destructive mt-1">{email.errorMessage}</p>}
                  </div>
                  {!selectionMode && (
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTargetId(email.id); setShowDeleteDialog(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar emails?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetId
                ? 'Este email se eliminará permanentemente.'
                : `Se eliminarán ${selectedIds.size} email(s) permanentemente.`}
              {' '}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => handleDelete(deleteTargetId ? [deleteTargetId] : Array.from(selectedIds))}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
