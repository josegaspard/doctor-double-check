import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, RefreshCw, ShieldCheck, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type CredStatus = 'pending' | 'approved' | 'rejected';
type CredKind = 'cedula' | 'cofepris';

interface DoctorRow {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  cedula_profesional: string | null;
  cedula_status: CredStatus | null;
  cedula_rejection_reason: string | null;
  cofepris_permit: string | null;
  cofepris_status: CredStatus | null;
  cofepris_rejection_reason: string | null;
}

const STATUS_CONFIG: Record<CredStatus, { label: string; variant: any; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', variant: 'warning', icon: Clock },
  approved: { label: 'Aprobada', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Rechazada', variant: 'destructive', icon: XCircle },
};

export function MedicalCredentialsReview() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    doctor: DoctorRow | null;
    kind: CredKind;
    action: 'approve' | 'reject';
  }>({ open: false, doctor: null, kind: 'cedula', action: 'approve' });
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('doctor_profiles')
        .select('user_id, cedula_profesional, cedula_status, cedula_rejection_reason, cofepris_permit, cofepris_status, cofepris_rejection_reason')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const userIds = (profiles || []).map((p: any) => p.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const merged: DoctorRow[] = (profiles || []).map((dp: any) => ({
        user_id: dp.user_id,
        name: profileMap.get(dp.user_id)?.name || 'Doctor',
        email: profileMap.get(dp.user_id)?.email || null,
        avatar_url: profileMap.get(dp.user_id)?.avatar_url || null,
        cedula_profesional: dp.cedula_profesional,
        cedula_status: (dp.cedula_status as CredStatus) || null,
        cedula_rejection_reason: dp.cedula_rejection_reason,
        cofepris_permit: dp.cofepris_permit,
        cofepris_status: (dp.cofepris_status as CredStatus) || null,
        cofepris_rejection_reason: dp.cofepris_rejection_reason,
      }));

      const filtered = merged.filter(
        (d) => (d.cedula_profesional && d.cedula_profesional.trim()) || (d.cofepris_permit && d.cofepris_permit.trim())
      );
      setDoctors(filtered);
    } catch (err: any) {
      console.error('[MedicalCredentialsReview] fetch error', err);
      toast.error(err.message || 'Error cargando credenciales');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const openAction = (doctor: DoctorRow, kind: CredKind, action: 'approve' | 'reject') => {
    setActionDialog({ open: true, doctor, kind, action });
    setReason('');
  };

  const handleAction = async () => {
    if (!actionDialog.doctor) return;
    const { doctor, kind, action } = actionDialog;
    setIsProcessing(true);
    try {
      const newStatus: CredStatus = action === 'approve' ? 'approved' : 'rejected';
      const update: Record<string, any> = {};
      if (kind === 'cedula') {
        update.cedula_status = newStatus;
        update.cedula_rejection_reason = action === 'reject' ? reason.trim() : null;
      } else {
        update.cofepris_status = newStatus;
        update.cofepris_rejection_reason = action === 'reject' ? reason.trim() : null;
      }

      const { error } = await supabase
        .from('doctor_profiles')
        .update(update)
        .eq('user_id', doctor.user_id);
      if (error) throw error;

      const credLabel = kind === 'cedula' ? 'Cédula Profesional' : 'Permiso COFEPRIS';
      await supabase.from('notifications').insert({
        user_id: doctor.user_id,
        type: 'system',
        title: action === 'approve' ? '✅ Credencial aprobada' : '❌ Credencial rechazada',
        message:
          action === 'approve'
            ? `Tu ${credLabel} fue aprobada. Notas de verificación: ${reason.trim()}`
            : `Tu ${credLabel} fue rechazada. Motivo: ${reason.trim()}`,
        data: { kind, status: newStatus, admin_notes: reason.trim() },
      });

      toast.success(
        action === 'approve'
          ? `Credencial ${kind === 'cedula' ? 'Cédula' : 'COFEPRIS'} aprobada`
          : `Credencial ${kind === 'cedula' ? 'Cédula' : 'COFEPRIS'} rechazada`
      );
      setActionDialog({ open: false, doctor: null, kind: 'cedula', action: 'approve' });
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || 'No se pudo actualizar la credencial');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatusBadge = (status: CredStatus | null) => {
    const c = STATUS_CONFIG[status || 'pending'];
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="gap-1 text-[10px]">
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const matchesTab = (d: DoctorRow): boolean => {
    if (activeTab === 'all') return true;
    const cedulaState = d.cedula_status || 'pending';
    const cofeprisState = d.cofepris_status || 'pending';
    return cedulaState === activeTab || cofeprisState === activeTab;
  };

  const filtered = doctors.filter(matchesTab);

  const counts = {
    pending: doctors.filter((d) => (d.cedula_status || 'pending') === 'pending' || (d.cofepris_status || 'pending') === 'pending').length,
    approved: doctors.filter((d) => d.cedula_status === 'approved' || d.cofepris_status === 'approved').length,
    rejected: doctors.filter((d) => d.cedula_status === 'rejected' || d.cofepris_status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Credenciales Médicas
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Aprueba o rechaza Cédula Profesional y Permiso COFEPRIS por separado
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchDoctors} disabled={isLoading} className="h-9 w-9">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-warning">{counts.pending}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-success">{counts.approved}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Aprobadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg sm:text-2xl font-bold text-destructive">{counts.rejected}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Rechazadas</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="pending" className="text-[10px] sm:text-xs">Pendientes</TabsTrigger>
          <TabsTrigger value="approved" className="text-[10px] sm:text-xs">Aprobadas</TabsTrigger>
          <TabsTrigger value="rejected" className="text-[10px] sm:text-xs">Rechazadas</TabsTrigger>
          <TabsTrigger value="all" className="text-[10px] sm:text-xs">Todos</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No hay doctores con credenciales en este estado.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => (
                <Card key={d.user_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={d.avatar_url || ''} />
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.email}</p>
                      </div>
                    </div>

                    {d.cedula_profesional && d.cedula_profesional.trim() && (
                      <div className="rounded-lg border border-border/60 p-3 mb-2 bg-muted/20">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">Cédula Profesional</span>
                              {renderStatusBadge(d.cedula_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">{d.cedula_profesional}</p>
                            {d.cedula_status === 'rejected' && d.cedula_rejection_reason && (
                              <p className="text-[11px] text-destructive mt-1">
                                Motivo: {d.cedula_rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cedula', 'approve')}>
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Aprobar</span>
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cedula', 'reject')}>
                              <XCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Rechazar</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {d.cofepris_permit && d.cofepris_permit.trim() && (
                      <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">Permiso COFEPRIS</span>
                              {renderStatusBadge(d.cofepris_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">{d.cofepris_permit}</p>
                            {d.cofepris_status === 'rejected' && d.cofepris_rejection_reason && (
                              <p className="text-[11px] text-destructive mt-1">
                                Motivo: {d.cofepris_rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cofepris', 'approve')}>
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Aprobar</span>
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => openAction(d, 'cofepris', 'reject')}>
                              <XCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Rechazar</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ ...actionDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve'
                ? 'Aprobar credencial — confirma verificación'
                : 'Rechazar credencial — indica motivo'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.doctor?.name} —{' '}
              {actionDialog.kind === 'cedula' ? 'Cédula Profesional' : 'Permiso COFEPRIS'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">
              {actionDialog.action === 'approve' ? 'Notas de verificación' : 'Motivo del rechazo'}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionDialog.action === 'approve'
                  ? 'Confirma cómo verificaste esta credencial — visible al doctor y registrado para auditoría'
                  : 'Explica el motivo (visible al doctor)...'
              }
              className="mt-2"
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {actionDialog.action === 'approve'
                ? 'Ej.: "Verificada en RNPP/SEP por número y nombre el día de hoy."'
                : 'El doctor recibirá esta razón en su notificación.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ ...actionDialog, open: false })}>
              Cancelar
            </Button>
            <Button
              variant={actionDialog.action === 'approve' ? 'success' : 'destructive'}
              onClick={handleAction}
              disabled={isProcessing || !reason.trim()}
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionDialog.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
