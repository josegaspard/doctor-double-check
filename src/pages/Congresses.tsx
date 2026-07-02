import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CongressCreateDialog } from '@/components/congresses/CongressCreateDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Loader2, Presentation, CalendarDays, Users, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Congress, CongressSpeaker, congressPhase, hydrateSpeakers } from '@/lib/congresses';

// Congresos (cliente 2026-07-02): espacio propio, fuera de Lives y Reuniones.
// Serie de conferencias de varios doctores en un rango de fechas; se ven en vivo
// y al terminar quedan archivadas aquí y en los perfiles de los conferencistas.

interface CongressRow extends Congress {
  speakers: CongressSpeaker[];
  sessionsCount: number;
  liveNow: boolean;
}

export default function Congresses() {
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [congresses, setCongresses] = useState<CongressRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const canCreate = isAuthenticated && ['doctor', 'resident', 'admin'].includes(role || '');

  const fetchCongresses = useCallback(async () => {
    try {
      const { data: rows } = await (supabase as any)
        .from('congresses')
        .select('id, organizer_id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at')
        .order('starts_at', { ascending: false })
        .limit(200);
      const list = (rows as Congress[]) || [];
      if (list.length === 0) { setCongresses([]); return; }

      const ids = list.map(c => c.id);
      const [{ data: speakerRows }, { data: sessionRows }, { data: liveRows }] = await Promise.all([
        (supabase as any).from('congress_speakers').select('id, congress_id, user_id, is_lead').in('congress_id', ids),
        (supabase as any).from('clinical_sessions').select('id, congress_id').in('congress_id', ids),
        (supabase as any).from('lives').select('id, congress_id, status').in('congress_id', ids),
      ]);

      const speakers = await hydrateSpeakers((speakerRows as CongressSpeaker[]) || []);
      const speakersByCongress: Record<string, CongressSpeaker[]> = {};
      speakers.forEach(s => {
        (speakersByCongress[s.congress_id] ||= []).push(s);
      });

      const sessionsByCongress: Record<string, number> = {};
      ((sessionRows as any[]) || []).forEach(s => { sessionsByCongress[s.congress_id] = (sessionsByCongress[s.congress_id] || 0) + 1; });
      ((liveRows as any[]) || []).forEach(l => { sessionsByCongress[l.congress_id] = (sessionsByCongress[l.congress_id] || 0) + 1; });

      const liveNowSet = new Set(((liveRows as any[]) || []).filter(l => l.status === 'live').map(l => l.congress_id));

      setCongresses(list.map(c => ({
        ...c,
        speakers: (speakersByCongress[c.id] || []).sort((a, b) => Number(b.is_lead) - Number(a.is_lead)),
        sessionsCount: sessionsByCongress[c.id] || 0,
        liveNow: liveNowSet.has(c.id),
      })));
    } catch (error) {
      console.error('Error fetching congresses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCongresses();
  }, [fetchCongresses]);

  const active = congresses.filter(c => congressPhase(c) === 'active');
  const upcoming = congresses.filter(c => congressPhase(c) === 'upcoming')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const archived = congresses.filter(c => congressPhase(c) === 'archived');

  const dateRange = (c: Congress) => {
    // starts_at/ends_at son date puras; anclar a mediodía evita el corrimiento de día por zona horaria.
    const s = new Date(`${c.starts_at}T12:00:00`);
    const e = new Date(`${c.ends_at}T12:00:00`);
    if (c.starts_at === c.ends_at) return format(s, 'd MMMM yyyy', { locale });
    return `${format(s, 'd MMM', { locale })} – ${format(e, 'd MMM yyyy', { locale })}`;
  };

  const CongressCard = ({ c }: { c: CongressRow }) => (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/congreso/${c.id}`)}
    >
      <div
        className="h-20 sm:h-24 relative"
        style={c.banner_url
          ? { backgroundImage: `url(${c.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(120deg, #163a83 0%, #227787 100%)' }}
      >
        {c.liveNow && (
          <Badge className="absolute top-2 left-2 bg-live text-white gap-1 animate-pulse">
            <Radio className="w-3 h-3" />
            {t('congresses.liveNow')}
          </Badge>
        )}
        {congressPhase(c) === 'archived' && (
          <Badge variant="secondary" className="absolute top-2 left-2">{t('congresses.statusArchived')}</Badge>
        )}
        <Presentation className="absolute right-3 bottom-2 w-8 h-8 text-white/25" />
      </div>
      <CardContent className="p-3 sm:p-4">
        <h3 className="font-heading font-bold text-sm sm:text-base line-clamp-2 leading-snug">{c.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {dateRange(c)}
          </span>
          {c.specialty && <Badge variant="outline" className="text-[10px] h-5">{c.specialty}</Badge>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {c.speakers.slice(0, 4).map(s => (
                <Avatar key={s.user_id} className="w-6 h-6 border-2 border-card">
                  {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.name || ''} />}
                  <AvatarFallback className="text-[9px]">{(s.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="ml-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t('congresses.speakersCount').replace('{n}', String(c.speakers.length))}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {t('congresses.sessionsCount').replace('{n}', String(c.sessionsCount))}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-12 col-span-full">
      <Presentation className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {canCreate && (
        <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          {t('congresses.create')}
        </Button>
      )}
    </div>
  );

  const renderGrid = (items: CongressRow[], emptyMessage: string) => (
    isLoading ? (
      <div className="flex items-center justify-center py-12 col-span-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ) : items.length > 0 ? (
      items.map(c => <CongressCard key={c.id} c={c} />)
    ) : (
      <EmptyState message={emptyMessage} />
    )
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Presentation className="w-6 h-6 text-primary" />
              {t('congresses.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('congresses.subtitle')}</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} className="gap-2 flex-shrink-0" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('congresses.create')}</span>
              <span className="sm:hidden">{t('congresses.createShort')}</span>
            </Button>
          )}
        </div>

        <Tabs defaultValue={active.length > 0 || isLoading ? 'active' : (upcoming.length > 0 ? 'upcoming' : 'archived')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="gap-1.5">
              {t('congresses.tabs.active')}
              {active.length > 0 && <Badge variant="secondary" className="text-xs">{active.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5">
              {t('congresses.tabs.upcoming')}
              {upcoming.length > 0 && <Badge variant="secondary" className="text-xs">{upcoming.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="archived">{t('congresses.tabs.archived')}</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderGrid(active, t('congresses.emptyActive'))}
          </TabsContent>
          <TabsContent value="upcoming" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderGrid(upcoming, t('congresses.emptyUpcoming'))}
          </TabsContent>
          <TabsContent value="archived" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderGrid(archived, t('congresses.emptyArchived'))}
          </TabsContent>
        </Tabs>

        <CongressCreateDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={fetchCongresses}
        />
      </div>
    </MainLayout>
  );
}
