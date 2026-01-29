import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Stethoscope, Star, Award, MessageSquare, Video, MapPin, Users, Radio, Loader2 } from 'lucide-react';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { toast } from 'sonner';
interface DoctorData {
  id: string;
  visibleId: string;
  name: string;
  specialty: string;
  bio?: string;
  rating: number;
  totalConsultations: number;
  consultationFee: number;
  location?: string;
  followersCount: number;
  avatarUrl?: string;
}

interface LiveData {
  id: string;
  title: string;
  viewerCount: number;
}

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { createSession } = useChat();
  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [activeLive, setActiveLive] = useState<LiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;

      // Use the secure RPC function to get doctor's public profile
      const { data: doctorData, error } = await supabase.rpc(
        'get_doctor_public_profile',
        { p_user_id: id }
      );

      if (error) {
        console.error('Error fetching doctor profile:', error);
        setIsLoading(false);
        return;
      }

      // The RPC returns an array, get first result
      const doctorProfile = Array.isArray(doctorData) ? doctorData[0] : doctorData;

      if (doctorProfile) {
        setDoctor({
          id: doctorProfile.user_id,
          visibleId: doctorProfile.profile_id,
          name: doctorProfile.name || 'Doctor',
          specialty: doctorProfile.specialty,
          bio: doctorProfile.bio || undefined,
          rating: Number(doctorProfile.rating),
          totalConsultations: doctorProfile.total_consultations,
          consultationFee: Number(doctorProfile.consultation_fee),
          location: doctorProfile.location || undefined,
          followersCount: doctorProfile.followers_count,
          avatarUrl: doctorProfile.avatar_url || undefined,
        });

        // Check if doctor has an active live
        const { data: liveData } = await supabase
          .from('lives')
          .select('id, title, viewer_count')
          .eq('doctor_id', doctorProfile.user_id)
          .eq('status', 'live')
          .maybeSingle();

        if (liveData) {
          setActiveLive({
            id: liveData.id,
            title: liveData.title,
            viewerCount: liveData.viewer_count,
          });
        }
      }
      setIsLoading(false);
    };

    fetchDoctor();

    // Subscribe to live status changes
    const channel = supabase
      .channel('doctor-live-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lives' },
        (payload) => {
          if (payload.new && (payload.new as any).doctor_id === doctor?.id) {
            const live = payload.new as any;
            if (live.status === 'live') {
              setActiveLive({
                id: live.id,
                title: live.title,
                viewerCount: live.viewer_count,
              });
            } else {
              setActiveLive(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Handle starting a consultation with this doctor
  const handleStartConsultation = async () => {
    if (!user?.id || !doctor) {
      navigate('/login');
      return;
    }

    if (role !== 'patient') {
      toast.error('Solo los pacientes pueden iniciar consultas');
      return;
    }

    setIsStartingChat(true);
    try {
      const result = await createSession(doctor.id, 'doctor', false);
      
      if (result.success && result.session) {
        navigate('/chat');
        toast.success(`Chat iniciado con ${doctor.name}`);
      } else {
        toast.error(result.error || 'Error al iniciar consulta');
      }
    } catch (error) {
      toast.error('Error al iniciar consulta');
    } finally {
      setIsStartingChat(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-3xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!doctor) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-3xl text-center">
          <h1 className="text-2xl font-bold mb-4">Doctor no encontrado</h1>
          <Button onClick={() => navigate('/lives')}>Volver a Lives</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        {/* Live Indicator Banner */}
        {activeLive && (
          <Card 
            className="mb-4 border-destructive/50 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
            onClick={() => navigate(`/live/${activeLive.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive"></span>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="gap-1">
                        <Radio className="w-3 h-3" />
                        EN VIVO
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activeLive.viewerCount} viendo
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1">{activeLive.title}</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" className="gap-1">
                  <Video className="w-4 h-4" />
                  Ver Ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar with live indicator */}
              <div className="relative flex-shrink-0">
                {doctor.avatarUrl ? (
                  <img
                    src={doctor.avatarUrl}
                    alt={doctor.name}
                    className={`w-24 h-24 rounded-full object-cover ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ${activeLive ? 'ring-4 ring-destructive ring-offset-2' : ''}`}>
                    <Stethoscope className="w-12 h-12 text-primary" />
                  </div>
                )}
                {activeLive && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    LIVE
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-foreground">{doctor.name}</h1>
                    <p className="text-muted-foreground">{doctor.specialty}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="verified" className="gap-1">
                        <Award className="w-3 h-3" />
                        Verificado
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="w-3 h-3" />
                        {doctor.followersCount} seguidores
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-premium/10 px-3 py-1 rounded-full">
                    <Star className="w-4 h-4 fill-premium text-premium" />
                    <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                {doctor.bio && (
                  <p className="text-muted-foreground mb-4">{doctor.bio}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-foreground">{doctor.totalConsultations}</p>
                    <p className="text-xs text-muted-foreground">Consultas</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-premium">${doctor.consultationFee}</p>
                    <p className="text-xs text-muted-foreground">Consulta</p>
                  </div>
                  {doctor.location && (
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{doctor.location}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <SubscribeButton doctorId={doctor.id} doctorName={doctor.name} />
                  <Button 
                    className="gap-2" 
                    onClick={handleStartConsultation}
                    disabled={isStartingChat}
                  >
                    {isStartingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    {isStartingChat ? 'Iniciando...' : 'Iniciar Consulta'}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => navigate('/lives')}>
                    <Video className="w-4 h-4" />
                    Ver Lives
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
