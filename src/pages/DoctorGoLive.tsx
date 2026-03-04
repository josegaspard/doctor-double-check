import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useDaily } from '@/hooks/useDaily';
import { useLocalRecording } from '@/hooks/cloudflare/useLocalRecording';
import { useActiveStream } from '@/contexts/ActiveStreamContext';
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

export default function DoctorGoLive() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();
  const activeStream = useActiveStream();

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

  // Local media stream for recording
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const [dailyOwnerToken, setDailyOwnerToken] = useState<string | null>(null);

  // Hooks
  const { createRoom, endRoom } = useDaily();
  const localRecording = useLocalRecording();

  // Real-time viewer count
  const { viewerCount, likesCount } = useViewerCount({
    liveId: liveData?.id || activeStream.liveData?.id || '',
    autoJoin: false,
  });

  // Sync viewer/likes to context
  useEffect(() => {
    if (viewerCount > 0) activeStream.setViewerCount(viewerCount);
    if (likesCount > 0) activeStream.setLikesCount(likesCount);
  }, [viewerCount, likesCount]);

  // Restore from active stream context (doctor returns to page)
  useEffect(() => {
    if (activeStream.isLive && activeStream.liveData && !isLive) {
      setLiveData({
        ...activeStream.liveData,
        viewerCount: activeStream.viewerCount,
        likesCount: activeStream.likesCount,
      });
      setIsLive(true);
      activeStream.maximizeStream();
    }
  }, [activeStream.isLive, activeStream.liveData]);

  // Use context timer when restored
  const displayElapsedTime = activeStream.isLive ? activeStream.elapsedTime : elapsedTime;

  // Timer (only when not using context)
  useEffect(() => {
    if (activeStream.isLive) return; // context handles timer
    let interval: NodeJS.Timeout;
    if (isLive && liveData?.startedAt) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - new Date(liveData.startedAt).getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive, liveData?.startedAt, activeStream.isLive]);

  // Browser close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((isLive || activeStream.isLive) && !isEnding) {
        e.preventDefault();
        e.returnValue = t('doctorGoLive.confirmExit');
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLive, isEnding, activeStream.isLive]);

  // Minimize on navigate away (detect route change)
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    // This effect runs when location changes. If we were on this page and now leaving,
    // minimize the stream. But we need to detect "leaving" in the cleanup.
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // When this component unmounts while live, minimize the stream
  useEffect(() => {
    return () => {
      if (activeStream.isLive && !isEnding) {
        activeStream.minimizeStream();
      }
    };
  }, [activeStream.isLive, isEnding]);

  const handleStartLive = async (config: LiveConfig) => {
    if (!user?.id) return;

    // Capture media first (user gesture)
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
      // Create live record in DB
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

      // Create Daily.co room for live broadcast
      const room = await createRoom(live.id, config.title.trim(), 'live');
      if (!room) {
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error creating broadcast room');
      }

      // Save room name to lives table
      await supabase
        .from('lives')
        .update({ daily_room_name: room.name })
        .eq('id', live.id);

      setDailyRoomName(room.name);
      setDailyRoomUrl(room.url);
      setDailyOwnerToken(room.ownerToken || '');

      // Start the stream in the global context (persists across navigation)
      await activeStream.startStream(room.url, room.ownerToken || '', {
        id: live.id,
        title: live.title,
        description: live.description || '',
        specialty: live.specialty,
        startedAt: new Date(live.started_at),
      });

      // Start local recording
      localRecording.startRecording(stream);

      setLiveData({
        id: live.id, title: live.title, description: live.description || '',
        specialty: live.specialty, viewerCount: 0, likesCount: 0,
        startedAt: new Date(live.started_at),
      });
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
      stream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      toast.error(error.message || t('doctorGoLive.startError'));
    } finally {
      setIsCreating(false);
    }
  };

  // End live
  const handleEndLive = async () => {
    const currentLiveData = liveData || (activeStream.liveData ? {
      ...activeStream.liveData,
      viewerCount: activeStream.viewerCount,
      likesCount: activeStream.likesCount,
    } : null);
    
    if (!currentLiveData?.id || !user?.id || isEnding) return;

    setIsEnding(true);
    setShowEndDialog(false);
    setShowEndingModal(true);
    setEndingStage('ending');

    try {
      // Stop local recording
      if (localRecording.isRecording) {
        await localRecording.stopRecording();
      }

      // Save peak viewers
      const currentViewerCount = viewerCount || activeStream.viewerCount;
      if (currentViewerCount > 0) {
        await supabase
          .from('lives')
          .update({ peak_viewers: currentViewerCount })
          .eq('id', currentLiveData.id);
      }

      // End the stream in context (destroys Daily call)
      activeStream.endStream();

      // End Daily room (non-blocking)
      if (dailyRoomName) {
        try {
          await endRoom(dailyRoomName);
        } catch (roomErr) {
          console.warn('endRoom failed (non-critical):', roomErr);
        }
      }

      // Update live status in DB
      setEndingStage('saving');
      await supabase.from('lives').update({
        status: 'ended', ended_at: new Date().toISOString(),
      }).eq('id', currentLiveData.id);

      // Upload local recording
      let recordingCreated = false;
      const localBlob = localRecording.getRecordingBlob();
      if (localBlob && localBlob.size > 0) {
        setEndingStage('uploading');
        const uploadResult = await localRecording.uploadRecording({
          liveId: currentLiveData.id, doctorId: user.id, title: currentLiveData.title,
          description: currentLiveData.description, specialty: currentLiveData.specialty,
          tags, price: enableRecording ? recordingPrice : 0,
        });
        if (uploadResult.success) {
          recordingCreated = true;
          await supabase
            .from('recordings')
            .update({ peak_viewers: currentViewerCount || 0 })
            .eq('live_id', currentLiveData.id)
            .eq('doctor_id', user.id);
        }
      }

      // Stop local media
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
      activeStream.endStream();
      localStream?.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localRecording.cleanup();
      try {
        await supabase.from('lives').update({
          status: 'ended', ended_at: new Date().toISOString(),
        }).eq('id', currentLiveData.id);
      } catch {}
      setIsLive(false);
      setLiveData(null);
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
  const currentIsLive = isLive || activeStream.isLive;
  const currentLiveData = liveData || (activeStream.liveData ? {
    ...activeStream.liveData,
    viewerCount: activeStream.viewerCount,
    likesCount: activeStream.likesCount,
  } : null);

  if (currentIsLive && currentLiveData) {
    const liveContent = (
      <>
        <LiveStreamView
          liveData={currentLiveData}
          elapsedTime={displayElapsedTime}
          viewerCount={viewerCount || activeStream.viewerCount}
          likesCount={likesCount || activeStream.likesCount}
          showChat={showChat}
          onToggleChat={() => setShowChat(!showChat)}
          onEndClick={() => setShowEndDialog(true)}
          roomUrl={dailyRoomUrl || ''}
          ownerToken={dailyOwnerToken || ''}
          useContextVideo={activeStream.isLive}
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
    if (isMobileCheck) {
      return liveContent;
    }

    return <MainLayout>{liveContent}</MainLayout>;
  }

  // Setup form
  return (
    <MainLayout>
      <LiveSetupForm onStartLive={handleStartLive} isCreating={isCreating} />
    </MainLayout>
  );
}
