import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Report {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string | null;
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
};

export default function AdminReports() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error('Acceso denegado');
    }
  }, [role, navigate]);

  useEffect(() => {
    if (role === 'admin') {
      fetchReports();
    }
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

      // Fetch reporter info
      const reporterIds = [...new Set(data?.map(r => r.reporter_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', reporterIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const reportsWithReporter = data?.map(r => ({
        ...r,
        reporter: profileMap.get(r.reporter_id) || null
      })) || [];

      setReports(reportsWithReporter);
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
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast.success('Reporte actualizado');
      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      toast.error('Error al actualizar reporte');
    } finally {
      setIsUpdating(false);
    }
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Admin
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Flag className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Gestión de Reportes
              </h1>
              <p className="text-muted-foreground">
                Revisa y gestiona reportes de contenido inapropiado
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por estado" />
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
          <div className="space-y-4">
            {reports.map(report => {
              const statusConfig = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = statusConfig?.icon || Clock;
              
              return (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          <span className="font-medium">{report.reason}</span>
                          <Badge variant={statusConfig?.variant || 'secondary'}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig?.label || report.status}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline">
                            {CONTENT_TYPE_LABELS[report.content_type] || report.content_type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            ID: {report.content_id.slice(0, 8)}...
                          </span>
                        </div>

                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {report.description}
                          </p>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Reportado por: {report.reporter?.name || 'Usuario'} • 
                          {format(new Date(report.created_at), ' dd MMM yyyy HH:mm', { locale: es })}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotes(report.admin_notes || '');
                          setNewStatus(report.status);
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revisar Reporte</DialogTitle>
              <DialogDescription>
                Actualiza el estado y agrega notas administrativas
              </DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Razón del reporte:</p>
                  <p className="text-sm text-muted-foreground">{selectedReport.reason}</p>
                </div>

                {selectedReport.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Descripción:</p>
                    <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Nuevo estado:</p>
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

                <div>
                  <p className="text-sm font-medium mb-2">Notas del administrador:</p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Agrega notas sobre la revisión..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateReport} disabled={isUpdating}>
                {isUpdating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
