import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RecordingVideoPlayer } from '@/components/recordings/RecordingVideoPlayer';
import { RecordingChatReplay } from '@/components/recordings/RecordingChatReplay';
import {
  PlayCircle,
  ArrowLeft,
  Clock,
  Stethoscope,
  Award,
  Lock,
  Loader2,
} from 'lucide-react';

interface Recording {
  id: string;
  title: string;
  description?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  duration: number;
  price: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  liveId?: string;
  createdAt: Date;
  tags: string[];
}

export default function RecordingPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, supabaseUser } = useAuth();
  
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  // Fetch recording directly from database
  useEffect(() => {
    const fetchRecording = async () => {
      if (!id) {
        setIsLoadingRecording(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('recordings')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          console.error('Error fetching recording:', error);
          setIsLoadingRecording(false);
          return;
        }

        // Get doctor name
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('name')
          .eq('id', data.doctor_id)
          .single();

        setRecording({
          id: data.id,
          title: data.title,
          description: data.description || undefined,
          doctorId: data.doctor_id,
          doctorName: profile?.name || 'Doctor',
          specialty: data.specialty,
          duration: data.duration,
          price: Number(data.price),
          thumbnailUrl: data.thumbnail_url || undefined,
          videoUrl: data.video_url || undefined,
          liveId: data.live_id || undefined,
          createdAt: new Date(data.created_at),
          tags: data.tags || [],
        });
      } catch (error) {
        console.error('Error fetching recording:', error);
      } finally {
        setIsLoadingRecording(false);
      }
    };

    fetchRecording();
  }, [id]);

  // Check if user has purchased this recording
  const checkPurchase = useCallback(async () => {
    if (!supabaseUser?.id || !id) {
      setIsCheckingAccess(false);
      return;
    }

    // Admins and doctors have automatic access
    if (role === 'admin' || role === 'doctor') {
      setHasPurchased(true);
      setIsCheckingAccess(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', supabaseUser.id)
        .eq('recording_id', id)
        .maybeSingle();

      if (error) {
        console.error('Error checking purchase:', error);
      }
      
      setHasPurchased(!!data);
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setIsCheckingAccess(false);
    }
  }, [supabaseUser?.id, id, role]);

  useEffect(() => {
    checkPurchase();
  }, [checkPurchase]);

  // Check access - uses real purchase verification
  const hasAccess = (): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    // Check if recording is free
    if (recording && recording.price === 0) return true;
    return hasPurchased;
  };

  // Handle duration update from player
  const handleDurationUpdate = (newDuration: number) => {
    if (recording && recording.duration !== newDuration) {
      setRecording(prev => prev ? { ...prev, duration: newDuration } : null);
    }
  };

  if (isLoadingRecording || isCheckingAccess) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {isLoadingRecording ? 'Cargando grabación...' : 'Verificando acceso...'}
          </h2>
        </div>
      </MainLayout>
    );
  }

  if (!recording) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <PlayCircle className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Grabación no encontrada</h2>
          <p className="text-muted-foreground mb-4">Es posible que la grabación no exista o no tengas acceso.</p>
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
          <p className="text-muted-foreground mb-4">No has comprado esta grabación</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('/recordings')}>Ver Catálogo</Button>
            <Button variant="outline" onClick={() => navigate('/wallet')}>Recargar Wallet</Button>
          </div>
        </div>
      </MainLayout>
    );
  }


  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/recordings')} className="hidden sm:inline-flex mb-3 sm:mb-4 h-8 text-xs sm:text-sm">
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Volver a Grabaciones
        </Button>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <div className="relative no-context-menu">
              {recording.videoUrl ? (
                <RecordingVideoPlayer
                  videoUrl={recording.videoUrl}
                  recordingId={recording.id}
                  onDurationUpdate={handleDurationUpdate}
                  onTimeUpdate={setVideoCurrentTime}
                />
              ) : (
                <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
                  <div className="text-center p-6">
                    <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Video no disponible</h3>
                    <p className="text-sm text-muted-foreground">
                      La grabación aún no está disponible.
                    </p>
                  </div>
                </div>
              )}
              <Watermark />
            </div>

            <div>
              <h1 className="font-heading text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2 sm:mb-3">
                {recording.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  {recording.duration > 0 ? `${Math.floor(recording.duration / 60)} min` : 'Procesando...'}
                </Badge>
                {recording.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              
              <Separator className="my-3 sm:my-4" />
              
              <p className="text-muted-foreground text-sm">{recording.description}</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Chat replay synced with video */}
            {recording.liveId && (
              <RecordingChatReplay liveId={recording.liveId} />
            )}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{recording.doctorName}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{recording.specialty}</p>
                    <Badge variant="secondary" className="mt-2 gap-1 text-xs">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                </div>
                
                <Separator className="my-3 sm:my-4" />
                
                <Button className="w-full h-9 text-sm" onClick={() => navigate(`/doctor/${recording.doctorId}`)}>
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-xs sm:text-sm">Acceso Ilimitado</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Puedes ver esta grabación las veces que quieras.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Este contenido está protegido. No se permite la descarga.
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
