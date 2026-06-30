import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { VaccinationSchedule } from '@/components/medical/VaccinationSchedule';
import { ConsultationSummaryCard } from '@/components/chat/ConsultationSummaryCard';
import {
  User, Heart, Wine, Syringe, Upload, Calculator,
  Loader2, Save, FileText, Stethoscope, ShieldCheck,
  Check, CloudOff,
} from 'lucide-react';
import { toast } from 'sonner';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];

const FREQUENCY_OPTIONS = [
  { value: 'never' },
  { value: 'rarely' },
  { value: 'occasionally' },
  { value: 'weekly' },
  { value: 'daily' },
] as const;

const VACCINES = [
  { key: 'bcg' },
  { key: 'hepatitis_b' },
  { key: 'pentavalente' },
  { key: 'dpt' },
  { key: 'rotavirus' },
  { key: 'neumococo_conjugada' },
  { key: 'neumococo_23' },
  { key: 'influenza' },
  { key: 'srp' },
  { key: 'sabin' },
  { key: 'salk' },
  { key: 'sr' },
  { key: 'vph' },
  { key: 'hepatitis_a' },
  { key: 'tetanos_td' },
  { key: 'tdpa' },
  { key: 'covid19' },
  { key: 'meningococo' },
  { key: 'varicela' },
  { key: 'fiebre_amarilla' },
  { key: 'rabia' },
] as const;

interface MedicationItem { name: string; dose: string; frequency: string; }
interface SurgeryItem { procedure: string; date: string; complications?: string; }
interface VaccineData { applied: boolean; doses: string; date: string; }

const CHRONIC_CONDITIONS_LIST = [
  'Diabetes', 'Hipertensión', 'Asma', 'EPOC', 'Artritis',
  'Hipotiroidismo', 'Hipertiroidismo', 'Epilepsia', 'Insuficiencia renal',
  'Enfermedad hepática', 'VIH/SIDA', 'Lupus', 'Fibromialgia',
];

const EXTRA_FAMILY_CONDITIONS = [
  { key: 'renal' },
  { key: 'hepatic' },
  { key: 'thyroid' },
  { key: 'asthma_copd' },
  { key: 'arthritis' },
  { key: 'epilepsy' },
  { key: 'obesity' },
  { key: 'alcoholism' },
  { key: 'hereditary_allergies' },
  { key: 'autoimmune' },
] as const;

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
  extra_family: Record<string, { active: boolean; detail: string; relationship?: string }>;
  family_other: string; family_history: string;
  habit_alcohol: string; habit_smoking: string; habit_vaping: string;
  habit_hookah: string; habit_drugs: string; habit_exercise: string;
  habit_alcohol_amount: string; habit_smoking_amount: string; habit_vaping_amount: string;
  habit_hookah_amount: string; habit_drugs_amount: string; habit_exercise_amount: string;
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
function parseExtraFamily(text: string): Record<string, { active: boolean; detail: string }> {
  try { const obj = JSON.parse(text); if (typeof obj === 'object' && !Array.isArray(obj)) return obj; } catch {}
  const result: Record<string, { active: boolean; detail: string }> = {};
  EXTRA_FAMILY_CONDITIONS.forEach(c => { result[c.key] = { active: false, detail: '' }; });
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
  extra_family: {},
  family_other: '', family_history: '',
  habit_alcohol: 'never', habit_smoking: 'never', habit_vaping: 'never',
  habit_hookah: 'never', habit_drugs: 'never', habit_exercise: 'never',
  habit_alcohol_amount: '', habit_smoking_amount: '', habit_vaping_amount: '',
  habit_hookah_amount: '', habit_drugs_amount: '', habit_exercise_amount: '',
  gyn_last_period: '', gyn_pregnancies: '0', gyn_births: '0', gyn_cesareans: '0',
  gyn_abortions: '0', gyn_contraceptive: '', gyn_pap_result: '',
  vaccines: {},
  notes: '',
};

function ConsultationSummariesSection({ patientId }: { patientId: string }) {
  const { t } = useLanguage();
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
          {t('medicalRecordPage.consultationSummaries.empty')}
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
  const { language, t } = useLanguage();
  const [data, setData] = useState<ClinicalData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);
  const hasRecordRef = useRef(false);
  const dataRef = useRef<ClinicalData>(DEFAULT_DATA);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { hasRecordRef.current = hasRecord; }, [hasRecord]);

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
          extra_family: parseExtraFamily(record.family_history || ''),
          family_history: record.family_history || '',
          habit_alcohol: (record as any).habit_alcohol || 'never',
          habit_smoking: (record as any).habit_smoking || 'never',
          habit_vaping: (record as any).habit_vaping || 'never',
          habit_hookah: (record as any).habit_hookah || 'never',
          habit_drugs: (record as any).habit_drugs || 'never',
          habit_exercise: (record as any).habit_exercise || 'never',
          habit_alcohol_amount: (record as any).habit_alcohol_amount || '',
          habit_smoking_amount: (record as any).habit_smoking_amount || '',
          habit_vaping_amount: (record as any).habit_vaping_amount || '',
          habit_hookah_amount: (record as any).habit_hookah_amount || '',
          habit_drugs_amount: (record as any).habit_drugs_amount || '',
          habit_exercise_amount: (record as any).habit_exercise_amount || '',
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

  // Persiste el expediente. silent=true para auto-guardado (sin toast).
  // Usa los refs para que el callback del setTimeout siempre vea el estado más
  // reciente sin tener que recrearse cada vez que cambia `data` (lo cual
  // reiniciaría el debounce en cada teclazo).
  const persistData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?.id) return { ok: false };
    const silent = !!opts?.silent;
    const d = dataRef.current;
    const wasNew = !hasRecordRef.current;
    if (silent) setAutoSaveStatus('saving');
    else setIsSaving(true);
    try {
      const payload = {
        patient_id: user.id,
        sex: d.sex || null,
        date_of_birth: d.date_of_birth || null,
        blood_type: d.blood_type || null,
        height_cm: d.height_cm ? parseFloat(d.height_cm) : null,
        weight_kg: d.weight_kg ? parseFloat(d.weight_kg) : null,
        allergies: d.allergies || null,
        chronic_conditions: JSON.stringify(d.chronic_conditions_list),
        current_medications: JSON.stringify(d.medications),
        previous_surgeries: JSON.stringify(d.surgeries),
        emergency_contact_name: d.emergency_contact_name || null,
        emergency_contact_phone: d.emergency_contact_phone || null,
        family_diabetes: d.family_diabetes,
        family_diabetes_detail: d.family_diabetes_detail || null,
        family_hypertension: d.family_hypertension,
        family_hypertension_detail: d.family_hypertension_detail || null,
        family_cancer: d.family_cancer,
        family_cancer_detail: d.family_cancer_detail || null,
        family_heart_disease: d.family_heart_disease,
        family_heart_disease_detail: d.family_heart_disease_detail || null,
        family_mental_illness: d.family_mental_illness,
        family_mental_illness_detail: d.family_mental_illness_detail || null,
        family_other: d.family_other || null,
        family_history: JSON.stringify(d.extra_family),
        habit_alcohol: d.habit_alcohol,
        habit_smoking: d.habit_smoking,
        habit_vaping: d.habit_vaping,
        habit_hookah: d.habit_hookah,
        habit_drugs: d.habit_drugs,
        habit_exercise: d.habit_exercise,
        habit_alcohol_amount: d.habit_alcohol_amount || null,
        habit_smoking_amount: d.habit_smoking_amount || null,
        habit_vaping_amount: d.habit_vaping_amount || null,
        habit_hookah_amount: d.habit_hookah_amount || null,
        habit_drugs_amount: d.habit_drugs_amount || null,
        habit_exercise_amount: d.habit_exercise_amount || null,
        gyn_last_period: d.gyn_last_period || null,
        gyn_pregnancies: parseInt(d.gyn_pregnancies) || 0,
        gyn_births: parseInt(d.gyn_births) || 0,
        gyn_cesareans: parseInt(d.gyn_cesareans) || 0,
        gyn_abortions: parseInt(d.gyn_abortions) || 0,
        gyn_contraceptive: d.gyn_contraceptive || null,
        gyn_pap_result: d.gyn_pap_result || null,
        vaccines: d.vaccines,
        notes: d.notes || null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (hasRecordRef.current) {
        ({ error } = await supabase
          .from('patient_clinical_history')
          .update(payload as any)
          .eq('patient_id', user.id));
      } else {
        ({ error } = await supabase
          .from('patient_clinical_history')
          .insert(payload as any));
        if (!error) {
          setHasRecord(true);
          hasRecordRef.current = true;
        }
      }

      if (error) throw error;
      setLastSavedAt(new Date());
      if (silent) {
        setAutoSaveStatus('saved');
      } else {
        toast.success(wasNew ? t('medicalRecordPage.toastSaveSuccess') : t('medicalRecordPage.toastSaveSuccess'));
      }
      return { ok: true };
    } catch (err) {
      console.error('[MedicalRecord] persist failed:', err);
      if (silent) setAutoSaveStatus('error');
      else toast.error(t('medicalRecordPage.toastSaveError'));
      return { ok: false };
    } finally {
      if (silent) setIsSaving(false);
      else setIsSaving(false);
    }
  }, [user?.id, t]);

  const handleSave = () => persistData({ silent: false });

  // Auto-guardado: 1.5s después del último cambio el cliente persiste solo.
  // Saltamos el primer render (la carga inicial setea `data` desde la DB y
  // no debe volver a guardarse). El estado autoSaveStatus alimenta el chip
  // del header para que el usuario vea "Guardando…" / "Guardado" sin spam
  // de toasts.
  useEffect(() => {
    if (isLoading) return;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutoSaveStatus('saving');
    autosaveTimerRef.current = setTimeout(() => {
      persistData({ silent: true });
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [data, isLoading, persistData]);

  // Guardado final al salir de la página: el debounce de 1.5s puede no
  // haber disparado todavía. visibilitychange (cuando el tab pasa a hidden)
  // dispara un save sincrónico para no perder el último input.
  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden' && initialLoadDoneRef.current) {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        persistData({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', flushOnHide);
    window.addEventListener('pagehide', flushOnHide);
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('pagehide', flushOnHide);
    };
  }, [persistData]);

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
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 max-w-4xl">
        {/* Header — mobile stacked, tablet+ inline */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <span className="truncate">{t('medicalRecordPage.header.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('medicalRecordPage.header.subtitle')}</p>
            {autoSaveStatus !== 'idle' && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {autoSaveStatus === 'saving' && (
                  <><Loader2 className="w-3 h-3 animate-spin" /> {t('medicalRecordPage.autoSave.saving') || 'Guardando…'}</>
                )}
                {autoSaveStatus === 'saved' && (
                  <><Check className="w-3 h-3 text-emerald-600" /> {t('medicalRecordPage.autoSave.saved') || 'Guardado'}{lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</>
                )}
                {autoSaveStatus === 'error' && (
                  <><CloudOff className="w-3 h-3 text-destructive" /> {t('medicalRecordPage.autoSave.error') || 'No se pudo auto-guardar'}</>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón "Descargar" eliminado a pedido del cliente (2026-06-24). */}
            <Button onClick={handleSave} disabled={isSaving} variant="live" size="sm" className="gap-2 h-9 px-3 flex-1 sm:flex-initial">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('medicalRecordPage.header.save')}
            </Button>
          </div>
        </div>

        {(role === 'patient' || role === 'doctor' || role === 'resident') && (
          <div className="mb-3 sm:mb-4 flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl bg-primary text-primary-foreground shadow-md ring-1 ring-primary/40 text-xs sm:text-sm">
            <div className="w-7 h-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <span className="leading-snug">
              {t('medicalRecordPage.privacyNotice.prefix')}{' '}
              <strong className="font-bold underline decoration-primary-foreground/40 underline-offset-2">{t('medicalRecordPage.privacyNotice.highlight')}</strong>{' '}
              {t('medicalRecordPage.privacyNotice.suffix')}
            </span>
          </div>
        )}

        <Tabs defaultValue="personal" className="space-y-3 sm:space-y-4">
          {/* Mobile: horizontal scroll (1 fila, sin wrap). Desktop: 7-col grid. */}
          <TabsList className="w-full flex sm:grid sm:grid-cols-7 gap-1 overflow-x-auto scrollbar-hide sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-1 h-auto py-1 justify-start">
            <TabsTrigger value="personal" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><User className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.personal')}</TabsTrigger>
            <TabsTrigger value="family" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><Heart className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.family')}</TabsTrigger>
            <TabsTrigger value="habits" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><Wine className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.habits')}</TabsTrigger>
            <TabsTrigger value="vaccines" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><Syringe className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.vaccines')}</TabsTrigger>
            <TabsTrigger value="studies" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><Upload className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.studies')}</TabsTrigger>
            <TabsTrigger value="summaries" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><FileText className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.summaries')}</TabsTrigger>
            <TabsTrigger value="calculators" className="text-xs gap-1 flex-shrink-0 px-3 py-1.5 sm:px-1 whitespace-nowrap"><Calculator className="w-3.5 h-3.5" /> {t('medicalRecordPage.tabs.calculators')}</TabsTrigger>
          </TabsList>

          {/* ── DATOS PERSONALES ── */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('medicalRecordPage.personal.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.sex')}</Label>
                    <Select value={data.sex} onValueChange={v => update('sex', v)}>
                      <SelectTrigger><SelectValue placeholder={t('medicalRecordPage.personal.selectPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t('medicalRecordPage.personal.sexMale')}</SelectItem>
                        <SelectItem value="female">{t('medicalRecordPage.personal.sexFemale')}</SelectItem>
                        <SelectItem value="other">{t('medicalRecordPage.personal.sexOther')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.dateOfBirth')}</Label>
                    <Input type="date" value={data.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.bloodType')}</Label>
                    <Select value={data.blood_type} onValueChange={v => update('blood_type', v)}>
                      <SelectTrigger><SelectValue placeholder={t('medicalRecordPage.personal.selectPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt === 'No sé' ? t('medicalRecordPage.bloodTypeUnknown') : bt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.heightCm')}</Label>
                    <Input type="number" placeholder="170" value={data.height_cm} onChange={e => update('height_cm', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.weightKg')}</Label>
                    <Input type="number" placeholder="70" value={data.weight_kg} onChange={e => update('weight_kg', e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">{t('medicalRecordPage.personal.allergies')}</Label>
                  <Textarea placeholder={t('medicalRecordPage.personal.allergiesPlaceholder')} value={data.allergies} onChange={e => update('allergies', e.target.value)} rows={2} />
                </div>
                <div>
                  <Label className="text-xs font-medium">{t('medicalRecordPage.personal.chronicConditions')}</Label>
                  <div className="space-y-2 mt-2">
                    {(() => {
                      // Lista libre de "Otras enfermedades crónicas" — cual + fecha + tratamiento.
                      // Se serializa dentro de chronic_conditions_list._otras.detail como JSON
                      // para no requerir migración de schema.
                      const raw = data.chronic_conditions_list?._otras?.detail || '';
                      let others: Array<{ cual: string; date: string; treatment: string }> = [];
                      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) others = parsed; } catch {}
                      const saveOthers = (next: typeof others) => {
                        setData(prev => ({
                          ...prev,
                          chronic_conditions_list: {
                            ...prev.chronic_conditions_list,
                            _otras: { active: next.length > 0, detail: JSON.stringify(next) },
                          },
                        }));
                      };
                      const addOther = () => saveOthers([...others, { cual: '', date: '', treatment: '' }]);
                      const updateOther = (i: number, patch: Partial<typeof others[number]>) =>
                        saveOthers(others.map((o, idx) => idx === i ? { ...o, ...patch } : o));
                      const removeOther = (i: number) => saveOthers(others.filter((_, idx) => idx !== i));
                      return (
                        <>
                          {others.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {others.map((o, i) => (
                                <div key={i} className="rounded-md border border-border p-2 bg-muted/20 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.otherChronicCondition')}</Label>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => removeOther(i)}>✕</Button>
                                  </div>
                                  <Input
                                    placeholder={t('medicalRecordPage.personal.otherChronicNamePlaceholder')}
                                    className="text-sm"
                                    value={o.cual}
                                    onChange={e => updateOther(i, { cual: e.target.value })}
                                  />
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.diagnosisDate')}</Label>
                                      <Input type="date" className="text-sm" value={o.date} onChange={e => updateOther(i, { date: e.target.value })} />
                                    </div>
                                    <div>
                                      <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.treatmentReminder')}</Label>
                                      <Input className="text-sm" placeholder={t('medicalRecordPage.personal.treatmentReminderPlaceholder')} value={o.treatment} onChange={e => updateOther(i, { treatment: e.target.value })} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <Button type="button" variant="outline" size="sm" className="text-xs h-7 gap-1 mb-2" onClick={addOther}>
                            {t('medicalRecordPage.personal.addOtherChronic')}
                          </Button>
                        </>
                      );
                    })()}
                    {CHRONIC_CONDITIONS_LIST.map(condition => {
                      const item = data.chronic_conditions_list[condition] || { active: false, detail: '' };
                      const isDiabetes = condition === 'Diabetes';
                      return (
                        <div key={condition} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={item.active} onCheckedChange={(v) => {
                              setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, active: !!v } } }));
                            }} />
                            <Label className="text-sm cursor-pointer">{t(`medicalRecordPage.chronicConditions.${condition}`)}</Label>
                          </div>
                          {item.active && (
                            <div className="ml-6 space-y-1.5">
                              {isDiabetes && (
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.diabetesType')}</Label>
                                  <Input
                                    className="text-sm"
                                    placeholder={t('medicalRecordPage.personal.diabetesTypePlaceholder')}
                                    value={(item as any).diabetes_type || ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, diabetes_type: v } as any } }));
                                    }}
                                  />
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.diagnosisDate')}</Label>
                                  <Input type="date" className="text-sm" value={(item as any).diagnosis_date || ''} onChange={e => {
                                    setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, diagnosis_date: e.target.value } as any } }));
                                  }} />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.personal.treatmentReminder')}</Label>
                                  <Input placeholder={t('medicalRecordPage.personal.treatmentReminderLongPlaceholder')} className="text-sm" value={(item as any).treatment_reminder || item.detail || ''} onChange={e => {
                                    setData(prev => ({ ...prev, chronic_conditions_list: { ...prev.chronic_conditions_list, [condition]: { ...item, treatment_reminder: e.target.value, detail: e.target.value } as any } }));
                                  }} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">{t('medicalRecordPage.personal.currentMedications')}</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={addMedication}>{t('medicalRecordPage.personal.add')}</Button>
                  </div>
                  {data.medications.map((med, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 mb-2 items-end">
                      <Input placeholder={t('medicalRecordPage.personal.medicationNamePlaceholder')} value={med.name} onChange={e => updateMedication(i, 'name', e.target.value)} className="text-sm" />
                      <Input placeholder={t('medicalRecordPage.personal.medicationDosePlaceholder')} value={med.dose} onChange={e => updateMedication(i, 'dose', e.target.value)} className="text-sm w-24" />
                      <Input placeholder={t('medicalRecordPage.personal.medicationFrequencyPlaceholder')} value={med.frequency} onChange={e => updateMedication(i, 'frequency', e.target.value)} className="text-sm w-28" />
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-9 px-2" onClick={() => removeMedication(i)}>✕</Button>
                    </div>
                  ))}
                  {data.medications.length === 0 && <p className="text-xs text-muted-foreground">{t('medicalRecordPage.personal.noMedications')}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">{t('medicalRecordPage.personal.previousSurgeries')}</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={addSurgery}>{t('medicalRecordPage.personal.add')}</Button>
                  </div>
                  {data.surgeries.map((s, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-2 mb-2 items-end">
                      <Input placeholder={t('medicalRecordPage.personal.surgeryProcedurePlaceholder')} value={s.procedure} onChange={e => updateSurgery(i, 'procedure', e.target.value)} className="text-sm" />
                      <Input type="date" value={s.date} onChange={e => updateSurgery(i, 'date', e.target.value)} className="text-sm" />
                      <Input placeholder={t('medicalRecordPage.personal.surgeryComplicationsPlaceholder')} value={s.complications || ''} onChange={e => updateSurgery(i, 'complications' as any, e.target.value)} className="text-sm" />
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-9 px-2" onClick={() => removeSurgery(i)}>✕</Button>
                    </div>
                  ))}
                  {data.surgeries.length === 0 && <p className="text-xs text-muted-foreground">{t('medicalRecordPage.personal.noSurgeries')}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.emergencyContact')}</Label>
                    <Input placeholder={t('medicalRecordPage.personal.emergencyContactNamePlaceholder')} value={data.emergency_contact_name} onChange={e => update('emergency_contact_name', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.personal.emergencyContactPhone')}</Label>
                    <Input placeholder={t('medicalRecordPage.personal.emergencyContactPhonePlaceholder')} value={data.emergency_contact_phone} onChange={e => update('emergency_contact_phone', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gynecology — only for female */}
            {data.sex === 'female' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{t('medicalRecordPage.gynecology.title')}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.lastPeriod')}</Label>
                      <Input type="date" value={data.gyn_last_period} onChange={e => update('gyn_last_period', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.pregnancies')}</Label>
                      <Input type="number" value={data.gyn_pregnancies} onChange={e => update('gyn_pregnancies', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.births')}</Label>
                      <Input type="number" value={data.gyn_births} onChange={e => update('gyn_births', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.cesareans')}</Label>
                      <Input type="number" value={data.gyn_cesareans} onChange={e => update('gyn_cesareans', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.abortions')}</Label>
                      <Input type="number" value={data.gyn_abortions} onChange={e => update('gyn_abortions', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('medicalRecordPage.gynecology.contraceptive')}</Label>
                      <Input placeholder={t('medicalRecordPage.gynecology.contraceptivePlaceholder')} value={data.gyn_contraceptive} onChange={e => update('gyn_contraceptive', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t('medicalRecordPage.gynecology.papResult')}</Label>
                    <Input placeholder={t('medicalRecordPage.gynecology.papResultPlaceholder')} value={data.gyn_pap_result} onChange={e => update('gyn_pap_result', e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ANTECEDENTES FAMILIARES ── */}
          <TabsContent value="family" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('medicalRecordPage.family.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'diabetes', label: t('medical.familyMain.diabetes') },
                  { key: 'hypertension', label: t('medical.familyMain.hypertension') },
                  { key: 'cancer', label: t('medical.familyMain.cancer') },
                  { key: 'heart_disease', label: t('medical.familyMain.heart_disease') },
                  { key: 'mental_illness', label: t('medical.familyMain.mental_illness') },
                ].map(item => {
                  const boolKey = `family_${item.key}` as keyof ClinicalData;
                  const detailKey = `family_${item.key}_detail` as keyof ClinicalData;
                  // Detalle como JSON {relationship, notes} para TODAS las enfermedades
                  // familiares (cliente 2026-06-19: "Parentesco familiar" + "Detalles
                  // adicionales" en todas, no solo diabetes; sin el campo "Tipo de
                  // diabetes"). Compat: si el valor guardado era texto plano (versión
                  // anterior), se interpreta como las notas.
                  let famDetail: { relationship?: string; notes?: string } = {};
                  const rawDetail = (data[detailKey] as string) || '';
                  try {
                    const parsed = rawDetail ? JSON.parse(rawDetail) : {};
                    famDetail = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : { notes: rawDetail };
                  } catch { famDetail = { notes: rawDetail }; }
                  const setFamDetail = (patch: Partial<typeof famDetail>) => {
                    update(detailKey, JSON.stringify({ ...famDetail, ...patch }));
                  };
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
                        <div className="space-y-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.family.relationship')}</Label>
                            <Select value={famDetail.relationship || ''} onValueChange={v => setFamDetail({ relationship: v })}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('medicalRecordPage.personal.selectPlaceholder')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="father">{t('medicalRecordPage.relatives.father')}</SelectItem>
                                <SelectItem value="mother">{t('medicalRecordPage.relatives.mother')}</SelectItem>
                                <SelectItem value="sibling">{t('medicalRecordPage.relatives.sibling')}</SelectItem>
                                <SelectItem value="grandparent">{t('medicalRecordPage.relatives.grandparent')}</SelectItem>
                                <SelectItem value="uncle_aunt">{t('medicalRecordPage.relatives.uncle_aunt')}</SelectItem>
                                <SelectItem value="cousin">{t('medicalRecordPage.relatives.cousin')}</SelectItem>
                                <SelectItem value="child">{t('medicalRecordPage.relatives.child')}</SelectItem>
                                <SelectItem value="other">{t('medicalRecordPage.relatives.other')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.family.additionalDetails')}</Label>
                            <Textarea
                              placeholder={t('medicalRecordPage.family.additionalDetails')}
                              value={famDetail.notes || ''}
                              onChange={e => setFamDetail({ notes: e.target.value })}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Extended family conditions */}
                {EXTRA_FAMILY_CONDITIONS.map(item => {
                  const val = data.extra_family[item.key] || { active: false, detail: '' };
                  const localizedLabel = t(`medicalRecordPage.extraFamilyConditions.${item.key}`);
                  return (
                    <div key={item.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{localizedLabel}</Label>
                        <Switch
                          checked={val.active}
                          onCheckedChange={v => {
                            setData(prev => ({
                              ...prev,
                              extra_family: { ...prev.extra_family, [item.key]: { ...val, active: !!v } },
                            }));
                          }}
                        />
                      </div>
                      {val.active && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.family.whichRelative')}</Label>
                            <Select
                              value={val.relationship || ''}
                              onValueChange={v => {
                                setData(prev => ({
                                  ...prev,
                                  extra_family: { ...prev.extra_family, [item.key]: { ...val, relationship: v } },
                                }));
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('medicalRecordPage.personal.selectPlaceholder')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="father">{t('medicalRecordPage.relatives.father')}</SelectItem>
                                <SelectItem value="mother">{t('medicalRecordPage.relatives.mother')}</SelectItem>
                                <SelectItem value="sibling">{t('medicalRecordPage.relatives.sibling')}</SelectItem>
                                <SelectItem value="grandparent">{t('medicalRecordPage.relatives.grandparent')}</SelectItem>
                                <SelectItem value="uncle_aunt">{t('medicalRecordPage.relatives.uncle_aunt')}</SelectItem>
                                <SelectItem value="cousin">{t('medicalRecordPage.relatives.cousin')}</SelectItem>
                                <SelectItem value="child">{t('medicalRecordPage.relatives.child')}</SelectItem>
                                <SelectItem value="other">{t('medicalRecordPage.relatives.other')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.family.details')}</Label>
                            <Textarea
                              placeholder={`${t('medical.familyDetailPrefix')} ${localizedLabel.toLowerCase()}...`}
                              value={val.detail}
                              onChange={e => {
                                setData(prev => ({
                                  ...prev,
                                  extra_family: { ...prev.extra_family, [item.key]: { ...val, detail: e.target.value } },
                                }));
                              }}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div>
                  <Label className="text-xs">{t('medicalRecordPage.family.otherFamilyHistory')}</Label>
                  <Textarea placeholder={t('medicalRecordPage.family.otherFamilyHistoryPlaceholder')} value={data.family_other} onChange={e => update('family_other', e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── HÁBITOS ── */}
          <TabsContent value="habits" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('medicalRecordPage.habits.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ALCOHOL */}
                {(() => {
                  const isPositive = data.habit_alcohol !== 'never' && data.habit_alcohol !== '';
                  // amount stored as JSON {beverage, amount}
                  let parsed: { beverage?: string; amount?: string } = {};
                  try { parsed = data.habit_alcohol_amount ? JSON.parse(data.habit_alcohol_amount) : {}; } catch { parsed = { amount: data.habit_alcohol_amount }; }
                  const setAlcohol = (patch: Partial<typeof parsed>) => update('habit_alcohol_amount', JSON.stringify({ ...parsed, ...patch }));
                  return (
                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2"><span className="text-lg">🍷</span><Label className="text-sm font-medium">{t('medicalRecordPage.habits.alcohol')}</Label></div>
                        <Select
                          value={isPositive ? 'positive' : 'negative'}
                          onValueChange={v => {
                            if (v === 'negative') { update('habit_alcohol', 'never'); update('habit_alcohol_amount', ''); }
                            else if (data.habit_alcohol === 'never' || !data.habit_alcohol) update('habit_alcohol', 'occasionally');
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="negative">{t('medicalRecordPage.habits.negative')}</SelectItem>
                            <SelectItem value="positive">{t('medicalRecordPage.habits.positive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {isPositive && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.beverage')}</Label>
                            <Select value={parsed.beverage || ''} onValueChange={v => setAlcohol({ beverage: v })}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('medicalRecordPage.habits.beveragePlaceholder')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beer">{t('medicalRecordPage.habits.beverages.beer')}</SelectItem>
                                <SelectItem value="wine">{t('medicalRecordPage.habits.beverages.wine')}</SelectItem>
                                <SelectItem value="spirits">{t('medicalRecordPage.habits.beverages.spirits')}</SelectItem>
                                <SelectItem value="cocktails">{t('medicalRecordPage.habits.beverages.cocktails')}</SelectItem>
                                <SelectItem value="mixed">{t('medicalRecordPage.habits.beverages.mixed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.frequencyLabel')}</Label>
                            <Select value={data.habit_alcohol} onValueChange={v => update('habit_alcohol', v)}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.filter(o => o.value !== 'never').map(o => <SelectItem key={o.value} value={o.value}>{t(`medicalRecordPage.frequency.${o.value}`)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.amount')}</Label>
                            <Input placeholder={t('medicalRecordPage.habits.alcoholAmountPlaceholder')} value={parsed.amount || ''} onChange={e => setAlcohol({ amount: e.target.value })} className="h-9 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* TABAQUISMO — grupo cigarro/vape/arguile */}
                {(() => {
                  const anyPositive = ['habit_smoking','habit_vaping','habit_hookah'].some(k => data[k as keyof ClinicalData] !== 'never' && data[k as keyof ClinicalData] !== '');
                  return (
                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2"><span className="text-lg">🚬</span><Label className="text-sm font-medium">{t('medicalRecordPage.habits.smoking')}</Label></div>
                        <Select
                          value={anyPositive ? 'positive' : 'negative'}
                          onValueChange={v => {
                            if (v === 'negative') {
                              ['habit_smoking','habit_vaping','habit_hookah'].forEach(k => { update(k as any, 'never'); update((k + '_amount') as any, ''); });
                            } else {
                              if (data.habit_smoking === 'never') update('habit_smoking', 'occasionally');
                            }
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="negative">{t('medicalRecordPage.habits.negative')}</SelectItem>
                            <SelectItem value="positive">{t('medicalRecordPage.habits.positive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {anyPositive && (
                        <div className="space-y-2 pl-7">
                          {[
                            { key: 'habit_smoking' as const, amountKey: 'habit_smoking_amount' as const, label: t('medicalRecordPage.habits.subtypes.cigarette'), icon: '🚬', placeholder: t('medicalRecordPage.habits.cigarettePlaceholder') },
                            { key: 'habit_vaping' as const, amountKey: 'habit_vaping_amount' as const, label: t('medicalRecordPage.habits.subtypes.vape'), icon: '💨', placeholder: t('medicalRecordPage.habits.vapePlaceholder') },
                            { key: 'habit_hookah' as const, amountKey: 'habit_hookah_amount' as const, label: t('medicalRecordPage.habits.subtypes.hookah'), icon: '🫧', placeholder: t('medicalRecordPage.habits.hookahPlaceholder') },
                          ].map(sub => {
                            const subActive = data[sub.key] !== 'never' && data[sub.key] !== '';
                            return (
                              <div key={sub.key} className="rounded-md border border-border/60 p-2 space-y-2 bg-muted/20">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2"><span>{sub.icon}</span><Label className="text-xs font-medium">{sub.label}</Label></div>
                                  <Switch checked={subActive} onCheckedChange={v => {
                                    if (!v) { update(sub.key, 'never'); update(sub.amountKey, ''); }
                                    else update(sub.key, 'occasionally');
                                  }} />
                                </div>
                                {subActive && (() => {
                                  let parsed: { amount?: string; started?: string } = {};
                                  try { parsed = data[sub.amountKey] ? JSON.parse(data[sub.amountKey]) : {}; }
                                  catch { parsed = { amount: data[sub.amountKey] }; }
                                  const setParsed = (patch: Partial<typeof parsed>) => update(sub.amountKey, JSON.stringify({ ...parsed, ...patch }));
                                  return (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <Select value={data[sub.key]} onValueChange={v => update(sub.key, v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {FREQUENCY_OPTIONS.filter(o => o.value !== 'never').map(o => <SelectItem key={o.value} value={o.value}>{t(`medicalRecordPage.frequency.${o.value}`)}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                      <Input placeholder={sub.placeholder} value={parsed.amount || ''} onChange={e => setParsed({ amount: e.target.value })} className="h-8 text-xs" />
                                      <Input placeholder={t('medicalRecordPage.habits.startedAgo')} value={parsed.started || ''} onChange={e => setParsed({ started: e.target.value })} className="h-8 text-xs" />
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* OTRAS DROGAS */}
                {(() => {
                  const isPositive = data.habit_drugs !== 'never' && data.habit_drugs !== '';
                  let parsed: { type?: string; amount?: string } = {};
                  try { parsed = data.habit_drugs_amount ? JSON.parse(data.habit_drugs_amount) : {}; } catch { parsed = { amount: data.habit_drugs_amount }; }
                  const setDrugs = (patch: Partial<typeof parsed>) => update('habit_drugs_amount', JSON.stringify({ ...parsed, ...patch }));
                  return (
                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2"><span className="text-lg">💊</span><Label className="text-sm font-medium">{t('medicalRecordPage.habits.drugs')}</Label></div>
                        <Select
                          value={isPositive ? 'positive' : 'negative'}
                          onValueChange={v => {
                            if (v === 'negative') { update('habit_drugs', 'never'); update('habit_drugs_amount', ''); }
                            else if (data.habit_drugs === 'never') update('habit_drugs', 'occasionally');
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="negative">{t('medicalRecordPage.habits.negative')}</SelectItem>
                            <SelectItem value="positive">{t('medicalRecordPage.habits.positive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {isPositive && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.drugsType')}</Label>
                            <Input placeholder={t('medicalRecordPage.habits.drugsTypePlaceholder')} value={parsed.type || ''} onChange={e => setDrugs({ type: e.target.value })} className="h-9 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.frequencyLabel')}</Label>
                            <Select value={data.habit_drugs} onValueChange={v => update('habit_drugs', v)}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.filter(o => o.value !== 'never').map(o => <SelectItem key={o.value} value={o.value}>{t(`medicalRecordPage.frequency.${o.value}`)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.amount')}</Label>
                            <Input placeholder={t('medicalRecordPage.habits.drugsAmountPlaceholder')} value={parsed.amount || ''} onChange={e => setDrugs({ amount: e.target.value })} className="h-9 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ACTIVIDAD FÍSICA */}
                {(() => {
                  const isPositive = data.habit_exercise !== 'never' && data.habit_exercise !== '';
                  let parsed: { type?: string; amount?: string } = {};
                  try { parsed = data.habit_exercise_amount ? JSON.parse(data.habit_exercise_amount) : {}; } catch { parsed = { amount: data.habit_exercise_amount }; }
                  const setEx = (patch: Partial<typeof parsed>) => update('habit_exercise_amount', JSON.stringify({ ...parsed, ...patch }));
                  return (
                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2"><span className="text-lg">🏃</span><Label className="text-sm font-medium">{t('medicalRecordPage.habits.exercise')}</Label></div>
                        <Select
                          value={isPositive ? 'positive' : 'negative'}
                          onValueChange={v => {
                            if (v === 'negative') { update('habit_exercise', 'never'); update('habit_exercise_amount', ''); }
                            else if (data.habit_exercise === 'never') update('habit_exercise', 'weekly');
                          }}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="negative">{t('medicalRecordPage.habits.sedentary')}</SelectItem>
                            <SelectItem value="positive">{t('medicalRecordPage.habits.active')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {isPositive && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.exerciseType')}</Label>
                            <Select value={parsed.type || ''} onValueChange={v => setEx({ type: v })}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t('medicalRecordPage.habits.exerciseTypePlaceholder')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cardio">{t('medicalRecordPage.habits.exerciseTypes.cardio')}</SelectItem>
                                <SelectItem value="strength">{t('medicalRecordPage.habits.exerciseTypes.strength')}</SelectItem>
                                <SelectItem value="hiit">{t('medicalRecordPage.habits.exerciseTypes.hiit')}</SelectItem>
                                <SelectItem value="yoga">{t('medicalRecordPage.habits.exerciseTypes.yoga')}</SelectItem>
                                <SelectItem value="sports">{t('medicalRecordPage.habits.exerciseTypes.sports')}</SelectItem>
                                <SelectItem value="walking">{t('medicalRecordPage.habits.exerciseTypes.walking')}</SelectItem>
                                <SelectItem value="cycling">{t('medicalRecordPage.habits.exerciseTypes.cycling')}</SelectItem>
                                <SelectItem value="swimming">{t('medicalRecordPage.habits.exerciseTypes.swimming')}</SelectItem>
                                <SelectItem value="mixed">{t('medicalRecordPage.habits.exerciseTypes.mixed')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.frequencyLabel')}</Label>
                            <Select value={data.habit_exercise} onValueChange={v => update('habit_exercise', v)}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.filter(o => o.value !== 'never').map(o => <SelectItem key={o.value} value={o.value}>{t(`medicalRecordPage.frequency.${o.value}`)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('medicalRecordPage.habits.exerciseDuration')}</Label>
                            <Input placeholder={t('medicalRecordPage.habits.exerciseDurationPlaceholder')} value={parsed.amount || ''} onChange={e => setEx({ amount: e.target.value })} className="h-9 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── VACUNAS — Cartilla oficial MX por edades + recordatorios ── */}
          <TabsContent value="vaccines" className="space-y-4">
            <VaccinationSchedule childDob={data.date_of_birth || undefined} />
          </TabsContent>

          {/* ── SUBIR ESTUDIOS ── */}
          <TabsContent value="studies" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {t('medicalRecordPage.studies.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('medicalRecordPage.studies.description')}
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.location.href = '/medical-history'}
                >
                  <Upload className="w-4 h-4" />
                  {t('medicalRecordPage.studies.goToUpload')}
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
          <Button onClick={handleSave} disabled={isSaving} variant="live" size="icon" className="w-12 h-12 rounded-full shadow-lg">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
