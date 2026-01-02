import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  PlayCircle,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ArrowLeft,
  Clock,
  Stethoscope,
  Star,
  Award,
  Lock,
} from 'lucide-react';
import { Patient, Resident } from '@/types';

export default function RecordingPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecording } = useLives();
  const { user, role } = useAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  
  const recording = getRecording(id || '');

  // Check access
  const hasAccess = (): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    
    const entitlements = (user as Patient | Resident)?.entitlements;
    return entitlements?.recordings?.includes(id || '') || false;
  };

  if (!recording) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <PlayCircle className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Grabación no encontrada</h2>
          <Button onClick={() => navigate('/recordings')}>Volver a Grabaciones</Button>
        </div>
      </MainLayout>
    );
  }

  if (!hasAccess()) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Lock className="w-16 h-16 mx-auto text-premium/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground mb-4">No tienes acceso a esta grabación</p>
          <Button onClick={() => navigate('/recordings')}>Ver Catálogo</Button>
        </div>
      </MainLayout>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = recording.duration * 60;

  // Watermark
  const Watermark = () => {
    if (!user) return null;
    
    return (
      <>
        <div className="watermark top-4 left-4">
          {user.email} • {new Date().toISOString().slice(0, 10)}
        </div>
        <div className="watermark bottom-20 right-4">
          ID: {user.id}
        </div>
        <div className="watermark top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg opacity-5">
          {user.email}
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
          onClick={() => navigate('/recordings')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Grabaciones
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Player Container */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden no-context-menu">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-premium/10 to-primary/20">
                <div className="text-center">
                  <div 
                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center cursor-pointer transition-colors"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause className="w-10 h-10 text-white" />
                    ) : (
                      <PlayCircle className="w-10 h-10 text-white" />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Watermarks */}
              <Watermark />
              
              {/* Premium Badge */}
              <div className="absolute top-4 left-4">
                <Badge variant="premium" className="gap-1">
                  <Award className="w-3 h-3" />
                  Premium
                </Badge>
              </div>
              
              {/* Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {/* Progress Bar */}
                <div className="mb-3">
                  <Slider
                    value={[currentTime]}
                    max={totalSeconds}
                    step={1}
                    onValueChange={(v) => setCurrentTime(v[0])}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-white/70 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(totalSeconds)}</span>
                  </div>
                </div>
                
                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <PlayCircle className="w-5 h-5" />
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>
                      <div className="w-24 hidden sm:block">
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          max={100}
                          step={1}
                          onValueChange={(v) => {
                            setVolume(v[0]);
                            if (v[0] > 0) setIsMuted(false);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                  >
                    <Maximize className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Video Info */}
            <div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground mb-3">
                {recording.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="outline" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {recording.duration} min
                </Badge>
                {recording.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <p className="text-muted-foreground">{recording.description}</p>
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
                    <h3 className="font-semibold text-foreground">{recording.doctorName}</h3>
                    <p className="text-sm text-muted-foreground">{recording.specialty}</p>
                    <Badge variant="verified" className="mt-2 gap-1">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <Button className="w-full" onClick={() => navigate(`/doctor/${recording.doctorId}`)}>
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Access Info */}
            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">Acceso Ilimitado</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Puedes ver esta grabación las veces que quieras desde cualquier dispositivo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DRM Notice */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Este contenido está protegido. No se permite la descarga ni distribución sin autorización.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
