import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Stethoscope, Star, Award, MessageSquare, Video, Clock, MapPin } from 'lucide-react';

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock doctor data
  const doctor = {
    id: id || 'doctor-001',
    name: 'Dr. Carlos Mendoza',
    specialty: 'Cardiología',
    bio: 'Cardiólogo con más de 15 años de experiencia. Especialista en arritmias y enfermedades cardiovasculares. Egresado del Instituto Nacional de Cardiología.',
    rating: 4.8,
    totalConsultations: 342,
    consultationFee: 500,
    location: 'Ciudad de México',
    experience: '15 años',
  };

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
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-12 h-12 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-foreground">{doctor.name}</h1>
                    <p className="text-muted-foreground">{doctor.specialty}</p>
                    <Badge variant="verified" className="mt-2 gap-1">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 bg-premium/10 px-3 py-1 rounded-full">
                    <Star className="w-4 h-4 fill-premium text-premium" />
                    <span className="font-semibold">{doctor.rating}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <p className="text-muted-foreground mb-4">{doctor.bio}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-foreground">{doctor.totalConsultations}</p>
                    <p className="text-xs text-muted-foreground">Consultas</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-foreground">{doctor.experience}</p>
                    <p className="text-xs text-muted-foreground">Experiencia</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xl font-bold text-premium">${doctor.consultationFee}</p>
                    <p className="text-xs text-muted-foreground">Consulta</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{doctor.location}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
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
