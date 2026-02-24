import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface IncomingCallData {
  consultationId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
}

export function useIncomingCall() {
  const { supabaseUser, role } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  const dismissCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    if (!supabaseUser?.id || role !== 'patient') return;

    // Listen for incoming call notifications via realtime broadcast
    const channel = supabase
      .channel(`incoming-call-${supabaseUser.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const data = payload.payload as IncomingCallData;
        setIncomingCall(data);
      })
      .subscribe();

    // Also listen for video_call notifications from the notifications table
    const notifChannel = supabase
      .channel(`call-notif-${supabaseUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${supabaseUser.id}`,
        },
        (payload: any) => {
          const notification = payload.new;
          if (notification.type === 'video_call') {
            setIncomingCall({
              consultationId: notification.data?.consultationId,
              doctorName: notification.data?.doctorName || 'Doctor',
              doctorSpecialty: notification.data?.doctorSpecialty,
              doctorAvatar: notification.data?.doctorAvatar,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
    };
  }, [supabaseUser?.id, role]);

  return { incomingCall, dismissCall };
}
