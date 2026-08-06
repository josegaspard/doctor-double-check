import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CongressCreateDialog } from '@/components/congresses/CongressCreateDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Loader2, Presentation, CalendarDays, Radio, Film, Video } from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import {
  Congress, CongressSpeaker, congressPhase, congressPosterStyle,
  avatarTint, initialsOf, hydrateSpeakers,
} from '@/lib/congresses';

// Congresos (cliente 2026-07-02, rediseño mismo día): espacio propio, fuera de
// Lives y Reuniones. Tarjetas tipo póster con identidad visual por congreso.

interface CongressRow extends Congress {
  speakers: CongressSpeaker[];
  sessionsCount: number;
  recordingsCount: number;
  liveNow: boolean;
}

export default function Congresses() {
  const navigate = useNavigate();
  const { role, isAuthenticated } = useAuth();
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
      const [{ data: speakerRows }, { data: sessionRows }, { data: liveRows }, { data: recRows }] = await Promise.all([
        (supabase as any).from('congress_speakers').select('id, congress_id, user_id, is_lead').in('congress_id', ids),
        (supabase as any).from('clinical_sessions').select('id, congress_id').in('congress_id', ids),
        (supabase as any).from('lives').select('id, congress_id, status').in('congress_id', ids),
        // Vista pública en vez de la tabla: `recordings` no tiene GRANT de SELECT
        // para `anon` (revocado a propósito en el endurecimiento del 11-jul), así
        // que consultarla sin sesión devolvía 401 y el contador de grabaciones
        // salía en 0 para todo visitante. Con la vista sale bien para todos.
        // (Auditoría 2026-08-05)
        (supabase as any).from('recordings_public').select('id, congress_id').in('congress_id', ids),
      ]);

      const speakers = await hydrateSpeakers((speakerRows as CongressSpeaker[]) || []);
      const speakersByCongress: Record<string, CongressSpeaker[]> = {};
      speakers.forEach(s => { (speakersByCongress[s.congress_id] ||= []).push(s); });

      const count = (arr: any[] | null) => {
        const m: Record<string, number> = {};
        (arr || []).forEach(r => { m[r.congress_id] = (m[r.congress_id] || 0) + 1; });
        return m;
      };
      const sessionCounts = count(sessionRows as any[]);
      const liveCounts = count(liveRows as any[]);
      const recCounts = count(recRows as any[]);
      const liveNowSet = new Set(((liveRows as any[]) || []).filter(l => l.status === 'live').map(l => l.congress_id));

      setCongresses(list.map(c => ({
        ...c,
        speakers: (speakersByCongress[c.id] || []).sort((a, b) => Number(b.is_lead) - Number(a.is_lead)),
        sessionsCount: (sessionCounts[c.id] || 0) + (liveCounts[c.id] || 0),
        recordingsCount: recCounts[c.id] || 0,
        liveNow: liveNowSet.has(c.id),
      })));
    } catch (error) {
      console.error('Error fetching congresses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCongresses();
  }, [fetchCongresses]);

  const active = congresses.filter(c => congressPhase(c) === 'active');
  const upcoming = congresses.filter(c => congressPhase(c) === 'upcoming')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const archived = congresses.filter(c => congressPhase(c) === 'archived');

  // Pestaña activa CONTROLADA: elige una no-vacía tras cargar (antes defaultValue se
  // fijaba en el primer render con isLoading=true → siempre 'active', dejando al usuario
  // en una pestaña vacía si solo había próximos/archivados).
  const [tab, setTab] = useState<'active' | 'upcoming' | 'archived'>('active');
  const [tabInit, setTabInit] = useState(false);
  useEffect(() => {
    if (isLoading || tabInit) return;
    setTabInit(true);
    setTab(active.length > 0 ? 'active' : upcoming.length > 0 ? 'upcoming' : archived.length > 0 ? 'archived' : 'active');
  }, [isLoading, tabInit, active.length, upcoming.length, archived.length]);

  const dateRange = (c: Congress) => {
    const s = new Date(`${c.starts_at}T12:00:00`);
    const e = new Date(`${c.ends_at}T12:00:00`);
    if (c.starts_at === c.ends_at) return format(s, 'd MMMM yyyy', { locale });
    return `${format(s, 'd MMM', { locale })} – ${format(e, 'd MMM yyyy', { locale })}`;
  };

  const CongressCard = ({ c }: { c: CongressRow }) => {
    const phase = congressPhase(c);
    return (
      <button
        onClick={() => navigate(`/congreso/${c.id}`)}
        className="group text-left rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-lg transition-shadow duration-200"
      >
        {/* Póster: identidad visual propia + título dentro del banner */}
        <div className="relative h-40 sm:h-44" style={congressPosterStyle(c)}>
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(120% 90% at 85% -10%, rgba(255,255,255,0.14) 0%, transparent 55%), linear-gradient(to top, rgba(8,20,45,0.72) 0%, rgba(8,20,45,0.12) 55%, transparent 100%)' }}
          />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {c.liveNow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-live text-white text-[11px] font-semibold px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                {t('congresses.liveNow')}
              </span>
            ) : phase === 'upcoming' ? (
              <span className="rounded-full bg-white/15 text-white text-[11px] font-medium px-2.5 py-1 backdrop-blur-sm">{t('congresses.statusUpcoming')}</span>
            ) : phase === 'archived' ? (
              <span className="rounded-full bg-white/15 text-white/90 text-[11px] font-medium px-2.5 py-1 backdrop-blur-sm">{t('congresses.statusArchived')}</span>
            ) : (
              <span className="rounded-full bg-white/15 text-white text-[11px] font-medium px-2.5 py-1 backdrop-blur-sm">{t('congresses.statusActive')}</span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {dateRange(c)}
            </p>
            <h3 className="font-heading text-lg sm:text-xl font-bold text-white leading-snug line-clamp-2 mt-1">
              {c.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center min-w-0">
            <div className="flex -space-x-2.5">
              {c.speakers.slice(0, 5).map(s => (
                <Avatar key={s.user_id} className="w-8 h-8 border-2 border-card">
                  {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.name || ''} />}
                  <AvatarFallback className="text-[10px] font-semibold text-white" style={{ backgroundColor: avatarTint(s.name || s.user_id) }}>
                    {initialsOf(s.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {c.speakers.length > 5 && (
                <span className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  +{c.speakers.length - 5}
                </span>
              )}
            </div>
            <span className="ml-2.5 text-xs text-muted-foreground truncate">
              {t('congresses.speakersCount').replace('{n}', String(c.speakers.length))}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" />{c.sessionsCount}</span>
            <span className="inline-flex items-center gap-1"><Film className="w-3.5 h-3.5" />{c.recordingsCount}</span>
          </div>
        </div>
      </button>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-14 col-span-full rounded-2xl bg-card border border-dashed border-border">
      <Presentation className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
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
      <div className="flex items-center justify-center py-14 col-span-full">
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Presentation className="w-6 h-6 text-primary" />
              {t('congresses.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{t('congresses.subtitle')}</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} className="gap-2 flex-shrink-0" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('congresses.create')}</span>
              <span className="sm:hidden">{t('congresses.createShort')}</span>
            </Button>
          )}
        </div>

        {/* Cómo funciona — responde "¿dónde creo y cómo agrego todo?" (Jose 2026-07-02) */}
        {canCreate && (
          <div className="mt-4 rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs font-semibold text-foreground mb-2">{t('congresses.howTitle')}</p>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-1.5">
              {[t('congresses.howStep1'), t('congresses.howStep2'), t('congresses.howStep3')].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-snug">
                  <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-px">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'upcoming' | 'archived')} className="space-y-4 mt-5">
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

          <TabsContent value="active" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderGrid(active, t('congresses.emptyActive'))}
          </TabsContent>
          <TabsContent value="upcoming" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderGrid(upcoming, t('congresses.emptyUpcoming'))}
          </TabsContent>
          <TabsContent value="archived" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
