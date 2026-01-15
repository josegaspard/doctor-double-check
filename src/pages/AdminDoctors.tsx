import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, XCircle, Clock, User, Stethoscope, ArrowLeft } from 'lucide-react';
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
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profile?: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export default function AdminDoctors() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
      toast({ title: 'Acceso denegado', description: 'Solo administradores pueden acceder', variant: 'destructive' });
      navigate('/');
      return;
    }
    fetchDoctors();
  }, [user, navigate]);

  const fetchDoctors = async () => {
    try {
      const { data: doctorProfiles, error } = await supabase
        .from('doctor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for each doctor
      const doctorsWithProfiles = await Promise.all(
        (doctorProfiles || []).map(async (doc) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, avatar_url')
            .eq('id', doc.user_id)
            .single();
          return { ...doc, profile } as DoctorRequest;
        })
      );

      setDoctors(doctorsWithProfiles);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los doctores', variant: 'destructive' });
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

      toast({
        title: actionDialog.action === 'approve' ? 'Doctor aprobado' : 'Doctor rechazado',
        description: `${actionDialog.doctor.profile?.name} ha sido ${newStatus === 'approved' ? 'aprobado' : 'rechazado'}`,
      });

      fetchDoctors();
    } catch (error) {
      console.error('Error updating doctor:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
    } finally {
      setActionDialog({ open: false, doctor: null, action: 'approve' });
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
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Aprobado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = doctors.filter((d) => d.status === 'pending').length;

  if (user?.role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              Gestión de Doctores
            </h1>
            <p className="text-muted-foreground">
              {pendingCount} solicitudes pendientes de revisión
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
                  placeholder="Buscar por nombre, especialidad o email..."
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
                    {status === 'all' ? 'Todos' : status === 'pending' ? 'Pendientes' : status === 'approved' ? 'Aprobados' : 'Rechazados'}
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
              <p className="text-muted-foreground">No se encontraron doctores</p>
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
                          <h3 className="font-semibold">{doctor.profile?.name || 'Sin nombre'}</h3>
                          {getStatusBadge(doctor.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{doctor.profile?.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary">{doctor.specialty}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Licencia: {doctor.license || 'No especificada'}
                          </span>
                        </div>
                        {doctor.cedula_profesional && (
                          <p className="text-xs text-muted-foreground">
                            Cédula: {doctor.cedula_profesional}
                          </p>
                        )}
                        {doctor.bio && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{doctor.bio}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Registrado: {new Date(doctor.created_at).toLocaleDateString()}
                        </p>
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
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setActionDialog({ open: true, doctor, action: 'reject' })}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
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
                {actionDialog.action === 'approve' ? '¿Aprobar doctor?' : '¿Rechazar doctor?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionDialog.action === 'approve'
                  ? `${actionDialog.doctor?.profile?.name} podrá ejercer como doctor verificado en la plataforma.`
                  : `${actionDialog.doctor?.profile?.name} no podrá ejercer como doctor en la plataforma.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {actionDialog.action === 'approve' ? 'Aprobar' : 'Rechazar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
