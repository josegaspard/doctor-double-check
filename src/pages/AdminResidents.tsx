import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  GraduationCap,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  Mail,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Building,
  Calendar,
} from 'lucide-react';

type ResidentStatus = 'pending' | 'approved' | 'rejected';

interface ResidentWithProfile {
  id: string;
  user_id: string;
  institution: string;
  specialty: string;
  year: number;
  status: ResidentStatus;
  titulo_medicina: string | null;
  cedula_profesional: string | null;
  created_at: string;
  user: {
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function AdminResidents() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  
  const [residents, setResidents] = useState<ResidentWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResident, setSelectedResident] = useState<ResidentWithProfile | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

  const fetchResidents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('resident_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const residentsWithProfiles: ResidentWithProfile[] = [];
      
      for (const r of data || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, avatar_url')
          .eq('id', r.user_id)
          .single();

        residentsWithProfiles.push({
          ...r,
          status: r.status as ResidentStatus,
          user: profile,
        });
      }

      setResidents(residentsWithProfiles);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchResidents();
    }
  }, [role]);

  const openActionDialog = (resident: ResidentWithProfile, action: 'approve' | 'reject') => {
    setSelectedResident(resident);
    setActionType(action);
    setRejectionReason('');
    setIsActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedResident) return;

    setIsProcessing(true);
    try {
      const newStatus: ResidentStatus = actionType === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('resident_profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedResident.id);

      if (error) throw error;

      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            user_id: selectedResident.user_id,
            status: newStatus === 'approved' ? 'verified' : 'failed',
            user_email: selectedResident.user?.email,
            user_name: selectedResident.user?.name,
          },
        });
      } catch (emailError) {
        console.warn('Failed to send email:', emailError);
      }

      toast.success(
        actionType === 'approve'
          ? (language === 'es' ? 'Residente aprobado' : 'Resident approved')
          : (language === 'es' ? 'Residente rechazado' : 'Resident rejected')
      );

      setIsActionDialogOpen(false);
      fetchResidents();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: ResidentStatus) => {
    const configs: Record<ResidentStatus, { variant: any; label: string; icon: React.ElementType }> = {
      pending: { variant: 'warning', label: language === 'es' ? 'Pendiente' : 'Pending', icon: Clock },
      approved: { variant: 'success', label: language === 'es' ? 'Aprobado' : 'Approved', icon: CheckCircle },
      rejected: { variant: 'destructive', label: language === 'es' ? 'Rechazado' : 'Rejected', icon: XCircle },
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredResidents = residents.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'approved') return r.status === 'approved';
    if (activeTab === 'rejected') return r.status === 'rejected';
    return true;
  });

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-purple-500" />
              {language === 'es' ? 'Validación de Residentes' : 'Resident Validation'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' ? 'Aprueba o rechaza solicitudes de residentes' : 'Approve or reject resident requests'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchResidents} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-warning">{residents.filter(r => r.status === 'pending').length}</div><div className="text-sm text-muted-foreground">{language === 'es' ? 'Pendientes' : 'Pending'}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-success">{residents.filter(r => r.status === 'approved').length}</div><div className="text-sm text-muted-foreground">{language === 'es' ? 'Aprobados' : 'Approved'}</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-destructive">{residents.filter(r => r.status === 'rejected').length}</div><div className="text-sm text-muted-foreground">{language === 'es' ? 'Rechazados' : 'Rejected'}</div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-1" />{language === 'es' ? 'Pendientes' : 'Pending'}</TabsTrigger>
            <TabsTrigger value="approved"><CheckCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Aprobados' : 'Approved'}</TabsTrigger>
            <TabsTrigger value="rejected"><XCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Rechazados' : 'Rejected'}</TabsTrigger>
            <TabsTrigger value="all">{language === 'es' ? 'Todos' : 'All'}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => (<Card key={i}><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div></div></CardContent></Card>))}</div>
            ) : filteredResidents.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{language === 'es' ? 'No hay residentes en esta categoría' : 'No residents in this category'}</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {filteredResidents.map(resident => (
                  <Card key={resident.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={resident.user?.avatar_url || ''} />
                          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{resident.user?.name || 'Residente'}</span>
                            {getStatusBadge(resident.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{resident.specialty} - Año {resident.year}</span>
                            <span className="flex items-center gap-1"><Building className="w-3 h-3" />{resident.institution}</span>
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{resident.user?.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedResident(resident)}>
                            <Eye className="w-4 h-4 mr-1" />{language === 'es' ? 'Ver' : 'View'}
                          </Button>
                          {resident.status === 'pending' && (
                            <>
                              <Button size="sm" variant="success" onClick={() => openActionDialog(resident, 'approve')}>
                                <CheckCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Aprobar' : 'Approve'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openActionDialog(resident, 'reject')}>
                                <XCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Rechazar' : 'Reject'}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {selectedResident && !isActionDialogOpen && (
          <Dialog open={!!selectedResident} onOpenChange={() => setSelectedResident(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5" />{language === 'es' ? 'Detalles del Residente' : 'Resident Details'}</DialogTitle>
                <DialogDescription>{selectedResident.user?.name} - {selectedResident.user?.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Especialidad' : 'Specialty'}</label><p className="font-medium">{selectedResident.specialty}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Año' : 'Year'}</label><p className="font-medium">{selectedResident.year}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Institución' : 'Institution'}</label><p className="font-medium">{selectedResident.institution}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Título de Medicina' : 'Medical Degree'}</label><p className="font-medium">{selectedResident.titulo_medicina || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Cédula Profesional' : 'Professional ID'}</label><p className="font-medium">{selectedResident.cedula_profesional || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Registrado' : 'Registered'}</label><p className="font-medium">{new Date(selectedResident.created_at).toLocaleDateString()}</p></div>
                </div>
              </div>
              <DialogFooter>
                {selectedResident.status === 'pending' && (
                  <div className="flex gap-2 w-full">
                    <Button className="flex-1" variant="success" onClick={() => { setSelectedResident(null); setTimeout(() => openActionDialog(selectedResident, 'approve'), 100); }}>
                      <CheckCircle className="w-4 h-4 mr-2" />{language === 'es' ? 'Aprobar' : 'Approve'}
                    </Button>
                    <Button className="flex-1" variant="destructive" onClick={() => { setSelectedResident(null); setTimeout(() => openActionDialog(selectedResident, 'reject'), 100); }}>
                      <XCircle className="w-4 h-4 mr-2" />{language === 'es' ? 'Rechazar' : 'Reject'}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionType === 'approve' ? (language === 'es' ? '¿Aprobar residente?' : 'Approve resident?') : (language === 'es' ? '¿Rechazar residente?' : 'Reject resident?')}</DialogTitle>
              <DialogDescription>{actionType === 'approve' ? (language === 'es' ? 'El residente podrá acceder a todas las funcionalidades.' : 'The resident will be able to access all functionalities.') : (language === 'es' ? 'Proporciona una razón para el rechazo.' : 'Provide a reason for rejection.')}</DialogDescription>
            </DialogHeader>
            {actionType === 'reject' && <Textarea placeholder={language === 'es' ? 'Razón del rechazo...' : 'Rejection reason...'} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} />}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} disabled={isProcessing}>{language === 'es' ? 'Cancelar' : 'Cancel'}</Button>
              <Button variant={actionType === 'approve' ? 'success' : 'destructive'} onClick={handleAction} disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'approve' ? (language === 'es' ? 'Confirmar' : 'Confirm') : (language === 'es' ? 'Rechazar' : 'Reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
