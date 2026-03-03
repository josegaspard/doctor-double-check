import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, XCircle, Clock, User, Stethoscope, ArrowLeft, Newspaper, Loader2, Star, Shield, MapPin, GraduationCap, Building, Calendar, FileText, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DoctorRequest {
  id: string;
  user_id: string;
  specialty: string;
  license: string;
  cedula_profesional: string | null;
  numero_consejo: string | null;
  bio: string | null;
  location: string | null;
  status: 'pending' | 'approved' | 'rejected';
  badge_override: string | null;
  created_at: string;
  cedula_verification_id: string | null;
  consultation_fee: number;
  profile?: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
  cedula_verification?: {
    nombre: string | null;
    paterno: string | null;
    materno: string | null;
    titulo: string | null;
    institucion: string | null;
    anio_registro: number | null;
    is_verified: boolean | null;
    is_claimed: boolean | null;
    verified_at: string | null;
  } | null;
  document_signatures_count?: number;
}

export default function AdminDoctors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<DoctorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionDialog, setActionDialog] = useState<{ open: boolean; doctor: DoctorRequest | null; action: 'approve' | 'reject' }>({
    open: false,
    doctor: null,
    action: 'approve',
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast({ 
        title: t('admin.accessDenied'), 
        description: t('admin.onlyAdmins'), 
        variant: 'destructive' 
      });
      navigate('/');
      return;
    }
    fetchDoctors();
  }, [user, navigate]);

  const fetchDoctors = async () => {
    try {
      const { data: doctorProfiles, error } = await supabase
        .from('doctor_profiles')
        .select('*, cedula_verifications:cedula_verification_id(nombre, paterno, materno, titulo, institucion, anio_registro, is_verified, is_claimed, verified_at)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const doctorsWithProfiles = await Promise.all(
        (doctorProfiles || []).map(async (doc: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, avatar_url')
            .eq('id', doc.user_id)
            .single();

          // Count document signatures
          const { count } = await supabase
            .from('document_signatures')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', doc.user_id);

          return {
            ...doc,
            profile,
            cedula_verification: doc.cedula_verifications || null,
            document_signatures_count: count || 0,
          } as DoctorRequest;
        })
      );

      setDoctors(doctorsWithProfiles);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({ title: t('common.error'), description: t('admin.errorLoadingDoctors'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.doctor) return;

    try {
      const newStatus = actionDialog.action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ status: newStatus })
        .eq('id', actionDialog.doctor.id);

      if (error) throw error;

      // Send approval email and in-app notification
      if (newStatus === 'approved' && actionDialog.doctor.profile?.email) {
        // Send approval email
        try {
          await supabase.functions.invoke('send-approval-email', {
            body: {
              email: actionDialog.doctor.profile.email,
              name: actionDialog.doctor.profile.name || 'Doctor',
              role: 'doctor',
            },
          });
        } catch (emailErr) {
          console.error('Approval email error:', emailErr);
        }

        // Insert in-app notification
        await supabase.from('notifications').insert({
          user_id: actionDialog.doctor.user_id,
          type: 'system' as any,
          title: '¡Tu cuenta ha sido aprobada!',
          message: 'Tu perfil de médico ha sido verificado y aprobado. Ya puedes acceder a todas las funciones de la plataforma.',
          data: { action_url: '/doctor' },
        });
      }

      toast({
        title: actionDialog.action === 'approve' ? t('admin.doctorApproved') : t('admin.doctorRejected'),
        description: `${actionDialog.doctor.profile?.name} ${newStatus === 'approved' ? t('admin.hasBeenApproved') : t('admin.hasBeenRejected')}`,
      });

      fetchDoctors();
    } catch (error) {
      console.error('Error updating doctor:', error);
      toast({ title: t('common.error'), description: t('admin.errorUpdatingStatus'), variant: 'destructive' });
    } finally {
      setActionDialog({ open: false, doctor: null, action: 'approve' });
    }
  };

  const [togglingNewsId, setTogglingNewsId] = useState<string | null>(null);
  const [updatingBadgeId, setUpdatingBadgeId] = useState<string | null>(null);
  const [verifyingCedulaId, setVerifyingCedulaId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, any>>({});

  const handleVerifyCedula = async (doctor: DoctorRequest) => {
    if (!doctor.license && !doctor.cedula_profesional) {
      toast({ title: 'Sin cédula', description: 'Este doctor no tiene número de cédula registrado', variant: 'destructive' });
      return;
    }
    setVerifyingCedulaId(doctor.id);
    try {
      const cedulaNumber = doctor.cedula_profesional || doctor.license;
      const { data, error } = await supabase.functions.invoke('verify-cedula-sep', {
        body: { cedula: cedulaNumber, userId: doctor.user_id },
      });
      if (error) throw error;
      setVerificationResults(prev => ({ ...prev, [doctor.id]: data }));
      if (data?.verified) {
        toast({ title: '✅ Cédula verificada', description: `${data.nombre} - ${data.titulo}` });
        fetchDoctors(); // Refresh to show updated verification status
      } else {
        toast({ title: '⚠️ No verificada', description: data?.message || 'No se encontraron resultados en la SEP', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error verifying cedula:', error);
      toast({ title: 'Error', description: 'No se pudo verificar la cédula. Intente manualmente.', variant: 'destructive' });
      setVerificationResults(prev => ({ ...prev, [doctor.id]: { error: true } }));
    } finally {
      setVerifyingCedulaId(null);
    }
  };

  const toggleNewsPermission = async (doctor: DoctorRequest) => {
    setTogglingNewsId(doctor.id);
    try {
      const newValue = !(doctor as any).can_publish_news;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ can_publish_news: newValue } as any)
        .eq('id', doctor.id);

      if (error) throw error;

      if (newValue) {
        await supabase.from('notifications').insert({
          user_id: doctor.user_id,
          type: 'system' as any,
          title: 'Permiso de publicación otorgado',
          message: 'Se te ha otorgado permiso para crear y publicar artículos en el blog médico. ¡Ve a la sección de noticias para empezar!',
          data: { action_url: '/news' },
        });
      }

      toast({
        title: newValue ? 'Permiso otorgado' : 'Permiso revocado',
        description: `${doctor.profile?.name} ${newValue ? 'ahora puede publicar noticias' : 'ya no puede publicar noticias'}`,
      });
      fetchDoctors();
    } catch (error) {
      console.error('Error toggling news permission:', error);
      toast({ title: t('common.error'), description: 'Error al cambiar permiso', variant: 'destructive' });
    } finally {
      setTogglingNewsId(null);
    }
  };

  const updateBadge = async (doctor: DoctorRequest, badgeValue: string) => {
    setUpdatingBadgeId(doctor.id);
    try {
      const newValue = badgeValue === 'auto' ? null : badgeValue;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ badge_override: newValue } as any)
        .eq('id', doctor.id);

      if (error) throw error;

      toast({
        title: 'Badge actualizado',
        description: `${doctor.profile?.name}: ${badgeValue === 'pro' ? 'Doctor Pro ⭐' : badgeValue === 'new' ? 'Doctor Nuevo 🔵' : 'Automático'}`,
      });
      fetchDoctors();
    } catch (error) {
      console.error('Error updating badge:', error);
      toast({ title: t('common.error'), description: 'Error al cambiar badge', variant: 'destructive' });
    } finally {
      setUpdatingBadgeId(null);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch =
      doc.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> {t('admin.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> {t('admin.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> {t('admin.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = doctors.filter((d) => d.status === 'pending').length;

  if (user?.role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              {t('admin.doctorManagement')}
            </h1>
            <p className="text-muted-foreground">
              {pendingCount} {t('admin.pendingRequests')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchByNameEmailSpecialty')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? t('admin.all') : t(`admin.${status}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Doctors List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('admin.noDoctorsFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDoctors.map((doctor) => (
              <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={doctor.profile?.avatar_url || ''} />
                        <AvatarFallback>{doctor.profile?.name?.[0] || 'D'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{doctor.profile?.name || t('admin.noName')}</h3>
                          {getStatusBadge(doctor.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{doctor.profile?.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary">{doctor.specialty}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {t('admin.license')}: {doctor.license || t('admin.notSpecified')}
                          </span>
                          {doctor.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {doctor.location}
                            </span>
                          )}
                        </div>

                        {/* SEP Verification Details */}
                        {doctor.cedula_verification && doctor.cedula_verification.is_verified && (
                          <div className="mt-2 p-2 rounded-md bg-success/10 border border-success/20">
                            <div className="flex items-center gap-1 mb-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-success" />
                              <span className="text-xs font-semibold text-success">Verificado por SEP</span>
                              {doctor.cedula_verification.verified_at && (
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {new Date(doctor.cedula_verification.verified_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {doctor.cedula_verification.nombre} {doctor.cedula_verification.paterno} {doctor.cedula_verification.materno}
                              </span>
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" />
                                {doctor.cedula_verification.titulo}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {doctor.cedula_verification.institucion}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Año: {doctor.cedula_verification.anio_registro}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Document Signatures Status */}
                        <div className="flex items-center gap-1 mt-1">
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Firmas: {doctor.document_signatures_count || 0} documento(s)
                          </span>
                          {(doctor.document_signatures_count || 0) >= 2 && (
                            <Badge variant="success" className="text-[10px] ml-1 px-1.5 py-0">✓</Badge>
                          )}
                        </div>

                        {doctor.cedula_profesional && (
                          <p className="text-xs text-muted-foreground">
                            {t('admin.cedula')}: {doctor.cedula_profesional}
                          </p>
                        )}

                        {/* Admin SEP Verification Button */}
                        {!doctor.cedula_verification?.is_verified && (doctor.license || doctor.cedula_profesional) && (
                          <div className="mt-2 space-y-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => handleVerifyCedula(doctor)}
                              disabled={verifyingCedulaId === doctor.id}
                            >
                              {verifyingCedulaId === doctor.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3" />
                              )}
                              Verificar Cédula SEP
                            </Button>
                            <a
                              href="https://cedulaprofesional.sep.gob.mx"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Verificar manualmente en SEP
                            </a>
                            {verificationResults[doctor.id] && !verificationResults[doctor.id].verified && !verificationResults[doctor.id].error && (
                              <div className="p-2 rounded-md bg-warning/10 border border-warning/20">
                                <div className="flex items-center gap-1 text-xs text-warning">
                                  <AlertTriangle className="w-3 h-3" />
                                  {verificationResults[doctor.id].message || 'No se encontró en la base de datos de la SEP'}
                                </div>
                              </div>
                            )}
                            {verificationResults[doctor.id]?.error && (
                              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                <p className="text-xs text-destructive">Servicio SEP no disponible. Verifique manualmente.</p>
                              </div>
                            )}
                          </div>
                        )}
                        {doctor.bio && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{doctor.bio}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t('admin.registered')}: {new Date(doctor.created_at).toLocaleDateString()}
                        </p>
                        {doctor.status === 'approved' && (
                          <>
                            <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50">
                              <Star className="w-4 h-4 text-premium" />
                              <Label className="text-xs flex-1">Badge</Label>
                              {updatingBadgeId === doctor.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Select
                                  value={doctor.badge_override || 'auto'}
                                  onValueChange={(v) => updateBadge(doctor, v)}
                                >
                                  <SelectTrigger className="w-32 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="auto">Automático</SelectItem>
                                    <SelectItem value="pro">⭐ Doctor Pro</SelectItem>
                                    <SelectItem value="new">🔵 Nuevo</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50">
                              <Newspaper className="w-4 h-4 text-primary" />
                              <Label htmlFor={`news-${doctor.id}`} className="text-xs cursor-pointer flex-1">
                                Puede publicar noticias
                              </Label>
                              {togglingNewsId === doctor.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Switch
                                  id={`news-${doctor.id}`}
                                  checked={(doctor as any).can_publish_news || false}
                                  onCheckedChange={() => toggleNewsPermission(doctor)}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {doctor.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setActionDialog({ open: true, doctor, action: 'approve' })}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t('admin.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setActionDialog({ open: true, doctor, action: 'reject' })}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t('admin.reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionDialog.action === 'approve' ? t('admin.approveDoctor2') : t('admin.rejectDoctor2')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionDialog.action === 'approve'
                  ? `${actionDialog.doctor?.profile?.name} ${t('admin.doctorApproveMessage')}`
                  : `${actionDialog.doctor?.profile?.name} ${t('admin.doctorRejectMessage')}`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {actionDialog.action === 'approve' ? t('admin.approve') : t('admin.reject')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}