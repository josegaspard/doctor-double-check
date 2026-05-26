import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Crown, Star, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';

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
  const navigate = useNavigate();
  const { language } = useLanguage();
  const es = language === 'es';
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
        <Badge className="gap-1 bg-warning hover:bg-warning/90 text-white">
          <Crown className="w-3 h-3" /> Premium
        </Badge>
      );
    if (tier === 'basic')
      return (
        <Badge variant="secondary" className="gap-1">
          <Star className="w-3 h-3" /> {es ? 'Básico' : 'Basic'}
        </Badge>
      );
    return <Badge variant="outline">{es ? 'Gratis' : 'Free'}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button
          variant="back"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-3 -ml-2 text-white hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {es ? 'Volver' : 'Back'}
        </Button>

        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">
                {es ? 'Mis suscriptores' : 'My subscribers'}
              </h1>
              <p className="text-xs sm:text-sm text-secondary/70">
                {activeCount} {es ? 'activos' : 'active'} · {premiumCount} premium
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{es ? 'Lista' : 'List'}</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={es ? 'Buscar por nombre o email…' : 'Search by name or email…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-11 text-base"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{es ? 'Cargando…' : 'Loading…'}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {query ? (es ? 'Sin resultados' : 'No results') : (es ? 'Aún no tienes suscriptores' : 'No subscribers yet')}
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
                        <p className="font-medium text-base truncate">{s.name || (es ? 'Sin nombre' : 'No name')}</p>
                        {tierBadge(s.tier)}
                        {!s.is_active && <Badge variant="outline" className="text-muted-foreground">{es ? 'Inactivo' : 'Inactive'}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {es ? 'Desde' : 'Since'} {format(new Date(s.created_at), 'd MMM yyyy', { locale: esLocale })}
                        {s.expires_at && ` · ${es ? 'vence' : 'expires'} ${format(new Date(s.expires_at), 'd MMM yyyy', { locale: esLocale })}`}
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
    </MainLayout>
  );
}
