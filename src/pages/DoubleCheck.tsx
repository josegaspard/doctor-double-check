import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DoubleCheckFlow } from '@/components/doublecheck/DoubleCheckFlow';
import {
  CheckCheck,
  Star,
  Users,
  MessageSquare,
  Loader2,
  Award,
  Stethoscope,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

interface DoubleCheckDoctor {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  specialty: string;
  rating: number;
  totalConsultations: number;
  consultationFee: number;
  followersCount: number;
}

export default function DoubleCheck() {
  const navigate = useNavigate();
  const { user, role, refreshUser } = useAuth();
  const [doctors, setDoctors] = useState<DoubleCheckDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoubleCheckDoctor | null>(null);
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  const isDoctor = role === 'doctor';
  const isPatient = role === 'patient';
  const isAvailableForDoubleCheck = user?.doctorProfile?.availableForDoubleCheck || false;

  const fetchDoubleCheckDoctors = async () => {
    try {
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles')
        .select('*, profiles!doctor_profiles_user_id_fkey (name, avatar_url)')
        .eq('available_for_double_check', true)
        .eq('status', 'approved')
        .order('rating', { ascending: false });

      if (doctorProfiles) {
        setDoctors(doctorProfiles.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          name: d.profiles?.name || 'Doctor',
          avatarUrl: d.profiles?.avatar_url || undefined,
          specialty: d.specialty,
          rating: Number(d.rating),
          totalConsultations: d.total_consultations,
          consultationFee: Number(d.consultation_fee),
          followersCount: d.followers_count,
        })));
      }
    } catch (error) {
      // Fallback without join
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('available_for_double_check', true)
        .eq('status', 'approved')
        .order('rating', { ascending: false });

      if (doctorProfiles) {
        const userIds = doctorProfiles.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setDoctors(doctorProfiles.map(d => ({
          id: d.id,
          userId: d.user_id,
          name: profileMap.get(d.user_id)?.name || 'Doctor',
          avatarUrl: profileMap.get(d.user_id)?.avatar_url || undefined,
          specialty: d.specialty,
          rating: Number(d.rating),
          totalConsultations: d.total_consultations,
          consultationFee: Number(d.consultation_fee),
          followersCount: d.followers_count,
        })));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoubleCheckDoctors();
  }, []);

  const handleToggleAvailability = async () => {
    if (!user?.id || !isDoctor) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ available_for_double_check: !isAvailableForDoubleCheck })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(
        !isAvailableForDoubleCheck 
          ? 'Ahora estás disponible para Double Check' 
          : 'Ya no estás disponible para Double Check'
      );
      await refreshUser();
      await fetchDoubleCheckDoctors();
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar disponibilidad');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartDoubleCheck = (doctor: DoubleCheckDoctor) => {
    setSelectedDoctor(doctor);
    setIsFlowOpen(true);
  };

  const handleFlowClose = () => {
    setIsFlowOpen(false);
    setSelectedDoctor(null);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center flex-shrink-0">
            <CheckCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              Double Check
              <Badge variant="verified" className="gap-1">
                <CheckCheck className="w-3 h-3" />
                Verificado
              </Badge>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Segunda opinión médica por especialistas verificados
            </p>
          </div>
        </div>

        {/* Doctor Toggle */}
        {isDoctor && user?.doctorProfile?.status === 'approved' && (
          <Card className="mb-6 bg-gradient-to-r from-primary/5 to-info/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Disponibilidad Double Check
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isAvailableForDoubleCheck 
                        ? 'Estás recibiendo solicitudes de segunda opinión' 
                        : 'Activa para recibir solicitudes de segunda opinión'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isAvailableForDoubleCheck}
                  onCheckedChange={handleToggleAvailability}
                  disabled={isUpdating}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mb-6 bg-info/5 border-info/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2">¿Qué es Double Check?</h3>
            <p className="text-sm text-muted-foreground">
              Double Check te permite obtener una segunda opinión médica de especialistas 
              verificados. Comparte tus estudios desde tu Vault de forma segura y recibe 
              una evaluación profesional adicional para tomar decisiones informadas sobre 
              tu salud.
            </p>
          </CardContent>
        </Card>

        {/* Available Doctors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              Especialistas Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : doctors.length > 0 ? (
              <div className="space-y-4">
                {doctors.map((doctor) => (
                  <div 
                    key={doctor.id} 
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {doctor.avatarUrl ? (
                          <img 
                            src={doctor.avatarUrl} 
                            alt={doctor.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <Stethoscope className="w-7 h-7 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              {doctor.name}
                              <Badge variant="verified" className="gap-1 text-xs">
                                <CheckCheck className="w-3 h-3" />
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                          </div>
                          {isPatient && (
                            <Button 
                              size="sm" 
                              onClick={() => handleStartDoubleCheck(doctor)}
                              className="gap-1"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Consultar
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-premium text-premium" />
                            {doctor.rating.toFixed(1)} rating
                          </span>
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {doctor.totalConsultations} consultas
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {doctor.followersCount} seguidores
                          </span>
                          <span className="flex items-center gap-1 text-success">
                            <DollarSign className="w-3 h-3" />
                            ${doctor.consultationFee} MXN
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No hay especialistas disponibles en este momento
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">¿Cómo funciona?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="font-bold text-primary">1</span>
                </div>
                <h4 className="font-semibold text-sm mb-1">Elige un especialista</h4>
                <p className="text-xs text-muted-foreground">
                  Selecciona un médico verificado de la especialidad que necesitas
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="font-bold text-primary">2</span>
                </div>
                <h4 className="font-semibold text-sm mb-1">Comparte tus estudios</h4>
                <p className="text-xs text-muted-foreground">
                  Desde tu Vault, comparte los estudios relevantes de forma segura
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="font-bold text-primary">3</span>
                </div>
                <h4 className="font-semibold text-sm mb-1">Recibe tu segunda opinión</h4>
                <p className="text-xs text-muted-foreground">
                  El especialista revisará tu caso y te dará su opinión profesional
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Double Check Flow Dialog */}
      {selectedDoctor && (
        <DoubleCheckFlow
          doctor={{
            userId: selectedDoctor.userId,
            name: selectedDoctor.name,
            specialty: selectedDoctor.specialty,
            consultationFee: selectedDoctor.consultationFee,
          }}
          isOpen={isFlowOpen}
          onClose={handleFlowClose}
        />
      )}
    </MainLayout>
  );
}
