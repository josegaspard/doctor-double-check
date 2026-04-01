import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVault } from '@/contexts/VaultContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HealthCalculators } from '@/components/medical/HealthCalculators';
import { ConsultationSummaryCard } from '@/components/chat/ConsultationSummaryCard';
import {
  User, Heart, Wine, Syringe, Upload, Calculator,
  Loader2, Save, FileText, Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];

const FREQUENCY_OPTIONS = [
  { value: 'never', label: 'Nunca' },
  { value: 'rarely', label: 'Raramente' },
  { value: 'occasionally', label: 'Ocasionalmente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'daily', label: 'Diariamente' },
];

const VACCINES = [
  { key: 'bcg', label: 'BCG' },
  { key: 'hepatitis_b', label: 'Hepatitis B' },
  { key: 'pentavalente', label: 'Pentavalente' },
  { key: 'rotavirus', label: 'Rotavirus' },
  { key: 'neumococo', label: 'Neumococo' },
  { key: 'influenza', label: 'Influenza' },
  { key: 'srp', label: 'SRP (Sarampión, Rubéola, Parotiditis)' },
  { key: 'dpt', label: 'DPT' },
  { key: 'vph', label: 'VPH' },
  { key: 'hepatitis_a', label: 'Hepatitis A' },
  { key: 'tetanos', label: 'Tétanos' },
  { key: 'covid19', label: 'COVID-19' },
  { key: 'meningococo', label: 'Meningococo' },
  { key: 'varicela', label: 'Varicela' },
];

interface MedicationItem { name: string; dose: string; frequency: string; }
interface SurgeryItem { procedure: string; date: string; }
interface VaccineData { applied: boolean; doses: string; date: string; }

const CHRONIC_CONDITIONS_LIST = [
  'Diabetes', 'Hipertensión', 'Asma', 'EPOC', 'Artritis',
  'Hipotiroidismo', 'Hipertiroidismo', 'Epilepsia', 'Insuficiencia renal',
  'Enfermedad hepática', 'VIH/SIDA', 'Lupus', 'Fibromialgia',
];

interface ClinicalData {
  sex: string; date_of_birth: string; blood_type: string;
  height_cm: string; weight_kg: string; allergies: string;
  chronic_conditions_list: Record<string, { active: boolean; detail: string }>;
  chronic_conditions: string;
  medications: MedicationItem[];
  current_medications: string;
  surgeries: SurgeryItem[];
  previous_surgeries: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  family_diabetes: boolean; family_diabetes_detail: string;
  family_hypertension: boolean; family_hypertension_detail: string;
  family_cancer: boolean; family_cancer_detail: string;
  family_heart_disease: boolean; family_heart_disease_detail: string;
  family_mental_illness: boolean; family_mental_illness_detail: string;
  family_other: string; family_history: string;
  habit_alcohol: string; habit_smoking: string; habit_vaping: string;
  habit_hookah: string; habit_drugs: string; habit_exercise: string;
  gyn_last_period: string; gyn_pregnancies: string; gyn_births: string;
  gyn_cesareans: string; gyn_abortions: string;
  gyn_contraceptive: string; gyn_pap_result: string;
  vaccines: Record<string, VaccineData>;
  notes: string;
}

function parseMedications(text: string): MedicationItem[] {
  try { const arr = JSON.parse(text); if (Array.isArray(arr)) return arr; } catch {}
  if (!text.trim()) return [];
  return text.split('\n').filter(Boolean).map(l => ({ name: l, dose: '', frequency: '' }));
}
function parsesSurgeries(text: string): SurgeryItem[] {
  try { const arr = JSON.parse(text); if (Array.isArray(arr)) return arr; } catch {}
  if (!text.trim()) return [];
  return text.split('\n').filter(Boolean).map(l => ({ procedure: l, date: '' }));
}
function parseChronicList(text: string): Record<string, { active: boolean; detail: string }> {
  try { const obj = JSON.parse(text); if (typeof obj === 'object' && !Array.isArray(obj)) return obj; } catch {}
  const result: Record<string, { active: boolean; detail: string }> = {};
  CHRONIC_CONDITIONS_LIST.forEach(c => { result[c] = { active: false, detail: '' }; });
  if (text.trim()) { result['_other'] = { active: true, detail: text }; }
  return result;
}
function parseVaccines(raw: any): Record<string, VaccineData> {
  const result: Record<string, VaccineData> = {};
  if (raw && typeof raw === 'object') {
    VACCINES.forEach(v => {
      const val = raw[v.key];
      if (typeof val === 'object' && val !== null) {
        result[v.key] = { applied: !!val.applied, doses: val.doses || '', date: val.date || '' };
      } else {
        result[v.key] = { applied: !!val, doses: '', date: '' };
      }
    });
  }
  return result;
}

const DEFAULT_DATA: ClinicalData = {
  sex: '', date_of_birth: '', blood_type: '', height_cm: '', weight_kg: '',
  allergies: '', chronic_conditions: '', chronic_conditions_list: {},
  current_medications: '', medications: [], previous_surgeries: '', surgeries: [],
  emergency_contact_name: '', emergency_contact_phone: '',
  family_diabetes: false, family_diabetes_detail: '',
  family_hypertension: false, family_hypertension_detail: '',
  family_cancer: false, family_cancer_detail: '',
  family_heart_disease: false, family_heart_disease_detail: '',
  family_mental_illness: false, family_mental_illness_detail: '',
  family_other: '', family_history: '',
  habit_alcohol: 'never', habit_smoking: 'never', habit_vaping: 'never',
  habit_hookah: 'never', habit_drugs: 'never', habit_exercise: 'never',
  gyn_last_period: '', gyn_pregnancies: '0', gyn_births: '0', gyn_cesareans: '0',
  gyn_abortions: '0', gyn_contraceptive: '', gyn_pap_result: '',
  vaccines: {},
  notes: '',
};

function ConsultationSummariesSection({ patientId }: { patientId: string }) {
  const [consultationIds, setConsultationIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    const fetchSummaries = async () => {
      const { data } = await supabase
        .from('consultations')
        .select('id')
        .eq('patient_id', patientId)
        .not('doctor_summary', 'is', null)
        .order('completed_at', { ascending: false });
      setConsultationIds((data || []).map(c => c.id));
      setIsLoading(false);
    };
    fetchSummaries();
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (consultationIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No hay resúmenes médicos disponibles aún.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {consultationIds.map(id => (
        <ConsultationSummaryCard key={id} consultationId={id} />
      ))}
    </div>
  );
}

export default function MedicalRecord() {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const [data, setData] = useState<ClinicalData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const fetch = async () => {
      const { data: record } = await supabase
        .from('patient_clinical_history')
        .select('*')
        .eq('patient_id', user.id)
        .maybeSingle();

      if (record) {
        setHasRecord(true);
        setData({
          sex: (record as any).sex || '',
          date_of_birth: (record as any).date_of_birth || '',
          blood_type: record.blood_type || '',
          height_cm: record.height_cm ? String(record.height_cm) : '',
          weight_kg: record.weight_kg ? String(record.weight_kg) : '',
          allergies: record.allergies || '',
          chronic_conditions: record.chronic_conditions || '',
          chronic_conditions_list: parseChronicList(record.chronic_conditions || ''),
          current_medications: record.current_medications || '',
          medications: parseMedications(record.current_medications || ''),
          previous_surgeries: record.previous_surgeries || '',
          surgeries: parsesSurgeries(record.previous_surgeries || ''),
          emergency_contact_name: record.emergency_contact_name || '',
          emergency_contact_phone: record.emergency_contact_phone || '',
          family_diabetes: (record as any).family_diabetes || false,
          family_diabetes_detail: (record as any).family_diabetes_detail || '',
          family_hypertension: (record as any).family_hypertension || false,
          family_hypertension_detail: (record as any).family_hypertension_detail || '',
          family_cancer: (record as any).family_cancer || false,
          family_cancer_detail: (record as any).family_cancer_detail || '',
          family_heart_disease: (record as any).family_heart_disease || false,
          family_heart_disease_detail: (record as any).family_heart_disease_detail || '',
          family_mental_illness: (record as any).family_mental_illness || false,
          family_mental_illness_detail: (record as any).family_mental_illness_detail || '',
          family_other: (record as any).family_other || '',
          family_history: record.family_history || '',
          habit_alcohol: (record as any).habit_alcohol || 'never',
          habit_smoking: (record as any).habit_smoking || 'never',
          habit_vaping: (record as any).habit_vaping || 'never',
          habit_hookah: (record as any).habit_hookah || 'never',
          habit_drugs: (record as any).habit_drugs || 'never',
          habit_exercise: (record as any).habit_exercise || 'never',
          gyn_last_period: (record as any).gyn_last_period || '',
          gyn_pregnancies: String((record as any).gyn_pregnancies || 0),
          gyn_births: String((record as any).gyn_births || 0),
          gyn_cesareans: String((record as any).gyn_cesareans || 0),
          gyn_abortions: String((record as any).gyn_abortions || 0),
          gyn_contraceptive: (record as any).gyn_contraceptive || '',
          gyn_pap_result: (record as any).gyn_pap_result || '',
          vaccines: parseVaccines((record as any).vaccines),
          notes: (record as any).notes || '',
        });
      }
      setIsLoading(false);
    };
    fetch();
  }, [user?.id]);

  const update = (field: keyof ClinicalData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const toggleVaccine = (key: string) => {
    setData(prev => ({
      ...prev,
      vaccines: {
        ...prev.vaccines,
        [key]: {
          ...(prev.vaccines[key] || { applied: false, doses: '', date: '' }),
          applied: !(prev.vaccines[key]?.applied),
        },
      },
    }));
  };

  const updateVaccineField = (key: string, field: 'doses' | 'date', value: string) => {
    setData(prev => ({
      ...prev,
      vaccines: {
        ...prev.vaccines,
        [key]: { ...(prev.vaccines[key] || { applied: true, doses: '', date: '' }), [field]: value },
      },
    }));
  };

  const addMedication = () => setData(prev => ({ ...prev, medications: [...prev.medications, { name: '', dose: '', frequency: '' }] }));
  const removeMedication = (i: number) => setData(prev => ({ ...prev, medications: prev.medications.filter((_, idx) => idx !== i) }));
  const updateMedication = (i: number, field: keyof MedicationItem, value: string) => {
    setData(prev => ({ ...prev, medications: prev.medications.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }));
  };

  const addSurgery = () => setData(prev => ({ ...prev, surgeries: [...prev.surgeries, { procedure: '', date: '' }] }));
  const removeSurgery = (i: number) => setData(prev => ({ ...prev, surgeries: prev.surgeries.filter((_, idx) => idx !== i) }));
  const updateSurgery = (i: number, field: keyof SurgeryItem, value: string) => {
    setData(prev => ({ ...prev, surgeries: prev.surgeries.map((s, idx) => idx === i ? { ...s, [field]: value } : s) }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        patient_id: user.id,
        sex: data.sex || null,
        date_of_birth: data.date_of_birth || null,
        blood_type: data.blood_type || null,
        height_cm: data.height_cm ? parseFloat(data.height_cm) : null,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        allergies: data.allergies || null,
        chronic_conditions: JSON.stringify(data.chronic_conditions_list),
        current_medications: JSON.stringify(data.medications),
        previous_surgeries: JSON.stringify(data.surgeries),
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        family_diabetes: data.family_diabetes,
        family_diabetes_detail: data.family_diabetes_detail || null,
        family_hypertension: data.family_hypertension,
        family_hypertension_detail: data.family_hypertension_detail || null,
        family_cancer: data.family_cancer,
        family_cancer_detail: data.family_cancer_detail || null,
        family_heart_disease: data.family_heart_disease,
        family_heart_disease_detail: data.family_heart_disease_detail || null,
        family_mental_illness: data.family_mental_illness,
        family_mental_illness_detail: data.family_mental_illness_detail || null,
        family_other: data.family_other || null,
        family_history: data.family_history || null,
        habit_alcohol: data.habit_alcohol,
        habit_smoking: data.habit_smoking,
        habit_vaping: data.habit_vaping,
        habit_hookah: data.habit_hookah,
        habit_drugs: data.habit_drugs,
        habit_exercise: data.habit_exercise,
        gyn_last_period: data.gyn_last_period || null,
        gyn_pregnancies: parseInt(data.gyn_pregnancies) || 0,
        gyn_births: parseInt(data.gyn_births) || 0,
        gyn_cesareans: parseInt(data.gyn_cesareans) || 0,
        gyn_abortions: parseInt(data.gyn_abortions) || 0,
        gyn_contraceptive: data.gyn_contraceptive || null,
        gyn_pap_result: data.gyn_pap_result || null,
        vaccines: data.vaccines,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (hasRecord) {
        ({ error } = await supabase
          .from('patient_clinical_history')
          .update(payload as any)
          .eq('patient_id', user.id));
      } else {
        ({ error } = await supabase
          .from('patient_clinical_history')
          .insert(payload as any));
        if (!error) setHasRecord(true);
      }

      if (error) throw error;
      toast.success('Expediente guardado correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el expediente');
    } finally {
      setIsSaving(false);
    }
  };

  if (!['patient', 'doctor', 'resident'].includes(role || '')) return <Navigate to="/lives" replace />;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary" />
              Expediente Médico
            </h1>
            <p className="text-sm text-muted-foreground">Tu historial clínico completo</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </div>

        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7 gap-1">
            <TabsTrigger value="personal" className="text-xs gap-1"><User className="w-3 h-3" /> Personal</TabsTrigger>
            <TabsTrigger value="family" className="text-xs gap-1"><Heart className="w-3 h-3" /> Familia</TabsTrigger>
            <TabsTrigger value="habits" className="text-xs gap-1"><Wine className="w-3 h-3" /> Hábitos</TabsTrigger>
            <TabsTrigger value="vaccines" className="text-xs gap-1"><Syringe className="w-3 h-3" /> Vacunas</TabsTrigger>
            <TabsTrigger value="studies" className="text-xs gap-1"><Upload className="w-3 h-3" /> Estudios</TabsTrigger>
            <TabsTrigger value="summaries" className="text-xs gap-1"><FileText className="w-3 h-3" /> Resúmenes</TabsTrigger>
            <TabsTrigger value="calculators" className="text-xs gap-1"><Calculator className="w-3 h-3" /> Calc.</TabsTrigger>
          </TabsList>

          {/* ── DATOS PERSONALES ── */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Sexo</Label>
                    <Select value={data.sex} onValueChange={v => update('sex', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Femenino</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Fecha de nacimiento</Label>
                    <Input type="date" value={data.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de sangre</Label>
                    <Select value={data.blood_type} onValueChange={v => update('blood_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Altura (cm)</Label>
                    <Input type="number" placeholder="170" value={data.height_cm} onChange={e => update('height_cm', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input type="number" placeholder="70" value={data.weight_kg} onChange={e => update('weight_kg', e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Alergias</Label>
                  <Textarea placeholder="Medicamentos, alimentos, etc." value={data.allergies} onChange={e => update('allergies', e.target.value)} rows={2} />
                </div>
                <div>
                  <Label className="text-xs font-medium">Enfermedades crónicas</Label>
                  <div className="space-y-2 mt-2">
                    {CHRONIC_CONDITIONS_LIST.map(condition => {
                      const item = data.chronic_conditions_list[condition] || { active: false, detail: '' };
                      return (
                        <div key={condition} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={item.active} onCheckedChange={(v) => {
                              setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, active: !!v } } }));
                            }} />
                            <Label className="text-sm cursor-pointer">{condition}</Label>
                          </div>
                          {item.active && (
                            <Input placeholder="Fecha de diagnóstico, tratamiento..." className="ml-6 text-sm" value={item.detail} onChange={e => {
                              setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, detail: e.target.value } } }));
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Medicamentos actuales</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={addMedication}>+ Agregar</Button>
                  </div>
                  {data.medications.map((med, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 mb-2 items-end">
                      <Input placeholder="Nombre" value={med.name} onChange={e => updateMedication(i, 'name', e.target.value)} className="text-sm" />
                      <Input placeholder="Dosis" value={med.dose} onChange={e => updateMedication(i, 'dose', e.target.value)} className="text-sm w-24" />
                      <Input placeholder="Frecuencia" value={med.frequency} onChange={e => updateMedication(i, 'frequency', e.target.value)} className="text-sm w-28" />
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-9 px-2" onClick={() => removeMedication(i)}>✕</Button>
                    </div>
                  ))}
                  {data.medications.length === 0 && <p className="text-xs text-muted-foreground">Sin medicamentos registrados</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Cirugías previas</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={addSurgery}>+ Agregar</Button>
                  </div>
                  {data.surgeries.map((s, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 mb-2 items-end">
                      <Input placeholder="Procedimiento" value={s.procedure} onChange={e => updateSurgery(i, 'procedure', e.target.value)} className="text-sm" />
                      <Input type="date" value={s.date} onChange={e => updateSurgery(i, 'date', e.target.value)} className="text-sm w-36" />
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-9 px-2" onClick={() => removeSurgery(i)}>✕</Button>
                    </div>
                  ))}
                  {data.surgeries.length === 0 && <p className="text-xs text-muted-foreground">Sin cirugías registradas</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Contacto de emergencia</Label>
                    <Input placeholder="Nombre" value={data.emergency_contact_name} onChange={e => update('emergency_contact_name', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Teléfono emergencia</Label>
                    <Input placeholder="+52 55..." value={data.emergency_contact_phone} onChange={e => update('emergency_contact_phone', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gynecology — only for female */}
            {data.sex === 'female' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Ginecología</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Última menstruación</Label>
                      <Input type="date" value={data.gyn_last_period} onChange={e => update('gyn_last_period', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Embarazos</Label>
                      <Input type="number" value={data.gyn_pregnancies} onChange={e => update('gyn_pregnancies', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Partos</Label>
                      <Input type="number" value={data.gyn_births} onChange={e => update('gyn_births', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Cesáreas</Label>
                      <Input type="number" value={data.gyn_cesareans} onChange={e => update('gyn_cesareans', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Abortos</Label>
                      <Input type="number" value={data.gyn_abortions} onChange={e => update('gyn_abortions', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Anticonceptivo</Label>
                      <Input placeholder="Tipo de anticonceptivo" value={data.gyn_contraceptive} onChange={e => update('gyn_contraceptive', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Resultado último Papanicolaou</Label>
                    <Input placeholder="Normal, anormal, pendiente..." value={data.gyn_pap_result} onChange={e => update('gyn_pap_result', e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ANTECEDENTES FAMILIARES ── */}
          <TabsContent value="family" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Antecedentes Familiares</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'diabetes', label: 'Diabetes' },
                  { key: 'hypertension', label: 'Hipertensión' },
                  { key: 'cancer', label: 'Cáncer' },
                  { key: 'heart_disease', label: 'Enfermedad cardíaca' },
                  { key: 'mental_illness', label: 'Enfermedad mental' },
                ].map(item => {
                  const boolKey = `family_${item.key}` as keyof ClinicalData;
                  const detailKey = `family_${item.key}_detail` as keyof ClinicalData;
                  return (
                    <div key={item.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{item.label}</Label>
                        <Switch
                          checked={data[boolKey] as boolean}
                          onCheckedChange={v => update(boolKey, v)}
                        />
                      </div>
                      {data[boolKey] && (
                        <Textarea
                          placeholder={`Detalle sobre ${item.label.toLowerCase()} en la familia...`}
                          value={data[detailKey] as string}
                          onChange={e => update(detailKey, e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      )}
                    </div>
                  );
                })}
                <div>
                  <Label className="text-xs">Otros antecedentes familiares</Label>
                  <Textarea placeholder="Otros antecedentes relevantes..." value={data.family_other} onChange={e => update('family_other', e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── HÁBITOS ── */}
          <TabsContent value="habits" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Hábitos y Estilo de Vida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'habit_alcohol' as const, label: 'Alcohol', icon: '🍷' },
                  { key: 'habit_smoking' as const, label: 'Cigarro', icon: '🚬' },
                  { key: 'habit_vaping' as const, label: 'Vape', icon: '💨' },
                  { key: 'habit_hookah' as const, label: 'Arguile/Hookah', icon: '🫧' },
                  { key: 'habit_drugs' as const, label: 'Drogas recreativas', icon: '💊' },
                  { key: 'habit_exercise' as const, label: 'Ejercicio', icon: '🏃' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{item.icon}</span>
                      <Label className="text-sm">{item.label}</Label>
                    </div>
                    <Select value={data[item.key]} onValueChange={v => update(item.key, v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── VACUNAS ── */}
          <TabsContent value="vaccines" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-primary" />
                  Cartilla de Vacunación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {VACCINES.map(v => {
                    const vData = data.vaccines[v.key] || { applied: false, doses: '', date: '' };
                    return (
                      <div key={v.key} className="p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={vData.applied} onCheckedChange={() => toggleVaccine(v.key)} />
                          <Label className="text-sm cursor-pointer flex-1">{v.label}</Label>
                          {vData.applied && (
                            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Aplicada</Badge>
                          )}
                        </div>
                        {vData.applied && (
                          <div className="flex gap-2 ml-6">
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground">Dosis</Label>
                              <Input placeholder="Ej: 2 de 3" value={vData.doses} onChange={e => updateVaccineField(v.key, 'doses', e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="flex-1">
                              <Label className="text-[10px] text-muted-foreground">Fecha</Label>
                              <Input type="date" value={vData.date} onChange={e => updateVaccineField(v.key, 'date', e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SUBIR ESTUDIOS ── */}
          <TabsContent value="studies" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Estudios Médicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Sube tus laboratorios, radiografías, resonancias y otros estudios.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.location.href = '/medical-history'}
                >
                  <Upload className="w-4 h-4" />
                  Ir a subir estudios
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RESÚMENES MÉDICOS ── */}
          <TabsContent value="summaries">
            <ConsultationSummariesSection patientId={user?.id || ''} />
          </TabsContent>

          {/* ── CALCULADORAS ── */}
          <TabsContent value="calculators">
            <HealthCalculators />
          </TabsContent>
        </Tabs>

        {/* Floating save */}
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 sm:hidden">
          <Button onClick={handleSave} disabled={isSaving} size="icon" className="w-12 h-12 rounded-full shadow-lg">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
