import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Stethoscope, UserPlus, X, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useSpecialties } from '@/hooks/useSpecialties';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { Congress, CongressSpeaker } from '@/lib/congresses';

// Crear/editar congreso (cliente 2026-07-02): contenedor de conferencias con
// rango de fechas y conferencistas. Los marcados como líder (estrella) pueden
// administrar el congreso y agregarle reuniones de cualquier doctor.

interface SpeakerDraft {
  userId: string;
  name: string;
  specialty?: string;
  isLead: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: { congress: Congress; speakers: CongressSpeaker[] } | null;
}

export function CongressCreateDialog({ open, onOpenChange, onSaved, editing }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { specialtiesList: SPECIALTIES } = useSpecialties();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!editing;

  const [form, setForm] = useState({
    title: '', description: '', specialty: '', startsAt: '', endsAt: '',
  });
  const [speakers, setSpeakers] = useState<SpeakerDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.congress.title || '',
        description: editing.congress.description || '',
        specialty: editing.congress.specialty || '',
        startsAt: editing.congress.starts_at || '',
        endsAt: editing.congress.ends_at || '',
      });
      setSpeakers(editing.speakers.map(s => ({
        userId: s.user_id,
        name: s.name || t('congresses.speakerFallback'),
        specialty: s.specialty,
        isLead: s.is_lead,
      })));
    } else {
      setForm({ title: '', description: '', specialty: '', startsAt: '', endsAt: '' });
      setSpeakers([]);
    }
  }, [open, editing?.congress?.id]);

  // Búsqueda de doctores/residentes (mismo patrón que MeetingCreateDialog).
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; specialty?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const { data: docProfiles } = await supabase
        .from('doctor_profiles')
        .select('user_id, specialty')
        .limit(200);
      const results: { id: string; name: string; specialty?: string }[] = [];
      if (docProfiles && docProfiles.length > 0) {
        const userIds = docProfiles.map(d => d.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds)
          .ilike('name', `%${searchQuery}%`)
          .limit(8);
        const specMap: Record<string, string> = {};
        docProfiles.forEach(d => { specMap[d.user_id] = d.specialty; });
        (profs || []).forEach(p => results.push({ id: p.id, name: p.name, specialty: specMap[p.id] }));
      }
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addSpeaker = (doc: { id: string; name: string; specialty?: string }) => {
    if (!speakers.find(s => s.userId === doc.id)) {
      setSpeakers(prev => [...prev, { userId: doc.id, name: doc.name, specialty: doc.specialty, isLead: false }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const toggleLead = (userId: string) => {
    setSpeakers(prev => prev.map(s => s.userId === userId ? { ...s, isLead: !s.isLead } : s));
  };

  const removeSpeaker = (userId: string) => {
    // El organizador no se quita a sí mismo desde el diálogo (siempre es líder).
    if (userId === user?.id) return;
    setSpeakers(prev => prev.filter(s => s.userId !== userId));
  };

  // Campanilla + push a los conferencistas nuevos (mismo patrón notifyInvitees).
  const notifyNewSpeakers = async (userIds: string[], congressId: string, congressTitle: string) => {
    const targets = userIds.filter(id => id !== user?.id);
    if (!targets.length) return;
    const title = t('congresses.notifyTitle');
    const message = t('congresses.notifyMessage').replace('{title}', congressTitle || '');
    try {
      const rows = targets.map(uid => ({
        user_id: uid,
        type: 'system' as const,
        title,
        message,
        data: { kind: 'congress_speaker', congress_id: congressId, deeplink: `/congreso/${congressId}` },
      }));
      const { error } = await supabase.from('notifications').insert(rows as any);
      if (error) console.error('Error notifying speakers (bell):', error);
      await supabase.functions.invoke('send-push-notification', {
        body: { user_ids: targets, title, body: message, url: `/congreso/${congressId}` },
      }).catch(() => {});
    } catch (e) {
      console.error('notifyNewSpeakers error:', e);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !user?.id) return;
    if (!form.startsAt || !form.endsAt) { toast.error(t('congresses.datesRequired')); return; }
    if (form.endsAt < form.startsAt) { toast.error(t('congresses.datesOrder')); return; }
    setIsSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        specialty: form.specialty || null,
        starts_at: form.startsAt,
        ends_at: form.endsAt,
      };

      let congressId = editing?.congress.id;
      if (isEditing && congressId) {
        const { error } = await (supabase as any)
          .from('congresses')
          .update(payload)
          .eq('id', congressId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from('congresses')
          .insert({ ...payload, organizer_id: user.id })
          .select('id')
          .single();
        if (error) throw error;
        congressId = data.id as string;
      }

      // Sincronizar conferencistas: el organizador siempre queda como líder.
      const draft = [...speakers];
      if (!draft.find(s => s.userId === (isEditing ? editing!.congress.organizer_id : user.id))) {
        const orgId = isEditing ? editing!.congress.organizer_id : user.id;
        draft.unshift({ userId: orgId, name: '', isLead: true });
      }
      const prevIds = new Set((editing?.speakers || []).map(s => s.user_id));
      const rows = draft.map(s => ({
        congress_id: congressId,
        user_id: s.userId,
        is_lead: s.isLead || s.userId === (isEditing ? editing!.congress.organizer_id : user.id),
        added_by: user.id,
      }));
      const { error: spError } = await (supabase as any)
        .from('congress_speakers')
        .upsert(rows, { onConflict: 'congress_id,user_id' });
      if (spError) throw spError;

      // Quitar los eliminados en el diálogo (solo en edición).
      if (isEditing) {
        const keep = new Set(draft.map(s => s.userId));
        const removed = (editing!.speakers || []).filter(s => !keep.has(s.user_id));
        for (const r of removed) {
          await (supabase as any).from('congress_speakers').delete().eq('id', r.id);
        }
      }

      const newSpeakerIds = draft.map(s => s.userId).filter(id => !prevIds.has(id));
      await notifyNewSpeakers(newSpeakerIds, congressId!, form.title.trim());

      toast.success(isEditing ? t('congresses.toastUpdated') : t('congresses.toastCreated'));
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast.error(error.message || t('congresses.toastError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('congresses.dialogEditTitle') : t('congresses.dialogNewTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium">{t('congresses.nameLabel')}</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('congresses.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">{t('congresses.startLabel')}</Label>
              <Input
                type="date"
                value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">{t('congresses.endLabel')}</Label>
              <Input
                type="date"
                value={form.endsAt}
                min={form.startsAt || undefined}
                onChange={e => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">{t('congresses.specialtyLabel')}</Label>
            <SearchableFilter
              options={SPECIALTIES}
              value={form.specialty}
              onChange={v => setForm({ ...form, specialty: v })}
              placeholder={t('congresses.specialtyPlaceholder')}
              searchPlaceholder={t('congresses.specialtySearchPlaceholder')}
              icon={Stethoscope}
              allLabel=""
            />
          </div>

          <div>
            <Label className="text-xs font-medium">{t('congresses.descriptionLabel')}</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={t('congresses.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* Conferencistas */}
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
              <UserPlus className="w-3.5 h-3.5" />
              {t('congresses.speakersLabel')}
            </Label>
            <p className="text-[11px] text-muted-foreground mb-2">{t('congresses.speakersHint')}</p>

            {speakers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {speakers.map(s => (
                  <Badge key={s.userId} variant="secondary" className="gap-1 text-xs pr-1">
                    <button
                      onClick={() => toggleLead(s.userId)}
                      title={t('congresses.lead')}
                      className={s.isLead || s.userId === user?.id ? 'text-premium' : 'text-muted-foreground/50 hover:text-premium'}
                      disabled={s.userId === user?.id}
                    >
                      <Star className="w-3 h-3" fill={(s.isLead || s.userId === user?.id) ? 'currentColor' : 'none'} />
                    </button>
                    {s.name || t('congresses.you')}
                    {s.specialty && <span className="opacity-60">· {s.specialty}</span>}
                    {s.userId !== user?.id && (
                      <button onClick={() => removeSpeaker(s.userId)} className="ml-0.5 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('congresses.searchSpeakers')}
                className="pl-8 text-sm"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-1 border border-border rounded-md bg-popover shadow-md max-h-40 overflow-y-auto">
                {searchResults.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => addSpeaker(doc)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span>{doc.name}</span>
                    {doc.specialty && (
                      <Badge variant="outline" className="text-[10px]">{doc.specialty}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || !form.title.trim() || !form.startsAt || !form.endsAt}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? t('congresses.saveChanges') : t('congresses.createAction')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
