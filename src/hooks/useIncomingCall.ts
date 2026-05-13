import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface IncomingCallData {
  consultationId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
}

export function useIncomingCall() {
  const { supabaseUser, role } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  // Track dismissed consultation IDs so they don't reappear
  const dismissedRef = useRef<Set<string>>(new Set());

  const dismissCall = useCallback(() => {
    if (incomingCall?.consultationId) {
      dismissedRef.current.add(incomingCall.consultationId);

      // Mark the video_call notification as read so it doesn't show in the bell
      if (supabaseUser?.id) {
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', supabaseUser.id)
          .eq('type', 'video_call' as any)
          .then(() => {});
      }
    }
    setIncomingCall(null);
  }, [incomingCall?.consultationId, supabaseUser?.id]);

  useEffect(() => {
    if (!supabaseUser?.id || role !== 'patient') return;

    // Listen for incoming call notifications via realtime broadcast
    const channel = supabase
      .channel(`incoming-call-${supabaseUser.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const data = payload.payload as IncomingCallData;
        if (!dismissedRef.current.has(data.consultationId)) {
          setIncomingCall(data);
        }
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
            const consultationId = notification.data?.consultationId;
            if (consultationId && !dismissedRef.current.has(consultationId)) {
              setIncomingCall({
                consultationId,
                doctorId: notification.data?.doctorId || '',
                doctorName: notification.data?.doctorName || 'Doctor',
                doctorSpecialty: notification.data?.doctorSpecialty,
                doctorAvatar: notification.data?.doctorAvatar,
              });
            }
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
