import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, Crown, Star } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';

interface Subscriber {
  subscriber_id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  tier: 'free' | 'basic' | 'premium';
  price_paid: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

export default function SubscribersList() {
  const { user, role } = useAuth();
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_subscribers' as any);
      if (error) console.error('subscribers error', error);
      setSubs((data || []) as Subscriber[]);
      setLoading(false);
    })();
  }, [user?.id]);

  if (role !== 'doctor' && role !== 'resident') {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
    );
  }, [subs, query]);

  const activeCount = subs.filter((s) => s.is_active).length;
  const premiumCount = subs.filter((s) => s.is_active && s.tier === 'premium').length;

  const tierBadge = (tier: Subscriber['tier']) => {
    if (tier === 'premium')
      return (
        <Badge className="gap-1 bg-warning hover:bg-warning/90">
          <Crown className="w-3 h-3" /> Premium
        </Badge>
      );
    if (tier === 'basic')
      return (
        <Badge variant="secondary" className="gap-1">
          <Star className="w-3 h-3" /> Básico
        </Badge>
      );
    return <Badge variant="outline">Gratis</Badge>;
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mis suscriptores</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} activos · {premiumCount} premium
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-11 text-base"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {query ? 'Sin resultados' : 'Aún no tienes suscriptores'}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((s) => (
                <li key={s.subscriber_id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={s.avatar_url || undefined} />
                    <AvatarFallback>
                      {(s.name || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-base truncate">{s.name || 'Sin nombre'}</p>
                      {tierBadge(s.tier)}
                      {!s.is_active && <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Desde {format(new Date(s.created_at), "d MMM yyyy", { locale: es })}
                      {s.expires_at && ` · vence ${format(new Date(s.expires_at), "d MMM yyyy", { locale: es })}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">
                      ${Number(s.price_paid).toLocaleString('es-MX')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">MXN</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
