import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';
import { useCallTimer } from '@/hooks/useCallTimer';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoCallControls } from '@/components/videocall/VideoCallControls';
import { VideoCallChat } from '@/components/videocall/VideoCallChat';
import { PatientRecordPanel } from '@/components/videocall/PatientRecordPanel';
import { PostConsultationSummaryDialog } from '@/components/chat/PostConsultationSummaryDialog';
import { Video, VideoOff, Loader2, ArrowLeft, AlertTriangle, BadgeCheck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import type { DailyCall } from '@daily-co/daily-js';
import { useConnectionQuality } from '@/hooks/useConnectionQuality';
import { ConnectionQualityIndicator } from '@/components/videocall/ConnectionQualityIndicator';

interface InCallMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isOwn: boolean;
}

/**
 * Renders Daily.co video tracks into a container without recreating
 * elements unnecessarily (prevents audio interruption on re-render).
 */
function renderVideoTracks(container: HTMLDivElement, co: DailyCall) {
  const participants = co.participants();
  const remotes = Object.values(participants).filter(p => !p.local);
  const local = participants.local;

  // ── Detect screen share from any remote participant ──
  let screenTrack: MediaStreamTrack | null = null;
  let screenAudioTrack: MediaStreamTrack | null = null;
  for (const r of remotes) {
    const st = r.tracks?.screenVideo?.persistentTrack;
    if (st) {
      screenTrack = st;
      screenAudioTrack = r.tracks?.screenAudio?.persistentTrack || null;
      break;
    }
  }

  // ── Screen share video (full-screen when active) ──
  let screenVideo = container.querySelector<HTMLVideoElement>('[data-role="screen"]');
  let screenBadge = container.querySelector<HTMLDivElement>('[data-role="screen-badge"]');

  if (screenTrack) {
    if (!screenVideo) {
      screenVideo = document.createElement('video');
      screenVideo.setAttribute('data-role', 'screen');
      screenVideo.autoplay = true;
      screenVideo.playsInline = true;
      screenVideo.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
      container.prepend(screenVideo);
    }
    const tracks: MediaStreamTrack[] = [screenTrack];
    if (screenAudioTrack) tracks.push(screenAudioTrack);
    const curIds = (screenVideo.srcObject as MediaStream)?.getTracks().map(t => t.id).join(',') || '';
    const newIds = tracks.map(t => t.id).join(',');
    if (curIds !== newIds) {
      screenVideo.srcObject = new MediaStream(tracks);
      screenVideo.play().catch(() => {});
    }
    // Badge
    if (!screenBadge) {
      screenBadge = document.createElement('div');
      screenBadge.setAttribute('data-role', 'screen-badge');
      screenBadge.style.cssText = 'position:absolute;top:12px;left:12px;z-index:20;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.7);color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;';
      screenBadge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span> Pantalla compartida';
      container.appendChild(screenBadge);
    }
  } else {
    screenVideo?.remove();
    screenBadge?.remove();
  }

  // ── Remote camera video ──
  let remoteVideo = container.querySelector<HTMLVideoElement>('[data-role="remote"]');
  let waitingEl = container.querySelector<HTMLDivElement>('[data-role="waiting"]');

  if (remotes.length > 0) {
    const remote = remotes[0];
    const videoTrack = remote.tracks?.video?.persistentTrack;
    const audioTrack = remote.tracks?.audio?.persistentTrack;

    waitingEl?.remove();

    if (videoTrack || audioTrack) {
      const isScreenActive = !!screenTrack;
      if (!remoteVideo) {
        remoteVideo = document.createElement('video');
        remoteVideo.setAttribute('data-role', 'remote');
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        container.prepend(remoteVideo);
      }
      // Switch between full-screen and PiP depending on screen share
      if (isScreenActive) {
        remoteVideo.style.cssText = 'position:absolute;bottom:80px;left:16px;width:120px;height:90px;border-radius:8px;object-fit:cover;z-index:10;border:2px solid hsl(var(--primary));box-shadow:0 4px 12px rgba(0,0,0,0.5);';
      } else {
        remoteVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      }

      const tracks: MediaStreamTrack[] = [];
      if (videoTrack) tracks.push(videoTrack);
      if (audioTrack) tracks.push(audioTrack);

      const currentTrackIds = (remoteVideo.srcObject as MediaStream)?.getTracks().map(t => t.id).join(',') || '';
      const newTrackIds = tracks.map(t => t.id).join(',');
      if (currentTrackIds !== newTrackIds) {
        remoteVideo.srcObject = new MediaStream(tracks);
        remoteVideo.play().catch(() => {});
      }
    } else {
      remoteVideo?.remove();
      if (!waitingEl) {
        waitingEl = document.createElement('div');
        waitingEl.setAttribute('data-role', 'waiting');
        waitingEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
        waitingEl.innerHTML = `<p style="color:rgba(255,255,255,0.7);font-size:14px;">${remote.user_name || 'Participante'} conectado (sin video)</p>`;
        container.prepend(waitingEl);
      }
    }
  } else {
    remoteVideo?.remove();
    if (!waitingEl) {
      waitingEl = document.createElement('div');
      waitingEl.setAttribute('data-role', 'waiting');
      waitingEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
      waitingEl.innerHTML = `
        <div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;">Esperando al otro participante...</p>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      `;
      container.prepend(waitingEl);
    }
  }

  // ── Local video (PiP) ──
  let localVideo = container.querySelector<HTMLVideoElement>('[data-role="local"]');
  const localTrack = local?.tracks?.video?.persistentTrack;

  if (localTrack) {
    if (!localVideo) {
      localVideo = document.createElement('video');
      localVideo.setAttribute('data-role', 'local');
      localVideo.autoplay = true;
      localVideo.playsInline = true;
      localVideo.muted = true;
      container.appendChild(localVideo);
    }
    // Position local PiP: if screen share is active, put it next to remote PiP
    const isScreenActive = !!screenTrack;
    if (isScreenActive) {
      localVideo.style.cssText = 'position:absolute;bottom:80px;right:16px;width:100px;height:75px;border-radius:8px;object-fit:cover;z-index:10;border:2px solid hsl(var(--primary));box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    } else {
      localVideo.style.cssText = 'position:absolute;bottom:80px;right:16px;width:120px;height:90px;border-radius:8px;object-fit:cover;z-index:10;border:2px solid hsl(var(--primary));box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    }
    const currentId = (localVideo.srcObject as MediaStream)?.getVideoTracks()[0]?.id;
    if (currentId !== localTrack.id) {
      localVideo.srcObject = new MediaStream([localTrack]);
      localVideo.play().catch(() => {});
    }
  } else {
    localVideo?.remove();
  }
}

export default function VideoCall() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const timer = useCallTimer();

  const consultationId = searchParams.get('consultation');
  const autoJoin = searchParams.get('autojoin') === '1';
  const isDoctor = role === 'doctor';

  const {
    callState,
    isMuted, isCameraOff, isScreenSharing,
    startCall, joinCall, endCall, resetCall,
    toggleMute, toggleCamera, toggleScreenShare,
    callObject,
  } = useWebRTCCall(consultationId, user?.id || null);

  const connectionStats = useConnectionQuality(callObject, callState === 'connected');

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<InCallMessage[]>([]);
  const [otherParticipantName, setOtherParticipantName] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctorCreds, setDoctorCreds] = useState<{ name: string; specialty: string | null; cedula: string | null; cofepris: string | null } | null>(null);
  const [showPostConsult, setShowPostConsult] = useState(false);

  const dailyContainerRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const timeLocale = language === 'es' ? 'es-MX' : 'en-US';

  // Render & update video tracks when call object events fire
  useEffect(() => {
    if (!callObject || callState !== 'connected') return;

    const container = dailyContainerRef.current;
    if (!container) return;

    // Initial render
    renderVideoTracks(container, callObject);

    const handleUpdate = () => {
      if (dailyContainerRef.current) {
        renderVideoTracks(dailyContainerRef.current, callObject);
      }
    };

    callObject.on('participant-updated', handleUpdate);
    callObject.on('participant-joined', handleUpdate);
    callObject.on('participant-left', handleUpdate);
    callObject.on('track-started', handleUpdate);
    callObject.on('track-stopped', handleUpdate);

    return () => {
      callObject.off('participant-updated', handleUpdate);
      callObject.off('participant-joined', handleUpdate);
      callObject.off('participant-left', handleUpdate);
      callObject.off('track-started', handleUpdate);
      callObject.off('track-stopped', handleUpdate);
    };
  }, [callObject, callState]);

  // Fetch other participant name + doctor credentials + patient id (for record panel)
  useEffect(() => {
    if (!consultationId) return;
    (async () => {
      const { data } = await supabase
        .from('consultations')
        .select('doctor_id, patient_id')
        .eq('id', consultationId)
        .single();
      if (!data) return;
      setPatientId(data.patient_id);
      const otherId = isDoctor ? data.patient_id : data.doctor_id;
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', otherId).single();
      setOtherParticipantName(profile?.name || t('videoCall.participant'));

      // Doctor credentials (visible to patient and doctor)
      const { data: doctorProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.doctor_id)
        .maybeSingle();
      const { data: dp } = await supabase
        .from('doctor_profiles')
        .select('specialty, cedula_profesional, cofepris_permit')
        .eq('user_id', data.doctor_id)
        .maybeSingle();
      if (doctorProfile && dp) {
        setDoctorCreds({
          name: doctorProfile.name || '',
          specialty: dp.specialty,
          cedula: dp.cedula_profesional,
          cofepris: dp.cofepris_permit,
        });
      }
    })();
  }, [consultationId, isDoctor]);

  // Set up in-call chat via Realtime
  useEffect(() => {
    if (!consultationId || !user?.id) return;
    const ch = supabase
      .channel(`call-chat-${consultationId}`)
      .on('broadcast', { event: 'chat-msg' }, ({ payload }) => {
        if (payload.senderId === user.id) return;
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: payload.senderName || t('videoCall.participant'),
          text: payload.text,
          time: new Date().toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
          isOwn: false,
        }]);
      })
      .subscribe();
    chatChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [consultationId, user?.id]);

  // Start timer when connected
  useEffect(() => {
    if (callState === 'connected') timer.start();
    if (callState === 'ended') timer.stop();
  }, [callState]);

  useEffect(() => {
    if (timer.isExpired) { toast.warning(t('videoCall.timeLimit')); handleEndCall(); }
  }, [timer.isExpired]);

  useEffect(() => {
    if (timer.isNearEnd && timer.timeRemaining === 300) toast.warning(t('videoCall.fiveMinWarning'));
  }, [timer.isNearEnd, timer.timeRemaining]);

  const handleStart = useCallback(async () => {
    if (!consultationId || !user?.id || callState !== 'idle') return;

    if (isDoctor) {
      const { data: consultation } = await supabase
        .from('consultations')
        .select('patient_id')
        .eq('id', consultationId)
        .single();

      if (consultation?.patient_id) {
        const { data: doctorProfile } = await supabase
          .from('doctor_profiles')
          .select('specialty')
          .eq('user_id', user.id)
          .single();

        await supabase.from('notifications').insert({
          user_id: consultation.patient_id,
          type: 'video_call' as any,
          title: '📹 ' + t('videoCall.title'),
          message: `${user.name} ${t('videoCall.withParticipant')}`,
          data: {
            consultationId,
            doctorName: user.name,
            doctorSpecialty: doctorProfile?.specialty,
            doctorAvatar: user.avatarUrl,
          },
        });

        await supabase.channel(`incoming-call-${consultation.patient_id}`).send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: {
            consultationId,
            doctorName: user.name,
            doctorSpecialty: doctorProfile?.specialty,
            doctorAvatar: user.avatarUrl,
          },
        });
      }

      startCall();
    } else {
      joinCall();
    }
  }, [consultationId, user, isDoctor, callState, startCall, joinCall, t]);

  const handleEndCall = useCallback(async () => {
    timer.stop();
    endCall();
  }, [endCall, timer]);

  const handleSendChat = (text: string) => {
    chatChannelRef.current?.send({
      type: 'broadcast',
      event: 'chat-msg',
      payload: { text, senderId: user?.id, senderName: user?.name || 'Usuario' },
    });
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: t('videoCall.you'),
      text,
      time: new Date().toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    }]);
  };

  // Auto-join: when patient accepts incoming call, connect automatically
  const autoJoinTriggered = useRef(false);
  useEffect(() => {
    if (autoJoin && callState === 'idle' && consultationId && !autoJoinTriggered.current) {
      autoJoinTriggered.current = true;
      handleStart();
    }
  }, [autoJoin, callState, consultationId, handleStart]);

  if (!consultationId) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-bold mb-4">{t('videoCall.noConsultation')}</h2>
          <Button onClick={() => navigate('/chat')}>{t('videoCall.backToChat')}</Button>
        </div>
      </MainLayout>
    );
  }

  const isInCall = callState === 'connecting' || callState === 'connected';

  const videoLayoutJSX = (
    <div ref={dailyContainerRef} className="relative w-full h-full bg-black" style={{ minHeight: 300 }}>
      {callState === 'connected' && (
        <ConnectionQualityIndicator stats={connectionStats} />
      )}
      {callState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-3" />
            <p className="text-white/80 text-sm">Conectando...</p>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile && isInCall) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex-1 w-full relative">
          {videoLayoutJSX}
        </div>
        <AnimatePresence>
          {showChat && (
            <VideoCallChat messages={chatMessages} onSend={handleSendChat} onClose={() => setShowChat(false)} />
          )}
        </AnimatePresence>
        {isInCall && (
          <VideoCallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            timeElapsed={timer.timeElapsed}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onToggleChat={() => setShowChat(!showChat)}
            onEndCall={handleEndCall}
            showChat={showChat}
            isDoctor={isDoctor}
          />
        )}
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('videoCall.back')}
          </Button>
          <div className="flex items-center gap-2">
            {callState === 'connected' && timer.isNearEnd && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {timer.timeElapsed}
              </Badge>
            )}
            <Badge variant="info" className="gap-1">
              <Video className="w-3 h-3" />
              {t('videoCall.title')}
            </Badge>
          </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-xl">
          <CardContent className="p-0">
            {callState === 'idle' && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-gradient-to-b from-muted/30 to-background">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 ring-4 ring-primary/5">
                  <Video className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {isDoctor ? t('videoCall.startCall') : t('videoCall.joinCall')}
                </h2>
                {otherParticipantName && (
                  <p className="text-muted-foreground mb-1">
                    {t('videoCall.withParticipant')} <span className="font-semibold text-foreground">{otherParticipantName}</span>
                  </p>
                )}
                <p className="text-sm text-muted-foreground mb-8 max-w-md">
                  {isDoctor ? t('videoCall.doctorStartInfo') : t('videoCall.patientJoinInfo')}
                </p>
                <Button size="lg" onClick={handleStart} className="gap-2 px-8 h-12 text-base">
                  <Video className="w-5 h-5" />
                  {isDoctor ? t('videoCall.startButton') : t('videoCall.joinButton')}
                </Button>
              </div>
            )}

            {isInCall && (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div className="w-full aspect-video">
                  {videoLayoutJSX}
                </div>
                <AnimatePresence>
                  {showChat && (
                    <VideoCallChat messages={chatMessages} onSend={handleSendChat} onClose={() => setShowChat(false)} />
                  )}
                </AnimatePresence>
                <VideoCallControls
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  isScreenSharing={isScreenSharing}
                  timeElapsed={timer.timeElapsed}
                  onToggleMute={toggleMute}
                  onToggleCamera={toggleCamera}
                  onToggleScreenShare={toggleScreenShare}
                  onToggleChat={() => setShowChat(!showChat)}
                  onEndCall={handleEndCall}
                  showChat={showChat}
                  isDoctor={isDoctor}
                />
              </div>
            )}

            {callState === 'ended' && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-b from-muted/30 to-background">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                  <VideoOff className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{t('videoCall.callEnded')}</h2>
                <p className="text-muted-foreground mb-2">
                  {t('videoCall.duration')}: {timer.timeElapsed}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {t('videoCall.callEndedWith').replace('{name}', otherParticipantName)}
                </p>
                <Button onClick={() => navigate('/chat')}>{t('videoCall.backToChat')}</Button>
              </div>
            )}

            {callState === 'error' && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-b from-muted/30 to-background">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Error de conexión</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  No se pudo establecer la conexión. Verifica tu cámara/micrófono e intenta de nuevo.
                </p>
                <Button onClick={() => resetCall()}>Reintentar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
