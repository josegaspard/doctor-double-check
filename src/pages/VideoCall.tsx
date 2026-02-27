import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useDaily } from '@/hooks/useDaily';
import { useCallTimer } from '@/hooks/useCallTimer';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoCallControls } from '@/components/videocall/VideoCallControls';
import { VideoCallChat } from '@/components/videocall/VideoCallChat';
import { Video, VideoOff, PhoneOff, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import DailyIframe from '@daily-co/daily-js';

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
  const { createRoom, endRoom } = useDaily();
  const timer = useCallTimer();

  const consultationId = searchParams.get('consultation');
  const autoJoin = searchParams.get('autojoin') === '1';
  const isDoctor = role === 'doctor';

  const [callState, setCallState] = useState<'idle' | 'joining' | 'connected' | 'ended'>('idle');
  const autoJoinTriggered = useRef(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<InCallMessage[]>([]);
  const [otherParticipantName, setOtherParticipantName] = useState<string>('');

  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const timeLocale = language === 'es' ? 'es-MX' : 'en-US';

  // Fetch consultation info
  useEffect(() => {
    if (!consultationId) return;
    const fetchInfo = async () => {
      const { data } = await supabase
        .from('consultations')
        .select('doctor_id, patient_id')
        .eq('id', consultationId)
        .single();
      if (data) {
        const otherId = isDoctor ? data.patient_id : data.doctor_id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', otherId)
          .single();
        setOtherParticipantName(profile?.name || t('videoCall.participant'));
      }
    };
    fetchInfo();
  }, [consultationId, isDoctor]);

  const startCall = useCallback(async () => {
    if (!consultationId || !user?.id || callState === 'joining') return;
    setCallState('joining');

    try {
      if (isDoctor) {
        // Pass mode: 'consultation' so both participants can broadcast
        const room = await createRoom(consultationId, `${t('videoCall.title')} - ${user.name}`, 'consultation');
        if (!room) {
          toast.error(t('videoCall.createRoomError'));
          setCallState('idle');
          return;
        }

        await supabase
          .from('consultations')
          .update({ video_room_name: room.name, video_room_url: room.url })
          .eq('id', consultationId);

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

        setRoomUrl(`${room.url}?t=${room.ownerToken}`);
        setRoomName(room.name);
      } else {
        const { data: consultation } = await supabase
          .from('consultations')
          .select('video_room_name, video_room_url')
          .eq('id', consultationId)
          .single();

        if (!consultation?.video_room_name) {
          toast.error(t('videoCall.doctorNotStarted'));
          setCallState('idle');
          return;
        }

        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-daily-token', {
          body: { roomName: consultation.video_room_name, isOwner: false, enableMedia: true },
        });

        if (tokenError || !tokenData?.success) {
          toast.error(t('videoCall.joinError'));
          setCallState('idle');
          return;
        }

        setRoomUrl(`${consultation.video_room_url}?t=${tokenData.token}`);
        setRoomName(consultation.video_room_name);
      }
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error(t('videoCall.startError'));
      setCallState('idle');
    }
  }, [consultationId, user?.id, isDoctor, createRoom, user?.name, t, callState]);

  // Auto-join when coming from incoming call modal
  useEffect(() => {
    if (autoJoin && !autoJoinTriggered.current && callState === 'idle' && consultationId && user?.id) {
      autoJoinTriggered.current = true;
      startCall();
    }
  }, [autoJoin, callState, consultationId, user?.id, startCall]);

  // Initialize Daily iframe
  useEffect(() => {
    if (!roomUrl || !containerRef.current || callFrameRef.current) return;

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: isMobile ? '0' : '12px',
      },
      showLeaveButton: false,
      showFullscreenButton: !isMobile,
    });

    callFrame.on('joined-meeting', () => {
      setCallState('connected');
      timer.start();
    });

    callFrame.on('left-meeting', () => {
      setCallState('ended');
      timer.stop();
      callFrame.destroy();
      callFrameRef.current = null;
    });

    callFrame.on('error', (e: any) => {
      console.error('Daily error:', e);
      toast.error(t('videoCall.callError'));
      setCallState('ended');
      timer.stop();
    });

    callFrame.on('app-message', (event: any) => {
      if (event?.data?.type === 'chat') {
        setChatMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: event.data.senderName || t('videoCall.participant'),
            text: event.data.text,
            time: new Date().toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
            isOwn: false,
          },
        ]);
      }
    });

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

  useEffect(() => {
    if (timer.isExpired) {
      toast.warning(t('videoCall.timeLimit'));
      handleEndCall();
    }
  }, [timer.isExpired]);

  useEffect(() => {
    if (timer.isNearEnd && timer.timeRemaining === 300) {
      toast.warning(t('videoCall.fiveMinWarning'));
    }
  }, [timer.isNearEnd, timer.timeRemaining]);

  const handleToggleMute = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleToggleCamera = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!callFrameRef.current) return;
    try {
      if (isScreenSharing) {
        await callFrameRef.current.stopScreenShare();
      } else {
        await callFrameRef.current.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error(t('videoCall.screenShareError'));
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (!callFrameRef.current) return;
    callFrameRef.current.sendAppMessage({
      type: 'chat',
      text,
      senderName: user?.name || 'Usuario',
    }, '*');

    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: t('videoCall.you'),
        text,
        time: new Date().toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }),
        isOwn: true,
      },
    ]);
  };

  const handleEndCall = async () => {
    timer.stop();
    if (callFrameRef.current) {
      callFrameRef.current.leave();
    }
    if (isDoctor && roomName) {
      await endRoom(roomName);
      if (consultationId) {
        await supabase
          .from('consultations')
          .update({ video_room_name: null, video_room_url: null })
          .eq('id', consultationId);
      }
    }
    setCallState('ended');
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

  // Mobile fullscreen when in call
  const isInCall = (callState === 'connected' || roomUrl) && callState !== 'ended';

  if (isMobile && isInCall) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div ref={containerRef} className="flex-1 w-full h-full" />
        <AnimatePresence>
          {showChat && (
            <VideoCallChat
              messages={chatMessages}
              onSend={handleSendChatMessage}
              onClose={() => setShowChat(false)}
            />
          )}
        </AnimatePresence>
        {callState === 'connected' && (
          <VideoCallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            timeElapsed={timer.timeElapsed}
            onToggleMute={handleToggleMute}
            onToggleCamera={handleToggleCamera}
            onToggleScreenShare={handleToggleScreenShare}
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
                <Button size="lg" onClick={startCall} className="gap-2 px-8 h-12 text-base">
                  <Video className="w-5 h-5" />
                  {isDoctor ? t('videoCall.startButton') : t('videoCall.joinButton')}
                </Button>
              </div>
            )}

            {callState === 'joining' && (
              <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-b from-muted/30 to-background">
                <Loader2 className="w-14 h-14 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">{t('videoCall.connecting')}</p>
                <p className="text-sm text-muted-foreground">
                  {isDoctor ? t('videoCall.creatingRoom') : t('videoCall.joiningCall')}
                </p>
              </div>
            )}

            {isInCall && (
              <div className="relative bg-dark rounded-lg overflow-hidden">
                <div ref={containerRef} className="w-full aspect-video" />
                <AnimatePresence>
                  {showChat && (
                    <VideoCallChat
                      messages={chatMessages}
                      onSend={handleSendChatMessage}
                      onClose={() => setShowChat(false)}
                    />
                  )}
                </AnimatePresence>
                {callState === 'connected' && (
                  <VideoCallControls
                    isMuted={isMuted}
                    isCameraOff={isCameraOff}
                    isScreenSharing={isScreenSharing}
                    timeElapsed={timer.timeElapsed}
                    onToggleMute={handleToggleMute}
                    onToggleCamera={handleToggleCamera}
                    onToggleScreenShare={handleToggleScreenShare}
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
