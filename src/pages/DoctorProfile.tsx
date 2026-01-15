import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Stethoscope, Star, Award, MessageSquare, Video, MapPin, Users } from 'lucide-react';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { supabase } from '@/integrations/supabase/client';

interface DoctorData {
  id: string;
  userId: string;
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

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!id) return;

      // Try to fetch by user_id first, then by profile id
      const { data: doctorProfile } = await supabase
        .from('doctor_profiles')
        .select('*')
        .or(`user_id.eq.${id},id.eq.${id}`)
        .single();

      if (doctorProfile) {
        // Fetch user profile for name and avatar
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .eq('id', doctorProfile.user_id)
          .single();

        setDoctor({
          id: doctorProfile.id,
          userId: doctorProfile.user_id,
          name: profile?.name || 'Doctor',
          specialty: doctorProfile.specialty,
          bio: doctorProfile.bio || undefined,
          rating: Number(doctorProfile.rating),
          totalConsultations: doctorProfile.total_consultations,
          consultationFee: Number(doctorProfile.consultation_fee),
          location: doctorProfile.location || undefined,
          followersCount: doctorProfile.followers_count,
          avatarUrl: profile?.avatar_url || undefined,
        });
      }
      setIsLoading(false);
    };

    fetchDoctor();
  }, [id]);

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

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {doctor.avatarUrl ? (
                <img
                  src={doctor.avatarUrl}
                  alt={doctor.name}
                  className="w-24 h-24 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-12 h-12 text-primary" />
                </div>
              )}
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
                  <SubscribeButton doctorId={doctor.userId} doctorName={doctor.name} />
                  <Button className="gap-2" onClick={() => navigate('/chat')}>
                    <MessageSquare className="w-4 h-4" />
                    Iniciar Consulta
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
