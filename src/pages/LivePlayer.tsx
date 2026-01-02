import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Video,
  Users,
  Clock,
  ArrowLeft,
  MessageSquare,
  Share2,
  Heart,
  Stethoscope,
  Star,
  Award,
} from 'lucide-react';

export default function LivePlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getLive } = useLives();
  const { user, role } = useAuth();
  
  const [isLiked, setIsLiked] = useState(false);
  
  const live = getLive(id || '');

  if (!live) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Transmisión no encontrada</h2>
          <Button onClick={() => navigate('/lives')}>Volver a Lives</Button>
        </div>
      </MainLayout>
    );
  }

  const formatDuration = (startedAt: Date) => {
    const diff = Date.now() - startedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Watermark for authenticated users
  const Watermark = () => {
    if (!user || role === 'visitor') return null;
    
    return (
      <>
        <div className="watermark top-4 left-4">
          {user.email} • {new Date().toISOString().slice(0, 10)}
        </div>
        <div className="watermark bottom-4 right-4">
          ID: {user.id}
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/lives')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Lives
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Player Container */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden no-context-menu">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white/80 text-sm">Transmisión en vivo</p>
                </div>
              </div>
              
              {/* Watermarks */}
              <Watermark />
              
              {/* Live indicator */}
              <div className="absolute top-4 left-4">
                <Badge variant="live" className="gap-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  EN VIVO
                </Badge>
              </div>
              
              {/* Viewers */}
              <div className="absolute top-4 right-4">
                <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
                  <Users className="w-3 h-3" />
                  {live.viewerCount} viendo
                </Badge>
              </div>
              
              {/* Duration */}
              <div className="absolute bottom-4 left-4">
                <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
                  <Clock className="w-3 h-3" />
                  {formatDuration(live.startedAt)}
                </Badge>
              </div>
            </div>

            {/* Video Info */}
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground mb-3">
                {live.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3">
                {live.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLiked(!isLiked)}
                  className="gap-2"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  Me gusta
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Compartir
                </Button>
                {role !== 'visitor' && (
                  <Button variant="outline" size="sm" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </Button>
                )}
              </div>
              
              <Separator className="my-4" />
              
              {/* Description */}
              <p className="text-muted-foreground">{live.description}</p>
            </div>
          </div>

          {/* Sidebar - Doctor Info */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{live.doctorName}</h3>
                    <p className="text-sm text-muted-foreground">{live.specialty}</p>
                    <Badge variant="verified" className="mt-2 gap-1">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">4.8</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 fill-premium text-premium" />
                      Rating
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">342</p>
                    <p className="text-xs text-muted-foreground">Consultas</p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <Button className="w-full" onClick={() => navigate(`/doctor/${live.doctorId}`)}>
                  Ver Perfil
                </Button>
                
                {(role === 'patient') && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => navigate('/chat')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Iniciar Chat
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recording Notice */}
            <Card className="bg-premium/5 border-premium/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-premium/10 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-premium" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">Grabación Premium</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuando termine este live, la grabación estará disponible para usuarios premium.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visitor Notice */}
            {role === 'visitor' && (
              <Card className="bg-info/5 border-info/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Regístrate para guardar este contenido y más
                  </p>
                  <Button size="sm" onClick={() => navigate('/login')}>
                    Crear Cuenta
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
