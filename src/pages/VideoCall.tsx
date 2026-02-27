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
import { Video, VideoOff, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';

interface InCallMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isOwn: boolean;
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
    callState, localStream, remoteStream,
    isMuted, isCameraOff, isScreenSharing,
    startCall, joinCall, endCall,
    toggleMute, toggleCamera, toggleScreenShare,
  } = useWebRTCCall(consultationId, user?.id || null);

  const autoJoinTriggered = useRef(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<InCallMessage[]>([]);
  const [otherParticipantName, setOtherParticipantName] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const timeLocale = language === 'es' ? 'es-MX' : 'en-US';

  // Fetch other participant name
  useEffect(() => {
    if (!consultationId) return;
    (async () => {
      const { data } = await supabase
        .from('consultations')
        .select('doctor_id, patient_id')
        .eq('id', consultationId)
        .single();
      if (data) {
        const otherId = isDoctor ? data.patient_id : data.doctor_id;
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', otherId).single();
        setOtherParticipantName(profile?.name || t('videoCall.participant'));
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

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Start timer when connected
  useEffect(() => {
    if (callState === 'connected') timer.start();
    if (callState === 'ended') timer.stop();
  }, [callState]);

  // Auto-join for patient from incoming call
  useEffect(() => {
    if (autoJoin && !autoJoinTriggered.current && callState === 'idle' && consultationId && user?.id) {
      autoJoinTriggered.current = true;
      handleStart();
    }
  }, [autoJoin, callState, consultationId, user?.id]);

  // Timer warnings
  useEffect(() => {
    if (timer.isExpired) { toast.warning(t('videoCall.timeLimit')); handleEndCall(); }
  }, [timer.isExpired]);

  useEffect(() => {
    if (timer.isNearEnd && timer.timeRemaining === 300) toast.warning(t('videoCall.fiveMinWarning'));
  }, [timer.isNearEnd, timer.timeRemaining]);

  const handleStart = useCallback(async () => {
    if (!consultationId || !user?.id || callState !== 'idle') return;

    if (isDoctor) {
      // Send notification to patient
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

  // Shared video layout
  const VideoLayout = () => (
    <div className="relative w-full h-full bg-black">
      {/* Remote video (full) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {/* No remote stream placeholder */}
      {(!remoteStream || remoteStream.getTracks().length === 0) && callState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-3" />
            <p className="text-white/80 text-sm">
              {isDoctor ? t('videoCall.waitingForPatient') || 'Esperando al paciente...' : t('videoCall.joiningCall')}
            </p>
          </div>
        </div>
      )}
      {/* Local video PiP */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute bottom-20 right-4 w-28 h-20 sm:w-36 sm:h-28 rounded-lg object-cover z-10 border-2 border-primary shadow-lg"
      />
    </div>
  );

  // Mobile fullscreen when in call
  if (isMobile && isInCall) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex-1 w-full relative">
          <VideoLayout />
        </div>
        <AnimatePresence>
          {showChat && (
            <VideoCallChat messages={chatMessages} onSend={handleSendChat} onClose={() => setShowChat(false)} />
          )}
        </AnimatePresence>
        {callState === 'connected' && (
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
                  <VideoLayout />
                </div>
                <AnimatePresence>
                  {showChat && (
                    <VideoCallChat messages={chatMessages} onSend={handleSendChat} onClose={() => setShowChat(false)} />
                  )}
                </AnimatePresence>
                {callState === 'connected' && (
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
                  />
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
                <Button onClick={handleStart}>Reintentar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
