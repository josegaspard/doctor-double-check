import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, User, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Subscriber {
  id: string;
  subscriberId: string;
  name: string;
  avatar?: string;
  tier: string;
  createdAt: Date;
}

interface SubscribersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
}

export function SubscribersModal({ open, onOpenChange, doctorId }: SubscribersModalProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !doctorId) return;

    const fetchSubscribers = async () => {
      setIsLoading(true);
      try {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, subscriber_id, tier, created_at')
          .eq('creator_id', doctorId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!subs || subs.length === 0) {
          setSubscribers([]);
          return;
        }

        const subscriberIds = subs.map(s => s.subscriber_id);
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', subscriberIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setSubscribers(subs.map(s => ({
          id: s.id,
          subscriberId: s.subscriber_id,
          name: profileMap.get(s.subscriber_id)?.name || 'Usuario',
          avatar: profileMap.get(s.subscriber_id)?.avatar_url || undefined,
          tier: s.tier,
          createdAt: new Date(s.created_at),
        })));
      } catch (err) {
        console.error('Error fetching subscribers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscribers();
  }, [open, doctorId]);

  const paidCount = subscribers.filter(s => s.tier === 'basic' || s.tier === 'premium').length;

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-warning/10 text-warning border-warning/30 gap-1"><Crown className="w-3 h-3" />Premium</Badge>;
      case 'basic':
        return <Badge variant="secondary" className="gap-1"><Crown className="w-3 h-3" />Básica</Badge>;
      default:
        return <Badge variant="outline">Gratis</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Suscriptores ({subscribers.length})
          </DialogTitle>
          {paidCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {paidCount} de pago · {subscribers.length - paidCount} gratuitos
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : subscribers.length > 0 ? (
            <div className="space-y-1">
              {subscribers.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={sub.avatar} />
                    <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Desde {format(sub.createdAt, 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  {getTierBadge(sub.tier)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no tienes suscriptores</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
