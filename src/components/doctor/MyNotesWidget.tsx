import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { NotebookPen, Loader2, Trash2, Paperclip, X, FileText, ImageIcon, Mail } from 'lucide-react';
import { compressImageIfNeeded, withTimeout } from '@/lib/imageUpload';
import { z } from 'zod';

interface Attachment {
  path: string;       // ruta dentro del bucket doctor-content
  name: string;
  size: number;
  type: string;
  isImage: boolean;
}

interface DoctorNote {
  id: string;
  content: string;
  created_at: string;
  attachments?: Attachment[] | null;
}

const noteSchema = z.object({
  content: z.string().trim().min(1, 'La nota no puede estar vacía').max(2000, 'Máximo 2000 caracteres'),
});

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB por archivo
const MAX_FILES_PER_NOTE = 5;

export function MyNotesWidget() {
  const { supabaseUser } = useAuth();
  const doctorId = supabaseUser?.id;
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // URLs firmadas por path para previews
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  const load = async () => {
    if (!doctorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('doctor_notes' as any)
      .select('id, content, created_at, attachments')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) console.error('[MyNotesWidget] load error:', error);
    const list = (data as unknown as DoctorNote[]) || [];
    setNotes(list);

    // Firma URLs de attachments
    const paths = list.flatMap(n => (n.attachments || []).map(a => a.path));
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from('doctor-content').createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (signed || []).forEach((s: any) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setSignedMap(map);
    } else {
      setSignedMap({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doctorId]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (pending.length + files.length > MAX_FILES_PER_NOTE) {
      toast.error(`Máximo ${MAX_FILES_PER_NOTE} archivos por nota`);
      return;
    }
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} excede 10MB`);
        continue;
      }
      valid.push(f);
    }
    setPending(prev => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePending = (idx: number) => setPending(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const parsed = noteSchema.safeParse({ content: draft });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!doctorId) {
      toast.error('Sesión expirada. Recarga la página.');
      return;
    }
    setSaving(true);
    try {
      // 1) Upload archivos al bucket doctor-content/${doctorId}/notes/${ts}-${safeName}
      const ts = Date.now();
      const uploaded: Attachment[] = [];
      for (const rawFile of pending) {
        const f = await compressImageIfNeeded(rawFile);
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${doctorId}/notes/${ts}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
        const { error: upErr } = await withTimeout(
          supabase.storage.from('doctor-content').upload(path, f, { contentType: f.type, upsert: false }),
          60_000,
          `subida de ${f.name}`,
        );
        if (upErr) throw upErr;
        uploaded.push({
          path,
          name: f.name,
          size: f.size,
          type: f.type,
          isImage: f.type.startsWith('image/'),
        });
      }

      // 2) Insert nota con attachments
      const { error } = await supabase
        .from('doctor_notes' as any)
        .insert({
          doctor_id: doctorId,
          content: parsed.data.content,
          attachments: uploaded,
        });

      if (error) {
        // Cleanup archivos si falla el insert
        if (uploaded.length > 0) {
          await supabase.storage.from('doctor-content').remove(uploaded.map(u => u.path));
        }
        throw error;
      }

      setDraft('');
      setPending([]);
      toast.success('Nota guardada');
      load();
    } catch (err: any) {
      console.error('[MyNotesWidget] save error:', err);
      if (err.code === '23503') toast.error('Tu perfil no está completo. Termina el onboarding primero.');
      else if (err.code === '42501' || err.message?.toLowerCase().includes('row-level security')) toast.error('Permisos insuficientes (RLS). Verifica tu sesión.');
      else toast.error(`No se pudo guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const emailNote = async (n: DoctorNote) => {
    const to = prompt('Email destinatario (paciente, colega o tu propio correo):');
    if (!to) return;
    const trimmed = to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Email inválido');
      return;
    }
    try {
      const subject = 'Nota clínica — Medical Masters';
      const created = new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      const attachmentsList = (n.attachments && n.attachments.length > 0)
        ? '\n\nAdjuntos referenciados:\n' + n.attachments.map(a => `• ${a.name}`).join('\n')
        : '';
      const body = `Nota guardada el ${created}\n\n${n.content}${attachmentsList}\n\n— Enviado desde Medical Masters`;
      const { error } = await supabase.functions.invoke('send-doctor-note', {
        body: { to: trimmed, subject, body, noteId: n.id },
      });
      if (error) throw error;
      toast.success('Nota enviada por email');
    } catch (err: any) {
      // Fallback: open the user's mail client
      const subject = encodeURIComponent('Nota clínica — Medical Masters');
      const body = encodeURIComponent(`${n.content}\n\n— Medical Masters`);
      window.location.href = `mailto:${trimmed}?subject=${subject}&body=${body}`;
      toast.message('Abriendo tu cliente de correo (servicio de email no configurado).');
    }
  };

  const remove = async (n: DoctorNote) => {
    if (!confirm('¿Eliminar esta nota? También se borrarán los archivos adjuntos.')) return;
    try {
      if (n.attachments && n.attachments.length > 0) {
        await supabase.storage.from('doctor-content').remove(n.attachments.map(a => a.path));
      }
      const { error } = await supabase.from('doctor_notes' as any).delete().eq('id', n.id);
      if (error) throw error;
      setNotes(prev => prev.filter(x => x.id !== n.id));
      toast.success('Nota eliminada');
    } catch (err: any) {
      toast.error(`No se pudo eliminar: ${err.message}`);
    }
  };

  const fmtBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <NotebookPen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Mis notas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Escribe una nota rápida (privada)..."
          rows={3}
          maxLength={2000}
          className="text-sm"
        />

        {/* Pending attachments preview */}
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map((f, i) => (
              <div key={i} className="relative flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs">
                {f.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-primary" /> : <FileText className="w-3.5 h-3.5 text-primary" />}
                <span className="truncate max-w-[140px]">{f.name}</span>
                <span className="text-muted-foreground text-[10px]">({fmtBytes(f.size)})</span>
                <button type="button" onClick={() => removePending(i)} className="text-destructive hover:text-destructive/70" aria-label="Quitar">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => fileRef.current?.click()} disabled={saving || pending.length >= MAX_FILES_PER_NOTE}>
            <Paperclip className="w-4 h-4" />
            Adjuntar
            {pending.length > 0 && <span className="text-[10px] text-muted-foreground">({pending.length}/{MAX_FILES_PER_NOTE})</span>}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            className="hidden"
            onChange={handleFilePick}
          />
          <Button size="sm" onClick={save} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar nota'}
          </Button>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Cargando...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no tienes notas.</p>
          ) : notes.map(n => (
            <div key={n.id} className="group flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap break-words">{n.content}</p>

                {/* Attachments */}
                {n.attachments && n.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {n.attachments.map((a, i) => {
                      const url = signedMap[a.path];
                      if (a.isImage && url) {
                        return (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={url} alt={a.name} className="h-16 w-16 object-cover rounded-md border border-border hover:border-primary transition-colors" />
                          </a>
                        );
                      }
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded-md text-xs hover:border-primary/40 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span className="truncate max-w-[160px]">{a.name}</span>
                          <span className="text-[10px] text-muted-foreground">({fmtBytes(a.size)})</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => emailNote(n)}
                  aria-label="Enviar nota por email"
                  title="Enviar por email"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => remove(n)}
                  aria-label="Eliminar nota"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
