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
import { Video, VideoOff, Loader2, ArrowLeft, AlertTriangle, BadgeCheck, FileText, MessageSquare, PhoneOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import type { DailyCall } from '@daily-co/daily-js';
import { useConnectionQuality } from '@/hooks/useConnectionQuality';
import { ConnectionQualityIndicator } from '@/components/videocall/ConnectionQualityIndicator';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

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
function renderVideoTracks(container: HTMLDivElement, co: DailyCall, t: (key: string) => string) {
  const participants = co.participants();
  const remotes = Object.values(participants).filter(p => !p.local);
  const local = participants.local;

  // ── Detectar screen share: PRIMERO el local (si yo comparto), DESPUÉS los remotos.
  // Antes solo escaneaba remotos → el que comparte no veía su propia pantalla.
  let screenTrack: MediaStreamTrack | null = null;
  let screenAudioTrack: MediaStreamTrack | null = null;
  let screenIsLocal = false;

  const localScreen = local?.tracks?.screenVideo?.persistentTrack;
  if (localScreen) {
    screenTrack = localScreen;
    screenAudioTrack = local?.tracks?.screenAudio?.persistentTrack || null;
    screenIsLocal = true;
  } else {
    for (const r of remotes) {
      const st = r.tracks?.screenVideo?.persistentTrack;
      if (st) {
        screenTrack = st;
        screenAudioTrack = r.tracks?.screenAudio?.persistentTrack || null;
        break;
      }
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
    // Si yo soy el que comparto, mute el audio del track propio para no hacer eco.
    const tracks: MediaStreamTrack[] = [screenTrack];
    if (screenAudioTrack && !screenIsLocal) tracks.push(screenAudioTrack);
    if (screenIsLocal) screenVideo.muted = true;
    const curIds = (screenVideo.srcObject as MediaStream)?.getTracks().map(t => t.id).join(',') || '';
    const newIds = tracks.map(t => t.id).join(',');
    if (curIds !== newIds) {
      screenVideo.srcObject = new MediaStream(tracks);
      screenVideo.play().catch(() => {});
    }
    // Badge: distinto label si la pantalla es propia o del otro
    if (!screenBadge) {
      screenBadge = document.createElement('div');
      screenBadge.setAttribute('data-role', 'screen-badge');
      screenBadge.style.cssText = 'position:absolute;top:12px;left:12px;z-index:20;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.7);color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;';
      container.appendChild(screenBadge);
    }
    // SECURITY: build DOM with textContent so the translated label cannot inject HTML.
    const screenDot = '<span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span> ';
    screenBadge.textContent = '';
    screenBadge.insertAdjacentHTML('beforeend', screenDot);
    screenBadge.appendChild(document.createTextNode(
      screenIsLocal ? t('videoCallPage.sharingYourScreen') : t('videoCallPage.screenShared')
    ));
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
        // SECURITY: build DOM with textContent so remote.user_name (controlled
        // by the other Daily.co participant) cannot inject HTML/script.
        const p = document.createElement('p');
        p.style.cssText = 'color:rgba(255,255,255,0.7);font-size:14px;';
        p.textContent = t('videoCallPage.participantConnectedNoVideo').replace('{name}', remote.user_name || t('videoCall.participant'));
        waitingEl.appendChild(p);
        container.prepend(waitingEl);
      }
    }
  } else {
    remoteVideo?.remove();
    if (!waitingEl) {
      waitingEl = document.createElement('div');
      waitingEl.setAttribute('data-role', 'waiting');
      waitingEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
      // SECURITY: build via textContent for the translated label to avoid HTML injection.
      const spinnerDiv = document.createElement('div');
      spinnerDiv.style.cssText = 'width:48px;height:48px;border:3px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;';
      const waitMsg = document.createElement('p');
      waitMsg.style.cssText = 'color:rgba(255,255,255,0.7);font-size:14px;';
      waitMsg.textContent = t('videoCallPage.waitingForOtherParticipant');
      const styleEl = document.createElement('style');
      styleEl.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      waitingEl.appendChild(spinnerDiv);
      waitingEl.appendChild(waitMsg);
      waitingEl.appendChild(styleEl);
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
  // Reunión multi-médico (no consulta 1:1): trae meetingId en la URL.
  const isMeeting = !!searchParams.get('meetingId');
  // En reuniones, doctores Y residentes pueden compartir pantalla (cliente 2026-06-29).
  const canScreenShare = isDoctor || (isMeeting && role === 'resident');

  const {
    callState,
    isMuted, isCameraOff, isScreenSharing,
    startCall, joinCall, endCall, resetCall,
    toggleMute, toggleCamera, toggleScreenShare, switchCamera,
    callObject,
  } = useWebRTCCall(consultationId, user?.id || null);

  const connectionStats = useConnectionQuality(callObject, callState === 'connected');

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<InCallMessage[]>([]);
  // Mensajes no leídos cuando showChat=false. Se resetea al abrir el chat.
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  // Preview del último mensaje no leído — burbuja flotante que aparece sobre
  // el video y al tocarla abre el chat panel.
  const [lastUnreadMsg, setLastUnreadMsg] = useState<{ sender: string; text: string } | null>(null);
  const [otherParticipantName, setOtherParticipantName] = useState('');
  // Doctor's user_id of the other participant, ONLY when the shown other party is
  // the doctor (i.e. current user is the patient). Null when the other party is a
  // patient, so the badge never renders for a patient. Used for DoctorBadgeIcon.
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
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
    renderVideoTracks(container, callObject, t);

    const handleUpdate = () => {
      if (dailyContainerRef.current) {
        renderVideoTracks(dailyContainerRef.current, callObject, t);
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
  }, [callObject, callState, t]);

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
      // Only the doctor gets a badge; when current user is the doctor, the other
      // party is a patient → keep id null so no badge shows.
      setOtherParticipantId(isDoctor ? null : data.doctor_id);
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
      .on('broadcast', { event: 'call-ended' }, ({ payload }) => {
        const data = payload as { endedBy?: 'doctor' | 'patient'; userId?: string };
        if (!data?.endedBy || data.userId === user.id) return;
        setOtherHangup(data.endedBy);
        // Cerrar el video de nuestro lado también
        try { endCall(); } catch { /* ignore */ }
        timer.stop();
        // Doctor: abrir el resumen post-consulta automáticamente
        if (isDoctor && consultationId) {
          setTimeout(() => setShowPostConsult(true), 400);
        }
      })
      .on('broadcast', { event: 'chat-msg' }, ({ payload }) => {
        if (payload.senderId === user.id) return;
        const senderName = payload.senderName || t('videoCall.participant');
        const text = payload.text;
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: senderName,
          text,
          time: new Date().toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
          isOwn: false,
        }]);
        // Si el chat panel está cerrado, mostrar burbuja flotante + contador.
        setShowChat(currentShow => {
          if (!currentShow) {
            setUnreadChatCount(c => c + 1);
            setLastUnreadMsg({ sender: senderName, text });
            // Vibración + sonido breve (best effort — algunos browsers ignoran)
            if ('vibrate' in navigator) {
              try { navigator.vibrate(80); } catch { /* ignore */ }
            }
          }
          return currentShow;
        });
      })
      .subscribe();
    chatChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [consultationId, user?.id, endCall, timer, isDoctor, t, timeLocale]);

  // Al abrir el chat → resetear unread + esconder burbuja
  useEffect(() => {
    if (showChat) {
      setUnreadChatCount(0);
      setLastUnreadMsg(null);
    }
  }, [showChat]);

  // Auto-esconder la burbuja tras 6s si el usuario no la tocó
  useEffect(() => {
    if (!lastUnreadMsg) return;
    const t = setTimeout(() => setLastUnreadMsg(null), 6000);
    return () => clearTimeout(t);
  }, [lastUnreadMsg]);

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

  const [permissionError, setPermissionError] = useState<null | 'denied' | 'no_devices'>(null);

  // Probe camera+mic permissions BEFORE we hit Daily.co so we can show the user
  // a helpful message ("enable in browser settings") instead of a generic error.
  const probePermissions = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Release tracks immediately — Daily will request its own.
      stream.getTracks().forEach((t) => t.stop());
      setPermissionError(null);
      return true;
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        setPermissionError('denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
        setPermissionError('no_devices');
      } else {
        setPermissionError('denied'); // generic fallback — still actionable
      }
      console.warn('[VideoCall] permission probe failed', e);
      return false;
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!consultationId || !user?.id || callState !== 'idle') return;

    // Permission gate: surface a clear modal rather than silent failure.
    const ok = await probePermissions();
    if (!ok) return;

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
            doctorId: user.id,
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
            doctorId: user.id,
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
    // Notificar a la otra parte que el usuario actual colgó.
    try {
      chatChannelRef.current?.send({
        type: 'broadcast',
        event: 'call-ended',
        payload: { endedBy: isDoctor ? 'doctor' : 'patient', userId: user?.id },
      });
    } catch (_) { /* best effort */ }
    timer.stop();
    endCall();
    // Doctor: open post-consultation summary dialog automatically
    if (isDoctor && consultationId) {
      setTimeout(() => setShowPostConsult(true), 400);
    }
  }, [endCall, timer, isDoctor, consultationId, user?.id]);

  // Escucha el hangup del otro lado para mostrar aviso adecuado.
  const [otherHangup, setOtherHangup] = useState<null | 'doctor' | 'patient'>(null);

  const handleSendChat = (text: string) => {
    chatChannelRef.current?.send({
      type: 'broadcast',
      event: 'chat-msg',
      payload: { text, senderId: user?.id, senderName: user?.name || t('videoCallPage.userFallback') },
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

  // Doctor side: listen for patient rejection / no-answer so we stop waiting and notify the doctor.
  useEffect(() => {
    if (!isDoctor || !user?.id) return;
    const channel = supabase
      .channel(`call-status-${user.id}`)
      .on('broadcast', { event: 'call_rejected' }, (payload) => {
        const data = payload?.payload as { consultationId?: string; reason?: string } | undefined;
        if (!data || data.consultationId !== consultationId) return;
        // Stop the waiting state on the doctor side
        try { endCall(); } catch (_) {}
        timer.stop();
        if (data.reason === 'no_answer') {
          toast.warning(t('videoCallPage.patientNoAnswerToast'));
          // Fire-and-forget email + push notification to the patient
          supabase.functions.invoke('send-missed-call-email', {
            body: { consultationId },
          }).catch((e) => console.warn('missed-call email failed', e));
        } else {
          toast.info(t('videoCallPage.patientRejectedToast'));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDoctor, user?.id, consultationId, endCall, timer, t]);

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
            <p className="text-white/80 text-sm">{t('videoCallPage.connecting')}</p>
          </div>
        </div>
      )}
    </div>
  );

  // ── MOBILE: full-screen call UI siempre (idle + connecting + connected) ──
  // Antes el idle mostraba una card chica dentro de MainLayout. Ahora la pantalla
  // completa simula una llamada nativa: avatar + nombre del otro lado + botón único
  // (Iniciar / Unirse / Esperando) en idle, video full-screen + controles en in-call.
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-secondary via-primary to-secondary flex flex-col" style={{ height: '100dvh' }}>
        {callState === 'idle' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25"
              aria-label={t('videoCallPage.backAriaLabel')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-28 h-28 rounded-full bg-white/15 backdrop-blur ring-4 ring-white/20 flex items-center justify-center mb-6">
              <Video className="w-14 h-14 text-white" />
            </div>

            <p className="text-xs uppercase tracking-widest text-white/70 mb-1">
              {isDoctor ? t('videoCallPage.callingTo') : t('videoCallPage.incomingCall')}
            </p>
            <span className="inline-flex items-center gap-1 min-w-0 mb-1">
              <h2 className="text-2xl font-bold text-white">
                {otherParticipantName || (isDoctor ? t('videoCallPage.patient') : t('videoCallPage.doctor'))}
              </h2>
              <DoctorBadgeIcon userId={otherParticipantId ?? undefined} size="sm" className="flex-shrink-0" />
            </span>
            {doctorCreds?.specialty && !isDoctor && (
              <p className="text-sm text-white/80">{doctorCreds.specialty}</p>
            )}

            <p className="text-sm text-white/75 mt-6 max-w-xs">
              {isDoctor
                ? t('videoCall.doctorStartInfo')
                : (autoJoin ? t('videoCall.patientJoinInfo') : t('videoCallPage.waitingForDoctor'))}
            </p>

            <div className="mt-10 w-full max-w-sm">
              {(isDoctor || autoJoin) ? (
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="w-full h-14 rounded-full bg-white text-primary hover:bg-white/90 text-base font-bold gap-2 shadow-2xl"
                >
                  <Video className="w-5 h-5" />
                  {isDoctor ? t('videoCall.startButton') : t('videoCall.joinButton')}
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-3 text-white/85">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{t('videoCallPage.waitingForDoctor')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 w-full relative bg-black">
              {videoLayoutJSX}

              {/* Burbuja flotante: aparece sobre el video cuando llega un mensaje
                  y el chat panel está cerrado. Click → abre el chat. */}
              <AnimatePresence>
                {!showChat && lastUnreadMsg && (
                  <motion.button
                    initial={{ y: -20, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -20, opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                    onClick={() => setShowChat(true)}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-[90%] sm:max-w-md flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-card/95 backdrop-blur-md shadow-2xl ring-1 ring-black/10 text-left active:scale-[0.98] transition-transform"
                    aria-label={t('videoCallPage.openChatAriaLabel')}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-foreground leading-tight truncate">
                        {lastUnreadMsg.sender}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                        {lastUnreadMsg.text}
                      </p>
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>
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
              onSwitchCamera={switchCamera}
              showChat={showChat}
              isDoctor={isDoctor}
              canScreenShare={canScreenShare}
              unreadChatCount={unreadChatCount}
            />
          </>
        )}
        <PostConsultationSummaryDialog
          open={showPostConsult}
          onOpenChange={setShowPostConsult}
          consultationId={consultationId}
          onSaved={() => navigate('/chat')}
        />
        <OtherPartyHangupDialog
          open={!!otherHangup}
          endedBy={otherHangup}
          isDoctor={isDoctor}
          onClose={() => { setOtherHangup(null); if (!isDoctor) navigate('/chat'); }}
        />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="back" size="sm" onClick={() => navigate(-1)}>
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

                {/* Doctor credentials — visible to patient (and as confirmation to doctor) */}
                {doctorCreds && (
                  <div className="mt-3 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 max-w-md w-full text-left">
                    <p className="text-xs uppercase tracking-wide text-primary mb-1 flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> {t('videoCallPage.treatingDoctor')}
                    </p>
                    <p className="text-sm font-semibold">{doctorCreds.name}</p>
                    {doctorCreds.specialty && <p className="text-xs text-muted-foreground">{doctorCreds.specialty}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground">
                      {doctorCreds.cedula && <span>{t('videoCallPage.cedulaLabel')}: <strong>{doctorCreds.cedula}</strong></span>}
                      {doctorCreds.cofepris && <span>{t('videoCallPage.cofeprisLabel')}: <strong>{doctorCreds.cofepris}</strong></span>}
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground mb-8 max-w-md">
                  {isDoctor
                    ? t('videoCall.doctorStartInfo')
                    : (autoJoin
                        ? t('videoCall.patientJoinInfo')
                        : t('videoCallPage.patientWaitInfo'))}
                </p>

                {/* Patient can only JOIN (autoJoin), never start. Doctor can always start. */}
                {(isDoctor || autoJoin) ? (
                  <Button size="lg" onClick={handleStart} className="gap-2 px-8 h-12 text-base">
                    <Video className="w-5 h-5" />
                    {isDoctor ? t('videoCall.startButton') : t('videoCall.joinButton')}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground italic">{t('videoCallPage.waitingDoctorStart')}</p>
                  </div>
                )}
              </div>
            )}

            {isInCall && (
              <div className={isDoctor ? "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0" : ""}>
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
                    onSwitchCamera={switchCamera}
                    showChat={showChat}
                    isDoctor={isDoctor}
                    canScreenShare={canScreenShare}
                  />
                </div>
                {/* Lateral patient record panel — doctor only, desktop */}
                {isDoctor && (
                  <div className="hidden lg:block bg-card border-l">
                    <PatientRecordPanel patientId={patientId} enabled={isDoctor} />
                  </div>
                )}
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
                <div className="flex gap-2">
                  {isDoctor && (
                    <Button variant="outline" onClick={() => setShowPostConsult(true)}>
                      <FileText className="w-4 h-4 mr-2" />
                      {t('videoCallPage.postConsultReport')}
                    </Button>
                  )}
                  <Button onClick={() => navigate('/chat')}>{t('videoCall.backToChat')}</Button>
                </div>
              </div>
            )}

            {callState === 'error' && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-b from-muted/30 to-background">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{t('videoCallPage.connectionError')}</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {t('videoCallPage.connectionErrorDetail')}
                </p>
                <Button onClick={() => resetCall()}>{t('videoCallPage.retry')}</Button>
              </div>
            )}

            {permissionError && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-gradient-to-b from-muted/30 to-background">
                <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10 text-warning" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {permissionError === 'denied' ? t('videoCallPage.permissionDeniedTitle') : t('videoCallPage.noDevicesTitle')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  {permissionError === 'denied' ? (
                    <>
                      {t('videoCallPage.permissionDeniedDetailPrefix')}<strong>{t('videoCallPage.permissionDeniedLock')}</strong>{t('videoCallPage.permissionDeniedDetailSuffix')}
                    </>
                  ) : (
                    <>
                      {t('videoCallPage.noDevicesDetail')}
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setPermissionError(null); navigate(-1); }}>{t('videoCallPage.backToChatShort')}</Button>
                  <Button onClick={async () => { setPermissionError(null); await handleStart(); }}>{t('videoCallPage.retry')}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post-consultation summary dialog (auto-opens for doctor on hangup) */}
        <PostConsultationSummaryDialog
          open={showPostConsult}
          onOpenChange={setShowPostConsult}
          consultationId={consultationId}
          onSaved={() => navigate('/chat')}
        />
        <OtherPartyHangupDialog
          open={!!otherHangup}
          endedBy={otherHangup}
          isDoctor={isDoctor}
          onClose={() => { setOtherHangup(null); if (!isDoctor) navigate('/chat'); }}
        />
      </div>
    </MainLayout>
  );
}

function OtherPartyHangupDialog({
  open,
  endedBy,
  isDoctor,
  onClose,
}: {
  open: boolean;
  endedBy: 'doctor' | 'patient' | null;
  isDoctor: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  if (!endedBy) return null;
  // Mensaje según quién terminó y quién está viendo el modal
  const otherEnded = (isDoctor && endedBy === 'patient') || (!isDoctor && endedBy === 'doctor');
  if (!otherEnded) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <PhoneOff className="w-5 h-5 text-destructive" />
            {endedBy === 'doctor' ? t('videoCallPage.doctorEndedCall') : t('videoCallPage.patientEndedCall')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            {isDoctor
              ? t('videoCallPage.doctorHangupMessage')
              : t('videoCallPage.patientHangupMessage')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            {isDoctor ? t('videoCallPage.doctorHangupAck') : t('videoCallPage.patientHangupAck')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
