import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CongressCreateDialog } from '@/components/congresses/CongressCreateDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Plus, Loader2, Presentation, Search, Eye, Archive,
  ArchiveRestore, Trash2, Pencil, Radio, CalendarDays, Users, Film,
} from 'lucide-react';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { Congress, CongressSpeaker, congressPhase, hydrateSpeakers } from '@/lib/congresses';

// Admin → Congresos (cliente 2026-07-02): el super admin ve TODOS los congresos
// y puede crearlos, editarlos, archivarlos o eliminarlos (RLS: admin siempre
// puede administrar vía can_manage_congress / política de DELETE).

interface AdminCongressRow extends Congress {
  speakers: CongressSpeaker[];
  sessionsCount: number;
  recordingsCount: number;
  liveNow: boolean;
  organizerName?: string;
}

export default function AdminCongresses() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [rows, setRows] = useState<AdminCongressRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<{ congress: Congress; speakers: CongressSpeaker[] } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const { data: cRows } = await (supabase as any)
        .from('congresses')
        .select('id, organizer_id, title, description, specialty, banner_url, starts_at, ends_at, status, created_at')
        .order('starts_at', { ascending: false })
        .limit(300);
      const list = (cRows as Congress[]) || [];
      if (list.length === 0) { setRows([]); return; }

      const ids = list.map(c => c.id);
      const [{ data: speakerRows }, { data: sessionRows }, { data: liveRows }, { data: recRows }, { data: orgProfiles }] = await Promise.all([
        (supabase as any).from('congress_speakers').select('id, congress_id, user_id, is_lead').in('congress_id', ids),
        (supabase as any).from('clinical_sessions').select('id, congress_id').in('congress_id', ids),
        (supabase as any).from('lives').select('id, congress_id, status').in('congress_id', ids),
        (supabase as any).from('recordings').select('id, congress_id').in('congress_id', ids),
        supabase.from('profiles').select('id, name').in('id', Array.from(new Set(list.map(c => c.organizer_id)))),
      ]);

      const speakers = await hydrateSpeakers((speakerRows as CongressSpeaker[]) || []);
      const byCongress: Record<string, CongressSpeaker[]> = {};
      speakers.forEach(s => { (byCongress[s.congress_id] ||= []).push(s); });

      const count = (arr: any[] | null) => {
        const m: Record<string, number> = {};
        (arr || []).forEach(r => { m[r.congress_id] = (m[r.congress_id] || 0) + 1; });
        return m;
      };
      const sessionCounts = count(sessionRows as any[]);
      const liveCounts = count(liveRows as any[]);
      const recCounts = count(recRows as any[]);
      const liveNowSet = new Set(((liveRows as any[]) || []).filter(l => l.status === 'live').map(l => l.congress_id));
      const orgNames: Record<string, string> = {};
      ((orgProfiles as any[]) || []).forEach(p => { orgNames[p.id] = p.name; });

      setRows(list.map(c => ({
        ...c,
        speakers: byCongress[c.id] || [],
        sessionsCount: (sessionCounts[c.id] || 0) + (liveCounts[c.id] || 0),
        recordingsCount: recCounts[c.id] || 0,
        liveNow: liveNowSet.has(c.id),
        organizerName: orgNames[c.organizer_id],
      })));
    } catch (error) {
      console.error('Error fetching admin congresses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleArchiveToggle = async (c: AdminCongressRow) => {
    const toArchived = c.status !== 'archived';
    if (toArchived && !window.confirm(t('congresses.confirmArchive'))) return;
    const { error } = await (supabase as any)
      .from('congresses')
      .update({ status: toArchived ? 'archived' : 'published' })
      .eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(toArchived ? t('congresses.archivedToast') : t('congresses.unarchivedToast'));
    fetchAll();
  };

  const handleDelete = async (c: AdminCongressRow) => {
    if (!window.confirm(t('congresses.confirmDelete'))) return;
    const { error } = await (supabase as any).from('congresses').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('congresses.deletedToast'));
    fetchAll();
  };

  const filtered = rows.filter(c =>
    !search.trim() || c.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  const phaseBadge = (c: Congress) => {
    const phase = congressPhase(c);
    if (phase === 'active') return <Badge className="bg-live text-white text-[10px]">{t('congresses.statusActive')}</Badge>;
    if (phase === 'upcoming') return <Badge variant="info" className="text-[10px]">{t('congresses.statusUpcoming')}</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{t('congresses.statusArchived')}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2" onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-4 h-4" />
          {t('congresses.adminBack')}
        </Button>

        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Presentation className="w-6 h-6 text-primary" />
              {t('congresses.adminTitle')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('congresses.adminSubtitle')}</p>
          </div>
          <Button onClick={() => { setEditing(null); setShowCreate(true); }} className="gap-2 flex-shrink-0" size="sm">
            <Plus className="w-4 h-4" />
            {t('congresses.createShort')}
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('congresses.adminSearchPlaceholder')}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Presentation className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('congresses.adminEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <Card key={c.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-sm sm:text-base leading-snug">{c.title}</p>
                        {phaseBadge(c)}
                        {c.liveNow && (
                          <Badge className="bg-live text-white text-[10px] gap-1 animate-pulse">
                            <Radio className="w-2.5 h-2.5" />
                            {t('congresses.liveNow')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {format(new Date(`${c.starts_at}T12:00:00`), 'd MMM', { locale })} – {format(new Date(`${c.ends_at}T12:00:00`), 'd MMM yyyy', { locale })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {t('congresses.speakersCount').replace('{n}', String(c.speakers.length))}
                        </span>
                        <span>{t('congresses.sessionsCount').replace('{n}', String(c.sessionsCount))}</span>
                        <span className="inline-flex items-center gap-1">
                          <Film className="w-3.5 h-3.5" />
                          {c.recordingsCount}
                        </span>
                        {c.organizerName && (
                          <span className="truncate">{t('congresses.adminOrganizer')}: {c.organizerName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => navigate(`/congreso/${c.id}`)}>
                      <Eye className="w-3.5 h-3.5" />
                      {t('congresses.adminView')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { setEditing({ congress: c, speakers: c.speakers }); setShowCreate(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                      {t('congresses.edit')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => handleArchiveToggle(c)}>
                      {c.status === 'archived'
                        ? <><ArchiveRestore className="w-3.5 h-3.5" />{t('congresses.unarchive')}</>
                        : <><Archive className="w-3.5 h-3.5" />{t('congresses.archive')}</>}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => handleDelete(c)}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('congresses.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <CongressCreateDialog
          open={showCreate}
          onOpenChange={(o) => { setShowCreate(o); if (!o) setEditing(null); }}
          onSaved={fetchAll}
          editing={editing}
        />
      </div>
    </MainLayout>
  );
}
