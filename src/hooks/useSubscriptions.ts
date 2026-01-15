import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface Subscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  creatorName?: string;
  creatorAvatar?: string;
  tier: SubscriptionTier;
  pricePaid: number;
  isActive: boolean;
  notifyOnLive: boolean;
  notifyOnContent: boolean;
  notifyOnAvailability: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export function useSubscriptions() {
  const { supabaseUser } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    if (!supabaseUser?.id) return;

    // Fetch subscriptions where user is subscriber
    const { data: mySubscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('subscriber_id', supabaseUser.id)
      .eq('is_active', true);

    if (mySubscriptions) {
      // Fetch creator profiles
      const creatorIds = mySubscriptions.map(s => s.creator_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url')
        .in('id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setSubscriptions(
        mySubscriptions.map(s => ({
          id: s.id,
          subscriberId: s.subscriber_id,
          creatorId: s.creator_id,
          creatorName: profileMap.get(s.creator_id)?.name,
          creatorAvatar: profileMap.get(s.creator_id)?.avatar_url || undefined,
          tier: s.tier as SubscriptionTier,
          pricePaid: Number(s.price_paid),
          isActive: s.is_active,
          notifyOnLive: s.notify_on_live,
          notifyOnContent: s.notify_on_content,
          notifyOnAvailability: s.notify_on_availability,
          createdAt: new Date(s.created_at),
          expiresAt: s.expires_at ? new Date(s.expires_at) : undefined,
        }))
      );
    }

    // Fetch subscribers (where user is creator)
    const { data: mySubscribers } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('creator_id', supabaseUser.id)
      .eq('is_active', true);

    if (mySubscribers) {
      const subscriberIds = mySubscribers.map(s => s.subscriber_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url')
        .in('id', subscriberIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setSubscribers(
        mySubscribers.map(s => ({
          id: s.id,
          subscriberId: s.subscriber_id,
          creatorId: s.creator_id,
          creatorName: profileMap.get(s.subscriber_id)?.name,
          creatorAvatar: profileMap.get(s.subscriber_id)?.avatar_url || undefined,
          tier: s.tier as SubscriptionTier,
          pricePaid: Number(s.price_paid),
          isActive: s.is_active,
          notifyOnLive: s.notify_on_live,
          notifyOnContent: s.notify_on_content,
          notifyOnAvailability: s.notify_on_availability,
          createdAt: new Date(s.created_at),
          expiresAt: s.expires_at ? new Date(s.expires_at) : undefined,
        }))
      );
    }

    setIsLoading(false);
  }, [supabaseUser?.id]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const subscribe = async (
    creatorId: string,
    tier: SubscriptionTier = 'free',
    pricePaid: number = 0
  ) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: supabaseUser.id,
      creator_id: creatorId,
      tier,
      price_paid: pricePaid,
      is_active: true,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await fetchSubscriptions();
    return { success: true };
  };

  const unsubscribe = async (creatorId: string) => {
    if (!supabaseUser?.id) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('subscriber_id', supabaseUser.id)
      .eq('creator_id', creatorId);

    if (error) {
      return { success: false, error: error.message };
    }

    await fetchSubscriptions();
    return { success: true };
  };

  const updateNotificationPrefs = async (
    subscriptionId: string,
    prefs: { notifyOnLive?: boolean; notifyOnContent?: boolean; notifyOnAvailability?: boolean }
  ) => {
    const updates: Record<string, boolean> = {};
    if (prefs.notifyOnLive !== undefined) updates.notify_on_live = prefs.notifyOnLive;
    if (prefs.notifyOnContent !== undefined) updates.notify_on_content = prefs.notifyOnContent;
    if (prefs.notifyOnAvailability !== undefined) updates.notify_on_availability = prefs.notifyOnAvailability;

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId);

    if (error) {
      return { success: false, error: error.message };
    }

    await fetchSubscriptions();
    return { success: true };
  };

  const isSubscribedTo = (creatorId: string) => {
    return subscriptions.some(s => s.creatorId === creatorId && s.isActive);
  };

  const getSubscription = (creatorId: string) => {
    return subscriptions.find(s => s.creatorId === creatorId && s.isActive);
  };

  return {
    subscriptions,
    subscribers,
    subscriberCount: subscribers.length,
    isLoading,
    subscribe,
    unsubscribe,
    updateNotificationPrefs,
    isSubscribedTo,
    getSubscription,
    refresh: fetchSubscriptions,
  };
}
