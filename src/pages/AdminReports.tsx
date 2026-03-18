import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  ArrowLeft,
  Mail,
  Paperclip,
  Send,
  MessageSquare,
  Image,
  Video,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Report {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string | null;
  reason: string;
  description: string | null;
  subject: string | null;
  contact_email: string | null;
  attachment_urls: string[] | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: { name: string; email: string } | null;
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', variant: 'warning' as const, icon: Clock },
  reviewed: { label: 'Revisado', variant: 'info' as const, icon: Eye },
  resolved: { label: 'Resuelto', variant: 'success' as const, icon: CheckCircle },
  dismissed: { label: 'Descartado', variant: 'secondary' as const, icon: XCircle },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  live: 'Transmisión en vivo',
  recording: 'Grabación',
  doctor: 'Doctor',
  chat_message: 'Mensaje de chat',
  platform_report: 'Reporte de plataforma',
};

const REASON_LABELS: Record<string, string> = {
  bug: '🐛 Falla técnica',
  abuse: '⚠️ Abuso / Conducta inapropiada',
  other: '📝 Otro',
};

export default function AdminReports() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error('Acceso denegado');
    }
  }, [role, navigate]);

  useEffect(() => {
    if (role === 'admin') fetchReports();
  }, [role, filterStatus]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reporterIds = [...new Set(data?.map(r => r.reporter_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', reporterIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const reportsWithReporter = data?.map(r => ({
        ...r,
        reporter: profileMap.get(r.reporter_id) || null,
      })) || [];

      setReports(reportsWithReporter as Report[]);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Error al cargar reportes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!selectedReport || !newStatus) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', selectedReport.id);
      if (error) throw error;

      // Send notification to reporter if there's a response
      if (adminResponse.trim() && selectedReport.reporter_id) {
        await supabase.from('notifications').insert({
          user_id: selectedReport.reporter_id,
          type: 'system' as any,
          title: '📋 Respuesta a tu reporte',
          message: adminResponse.trim(),
          data: { report_id: selectedReport.id },
        });
      }

      toast.success('Reporte actualizado');
      setSelectedReport(null);
      setAdminResponse('');
      fetchReports();
    } catch (error) {
      toast.error('Error al actualizar reporte');
    } finally {
      setIsUpdating(false);
    }
  };

  const isMediaFile = (url: string) => {
    const lower = url.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg)/.test(lower);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-3 hidden sm:inline-flex">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver al Admin
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground truncate">
                Gestión de Reportes
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Revisa y gestiona reportes
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="reviewed">Revisados</SelectItem>
              <SelectItem value="resolved">Resueltos</SelectItem>
              <SelectItem value="dismissed">Descartados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Flag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No hay reportes</h3>
              <p className="text-muted-foreground">
                No se encontraron reportes con el filtro seleccionado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const statusConfig = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = statusConfig?.icon || Clock;
              
              return (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Subject line */}
                        {report.subject && (
                          <p className="font-semibold text-sm mb-1 line-clamp-1">{report.subject}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant={statusConfig?.variant || 'secondary'} className="text-[10px]">
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig?.label || report.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {CONTENT_TYPE_LABELS[report.content_type] || report.content_type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {REASON_LABELS[report.reason] || report.reason}
                          </span>
                        </div>

                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {report.description}
                          </p>
                        )}

                        {/* Attachment indicators */}
                        {report.attachment_urls && report.attachment_urls.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {report.attachment_urls.length} adjunto(s)
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{report.reporter?.name || 'Usuario'}</span>
                          {report.contact_email && (
                            <span className="flex items-center gap-0.5">
                              <Mail className="w-3 h-3" />
                              {report.contact_email}
                            </span>
                          )}
                          <span>
                            {format(new Date(report.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotes(report.admin_notes || '');
                          setNewStatus(report.status);
                          setAdminResponse('');
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Revisar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Revisar Reporte</DialogTitle>
              <DialogDescription>
                Actualiza el estado, agrega notas y responde al usuario
              </DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4">
                {/* Report details */}
                {selectedReport.subject && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Asunto</Label>
                    <p className="font-medium">{selectedReport.subject}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <p className="text-sm">{REASON_LABELS[selectedReport.reason] || selectedReport.reason}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Reportado por</Label>
                    <p className="text-sm">{selectedReport.reporter?.name || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground">{selectedReport.reporter?.email}</p>
                  </div>
                </div>

                {selectedReport.contact_email && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Email de contacto</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {selectedReport.contact_email}
                    </p>
                  </div>
                )}

                {selectedReport.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                      {selectedReport.description}
                    </p>
                  </div>
                )}

                {/* Attachments preview */}
                {selectedReport.attachment_urls && selectedReport.attachment_urls.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Adjuntos ({selectedReport.attachment_urls.length})
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedReport.attachment_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group"
                        >
                          {isMediaFile(url) ? (
                            <img src={url} alt={`Adjunto ${i + 1}`} className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-muted flex items-center justify-center">
                              <Video className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Nuevo estado</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="reviewed">Revisado</SelectItem>
                      <SelectItem value="resolved">Resuelto</SelectItem>
                      <SelectItem value="dismissed">Descartado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin notes (internal) */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Notas internas</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notas internas (no visibles para el usuario)..."
                    rows={2}
                  />
                </div>

                {/* Admin response to user */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Responder al usuario (se enviará como notificación)
                  </Label>
                  <Textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="Escribe una respuesta para el usuario..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setSelectedReport(null)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleUpdateReport} disabled={isUpdating} className="w-full sm:w-auto gap-1.5">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
