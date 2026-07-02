import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Film, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';

// Adjuntar videos existentes de Contenido Premium al congreso (cliente 2026-07-02).
// Cada doctor puede adjuntar SUS videos; los managers del congreso (organizador/
// líder/admin) pueden adjuntar el de cualquier doctor. Permisos en el RPC
// set_recording_congress (el dueño del video queda como conferencista al adjuntar).

interface RecordingRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number;
  doctor_id: string;
  congress_id: string | null;
  doctorName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  congressId: string;
  canManage: boolean;
  onChanged: () => void;
}

export function AttachRecordingsDialog({ open, onOpenChange, congressId, canManage, onChanged }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchRows = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Míos + los ya adjuntados a este congreso; managers además buscan en todo el catálogo.
      const base = 'id, title, thumbnail_url, duration, doctor_id, congress_id';
      const queries: PromiseLike<any>[] = [
        (supabase as any).from('recordings').select(base).eq('doctor_id', user.id).order('created_at', { ascending: false }).limit(50),
        (supabase as any).from('recordings').select(base).eq('congress_id', congressId).order('created_at', { ascending: false }).limit(100),
      ];
      if (canManage && search.trim().length >= 2) {
        queries.push((supabase as any).from('recordings').select(base).ilike('title', `%${search.trim()}%`).order('created_at', { ascending: false }).limit(20));
      }
      const results = await Promise.all(queries);
      const seen = new Set<string>();
      const merged: RecordingRow[] = [];
      results.forEach(r => (r.data || []).forEach((row: RecordingRow) => {
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
      }));

      // Nombres de los dueños (los managers ven videos ajenos).
      const ownerIds = Array.from(new Set(merged.map(r => r.doctor_id)));
      if (ownerIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ownerIds);
        const names: Record<string, string> = {};
        (profs || []).forEach((p: any) => { names[p.id] = p.name; });
        merged.forEach(r => { r.doctorName = names[r.doctor_id]; });
      }

      // Los de este congreso primero, luego los míos libres.
      merged.sort((a, b) => Number(b.congress_id === congressId) - Number(a.congress_id === congressId));
      setRows(merged);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, congressId, canManage, search]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(fetchRows, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, fetchRows]);

  const setCongress = async (rec: RecordingRow, attach: boolean) => {
    setBusyId(rec.id);
    try {
      const { error } = await (supabase.rpc as any)('set_recording_congress', {
        p_recording_id: rec.id,
        p_congress_id: attach ? congressId : null,
      });
      if (error) throw error;
      toast.success(attach ? t('congresses.attachOk') : t('congresses.detachOk'));
      await fetchRows();
      onChanged();
    } catch (error: any) {
      toast.error(error.message || t('congresses.attachError'));
    } finally {
      setBusyId(null);
    }
  };

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            {t('congresses.attachDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {canManage ? t('congresses.attachDialogHintManager') : t('congresses.attachDialogHintOwner')}
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('congresses.attachSearchPlaceholder')}
              className="pl-8 text-sm"
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8">
            <Film className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('congresses.attachEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(rec => {
              const attachedHere = rec.congress_id === congressId;
              const attachedElsewhere = !!rec.congress_id && !attachedHere;
              return (
                <div key={rec.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <div className="w-20 aspect-video rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
                    {rec.thumbnail_url ? (
                      <img src={rec.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <Film className="w-4 h-4 text-primary/50" />
                      </div>
                    )}
                    {rec.duration > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] leading-none bg-black/75 text-white px-1 py-0.5 rounded">
                        {fmtDuration(rec.duration)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-snug">{rec.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {rec.doctorName && rec.doctor_id !== user?.id && (
                        <span className="text-[11px] text-muted-foreground truncate">{rec.doctorName}</span>
                      )}
                      {attachedHere && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
                          <Check className="w-2.5 h-2.5" />
                          {t('congresses.attachedHere')}
                        </Badge>
                      )}
                      {attachedElsewhere && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">{t('congresses.attachedElsewhere')}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {attachedHere ? (
                      <Button
                        size="sm" variant="outline"
                        className="h-8 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                        disabled={busyId === rec.id}
                        onClick={() => setCongress(rec, false)}
                      >
                        {busyId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        {t('congresses.detach')}
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={busyId === rec.id}
                        onClick={() => setCongress(rec, true)}
                      >
                        {busyId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {t('congresses.attach')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
