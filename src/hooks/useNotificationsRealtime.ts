import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function useNotificationsRealtime() {
  const { supabaseUser } = useAuth();
  const navigate = useNavigate();

  const handleNewNotification = useCallback((payload: any) => {
    const notification = payload.new;
    
    // Show toast based on notification type
    switch (notification.type) {
      case 'doctor_live':
        toast.info(notification.title, {
          description: notification.message,
          action: {
            label: 'Ver',
            onClick: () => {
              const liveId = notification.data?.liveId;
              if (liveId) navigate(`/live/${liveId}`);
            },
          },
          duration: 10000,
        });
        break;
        
      case 'new_content':
        toast.info(notification.title, {
          description: notification.message,
          duration: 5000,
        });
        break;
        
      case 'doctor_availability':
        toast.info(notification.title, {
          description: notification.message,
          duration: 5000,
        });
        break;
        
      case 'chat_message':
        toast(notification.title, {
          description: notification.message,
          action: {
            label: 'Abrir',
            onClick: () => navigate('/chat'),
          },
          duration: 8000,
        });
        break;

      case 'rating_request':
        toast.info(notification.title, {
          description: notification.message,
          action: {
            label: 'Calificar',
            onClick: () => navigate('/chat'),
          },
          duration: 15000,
        });
        break;
        
      default:
        toast(notification.title, {
          description: notification.message,
          duration: 5000,
        });
    }
  }, [navigate]);

  useEffect(() => {
    if (!supabaseUser?.id) return;

    // Subscribe to notifications table for this user
    const channel = supabase
      .channel(`notifications-${supabaseUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${supabaseUser.id}`,
        },
        handleNewNotification
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseUser?.id, handleNewNotification]);
}
