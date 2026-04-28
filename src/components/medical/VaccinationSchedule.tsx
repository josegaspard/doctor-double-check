import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Syringe, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  VACCINATION_SCHEME_MX,
  getAgeMonths,
  getApplicableVaccines,
  type VaccineDef,
} from '@/lib/vaccinationSchemeMX';

interface PatientVaccinationRow {
  id: string;
  vaccine_key: string;
  dose_number: number;
  applied: boolean;
  application_date: string | null;
  lot: string | null;
  notes: string | null;
  child_id: string | null;
}

interface ChildOption {
  id: string;
  name: string;
  date_of_birth: string;
}

interface Props {
  /** Optional: if provided, manage vaccinations for this child sub-profile instead of the patient */
  childId?: string;
  childDob?: string;
}

export function VaccinationSchedule({ childId, childDob }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PatientVaccinationRow[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | 'self'>(childId || 'self');
  const [patientDob, setPatientDob] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [{ data: vacs }, { data: kids }, { data: prof }, { data: history }] = await Promise.all([
        supabase.from('patient_vaccinations').select('*').eq('patient_id', user.id),
        supabase.from('child_profiles').select('id,name,date_of_birth').eq('parent_id', user.id),
        supabase.from('profiles').select('vaccine_reminders_enabled').eq('id', user.id).maybeSingle(),
        supabase.from('patient_clinical_history').select('date_of_birth').eq('patient_id', user.id).maybeSingle(),
      ]);
      if (vacs) setRows(vacs as PatientVaccinationRow[]);
      if (kids) setChildren(kids as ChildOption[]);
      if (prof) setRemindersEnabled((prof as any).vaccine_reminders_enabled ?? true);
      if (history) setPatientDob((history as any).date_of_birth);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const currentDob = useMemo(() => {
    if (activeChildId === 'self') return patientDob || childDob || null;
    const c = children.find(x => x.id === activeChildId);
    return c?.date_of_birth || null;
  }, [activeChildId, patientDob, childDob, children]);

  const ageMonths = getAgeMonths(currentDob);
  const applicableVaccines = useMemo(() => getApplicableVaccines(ageMonths), [ageMonths]);

  const findRow = (vKey: string, dose: number) =>
    rows.find(r => r.vaccine_key === vKey && r.dose_number === dose && (
      activeChildId === 'self' ? r.child_id === null : r.child_id === activeChildId
    ));

  const upsertRow = async (
    v: VaccineDef,
    dose: number,
    patch: Partial<PatientVaccinationRow>
  ) => {
    if (!user?.id) return;
    const existing = findRow(v.key, dose);
    setSavingKey(`${v.key}-${dose}`);
    try {
      if (existing) {
        const { data, error } = await supabase
          .from('patient_vaccinations')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        setRows(prev => prev.map(r => (r.id === existing.id ? (data as PatientVaccinationRow) : r)));
      } else {
        const { data, error } = await supabase
          .from('patient_vaccinations')
          .insert({
            patient_id: user.id,
            child_id: activeChildId === 'self' ? null : activeChildId,
            vaccine_key: v.key,
            dose_number: dose,
            applied: patch.applied ?? false,
            application_date: patch.application_date ?? null,
            lot: patch.lot ?? null,
            notes: patch.notes ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        setRows(prev => [...prev, data as PatientVaccinationRow]);
      }
    } catch (e: any) {
      console.error('[Vaccinations] upsert error', e);
      toast.error('No se pudo guardar');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ vaccine_reminders_enabled: val })
      .eq('id', user.id);
    if (error) toast.error('No se pudo actualizar');
    else toast.success(val ? 'Recordatorios activados' : 'Recordatorios desactivados');
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Syringe className="w-5 h-5 text-primary" />
                Esquema de vacunación (México)
              </CardTitle>
              <CardDescription>Cartilla oficial Secretaría de Salud</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {remindersEnabled ? (
                <Bell className="w-4 h-4 text-success" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">Recordatorios</span>
              <Switch checked={remindersEnabled} onCheckedChange={toggleReminders} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Profile selector: self + children */}
          {(children.length > 0 && !childId) && (
            <Tabs value={activeChildId as string} onValueChange={(v) => setActiveChildId(v as any)}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="self">Yo</TabsTrigger>
                {children.map(c => (
                  <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {ageMonths === null && (
            <div className="text-xs text-muted-foreground italic p-3 rounded-lg bg-muted/30">
              Indica tu fecha de nacimiento en el historial clínico para personalizar las vacunas aplicables a tu edad.
            </div>
          )}

          <div className="space-y-3">
            {applicableVaccines.map(v => (
              <div key={v.key} className="rounded-lg border p-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    {v.description && (
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{v.ageGroup}</Badge>
                </div>

                <div className="mt-2 space-y-2">
                  {v.doses.map(d => {
                    const r = findRow(v.key, d.doseNumber);
                    const saving = savingKey === `${v.key}-${d.doseNumber}`;
                    return (
                      <div
                        key={d.doseNumber}
                        className="grid grid-cols-12 gap-2 items-center text-sm pl-3 border-l-2 border-muted py-1"
                      >
                        <div className="col-span-12 sm:col-span-1 flex items-center justify-start">
                          <Checkbox
                            checked={!!r?.applied}
                            disabled={saving}
                            onCheckedChange={v2 =>
                              upsertRow(v, d.doseNumber, { applied: !!v2 })
                            }
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-4">
                          <Label className="text-xs">Dosis {d.doseNumber}</Label>
                          <p className="text-xs text-muted-foreground">{d.label}</p>
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <Label className="text-xs">Fecha</Label>
                          <Input
                            type="date"
                            disabled={saving}
                            value={r?.application_date || ''}
                            onChange={e =>
                              upsertRow(v, d.doseNumber, {
                                applied: true,
                                application_date: e.target.value || null,
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-4">
                          <Label className="text-xs">Lote / notas</Label>
                          <Input
                            disabled={saving}
                            value={r?.lot || ''}
                            placeholder="Lote"
                            onChange={e => upsertRow(v, d.doseNumber, { lot: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        {saving && (
                          <Loader2 className="col-span-12 sm:col-span-12 w-3 h-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
