import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  userId: string;
  // Sincronizado con el enum notification_type de la BD (11 valores). Antes faltaban
  // recording_purchase/new_subscriber/payment_received/video_call → forzaba `as any`.
  type:
    | 'doctor_live' | 'doctor_availability' | 'new_content' | 'subscription_update'
    | 'chat_message' | 'rating_request' | 'system' | 'video_call'
    | 'recording_purchase' | 'new_subscriber' | 'payment_received';
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  notifyDoctorLive: boolean;
  notifyNewContent: boolean;
  notifyChatMessages: boolean;
}

export function useNotifications() {
  const { user, supabaseUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!supabaseUser?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const mapped = data.map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type as Notification['type'],
        title: n.title,
        message: n.message,
        data: (n.data as Record<string, any>) || {},
        isRead: n.is_read,
        createdAt: new Date(n.created_at),
      }));
      setNotifications(mapped);
      setUnreadCount(mapped.filter(n => !n.isRead).length);
    }
    setIsLoading(false);
  }, [supabaseUser?.id]);

  const fetchPreferences = useCallback(async () => {
    if (!supabaseUser?.id) return;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .maybeSingle();

    if (data) {
      setPreferences({
        id: data.id,
        userId: data.user_id,
        emailNotifications: data.email_notifications,
        pushNotifications: data.push_notifications,
        inAppNotifications: data.in_app_notifications,
        notifyDoctorLive: data.notify_doctor_live,
        notifyNewContent: data.notify_new_content,
        notifyChatMessages: data.notify_chat_messages,
      });
    } else if (!data && !error) {
      // No preferences found, create default
      const { data: newPrefs } = await supabase
        .from('notification_preferences')
        .insert({ user_id: supabaseUser.id })
        .select()
        .maybeSingle();

      if (newPrefs) {
        setPreferences({
          id: newPrefs.id,
          userId: newPrefs.user_id,
          emailNotifications: newPrefs.email_notifications,
          pushNotifications: newPrefs.push_notifications,
          inAppNotifications: newPrefs.in_app_notifications,
          notifyDoctorLive: newPrefs.notify_doctor_live,
          notifyNewContent: newPrefs.notify_new_content,
          notifyChatMessages: newPrefs.notify_chat_messages,
        });
      }
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    if (!supabaseUser?.id) {
      setIsLoading(false);
      return;
    }

    if (supabaseUser?.id) {
      // Fetch both in parallel
      Promise.all([fetchNotifications(), fetchPreferences()]);

      // Set up realtime subscription (unique channel per user to avoid conflicts with useNotificationsRealtime)
      const channel = supabase
        .channel(`notifications-list-${supabaseUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${supabaseUser.id}`,
          },
          (payload) => {
            const n = payload.new as any;
            const newNotification: Notification = {
              id: n.id,
              userId: n.user_id,
              type: n.type,
              title: n.title,
              message: n.message,
              data: n.data || {},
              isRead: n.is_read,
              createdAt: new Date(n.created_at),
            };
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Play notification sound
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1hZ2lncGRoaGRpY2JjYGRjYmNjYmJiYmJiYmJiYmJiYmJiYmFiYmJiYmJiYmJhYWBhYWFhYWFhYWFhYWFhYWFhYWFhYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYF9fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbWltbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1paWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWlpaWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWFlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFdXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVldWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQ==');
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch (e) {
              // Ignore audio errors
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser?.id]);

  const markAsRead = async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      // Revert on failure
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: false } : n))
      );
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAllAsRead = async () => {
    if (!supabaseUser?.id) return;

    // Optimistic update
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', supabaseUser.id)
      .eq('is_read', false);

    if (error) {
      // Revert on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const wasUnread = notifications.find(n => n.id === notificationId && !n.isRead);
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;

    await supabase
      .from('notifications')
      .delete()
      .in('id', notificationIds);

    const idsSet = new Set(notificationIds);
    const unreadDeleted = notifications.filter(n => idsSet.has(n.id) && !n.isRead).length;
    setNotifications(prev => prev.filter(n => !idsSet.has(n.id)));
    setUnreadCount(prev => Math.max(0, prev - unreadDeleted));
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!supabaseUser?.id || !preferences) return;

    const dbUpdates: Record<string, any> = {};
    if (updates.emailNotifications !== undefined) dbUpdates.email_notifications = updates.emailNotifications;
    if (updates.pushNotifications !== undefined) dbUpdates.push_notifications = updates.pushNotifications;
    if (updates.inAppNotifications !== undefined) dbUpdates.in_app_notifications = updates.inAppNotifications;
    if (updates.notifyDoctorLive !== undefined) dbUpdates.notify_doctor_live = updates.notifyDoctorLive;
    if (updates.notifyNewContent !== undefined) dbUpdates.notify_new_content = updates.notifyNewContent;
    if (updates.notifyChatMessages !== undefined) dbUpdates.notify_chat_messages = updates.notifyChatMessages;

    await supabase
      .from('notification_preferences')
      .update(dbUpdates)
      .eq('user_id', supabaseUser.id);

    setPreferences(prev => (prev ? { ...prev, ...updates } : null));
  };

  return {
    notifications,
    preferences,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotifications,
    updatePreferences,
    refresh: fetchNotifications,
  };
}
