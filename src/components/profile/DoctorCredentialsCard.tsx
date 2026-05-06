import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Award, GraduationCap, Building2, FileCheck, Plus, X, Loader2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Workplace { name: string; type?: string }

interface CredentialData {
  university: string | null;
  secondary_specialties: string[] | null;
  workplaces: Workplace[] | null;
  cedula_especialidad: string | null;
  cedula_especialidad_status: string | null;
  cedula_especialidad_rejection_reason: string | null;
  license: string | null;
  specialty: string;
}

export function DoctorCredentialsCard({ userId }: { userId: string }) {
  const [data, setData] = useState<CredentialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [university, setUniversity] = useState('');
  const [cedulaEsp, setCedulaEsp] = useState('');
  const [secondarySpecialties, setSecondarySpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [newWorkplace, setNewWorkplace] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('doctor_profiles')
        .select('university, secondary_specialties, workplaces, cedula_especialidad, cedula_especialidad_status, cedula_especialidad_rejection_reason, license, specialty')
        .eq('user_id', userId)
        .maybeSingle();
      if (row) {
        const d = row as any;
        setData(d);
        setUniversity(d.university || '');
        setCedulaEsp(d.cedula_especialidad || '');
        setSecondarySpecialties(d.secondary_specialties || []);
        setWorkplaces(Array.isArray(d.workplaces) ? d.workplaces : []);
      }
      setLoading(false);
    })();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmedUni = university.trim().slice(0, 200);
      const trimmedCedula = cedulaEsp.trim().slice(0, 50);
      const cleanSpecs = secondarySpecialties.map(s => s.trim().slice(0, 80)).filter(Boolean).slice(0, 5);
      const cleanWorkplaces = workplaces.map(w => ({ name: (w.name || '').trim().slice(0, 200) })).filter(w => w.name).slice(0, 10);

      const update: any = {
        university: trimmedUni || null,
        secondary_specialties: cleanSpecs,
        workplaces: cleanWorkplaces,
      };
      // Only update cedula if changed (resets status to pending)
      if (trimmedCedula !== (data?.cedula_especialidad || '')) {
        update.cedula_especialidad = trimmedCedula || null;
        update.cedula_especialidad_status = trimmedCedula ? 'pending' : null;
        update.cedula_especialidad_rejection_reason = null;
      }

      const { error } = await supabase
        .from('doctor_profiles')
        .update(update)
        .eq('user_id', userId);
      if (error) throw error;

      setData(prev => prev ? { ...prev, ...update } : prev);
      setEditing(false);
      toast.success('Credenciales actualizadas');
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const cedulaStatus = data.cedula_especialidad_status;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Credenciales profesionales
            </CardTitle>
            <CardDescription>Universidad, especialidades, lugares de trabajo y cédulas.</CardDescription>
          </div>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setUniversity(data.university || ''); setCedulaEsp(data.cedula_especialidad || ''); setSecondarySpecialties(data.secondary_specialties || []); setWorkplaces(Array.isArray(data.workplaces) ? data.workplaces : []); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* University */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm"><GraduationCap className="w-4 h-4 text-muted-foreground" /> Universidad donde estudió</Label>
            {editing ? (
              <Input value={university} onChange={e => setUniversity(e.target.value)} placeholder="Ej. UNAM, Facultad de Medicina" maxLength={200} />
            ) : (
              <p className="text-sm font-medium ml-6">{data.university || <span className="text-muted-foreground italic">No especificada</span>}</p>
            )}
          </div>
          <Separator />

          {/* Specialties */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm"><Award className="w-4 h-4 text-muted-foreground" /> Especialidades</Label>
            <div className="ml-6 flex flex-wrap gap-1.5">
              <Badge variant="default">{data.specialty} <span className="ml-1 opacity-60 text-[10px]">principal</span></Badge>
              {(editing ? secondarySpecialties : (data.secondary_specialties || [])).map((s, i) => (
                <Badge key={`${s}-${i}`} variant="secondary" className="gap-1">
                  {s}
                  {editing && (
                    <button type="button" onClick={() => setSecondarySpecialties(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {editing && (
              <div className="ml-6 flex gap-2 pt-2">
                <Input value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="Agregar especialidad" maxLength={80} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter' && newSpecialty.trim()) { e.preventDefault(); setSecondarySpecialties(p => [...p, newSpecialty.trim()].slice(0, 5)); setNewSpecialty(''); } }} />
                <Button type="button" size="sm" variant="outline" disabled={!newSpecialty.trim() || secondarySpecialties.length >= 5} onClick={() => { setSecondarySpecialties(p => [...p, newSpecialty.trim()].slice(0, 5)); setNewSpecialty(''); }}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>
          <Separator />

          {/* Workplaces */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" /> Hospitales / Clínicas donde trabaja</Label>
            <div className="ml-6 space-y-1.5">
              {(editing ? workplaces : (data.workplaces || [])).length === 0 && !editing && (
                <p className="text-sm text-muted-foreground italic">No registrados</p>
              )}
              {(editing ? workplaces : (data.workplaces || [])).map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm flex-1">{w.name}</span>
                  {editing && (
                    <button type="button" onClick={() => setWorkplaces(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <div className="ml-6 flex gap-2 pt-2">
                <Input value={newWorkplace} onChange={e => setNewWorkplace(e.target.value)} placeholder="Ej. Hospital ABC, Clínica..." maxLength={200} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter' && newWorkplace.trim()) { e.preventDefault(); setWorkplaces(p => [...p, { name: newWorkplace.trim() }].slice(0, 10)); setNewWorkplace(''); } }} />
                <Button type="button" size="sm" variant="outline" disabled={!newWorkplace.trim() || workplaces.length >= 10} onClick={() => { setWorkplaces(p => [...p, { name: newWorkplace.trim() }].slice(0, 10)); setNewWorkplace(''); }}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>
          <Separator />

          {/* Cedula profesional (read-only - validated by SEP) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm"><FileCheck className="w-4 h-4 text-muted-foreground" /> Cédula profesional</Label>
            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm font-mono">{data.license || <span className="text-muted-foreground italic font-sans">No registrada</span>}</span>
              {data.license && <Badge variant="verified" className="text-[10px]">SEP</Badge>}
            </div>
          </div>
          <Separator />

          {/* Cedula especialidad */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm"><FileCheck className="w-4 h-4 text-muted-foreground" /> Cédula de especialidad</Label>
            {editing ? (
              <div className="ml-6 space-y-1">
                <Input value={cedulaEsp} onChange={e => setCedulaEsp(e.target.value)} placeholder="Número de cédula de especialidad" maxLength={50} />
                <p className="text-xs text-muted-foreground">Al guardar se enviará a verificación administrativa.</p>
              </div>
            ) : (
              <div className="ml-6 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-mono">{data.cedula_especialidad || <span className="text-muted-foreground italic font-sans">No registrada</span>}</span>
                {data.cedula_especialidad && cedulaStatus === 'approved' && <Badge variant="verified" className="text-[10px]">Verificada</Badge>}
                {data.cedula_especialidad && cedulaStatus === 'pending' && <Badge variant="warning" className="text-[10px]">En revisión</Badge>}
                {data.cedula_especialidad && cedulaStatus === 'rejected' && <Badge variant="destructive" className="text-[10px]" title={data.cedula_especialidad_rejection_reason || ''}>Rechazada</Badge>}
              </div>
            )}
            {!editing && cedulaStatus === 'rejected' && data.cedula_especialidad_rejection_reason && (
              <p className="ml-6 text-xs text-destructive">Motivo: {data.cedula_especialidad_rejection_reason}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
