import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Plus, X, Loader2, CalendarDays, Clock, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

// Misma taxonomía que la de subir contenido (DoctorUpload).
const CONTENT_CATEGORIES = [
  'Alergología', 'Anestesiología', 'Angiología', 'Cardiología', 'Cirugía General',
  'Cirugía Plástica', 'Coloproctología', 'Dermatología', 'Endocrinología',
  'Gastroenterología', 'Geriatría', 'Ginecología', 'Hematología', 'Infectología',
  'Medicina Crítica', 'Medicina de Urgencias', 'Medicina del Deporte', 'Medicina Familiar',
  'Medicina Física y Rehabilitación', 'Medicina General', 'Medicina Interna',
  'Nefrología', 'Neonatología', 'Neumología', 'Neurología', 'Nutriología',
  'Oftalmología', 'Oncología', 'Ortopedia', 'Otorrinolaringología', 'Patología',
  'Pediatría', 'Psiquiatría', 'Radiología', 'Reumatología', 'Traumatología',
  'Urología',
  'Casos Clínicos', 'Explicaciones', 'Procedimientos', 'Conferencias',
  'Otro',
];

interface Session {
  session_number: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
}

interface Masterclass {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  creatorId: string;
  creatorName?: string;
  createdAt: string;
  moderationStatus: string;
  isPublic: boolean;
  fileUrl: string | null;
  sessions: Session[];
}

const emptySession = (n: number): Session => ({ session_number: n, title: '', scheduled_at: '', duration_minutes: 60 });

function fileType(file: File): 'video' | 'pdf' | 'image' | 'presentation' {
  const m = file.type;
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  return 'presentation';
}

export function MasterclassSection() {
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const canCreate = role === 'doctor' || role === 'admin' || role === 'resident';

  const [items, setItems] = useState<Masterclass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', category: '', isPublic: true });
  const [file, setFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<Session[]>([emptySession(1)]);

  const load = async () => {
    setLoading(true);
    // RLS restringe qué filas llegan; ordenamos por fecha desc.
    const { data } = await supabase
      .from('doctor_content')
      .select('id, title, description, category, creator_id, created_at, masterclass_sessions, moderation_status, is_public, file_url')
      .eq('is_masterclass', true)
      .order('created_at', { ascending: false });

    const rows = (data as any[]) || [];
    // Público aprobado + lo propio del usuario.
    const visible = rows.filter(r => r.moderation_status === 'approved' || r.creator_id === user?.id);

    const creatorIds = [...new Set(visible.map(r => r.creator_id))];
    const nameMap = new Map<string, string>();
    if (creatorIds.length) {
      const { data: profs } = await supabase.from('profiles_public').select('id, name').in('id', creatorIds);
      (profs || []).forEach((p: any) => nameMap.set(p.id, p.name));
    }

    setItems(visible.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      creatorId: r.creator_id,
      creatorName: nameMap.get(r.creator_id),
      createdAt: r.created_at,
      moderationStatus: r.moderation_status,
      isPublic: r.is_public,
      fileUrl: r.file_url ?? null,
      sessions: Array.isArray(r.masterclass_sessions) ? (r.masterclass_sessions as Session[]) : [],
    })));
    setLoading(false);
  };

  const [openingId, setOpeningId] = useState<string | null>(null);
  const openMaterial = async (m: Masterclass) => {
    if (!m.fileUrl) { toast.error(t('masterclassSection.noMaterial')); return; }
    setOpeningId(m.id);
    // Abrimos la pestaña de forma síncrona para no ser bloqueados por el popup blocker.
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('doctor-content').createSignedUrl(m.fileUrl, 3600);
    if (error || !data?.signedUrl) {
      if (tab) tab.close();
      toast.error(t('masterclassSection.materialError'));
      setOpeningId(null);
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    setOpeningId(null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const addSession = () => setSessions(prev => [...prev, emptySession(prev.length + 1)]);
  const removeSession = (i: number) =>
    setSessions(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, session_number: idx + 1 })));
  const patchSession = (i: number, patch: Partial<Session>) =>
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const resetForm = () => {
    setForm({ title: '', description: '', category: '', isPublic: true });
    setFile(null);
    setSessions([emptySession(1)]);
  };

  const submit = async () => {
    if (!user?.id || !form.title.trim() || !form.category || !file) return;
    const validSessions = sessions.filter(s => s.title.trim());
    if (validSessions.length === 0) {
      toast.error(t('masterclassSection.needSession'));
      return;
    }
    setSaving(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('doctor-content').upload(path, file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from('doctor_content').insert({
        creator_id: user.id,
        type: fileType(file),
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        is_public: form.isPublic,
        audience_type: 'all',
        file_url: path,
        is_masterclass: true,
        masterclass_sessions: validSessions as any,
      } as any);
      if (dbErr) throw dbErr;

      toast.success(t('masterclassSection.created'));
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || t('masterclassSection.createError'));
    } finally {
      setSaving(false);
    }
  };

  const fmtDateTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(language === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 text-xs rounded-xl px-3.5 py-2.5 bg-card border border-primary/20 border-l-4 border-l-primary shadow-md shadow-[#0b1d45]/15 flex-1">
          <span aria-hidden className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-[11px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #227787, #839ed5)' }}>🎓</span>
          <span className="leading-relaxed">
            <strong className="text-secondary font-semibold">{t('masterclassSection.calloutTitle')}</strong>{' '}
            <span className="text-muted-foreground">{t('masterclassSection.calloutBody')}</span>
          </span>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 min-h-[48px] bg-live hover:bg-live/90 text-white font-semibold shadow-lg shadow-live/30 sm:flex-shrink-0">
                <Plus className="w-5 h-5" />
                {t('masterclassSection.create')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('masterclassSection.newTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>{t('masterclassSection.fieldTitle')}</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('masterclassSection.titlePlaceholder')} />
                </div>
                <div>
                  <Label>{t('masterclassSection.fieldDescription')}</Label>
                  <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('masterclassSection.descriptionPlaceholder')} />
                </div>
                <div>
                  <Label>{t('masterclassSection.fieldCategory')}</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('masterclassSection.categoryPlaceholder')} /></SelectTrigger>
                    <SelectContent>{CONTENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('masterclassSection.fieldFile')}</Label>
                  <Input type="file" accept="image/*,application/pdf,video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-muted-foreground mt-1">{t('masterclassSection.fileHint')}</p>
                </div>

                {/* Sesiones programadas */}
                <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-sm font-medium">{t('masterclassSection.sessionsCount').replace('{count}', String(sessions.length))}</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={addSession}>
                      {t('masterclassSection.addSession')}
                    </Button>
                  </div>
                  {sessions.map((s, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-primary">{t('masterclassSection.sessionNumber').replace('{n}', String(i + 1))}</span>
                        {sessions.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 px-2 -mr-2" onClick={() => removeSession(i)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <Input placeholder={t('masterclassSection.sessionTitlePlaceholder')} value={s.title} onChange={e => patchSession(i, { title: e.target.value })} className="text-sm" />
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">{t('masterclassSection.sessionDateTime')}</Label>
                          <Input type="datetime-local" value={s.scheduled_at} onChange={e => patchSession(i, { scheduled_at: e.target.value })} className="text-sm w-full sm:w-48" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">{t('masterclassSection.sessionMinutes')}</Label>
                          <Input type="number" value={s.duration_minutes} onChange={e => patchSession(i, { duration_minutes: parseInt(e.target.value) || 60 })} className="text-sm w-full sm:w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="min-w-0 flex-1">
                    <Label>{t('masterclassSection.publicLabel')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('masterclassSection.publicHint')}</p>
                  </div>
                  <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))} className="flex-shrink-0" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t('masterclassSection.cancel')}</Button>
                <Button onClick={submit} disabled={saving || !form.title.trim() || !form.category || !file}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('masterclassSection.publish')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center border-primary/15">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-3 mx-auto">
            <GraduationCap className="w-8 h-8 text-primary" />
          </span>
          <p className="font-medium">{t('masterclassSection.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('masterclassSection.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {items.map(m => (
            <Card key={m.id} className="border-l-4 border-l-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary flex-shrink-0" />
                    {m.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {m.category && <Badge variant="outline" className="text-[10px]">{m.category}</Badge>}
                    {m.creatorId === user?.id && m.moderationStatus !== 'approved' && (
                      <Badge variant="secondary" className="text-[10px]">{t(`masterclassSection.status_${m.moderationStatus}`)}</Badge>
                    )}
                  </div>
                </div>
                {m.creatorName && <p className="text-xs text-muted-foreground">{m.creatorName}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                {m.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{m.description}</p>}
                {m.sessions.length > 0 && (
                  <div className="space-y-1.5">
                    {m.sessions.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary font-semibold text-[10px] flex-shrink-0">{i + 1}</span>
                        <span className="font-medium text-foreground truncate flex-1">{s.title || t('masterclassSection.sessionNumber').replace('{n}', String(i + 1))}</span>
                        {s.scheduled_at && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground flex-shrink-0">
                            <CalendarDays className="w-3 h-3" />{fmtDateTime(s.scheduled_at)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-muted-foreground flex-shrink-0">
                          <Clock className="w-3 h-3" />{s.duration_minutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {m.fileUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => openMaterial(m)}
                    disabled={openingId === m.id}
                  >
                    {openingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    {t('masterclassSection.viewMaterial')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default MasterclassSection;
