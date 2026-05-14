import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useDaily } from '@/hooks/useDaily';
import { useLocalRecording } from '@/hooks/cloudflare/useLocalRecording';
import { useActiveLive } from '@/contexts/ActiveLiveContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { LiveSetupForm, LiveConfig } from '@/components/live/LiveSetupForm';
import { LiveStreamView } from '@/components/live/LiveStreamView';
import { LiveDialogs } from '@/components/live/LiveDialogs';
import { EndingLiveModal } from '@/components/live/EndingLiveModal';
import { ScheduleCourseForm } from '@/components/live/ScheduleCourseForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Radio, CalendarClock } from 'lucide-react';
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
  const { session: activeLiveSession, setSession: setActiveLiveSession, clearSession: clearActiveLiveSession } = useActiveLive();

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
  const [endingStage, setEndingStage] = useState<'ending' | 'saving' | 'uploading'>('ending');
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

  // Restore session from ActiveLiveContext on mount
  useEffect(() => {
    if (activeLiveSession && !isLive && !isEnding) {
      setLiveData({
        id: activeLiveSession.liveId,
        title: activeLiveSession.title,
        description: activeLiveSession.description,
        specialty: activeLiveSession.specialty,
        viewerCount: 0,
        likesCount: 0,
        startedAt: activeLiveSession.liveStartedAt,
      });
      setDailyRoomUrl(activeLiveSession.dailyRoomUrl);
      setDailyOwnerToken(activeLiveSession.dailyOwnerToken);
      setDailyRoomName(activeLiveSession.dailyRoomName);
      setEnableRecording(activeLiveSession.enableRecording);
      setTags(activeLiveSession.tags);
      setRecordingPrice(activeLiveSession.recordingPrice);
      setIsLive(true);
    }
  }, []); // Only on mount

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
      const { data: docProfile } = await supabase
        .from('doctor_profiles')
        .select('location')
        .eq('user_id', user.id)
        .single();

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
          location: docProfile?.location || null,
          chat_mode: config.chatMode,
          chat_price: config.chatPrice,
          chat_highlight_seconds: config.chatHighlightSeconds,
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

      // Upload thumbnail if provided
      if (config.thumbnailFile) {
        const thumbExt = config.thumbnailFile.name.split('.').pop();
        const thumbPath = `${user.id}/${live.id}.${thumbExt}`;
        const { error: thumbError } = await supabase.storage.from('thumbnails').upload(thumbPath, config.thumbnailFile);
        if (!thumbError) {
          const { data: thumbUrl } = supabase.storage.from('thumbnails').getPublicUrl(thumbPath);
          await supabase.from('lives').update({ thumbnail_url: thumbUrl.publicUrl }).eq('id', live.id);
        }
      }

      localRecording.startRecording(stream);

      // Auto-capture thumbnail from stream if no custom thumbnail was provided
      if (!config.thumbnailFile) {
        setTimeout(async () => {
          try {
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length === 0) return;
            const autoVideo = document.createElement('video');
            autoVideo.srcObject = stream;
            autoVideo.muted = true;
            autoVideo.playsInline = true;
            autoVideo.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
            document.body.appendChild(autoVideo);
            await autoVideo.play();
            // Wait for video to have valid dimensions
            await new Promise<void>((resolve) => {
              if (autoVideo.videoWidth > 0) return resolve();
              autoVideo.onloadedmetadata = () => resolve();
              setTimeout(resolve, 2000);
            });
            const w = autoVideo.videoWidth || 640;
            const h = autoVideo.videoHeight || 480;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { autoVideo.remove(); return; }
            ctx.drawImage(autoVideo, 0, 0, w, h);
            autoVideo.remove();
            canvas.toBlob(async (blob) => {
              if (!blob || !user?.id) return;
              const thumbPath = `${user.id}/${live.id}-auto.jpg`;
              const { error: thumbErr } = await supabase.storage.from('thumbnails').upload(thumbPath, blob, { contentType: 'image/jpeg', upsert: true });
              if (!thumbErr) {
                const { data: thumbUrl } = supabase.storage.from('thumbnails').getPublicUrl(thumbPath);
                await supabase.from('lives').update({ thumbnail_url: thumbUrl.publicUrl }).eq('id', live.id);
                console.log('[GoLive] Auto-thumbnail captured and uploaded');
              }
            }, 'image/jpeg', 0.8);
          } catch (err) {
            console.warn('[GoLive] Auto-thumbnail capture failed:', err);
          }
        }, 3000);
      }

      const liveDataObj: LiveData = {
        id: live.id, title: live.title, description: live.description || '',
        specialty: live.specialty, viewerCount: 0, likesCount: 0,
        startedAt: new Date(live.started_at),
      };
      setLiveData(liveDataObj);
      setIsLive(true);

      // Store in global context so navigation away doesn't lose session
      setActiveLiveSession({
        liveId: live.id,
        title: live.title,
        dailyRoomUrl: room.url,
        dailyOwnerToken: room.ownerToken || '',
        dailyRoomName: room.name,
        enableRecording: config.enableRecording,
        tags: config.tags,
        recordingPrice: config.recordingPrice,
        liveStartedAt: new Date(live.started_at),
        specialty: live.specialty,
        description: live.description || '',
      });

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
      // RLS de Postgres rechaza el INSERT si el doctor no está aprobado.
      // Traducimos a un mensaje accionable en lugar del raw "row-level security".
      const rawMsg: string = error?.message || '';
      const isRls =
        error?.code === '42501' ||
        /row-level security/i.test(rawMsg) ||
        /violates row-level/i.test(rawMsg);
      if (isRls) {
        toast.error(t('contextErrors.notVerifiedToCreateLive'));
      } else {
        toast.error(rawMsg || t('doctorGoLive.startError'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleEndLive = async (saveAsPremium: boolean) => {
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
      try {
        const call = Daily.getCallInstance();
        if (call) {
          call.leave().catch(() => {});
          call.destroy().catch(() => {});
        }
      } catch { /* no instance */ }

      if (dailyRoomName) {
        try { await endRoom(dailyRoomName); } catch {}
      }

      setEndingStage('saving');
      await supabase.from('lives').update({
        status: 'ended', ended_at: new Date().toISOString(),
      }).eq('id', liveData.id);

      // Background save: upload recording if doctor chose to save
      const localBlob = localRecording.getRecordingBlob();

      // If the doctor asked to save but the recorder produced no bytes, surface a
      // sticky error instead of silently navigating away — otherwise the doctor
      // arrives at /recordings, sees nothing, and can't tell what went wrong.
      if (saveAsPremium && (!localBlob || localBlob.size === 0)) {
        toast.error(
          'La grabación local no capturó video. Esto puede ocurrir si el navegador bloqueó el MediaRecorder o si la conexión cayó. El live quedó registrado pero no hay archivo que subir.',
          { duration: 15000 }
        );
      }

      if (saveAsPremium && localBlob && localBlob.size > 0) {
        // Start upload in background — don't await, navigate immediately
        const liveId = liveData.id;
        const doctorId = user.id;
        const title = liveData.title;
        const description = liveData.description;
        const specialty = liveData.specialty;
        const currentTags = tags;
        const price = enableRecording ? recordingPrice : 0;
        const currentViewerCount = viewerCount;

        // Fetch live's thumbnail_url to copy to recording
        const { data: liveRow } = await supabase.from('lives').select('thumbnail_url').eq('id', liveId).single();
        const liveThumbnailUrl = liveRow?.thumbnail_url || undefined;

        // Fire and forget — upload happens in background
        (async () => {
          try {
            const uploadResult = await localRecording.uploadRecording({
              liveId, doctorId, title, description, specialty,
              tags: currentTags, price,
              thumbnailUrl: liveThumbnailUrl,
            });
            if (uploadResult.success) {
              await supabase.from('recordings')
                .update({ peak_viewers: currentViewerCount || 0 })
                .eq('live_id', liveId).eq('doctor_id', doctorId);
              toast.success('Grabación guardada correctamente');
            }
          } catch (err) {
            console.error('Background upload error:', err);
            toast.error('Error al guardar la grabación');
          } finally {
            localRecording.cleanup();
          }
        })();
      } else {
        // Not saving — if there was a blob but doctor chose not to save, discard it
        localRecording.cleanup();
      }

      localStream?.getTracks().forEach(t => t.stop());
      setLocalStream(null);

      // Clear state and navigate immediately
      setIsEnding(false);
      setShowEndingModal(false);
      setIsLive(false);
      setLiveData(null);
      clearActiveLiveSession();

      // Navigate to recordings with appropriate tab
      if (saveAsPremium) {
        navigate('/doctor/recordings?tab=grabaciones');
        toast.success('Tu grabación se está procesando en segundo plano');
      } else {
        navigate('/doctor/recordings?tab=lives-pasados');
        toast.info('Live finalizado. Métricas disponibles en Lives pasados');
      }
    } catch (error: any) {
      console.error('Error ending live:', error);
      toast.error(t('doctorGoLive.endError'));
      try {
        const call = Daily.getCallInstance();
        if (call) {
          call.leave().catch(() => {});
          call.destroy().catch(() => {});
        }
      } catch { /* no instance */ }
      localStream?.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localRecording.cleanup();
      try {
        await supabase.from('lives').update({
          status: 'ended', ended_at: new Date().toISOString(),
        }).eq('id', liveData.id);
      } catch {}
      clearActiveLiveSession();
      setIsEnding(false);
      setShowEndingModal(false);
      setIsLive(false);
      setLiveData(null);
      navigate('/doctor/dashboard');
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

  const isMobileStable = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  if (isLive && liveData) {
    // Recording diagnostic overlay — hidden by default. Only surfaces if
    // recording fails silently (lastError), so the doctor knows something is
    // wrong instead of seeing a constant chunks/MB counter.
    const recDiag = enableRecording && localRecording.lastError ? (
      <div className="fixed top-3 right-3 z-[60] rounded-lg bg-black/85 backdrop-blur-md border border-destructive/30 text-white text-[11px] font-mono px-3 py-2 shadow-2xl pointer-events-none select-none">
        <div className="text-destructive max-w-[200px] whitespace-normal">
          ⚠ {localRecording.lastError}
        </div>
      </div>
    ) : null;

    const liveContent = (
      <>
        {recDiag}
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
          isMobile={isMobileStable}
        />
        <LiveDialogs
          showEndDialog={showEndDialog}
          onEndDialogChange={setShowEndDialog}
          onConfirmEnd={handleEndLive}
          isEnding={isEnding}
          enableRecording={enableRecording}
          showNavigationWarning={false}
          onNavigationWarningChange={() => {}}
          onConfirmNavigation={async () => {}}
          onCancelNavigation={() => {}}
        />
        <EndingLiveModal
          isOpen={showEndingModal}
          stage={endingStage}
          enableRecording={enableRecording}
          uploadProgress={localRecording.uploadProgress}
        />
      </>
    );

    if (isMobileStable) return liveContent;

    return <MainLayout>{liveContent}</MainLayout>;
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground border border-primary shadow-md mb-3">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold tracking-wide">Estudio en vivo</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Comparte tu conocimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transmite ahora o programa una sesión para tu audiencia
          </p>
        </div>
        <Tabs defaultValue="now" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4 max-w-md mx-auto">
            <TabsTrigger value="now" className="gap-2"><Radio className="w-4 h-4" /> Transmitir ahora</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2"><CalendarClock className="w-4 h-4" /> Programar curso</TabsTrigger>
          </TabsList>
          <TabsContent value="now">
            <div className="rounded-2xl bg-card/95 backdrop-blur-sm border border-border shadow-lg p-4 sm:p-6">
              <LiveSetupForm onStartLive={handleStartLive} isCreating={isCreating} />
            </div>
          </TabsContent>
          <TabsContent value="schedule">
            <div className="rounded-2xl bg-card/95 backdrop-blur-sm border border-border shadow-lg p-4 sm:p-6">
              <ScheduleCourseForm />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
