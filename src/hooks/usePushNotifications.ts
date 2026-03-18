import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const VAPID_FALLBACK = 'BBgikQLw0EJq_Hq81I_dMU2I559XWbbqegAsMMEHOj4O8F5bvdfnkCYvMrSRVoUhWW8rlfVtcqb-298hnztAd3I';

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

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupported || !supabaseUser?.id) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
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
        console.error('Error checking push subscription:', error);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [isSupported, supabaseUser?.id]);

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
        toast.error('Permiso de notificaciones denegado. Habilítalo en los ajustes de tu navegador.');
        setIsLoading(false);
        return false;
      }

      // Register service worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      } catch (swError) {
        console.error('Service Worker registration failed:', swError);
        toast.error('Error al registrar el Service Worker. Intenta recargar la página.');
        setIsLoading(false);
        return false;
      }

      let subscription: PushSubscription;
      try {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      } catch (pushError: any) {
        console.error('PushManager.subscribe failed:', pushError);
        toast.error(`Error al suscribirse: ${pushError.message || 'Intenta de nuevo'}`);
        setIsLoading(false);
        return false;
      }

      // Extract keys
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        toast.error('Error al obtener las claves de suscripción');
        setIsLoading(false);
        return false;
      }

      // Save to database
      await supabase.from('push_subscriptions').delete().eq('user_id', supabaseUser.id);

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({ user_id: supabaseUser.id, endpoint: subscription.endpoint, p256dh, auth });

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
    } catch (error: any) {
      console.error('Push subscribe error:', error);
      toast.error(`Error: ${error.message || 'No se pudieron activar las notificaciones'}`);
      setIsLoading(false);
      return false;
    }
  }, [isSupported, supabaseUser?.id]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !supabaseUser?.id) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
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

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
