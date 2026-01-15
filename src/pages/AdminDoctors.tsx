import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Stethoscope,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  Mail,
  Calendar,
  MapPin,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Award,
  FileText,
} from 'lucide-react';

type DoctorStatus = 'pending' | 'approved' | 'rejected';

interface DoctorWithProfile {
  id: string;
  user_id: string;
  specialty: string;
  license: string;
  bio: string | null;
  status: DoctorStatus;
  consultation_fee: number;
  cedula_profesional: string | null;
  numero_consejo: string | null;
  location: string | null;
  created_at: string;
  user: {
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function AdminDoctors() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithProfile | null>(null);
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

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const doctorsWithProfiles: DoctorWithProfile[] = [];
      
      for (const d of data || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, avatar_url')
          .eq('id', d.user_id)
          .single();

        doctorsWithProfiles.push({
          ...d,
          status: d.status as DoctorStatus,
          user: profile,
        });
      }

      setDoctors(doctorsWithProfiles);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchDoctors();
    }
  }, [role]);

  const openActionDialog = (doctor: DoctorWithProfile, action: 'approve' | 'reject') => {
    setSelectedDoctor(doctor);
    setActionType(action);
    setRejectionReason('');
    setIsActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedDoctor) return;

    setIsProcessing(true);
    try {
      const newStatus: DoctorStatus = actionType === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedDoctor.id);

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            user_id: selectedDoctor.user_id,
            status: newStatus === 'approved' ? 'verified' : 'failed',
            user_email: selectedDoctor.user?.email,
            user_name: selectedDoctor.user?.name,
          },
        });
      } catch (emailError) {
        console.warn('Failed to send email:', emailError);
      }

      toast.success(
        actionType === 'approve'
          ? (language === 'es' ? 'Médico aprobado' : 'Doctor approved')
          : (language === 'es' ? 'Médico rechazado' : 'Doctor rejected')
      );

      setIsActionDialogOpen(false);
      fetchDoctors();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: DoctorStatus) => {
    const configs: Record<DoctorStatus, { variant: any; label: string; icon: React.ElementType }> = {
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

  const filteredDoctors = doctors.filter(d => {
    if (activeTab === 'pending') return d.status === 'pending';
    if (activeTab === 'approved') return d.status === 'approved';
    if (activeTab === 'rejected') return d.status === 'rejected';
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
              <Stethoscope className="w-6 h-6 text-green-500" />
              {language === 'es' ? 'Validación de Médicos' : 'Doctor Validation'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' ? 'Aprueba o rechaza solicitudes de médicos' : 'Approve or reject doctor requests'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchDoctors} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-warning">
                {doctors.filter(d => d.status === 'pending').length}
              </div>
              <div className="text-sm text-muted-foreground">{language === 'es' ? 'Pendientes' : 'Pending'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">
                {doctors.filter(d => d.status === 'approved').length}
              </div>
              <div className="text-sm text-muted-foreground">{language === 'es' ? 'Aprobados' : 'Approved'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">
                {doctors.filter(d => d.status === 'rejected').length}
              </div>
              <div className="text-sm text-muted-foreground">{language === 'es' ? 'Rechazados' : 'Rejected'}</div>
            </CardContent>
          </Card>
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
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div></div></CardContent></Card>
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{language === 'es' ? 'No hay médicos en esta categoría' : 'No doctors in this category'}</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {filteredDoctors.map(doctor => (
                  <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={doctor.user?.avatar_url || ''} />
                          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{doctor.user?.name || 'Doctor'}</span>
                            {getStatusBadge(doctor.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Award className="w-3 h-3" />{doctor.specialty}</span>
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{doctor.user?.email}</span>
                            {doctor.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{doctor.location}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedDoctor(doctor)}>
                            <Eye className="w-4 h-4 mr-1" />{language === 'es' ? 'Ver' : 'View'}
                          </Button>
                          {doctor.status === 'pending' && (
                            <>
                              <Button size="sm" variant="success" onClick={() => openActionDialog(doctor, 'approve')}>
                                <CheckCircle className="w-4 h-4 mr-1" />{language === 'es' ? 'Aprobar' : 'Approve'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openActionDialog(doctor, 'reject')}>
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

        {selectedDoctor && !isActionDialogOpen && (
          <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5" />{language === 'es' ? 'Detalles del Médico' : 'Doctor Details'}</DialogTitle>
                <DialogDescription>{selectedDoctor.user?.name} - {selectedDoctor.user?.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Especialidad' : 'Specialty'}</label><p className="font-medium">{selectedDoctor.specialty}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Licencia' : 'License'}</label><p className="font-medium">{selectedDoctor.license || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Cédula Profesional' : 'Professional ID'}</label><p className="font-medium">{selectedDoctor.cedula_profesional || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Número de Consejo' : 'Council Number'}</label><p className="font-medium">{selectedDoctor.numero_consejo || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Ubicación' : 'Location'}</label><p className="font-medium">{selectedDoctor.location || 'N/A'}</p></div>
                  <div><label className="text-sm text-muted-foreground">{language === 'es' ? 'Tarifa de consulta' : 'Consultation Fee'}</label><p className="font-medium">${selectedDoctor.consultation_fee}</p></div>
                </div>
                {selectedDoctor.bio && <div><label className="text-sm text-muted-foreground">Bio</label><p className="text-sm">{selectedDoctor.bio}</p></div>}
              </div>
              <DialogFooter>
                {selectedDoctor.status === 'pending' && (
                  <div className="flex gap-2 w-full">
                    <Button className="flex-1" variant="success" onClick={() => { setSelectedDoctor(null); setTimeout(() => openActionDialog(selectedDoctor, 'approve'), 100); }}>
                      <CheckCircle className="w-4 h-4 mr-2" />{language === 'es' ? 'Aprobar' : 'Approve'}
                    </Button>
                    <Button className="flex-1" variant="destructive" onClick={() => { setSelectedDoctor(null); setTimeout(() => openActionDialog(selectedDoctor, 'reject'), 100); }}>
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
              <DialogTitle>{actionType === 'approve' ? (language === 'es' ? '¿Aprobar médico?' : 'Approve doctor?') : (language === 'es' ? '¿Rechazar médico?' : 'Reject doctor?')}</DialogTitle>
              <DialogDescription>{actionType === 'approve' ? (language === 'es' ? 'El médico podrá acceder a todas las funcionalidades.' : 'The doctor will be able to access all functionalities.') : (language === 'es' ? 'Proporciona una razón para el rechazo.' : 'Provide a reason for rejection.')}</DialogDescription>
            </DialogHeader>
            {actionType === 'reject' && (
              <Textarea placeholder={language === 'es' ? 'Razón del rechazo...' : 'Rejection reason...'} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} />
            )}
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
