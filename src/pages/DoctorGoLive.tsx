import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useDaily } from '@/hooks/useDaily';
import { useLocalRecording } from '@/hooks/cloudflare/useLocalRecording';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { LiveSetupForm, LiveConfig } from '@/components/live/LiveSetupForm';
import { LiveStreamView } from '@/components/live/LiveStreamView';
import { LiveDialogs } from '@/components/live/LiveDialogs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Daily from '@daily-co/daily-js';

interface LiveData {
  id: string;
  title: string;
  description: string;
  specialty: string;
  viewerCount: number;
  likesCount: number;
  startedAt: Date;
}

export default function DoctorGoLive() {
  const navigate = useNavigate();
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();

  // Live state
  const [isCreating, setIsCreating] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [dailyRoomName, setDailyRoomName] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showEndingModal, setShowEndingModal] = useState(false);
  const [endingStage, setEndingStage] = useState<'ending' | 'saving' | 'uploading' | 'done'>('ending');
  const [enableRecording, setEnableRecording] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [recordingPrice, setRecordingPrice] = useState(0);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const [dailyOwnerToken, setDailyOwnerToken] = useState<string | null>(null);
  

  const { createRoom, endRoom } = useDaily();
  const localRecording = useLocalRecording();

  const { viewerCount, likesCount } = useViewerCount({
    liveId: liveData?.id || '',
    autoJoin: false,
  });

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && liveData?.startedAt) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - new Date(liveData.startedAt).getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive, liveData?.startedAt]);

  // Browser close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLive && !isEnding) {
        e.preventDefault();
        e.returnValue = t('doctorGoLive.confirmExit');
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLive, isEnding]);

  // Cleanup on unmount if still live
  useEffect(() => {
    return () => {
      try {
        const call = Daily.getCallInstance();
        if (call) {
          call.leave().catch(() => {});
          call.destroy().catch(() => {});
        }
      } catch { /* no instance */ }
    };
  }, []);

  const handleStartLive = async (config: LiveConfig) => {
    if (!user?.id) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);
    } catch (err) {
      toast.error('No se pudo acceder a la cámara/micrófono');
      return;
    }

    setIsCreating(true);
    setEnableRecording(config.enableRecording);
    setTags(config.tags);
    setRecordingPrice(config.recordingPrice);

    try {
      const { data: live, error: liveError } = await supabase
        .from('lives')
        .insert({
          doctor_id: user.id,
          title: config.title.trim(),
          description: config.description.trim() || null,
          specialty: config.specialty,
          tags: config.tags.length > 0 ? config.tags : null,
          recording_price: config.enableRecording ? config.recordingPrice : null,
          thumbnail_url: null,
          status: 'live',
          chat_enabled: config.chatEnabled,
          max_questions: config.maxQuestions,
          max_paid_chats: config.maxPaidChats,
        })
        .select()
        .single();

      if (liveError) throw liveError;

      const room = await createRoom(live.id, config.title.trim(), 'live');
      if (!room) {
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error creating broadcast room');
      }

      await supabase.from('lives').update({ daily_room_name: room.name }).eq('id', live.id);

      setDailyRoomName(room.name);
      setDailyRoomUrl(room.url);
      setDailyOwnerToken(room.ownerToken || '');

      localRecording.startRecording(stream);

      setLiveData({
        id: live.id, title: live.title, description: live.description || '',
        specialty: live.specialty, viewerCount: 0, likesCount: 0,
        startedAt: new Date(live.started_at),
      });
      setIsLive(true);

      // Notify subscribers
      Promise.allSettled([
        supabase.rpc('notify_subscribers', {
          p_doctor_id: user.id, p_notification_type: 'doctor_live',
          p_title: '¡En vivo ahora!',
          p_message: `${user.name || 'Un doctor que sigues'} está transmitiendo: ${config.title}`,
          p_data: { liveId: live.id },
        }),
        supabase.functions.invoke('send-push-notification', {
          body: { doctorId: user.id, liveId: live.id, title: '¡En vivo ahora!',
            message: `${user.name || 'Un doctor que sigues'} está transmitiendo: ${config.title}` },
        }),
        supabase.functions.invoke('send-live-notification-email', {
          body: { doctorId: user.id, liveId: live.id, title: config.title.trim(),
            description: config.description.trim() || null },
        }),
      ]).catch(() => {});

      toast.success('¡Transmisión iniciada!');
    } catch (error: any) {
      console.error('Error starting live:', error);
      stream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      toast.error(error.message || t('doctorGoLive.startError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleEndLive = async () => {
    if (!liveData?.id || !user?.id || isEnding) return;

    setIsEnding(true);
    setShowEndDialog(false);
    setShowEndingModal(true);
    setEndingStage('ending');

    try {
      if (localRecording.isRecording) {
        await localRecording.stopRecording();
      }

      if (viewerCount > 0) {
        await supabase.from('lives').update({ peak_viewers: viewerCount }).eq('id', liveData.id);
      }

      // Destroy Daily call
      if (callObjectRef.current) {
        callObjectRef.current.leave().catch(() => {});
        callObjectRef.current.destroy().catch(() => {});
        callObjectRef.current = null;
      }

      if (dailyRoomName) {
        try { await endRoom(dailyRoomName); } catch {}
      }

      setEndingStage('saving');
      await supabase.from('lives').update({
        status: 'ended', ended_at: new Date().toISOString(),
      }).eq('id', liveData.id);

      let recordingCreated = false;
      const localBlob = localRecording.getRecordingBlob();
      if (localBlob && localBlob.size > 0) {
        setEndingStage('uploading');
        const uploadResult = await localRecording.uploadRecording({
          liveId: liveData.id, doctorId: user.id, title: liveData.title,
          description: liveData.description, specialty: liveData.specialty,
          tags, price: enableRecording ? recordingPrice : 0,
        });
        if (uploadResult.success) {
          recordingCreated = true;
          await supabase.from('recordings')
            .update({ peak_viewers: viewerCount || 0 })
            .eq('live_id', liveData.id).eq('doctor_id', user.id);
        }
      }

      localStream?.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localRecording.cleanup();

      setEndingStage('done');
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsLive(false);
      setLiveData(null);

      if (enableRecording && recordingCreated) {
        toast.success('¡Transmisión finalizada! La grabación está disponible como contenido premium.');
        navigate('/doctor/recordings');
      } else if (enableRecording) {
        toast.warning('La transmisión finalizó pero no se pudo guardar la grabación.');
        navigate('/doctor/dashboard');
      } else {
        toast.success('Transmisión finalizada');
        navigate('/doctor/dashboard');
      }
    } catch (error: any) {
      console.error('Error ending live:', error);
      toast.error(t('doctorGoLive.endError'));
      if (callObjectRef.current) {
        callObjectRef.current.leave().catch(() => {});
        callObjectRef.current.destroy().catch(() => {});
        callObjectRef.current = null;
      }
      localStream?.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localRecording.cleanup();
      try {
        await supabase.from('lives').update({
          status: 'ended', ended_at: new Date().toISOString(),
        }).eq('id', liveData.id);
      } catch {}
      setIsLive(false);
      setLiveData(null);
      navigate('/doctor/dashboard');
    } finally {
      setIsEnding(false);
      setShowEndingModal(false);
    }
  };

  if (isAuthLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (role !== 'doctor') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Iniciar Transmisión</h2>
            <p className="text-muted-foreground mb-6">Solo los médicos verificados pueden iniciar transmisiones en vivo.</p>
            <Button onClick={() => navigate('/login')}>Iniciar Sesión como Médico</Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (isLive && liveData) {
    const liveContent = (
      <>
        <LiveStreamView
          liveData={liveData}
          elapsedTime={elapsedTime}
          viewerCount={viewerCount}
          likesCount={likesCount}
          showChat={showChat}
          onToggleChat={() => setShowChat(!showChat)}
          onEndClick={() => setShowEndDialog(true)}
          roomUrl={dailyRoomUrl || ''}
          ownerToken={dailyOwnerToken || ''}
        />
        <LiveDialogs
          showEndDialog={showEndDialog}
          onEndDialogChange={setShowEndDialog}
          onConfirmEnd={handleEndLive}
          isEnding={isEnding}
          enableRecording={enableRecording}
          showEndingModal={showEndingModal}
          endingStage={endingStage}
          uploadProgress={localRecording.uploadProgress}
          showNavigationWarning={false}
          onNavigationWarningChange={() => {}}
          onConfirmNavigation={async () => {}}
          onCancelNavigation={() => {}}
        />
      </>
    );

    const isMobileCheck = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    if (isMobileCheck) return liveContent;

    return <MainLayout>{liveContent}</MainLayout>;
  }

  return (
    <MainLayout>
      <LiveSetupForm onStartLive={handleStartLive} isCreating={isCreating} />
    </MainLayout>
  );
}
