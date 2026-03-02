import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Mail, CheckCircle, XCircle, Video, Calendar as CalendarIcon, ChevronDown, ChevronUp, Filter, X, Clock, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EmailHistoryItem {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  emailType: string;
  subject: string;
  contentId: string | null;
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
    case 'new_content':
      return <Video className="w-4 h-4" />;
    case 'live_started':
      return <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />;
    case 'availability_reminder':
      return <CalendarIcon className="w-4 h-4" />;
    default:
      return <Mail className="w-4 h-4" />;
  }
};

const getEmailTypeLabel = (type: string) => {
  switch (type) {
    case 'new_content':
      return 'Nuevo contenido';
    case 'live_started':
      return 'Live iniciado';
    case 'availability_reminder':
      return 'Recordatorio';
    default:
      return type;
  }
};

export function EmailHistoryCard() {
  const { supabaseUser } = useAuth();
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<EmailTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  useEffect(() => {
    if (!supabaseUser?.id) return;

    const fetchEmailHistory = async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq('doctor_id', supabaseUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setEmails(data.map(e => ({
          id: e.id,
          recipientEmail: e.recipient_email,
          recipientName: e.recipient_name,
          emailType: e.email_type,
          subject: e.subject,
          contentId: e.content_id,
          contentTitle: e.content_title,
          status: e.status as 'sent' | 'failed',
          errorMessage: e.error_message,
          createdAt: new Date(e.created_at),
        })));
      }
      setIsLoading(false);
    };

    fetchEmailHistory();
  }, [supabaseUser?.id]);

  // Apply filters
  const filteredEmails = useMemo(() => {
    let result = [...emails];

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(e => e.emailType === typeFilter);
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const todayStart = startOfDay(now);
      result = result.filter(e => isAfter(e.createdAt, todayStart));
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(e => isAfter(e.createdAt, weekAgo));
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(e => isAfter(e.createdAt, monthAgo));
    } else if (dateFilter === 'custom') {
      if (customDateFrom) {
        result = result.filter(e => isAfter(e.createdAt, startOfDay(customDateFrom)));
      }
      if (customDateTo) {
        result = result.filter(e => isBefore(e.createdAt, endOfDay(customDateTo)));
      }
    }

    return result;
  }, [emails, typeFilter, dateFilter, customDateFrom, customDateTo]);

  const hasActiveFilters = typeFilter !== 'all' || dateFilter !== 'all';

  const clearFilters = () => {
    setTypeFilter('all');
    setDateFilter('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('email_history')
        .delete()
        .in('id', ids);
      if (!error) {
        setEmails(prev => prev.filter(e => !selectedIds.has(e.id)));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error deleting emails:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const sentCount = filteredEmails.filter(e => e.status === 'sent').length;
  const failedCount = filteredEmails.filter(e => e.status === 'failed').length;

  const exportToCSV = () => {
    const headers = ['Fecha', 'Destinatario', 'Email', 'Tipo', 'Contenido', 'Estado', 'Error'];
    const rows = filteredEmails.map(email => [
      format(email.createdAt, "yyyy-MM-dd HH:mm:ss"),
      email.recipientName || '',
      email.recipientEmail,
      getEmailTypeLabel(email.emailType),
      email.contentTitle || '',
      email.status === 'sent' ? 'Enviado' : 'Fallido',
      email.errorMessage || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historial-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Historial de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Historial de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aún no has enviado emails a tus suscriptores</p>
            <p className="text-xs mt-1">Los emails aparecerán aquí cuando subas contenido o inicies un live</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedEmails = isExpanded ? filteredEmails : filteredEmails.slice(0, 5);

  return (
    <Card>
      <CardHeader className="space-y-3">
        {/* Row 1: Title + count badges */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2 min-w-0">
            <Mail className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">Historial de Emails</span>
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2">
              <CheckCircle className="w-3 h-3 text-success" />
              {sentCount}
            </Badge>
            {failedCount > 0 && (
              <Badge variant="destructive" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2">
                <XCircle className="w-3 h-3" />
                {failedCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelected}
              disabled={isDeleting}
              className="gap-1 h-8 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? '...' : `Eliminar (${selectedIds.size})`}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="gap-1 text-xs h-8"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{selectedIds.size === filteredEmails.length ? 'Deseleccionar' : 'Seleccionar todo'}</span>
          </Button>
          {filteredEmails.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="gap-1 h-8 text-xs"
              title="Exportar a CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1 h-8 text-xs"
          >
            <Filter className="w-3.5 h-3.5" />
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Type Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Tipo de email</label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as EmailTypeFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateRangeFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !customDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !customDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            )}

            {/* Results count */}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {filteredEmails.length} de {emails.length} emails
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filteredEmails.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Filter className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay emails que coincidan con los filtros</p>
            <Button variant="link" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className={isExpanded ? 'h-[400px]' : ''}>
              <div className="space-y-3">
                {displayedEmails.map(email => (
                  <div
                    key={email.id}
                    className={`flex items-start gap-3 p-3 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer ${selectedIds.has(email.id) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/50'}`}
                    onClick={() => toggleSelect(email.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(email.id)}
                      onChange={() => toggleSelect(email.id)}
                      className="mt-2 accent-primary flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                      {getEmailTypeIcon(email.emailType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {email.recipientName || email.recipientEmail}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getEmailTypeLabel(email.emailType)}
                        </Badge>
                        {email.status === 'sent' ? (
                          <CheckCircle className="w-3 h-3 text-success" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                      </div>
                      {email.contentTitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.contentTitle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(email.createdAt, "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                      {email.status === 'failed' && email.errorMessage && (
                        <p className="text-xs text-destructive mt-1">{email.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {filteredEmails.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Ver todos ({filteredEmails.length})
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
