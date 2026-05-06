import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const externalSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}

export function AddPatientModal({ open, onOpenChange, onAdded }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'registered' | 'external'>('registered');

  // Search registered
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // External
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extNotes, setExtNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    if (!term.trim() || term.trim().length < 2) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_patients_for_doctor', {
        p_term: term.trim(),
        p_limit: 10,
      });
      if (error) throw error;
      setResults(data || []);
    } catch (e: any) {
      toast.error(e.message || 'Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (patientId: string, patientName: string) => {
    if (!user?.id) return;
    try {
      // Send a notification inviting the patient to grant vault access
      const { error } = await supabase.from('notifications').insert({
        user_id: patientId,
        type: 'system' as any,
        title: '🩺 Un médico solicita acceso a tu expediente',
        message: 'Para iniciar tu seguimiento, autoriza el acceso desde tu Vault.',
        data: { doctor_id: user.id, action: 'request_vault_access' },
      });
      if (error) throw error;
      toast.success(`Invitación enviada a ${patientName}`);
      onAdded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo enviar la invitación');
    }
  };

  const handleAddExternal = async () => {
    if (!user?.id) return;
    const parsed = externalSchema.safeParse({
      full_name: extName,
      email: extEmail || undefined,
      phone: extPhone || undefined,
      notes: extNotes || undefined,
    });
    if (!parsed.success) {
      toast.error('Revisa los datos: nombre obligatorio, email válido si se incluye.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('external_patients' as any).insert({
        doctor_id: user.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
      });
      if (error) throw error;
      toast.success('Paciente externo agregado');
      setExtName(''); setExtEmail(''); setExtPhone(''); setExtNotes('');
      onAdded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Agregar paciente</DialogTitle>
          <DialogDescription>
            Invita a un paciente registrado para que te dé acceso a su expediente, o registra uno externo (offline).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="registered">Registrado</TabsTrigger>
            <TabsTrigger value="external">Externo</TabsTrigger>
          </TabsList>

          <TabsContent value="registered" className="space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="Buscar por nombre o correo"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                maxLength={100}
              />
              <Button onClick={handleSearch} disabled={searching || term.trim().length < 2}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {results.length === 0 && !searching && (
                <p className="text-xs text-muted-foreground italic text-center py-4">Escribe al menos 2 caracteres y presiona buscar.</p>
              )}
              {results.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-border hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleInvite(r.user_id, r.name || 'Paciente')}>Invitar</Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input value={extName} onChange={e => setExtName(e.target.value)} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input value={extEmail} onChange={e => setExtEmail(e.target.value)} maxLength={255} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={extPhone} onChange={e => setExtPhone(e.target.value)} maxLength={30} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Input value={extNotes} onChange={e => setExtNotes(e.target.value)} maxLength={500} placeholder="Diagnóstico inicial, observaciones..." />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleAddExternal} disabled={saving || !extName.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Guardar paciente
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
