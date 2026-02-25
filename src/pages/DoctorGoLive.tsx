import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useCloudflareStream, useLocalRecording } from '@/hooks/cloudflare';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { LiveSetupForm, LiveConfig } from '@/components/live/LiveSetupForm';
import { LiveStreamView } from '@/components/live/LiveStreamView';
import { LiveDialogs } from '@/components/live/LiveDialogs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LiveData {
  id: string;
  title: string;
  description: string;
  specialty: string;
  viewerCount: number;
  likesCount: number;
  startedAt: Date;
}

interface StreamData {
  uid: string;
  webRTCUrl: string;
  playbackUrl: string;
}

export default function DoctorGoLive() {
  const navigate = useNavigate();
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();

  // Live state
  const [isCreating, setIsCreating] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showEndingModal, setShowEndingModal] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [endingStage, setEndingStage] = useState<'ending' | 'saving' | 'uploading' | 'done'>('ending');
  const [enableRecording, setEnableRecording] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [recordingPrice, setRecordingPrice] = useState(0);
  const reconnectingRef = useRef(false);
  const disconnectedChecksRef = useRef(0);

  // Hooks
  const {
    createStream, prepareMediaStream, startBroadcast, stopBroadcast, endStream, toggleMute, toggleVideo,
    getLocalStream, isLoading: isStreamLoading,
  } = useCloudflareStream();
  const localRecording = useLocalRecording();

  // Real-time viewer count
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

  // Navigation guard refs
  const isLiveRef = useRef(isLive);
  const isEndingRef = useRef(isEnding);
  useEffect(() => { isLiveRef.current = isLive; isEndingRef.current = isEnding; }, [isLive, isEnding]);

  // Handle browser back/forward
  useEffect(() => {
    if (!isLive || isEnding) return;
    window.history.pushState({ isLiveGuard: true }, '');
    const handlePopState = () => {
      if (isLiveRef.current && !isEndingRef.current) {
        window.history.pushState({ isLiveGuard: true }, '');
        setShowNavigationWarning(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLive, isEnding]);

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


  // Keep Cloudflare ingest alive: auto-reconnect if input becomes disconnected
  useEffect(() => {
    if (!isLive || !streamData?.uid || !streamData.webRTCUrl || isEnding) return;

    let isCancelled = false;

    const checkCloudflareHealth = async () => {
      if (isCancelled) return;

      const { data, error } = await supabase.functions.invoke('get-cloudflare-playback', {
        body: {
          liveInputUid: streamData.uid,
          type: 'live',
        },
      });

      if (isCancelled || error) return;

      if (data?.success) {
        disconnectedChecksRef.current = 0;
        return;
      }

      if (data?.status === 'disconnected') {
        disconnectedChecksRef.current += 1;

        if (disconnectedChecksRef.current >= 2 && !reconnectingRef.current) {
          reconnectingRef.current = true;
          toast.warning('Se perdió la señal del live. Reconectando...');

          const ok = await startBroadcast(streamData.webRTCUrl);

          if (ok) {
            disconnectedChecksRef.current = 0;
            toast.success('Se recuperó la señal del live');
          } else {
            toast.error('No se pudo recuperar la señal. Finaliza y vuelve a iniciar el live.');
          }

          reconnectingRef.current = false;
        }
      }
    };

    const initialCheck = setTimeout(checkCloudflareHealth, 6000);
    const interval = setInterval(checkCloudflareHealth, 8000);

    return () => {
      isCancelled = true;
      clearTimeout(initialCheck);
      clearInterval(interval);
      disconnectedChecksRef.current = 0;
      reconnectingRef.current = false;
    };
  }, [isLive, streamData?.uid, streamData?.webRTCUrl, isEnding, startBroadcast]);

  const handleStartLive = async (config: LiveConfig) => {
    if (!user?.id) return;

    // IMPORTANT: media capture must happen directly from user gesture
    const mediaReady = await prepareMediaStream();
    if (!mediaReady) return;

    setIsCreating(true);
    setEnableRecording(config.enableRecording);
    setTags(config.tags);
    setRecordingPrice(config.recordingPrice);

    try {
      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (config.thumbnailFile) {
        const ext = config.thumbnailFile.name.split('.').pop() || 'jpg';
        const path = `live-thumbnails/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(path, config.thumbnailFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path);
          thumbnailUrl = urlData.publicUrl;
        }
      }

      const { data: live, error: liveError } = await supabase
        .from('lives')
        .insert({
          doctor_id: user.id,
          title: config.title.trim(),
          description: config.description.trim() || null,
          specialty: config.specialty,
          tags: config.tags.length > 0 ? config.tags : null,
          recording_price: config.enableRecording ? config.recordingPrice : null,
          thumbnail_url: thumbnailUrl,
          status: 'live',
        })
        .select()
        .single();

      if (liveError) throw liveError;

      const stream = await createStream(live.id, config.title.trim(), config.enableRecording);
      if (!stream) {
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error creating stream');
      }

      const broadcastStarted = await startBroadcast(stream.webRTCUrl);
      if (!broadcastStarted) {
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error starting broadcast');
      }

      // Start local recording IMMEDIATELY from second 0
      if (config.enableRecording) {
        const localStream = getLocalStream();
        if (localStream) {
          localRecording.startRecording(localStream);
        } else {
          // Retry once after a short delay if stream not ready yet
          setTimeout(() => {
            const retryStream = getLocalStream();
            if (retryStream) localRecording.startRecording(retryStream);
          }, 300);
        }
      }

      setLiveData({
        id: live.id, title: live.title, description: live.description || '',
        specialty: live.specialty, viewerCount: 0, likesCount: 0,
        startedAt: new Date(live.started_at),
      });
      setStreamData({ uid: stream.uid, webRTCUrl: stream.webRTCUrl, playbackUrl: stream.playbackUrl });
      setIsLive(true);

      // Notify subscribers (fire-and-forget)
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
      await stopBroadcast().catch(() => {});
      toast.error(error.message || t('doctorGoLive.startError'));
    } finally {
      setIsCreating(false);
    }
  };

  // End live
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

      setEndingStage('saving');
      const result = await endStream(liveData.id, streamData?.uid, enableRecording);
      const cloudflareRecordingId = result.success ? result.recordingId : undefined;
      let recordingCreated = !!cloudflareRecordingId;

      const localBlob = enableRecording ? localRecording.getRecordingBlob() : null;
      if (enableRecording && localBlob && localBlob.size > 0) {
        setEndingStage('uploading');
        const uploadResult = await localRecording.uploadRecording({
          liveId: liveData.id, doctorId: user.id, title: liveData.title,
          description: liveData.description, specialty: liveData.specialty,
          tags, price: recordingPrice, recordingId: cloudflareRecordingId,
        });
        if (uploadResult.success) recordingCreated = true;
      }

      if (!result.success) {
        await supabase.from('lives').update({
          status: 'ended', ended_at: new Date().toISOString(),
        }).eq('id', liveData.id);
      }

      localRecording.cleanup();
      setEndingStage('done');
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (enableRecording && recordingCreated) {
        toast.success('¡Transmisión finalizada! La grabación está disponible.');
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
      localRecording.cleanup();
      try {
        await supabase.from('lives').update({
          status: 'ended', ended_at: new Date().toISOString(),
        }).eq('id', liveData.id);
      } catch {}
      navigate('/doctor/dashboard');
    } finally {
      setIsEnding(false);
      setShowEndingModal(false);
    }
  };

  // Auth loading
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

  // Block non-doctors
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

  // Live streaming view
  if (isLive && streamData && liveData) {
    return (
      <MainLayout>
        <LiveStreamView
          liveData={liveData}
          elapsedTime={elapsedTime}
          viewerCount={viewerCount}
          likesCount={likesCount}
          showChat={showChat}
          onToggleChat={() => setShowChat(!showChat)}
          onEndClick={() => setShowEndDialog(true)}
          getLocalStream={getLocalStream}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
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
          showNavigationWarning={showNavigationWarning}
          onNavigationWarningChange={setShowNavigationWarning}
          onConfirmNavigation={async () => { setShowNavigationWarning(false); await handleEndLive(); }}
          onCancelNavigation={() => setShowNavigationWarning(false)}
        />
      </MainLayout>
    );
  }

  // Setup form
  return (
    <MainLayout>
      <LiveSetupForm onStartLive={handleStartLive} isCreating={isCreating} />
    </MainLayout>
  );
}
