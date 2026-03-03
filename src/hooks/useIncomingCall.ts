import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DISMISSED_KEY = 'mm_dismissed_calls';

function getDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function persistDismissedId(id: string) {
  const ids = getDismissedIds();
  ids.add(id);
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

interface IncomingCallData {
  consultationId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
}

export function useIncomingCall() {
  const { supabaseUser, role } = useAuth();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const dismissedRef = useRef<Set<string>>(getDismissedIds());

  // Auto-suppress when navigating to /video-call
  useEffect(() => {
    if (location.pathname.startsWith('/video-call') && incomingCall) {
      persistDismissedId(incomingCall.consultationId);
      dismissedRef.current.add(incomingCall.consultationId);
      setIncomingCall(null);
    }
  }, [location.pathname, incomingCall]);

  const dismissCall = useCallback(() => {
    if (incomingCall?.consultationId) {
      dismissedRef.current.add(incomingCall.consultationId);
      persistDismissedId(incomingCall.consultationId);

      // Delete the video_call notification so it doesn't re-trigger via realtime
      if (supabaseUser?.id) {
        supabase
          .from('notifications')
          .delete()
          .eq('user_id', supabaseUser.id)
          .eq('type', 'video_call' as any)
          .then(() => {});
      }
    }
    setIncomingCall(null);
  }, [incomingCall?.consultationId, supabaseUser?.id]);

  const isDismissed = useCallback((consultationId: string) => {
    return dismissedRef.current.has(consultationId) || window.location.pathname.startsWith('/video-call');
  }, []);

  useEffect(() => {
    if (!supabaseUser?.id || role !== 'patient') return;

    const channel = supabase
      .channel(`incoming-call-${supabaseUser.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const data = payload.payload as IncomingCallData;
        if (!isDismissed(data.consultationId)) {
          setIncomingCall(data);
        }
      })
      .subscribe();

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
            if (consultationId && !isDismissed(consultationId)) {
              setIncomingCall({
                consultationId,
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
  }, [supabaseUser?.id, role, isDismissed]);

  return { incomingCall, dismissCall };
}
