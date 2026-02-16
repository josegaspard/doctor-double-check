import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BBgikQLw0EJq_Hq81I_dMU2I559XWbbqegAsMMEHOj4O8F5bvdfnkCYvMrSRVoUhWW8rlfVtcqb-298hnztAd3I';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { supabaseUser } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
    
    setIsLoading(false);
  }, []);

  // Check if user is already subscribed
  useEffect(() => {
    if (!isSupported || !supabaseUser?.id) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();
        
        if (subscription) {
          // Check if this subscription exists in our database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', supabaseUser.id)
            .eq('endpoint', subscription.endpoint)
            .single();
          
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [isSupported, supabaseUser?.id]);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!isSupported) return null;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !supabaseUser?.id) {
      toast.error('Las notificaciones push no están disponibles');
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Permiso de notificaciones denegado');
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        toast.error('Error al registrar el Service Worker');
        setIsLoading(false);
        return false;
      }

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract keys
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        toast.error('Error al obtener las claves de suscripción');
        setIsLoading(false);
        return false;
      }

      // Save to database - delete existing and insert new
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', supabaseUser.id);

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: supabaseUser.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        });

      if (error) {
        console.error('Error saving subscription:', error);
        toast.error('Error al guardar la suscripción');
        setIsLoading(false);
        return false;
      }

      setIsSubscribed(true);
      toast.success('¡Notificaciones push activadas!');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Error al activar notificaciones push');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, supabaseUser?.id, registerServiceWorker]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !supabaseUser?.id) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', supabaseUser.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast.success('Notificaciones push desactivadas');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Error al desactivar notificaciones');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, supabaseUser?.id]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
