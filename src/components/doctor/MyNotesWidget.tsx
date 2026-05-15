import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { NotebookPen, Loader2, Trash2 } from 'lucide-react';
import { z } from 'zod';

interface DoctorNote {
  id: string;
  content: string;
  created_at: string;
}

const noteSchema = z.object({
  content: z.string().trim().min(1, 'La nota no puede estar vacía').max(2000, 'Máximo 2000 caracteres'),
});

export function MyNotesWidget() {
  const { supabaseUser } = useAuth();
  const doctorId = supabaseUser?.id;
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!doctorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('doctor_notes' as any)
      .select('id, content, created_at')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) {
      console.error('[MyNotesWidget] load error:', error);
    }
    if (!error && data) setNotes(data as unknown as DoctorNote[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doctorId]);

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
    const { error } = await supabase
      .from('doctor_notes' as any)
      .insert({ doctor_id: doctorId, content: parsed.data.content });
    setSaving(false);
    if (error) {
      console.error('[MyNotesWidget] save error:', error);
      // Mensaje específico cuando falta perfil (FK violation contra profiles.id)
      if (error.code === '23503') {
        toast.error('Tu perfil no está completo. Termina el onboarding primero.');
      } else if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
        toast.error('Permisos insuficientes (RLS). Verifica tu sesión.');
      } else {
        toast.error(`No se pudo guardar la nota: ${error.message}`);
      }
      return;
    }
    setDraft('');
    toast.success('Nota guardada');
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('doctor_notes' as any).delete().eq('id', id);
    if (error) {
      console.error('[MyNotesWidget] delete error:', error);
      toast.error(`No se pudo eliminar: ${error.message}`);
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== id));
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
        <div className="flex justify-end">
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
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(n.id)}
                aria-label="Eliminar nota"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
