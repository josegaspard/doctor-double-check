import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDaily } from '@/hooks/useDaily';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, PhoneOff, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import DailyIframe from '@daily-co/daily-js';

export default function VideoCall() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { createRoom, endRoom } = useDaily();
  
  const consultationId = searchParams.get('consultation');
  const doctorId = searchParams.get('doctor');
  const isDoctor = role === 'doctor';
  
  const [callState, setCallState] = useState<'idle' | 'joining' | 'connected' | 'ended'>('idle');
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startCall = useCallback(async () => {
    if (!consultationId || !user?.id) return;
    
    setCallState('joining');
    
    try {
      if (isDoctor) {
        // Doctor creates the room
        const room = await createRoom(consultationId, `Orientación médica - ${user.name}`);
        if (!room) {
          toast.error('Error al crear la sala');
          setCallState('idle');
          return;
        }
        
        // Save room info to consultation
        await supabase
          .from('consultations')
          .update({ video_room_name: room.name, video_room_url: room.url })
          .eq('id', consultationId);

        // Join with the owner token
        setRoomUrl(`${room.url}?t=${room.ownerToken}`);
        setRoomName(room.name);

      } else {
        // Patient gets the existing room
        const { data: consultation } = await supabase
          .from('consultations')
          .select('video_room_name, video_room_url')
          .eq('id', consultationId)
          .single();
        
        if (!consultation?.video_room_name) {
          toast.error('El doctor aún no ha iniciado la videollamada');
          setCallState('idle');
          return;
        }

        // Get participant token (with video/audio enabled for 1:1 call)
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-daily-token', {
          body: { roomName: consultation.video_room_name, isOwner: false, enableMedia: true },
        });
        
        if (tokenError || !tokenData?.success) {
          toast.error('Error al unirse a la llamada');
          setCallState('idle');
          return;
        }

        setRoomUrl(`${consultation.video_room_url}?t=${tokenData.token}`);
        setRoomName(consultation.video_room_name);
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Error al iniciar la videollamada');
      setCallState('idle');
    }
  }, [consultationId, user?.id, isDoctor, createRoom]);

  // Initialize Daily iframe when room is ready
  useEffect(() => {
    if (!roomUrl || !containerRef.current || callFrameRef.current) return;

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '12px',
      },
      showLeaveButton: true,
      showFullscreenButton: true,
    });

    callFrame.on('joined-meeting', () => setCallState('connected'));
    callFrame.on('left-meeting', () => {
      setCallState('ended');
      callFrame.destroy();
      callFrameRef.current = null;
    });
    callFrame.on('error', (e: any) => {
      console.error('Daily error:', e);
      toast.error('Error en la videollamada');
      setCallState('ended');
    });

    // Join with token embedded in URL
    callFrame.join({ 
      url: roomUrl,
      startVideoOff: false,
      startAudioOff: false,
    });
    callFrameRef.current = callFrame;

    return () => {
      if (callFrameRef.current) {
        try { callFrameRef.current.destroy(); } catch {}
        callFrameRef.current = null;
      }
    };
  }, [roomUrl]);

  const handleEndCall = async () => {
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
    if (isDoctor && roomName) {
      await endRoom(roomName);
    }
    setCallState('ended');
  };

  if (!consultationId) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-bold mb-4">No se especificó una orientación</h2>
          <Button onClick={() => navigate('/chat')}>Volver al Chat</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Badge variant="info" className="gap-1">
            <Video className="w-3 h-3" />
            Videollamada
          </Badge>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {callState === 'idle' && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {isDoctor ? 'Iniciar videollamada' : 'Unirse a videollamada'}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {isDoctor
                    ? 'Inicia una sesión de video con tu paciente. La llamada tiene una duración máxima de 1 hora.'
                    : 'Tu médico debe iniciar la llamada primero. Haz clic para unirte.'}
                </p>
                <Button size="lg" onClick={startCall} className="gap-2">
                  <Video className="w-5 h-5" />
                  {isDoctor ? 'Iniciar Llamada' : 'Unirse'}
                </Button>
              </div>
            )}

            {callState === 'joining' && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Conectando...</p>
              </div>
            )}

            {(callState === 'connected' || roomUrl) && callState !== 'ended' && (
              <div className="relative">
                <div ref={containerRef} className="w-full aspect-video bg-dark rounded-lg" />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleEndCall}
                    className="rounded-full w-14 h-14"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            )}

            {callState === 'ended' && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <VideoOff className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Llamada finalizada</h2>
                <p className="text-muted-foreground mb-6">La videollamada ha terminado</p>
                <Button onClick={() => navigate('/chat')}>Volver al Chat</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
