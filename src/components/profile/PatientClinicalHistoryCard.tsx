import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText, Loader2, Pencil, Check, X, ChevronDown, Heart, Pill, AlertTriangle, Phone, Ruler, Weight, Droplets, Users,
  Plus, Trash2, Baby, Activity, Cigarette, Wine, Copy,
} from 'lucide-react';
import { toast } from 'sonner';

// =================== Types ===================
type ChronicOther = { cual: string; diagnostico: string; tratamiento: string; fecha: string };
type SurgeryDetail = { description: string; date: string; complications: string };
type HabitDetail = { frequency?: string; amount?: string };
type SmokingDetail = {
  cigarette?: HabitDetail & { active?: boolean };
  vape?: HabitDetail & { active?: boolean };
  hookah?: HabitDetail & { active?: boolean };
};
type AlcoholismDetail = HabitDetail & { active?: boolean; drink?: string };
type DrugsDetail = HabitDetail & { active?: boolean; substance?: string };
type ActivityDetail = HabitDetail & { active?: boolean; type?: string };

interface ExtendedData {
  chronic_other?: ChronicOther[];
  surgeries?: SurgeryDetail[];
  complications?: string;
  family_matrix?: Record<string, string[]>; // disease -> [relations]
  habits_detail?: {
    alcoholism?: AlcoholismDetail;
    smoking?: SmokingDetail;
    drugs?: DrugsDetail;
    physical_activity?: ActivityDetail;
  };
}

interface ClinicalHistory {
  id: string;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  previous_surgeries: string | null;
  family_history: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  sex: string | null;
  date_of_birth: string | null;
  extended_data: ExtendedData;
}

interface ChildProfile {
  id: string;
  name: string;
  date_of_birth: string;
  sex: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  notes: string | null;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const FAMILY_DISEASES = [
  { key: 'diabetes', labelKey: 'familyDiseases.diabetes' },
  { key: 'hipertension', labelKey: 'familyDiseases.hipertension' },
  { key: 'cancer', labelKey: 'familyDiseases.cancer' },
  { key: 'cardiopatia', labelKey: 'familyDiseases.cardiopatia' },
  { key: 'mental', labelKey: 'familyDiseases.mental' },
  { key: 'obesidad', labelKey: 'familyDiseases.obesidad' },
];
const RELATIONS = [
  { key: 'mama', labelKey: 'relations.mama' },
  { key: 'papa', labelKey: 'relations.papa' },
  { key: 'hijos', labelKey: 'relations.hijos' },
  { key: 'abuelos', labelKey: 'relations.abuelos' },
];

const FREQ_OPTION_KEYS = ['diario', 'semanal', 'mensual', 'ocasional', 'nunca'] as const;

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// =================== Component ===================
export function PatientClinicalHistoryCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [history, setHistory] = useState<ClinicalHistory | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<ClinicalHistory>>({ extended_data: {} });

  // Child editor state
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [childForm, setChildForm] = useState<Partial<ChildProfile>>({});

  useEffect(() => {
    if (!user?.id) return;
    const fetchAll = async () => {
      const [{ data: hData }, { data: cData }] = await Promise.all([
        supabase.from('patient_clinical_history').select('*').eq('patient_id', user.id).maybeSingle(),
        supabase.from('child_profiles').select('*').eq('parent_id', user.id).order('date_of_birth', { ascending: false }),
      ]);
      if (hData) {
        const h = { ...(hData as any), extended_data: (hData as any).extended_data || {} } as ClinicalHistory;
        setHistory(h);
        setForm(h);
      }
      if (cData) setChildren(cData as ChildProfile[]);
      setIsLoading(false);
    };
    fetchAll();
  }, [user?.id]);

  const ext: ExtendedData = (form.extended_data as ExtendedData) || {};
  const updateExt = (patch: Partial<ExtendedData>) =>
    setForm(p => ({ ...p, extended_data: { ...(p.extended_data || {}), ...patch } }));

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const payload: any = {
        patient_id: user.id,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        chronic_conditions: form.chronic_conditions || null,
        current_medications: form.current_medications || null,
        previous_surgeries: form.previous_surgeries || null,
        family_history: form.family_history || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        height_cm: form.height_cm || null,
        weight_kg: form.weight_kg || null,
        sex: form.sex || null,
        date_of_birth: form.date_of_birth || null,
        extended_data: form.extended_data || {},
        updated_at: new Date().toISOString(),
      };

      if (history?.id) {
        const { error } = await supabase.from('patient_clinical_history').update(payload).eq('id', history.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('patient_clinical_history').insert(payload).select().single();
        if (error) throw error;
        if (data) setHistory({ ...(data as any), extended_data: (data as any).extended_data || {} } as ClinicalHistory);
      }

      setHistory(prev => (prev ? { ...prev, ...payload } : ({ id: '', ...payload } as ClinicalHistory)));
      setIsEditing(false);
      toast.success(t('patientClinicalHistoryCard.saved'));
    } catch (e: any) {
      console.error('[ClinicalHistory] save error', e);
      toast.error(t('patientClinicalHistoryCard.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Children helpers ----------
  const openChildForm = (c?: ChildProfile) => {
    setEditingChild(c || null);
    setChildForm(c ? { ...c } : { name: '', date_of_birth: '' });
    setShowChildForm(true);
  };
  const saveChild = async () => {
    if (!user?.id || !childForm.name || !childForm.date_of_birth) {
      toast.error(t('patientClinicalHistoryCard.child.requiredFields'));
      return;
    }
    try {
      if (editingChild?.id) {
        const { error } = await supabase
          .from('child_profiles')
          .update({
            name: childForm.name,
            date_of_birth: childForm.date_of_birth,
            sex: childForm.sex || null,
            blood_type: childForm.blood_type || null,
            allergies: childForm.allergies || null,
            chronic_conditions: childForm.chronic_conditions || null,
            current_medications: childForm.current_medications || null,
            notes: childForm.notes || null,
          })
          .eq('id', editingChild.id);
        if (error) throw error;
        setChildren(prev => prev.map(c => (c.id === editingChild.id ? ({ ...c, ...childForm } as ChildProfile) : c)));
      } else {
        const { data, error } = await supabase
          .from('child_profiles')
          .insert({
            parent_id: user.id,
            name: childForm.name!,
            date_of_birth: childForm.date_of_birth!,
            sex: childForm.sex || null,
            blood_type: childForm.blood_type || null,
            allergies: childForm.allergies || null,
            chronic_conditions: childForm.chronic_conditions || null,
            current_medications: childForm.current_medications || null,
            notes: childForm.notes || null,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setChildren(prev => [data as ChildProfile, ...prev]);
      }
      setShowChildForm(false);
      setEditingChild(null);
      setChildForm({});
      toast.success(t('patientClinicalHistoryCard.child.saved'));
    } catch (e: any) {
      console.error('[ChildProfile] save error', e);
      toast.error(t('patientClinicalHistoryCard.child.saveError'));
    }
  };
  const deleteChild = async (id: string) => {
    if (!confirm(t('patientClinicalHistoryCard.child.confirmDelete'))) return;
    const { error } = await supabase.from('child_profiles').delete().eq('id', id);
    if (error) {
      toast.error(t('patientClinicalHistoryCard.child.deleteError'));
      return;
    }
    setChildren(prev => prev.filter(c => c.id !== id));
    toast.success(t('patientClinicalHistoryCard.child.deleted'));
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const isFemale = (form.sex || history?.sex) === 'female';

  // ---------- Sub-renderers ----------
  const renderChronicOther = () => {
    const list = ext.chronic_other || [];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t('patientClinicalHistoryCard.chronicOther.title')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateExt({ chronic_other: [...list, { cual: '', diagnostico: '', tratamiento: '', fecha: '' }] })
            }
          >
            <Plus className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.add')}
          </Button>
        </div>
        {list.map((item, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border">
            <Input
              placeholder={t('patientClinicalHistoryCard.chronicOther.whichPlaceholder')}
              value={item.cual}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], cual: e.target.value };
                updateExt({ chronic_other: next });
              }}
            />
            <Input
              type="date"
              value={item.fecha}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], fecha: e.target.value };
                updateExt({ chronic_other: next });
              }}
            />
            <Textarea
              placeholder={t('patientClinicalHistoryCard.chronicOther.diagnosisPlaceholder')}
              rows={2}
              value={item.diagnostico}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], diagnostico: e.target.value };
                updateExt({ chronic_other: next });
              }}
            />
            <Textarea
              placeholder={t('patientClinicalHistoryCard.chronicOther.treatmentPlaceholder')}
              rows={2}
              value={item.tratamiento}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], tratamiento: e.target.value };
                updateExt({ chronic_other: next });
              }}
            />
            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateExt({ chronic_other: list.filter((_, j) => j !== i) })}
              >
                <Trash2 className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.remove')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSurgeries = () => {
    const list = ext.surgeries || [];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t('patientClinicalHistoryCard.surgeries.title')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateExt({ surgeries: [...list, { description: '', date: '', complications: '' }] })}
          >
            <Plus className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.add')}
          </Button>
        </div>
        {list.map((item, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border">
            <Input
              placeholder={t('patientClinicalHistoryCard.surgeries.descriptionPlaceholder')}
              value={item.description}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], description: e.target.value };
                updateExt({ surgeries: next });
              }}
            />
            <Input
              type="date"
              value={item.date}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], date: e.target.value };
                updateExt({ surgeries: next });
              }}
            />
            <Textarea
              placeholder={t('patientClinicalHistoryCard.surgeries.complicationsPlaceholder')}
              rows={2}
              className="sm:col-span-2"
              value={item.complications}
              onChange={e => {
                const next = [...list];
                next[i] = { ...next[i], complications: e.target.value };
                updateExt({ surgeries: next });
              }}
            />
            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateExt({ surgeries: list.filter((_, j) => j !== i) })}
              >
                <Trash2 className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.remove')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFamilyMatrix = () => {
    const matrix = ext.family_matrix || {};
    const toggle = (disease: string, rel: string) => {
      const current = matrix[disease] || [];
      const next = current.includes(rel) ? current.filter(r => r !== rel) : [...current, rel];
      updateExt({ family_matrix: { ...matrix, [disease]: next } });
    };
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('patientClinicalHistoryCard.familyMatrix.title')}</Label>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">{t('patientClinicalHistoryCard.familyMatrix.diseaseHeader')}</th>
                {RELATIONS.map(r => (
                  <th key={r.key} className="p-2 text-center">{t(`patientClinicalHistoryCard.${r.labelKey}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAMILY_DISEASES.map(d => (
                <tr key={d.key} className="border-t">
                  <td className="p-2 font-medium">{t(`patientClinicalHistoryCard.${d.labelKey}`)}</td>
                  {RELATIONS.map(r => (
                    <td key={r.key} className="p-2 text-center">
                      <Checkbox
                        checked={(matrix[d.key] || []).includes(r.key)}
                        onCheckedChange={() => toggle(d.key, r.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHabits = () => {
    const h = ext.habits_detail || {};
    const setH = (patch: any) => updateExt({ habits_detail: { ...h, ...patch } });

    const renderSubHabit = (
      label: string,
      key: 'cigarette' | 'vape' | 'hookah'
    ) => {
      const sub = (h.smoking?.[key] as any) || {};
      const setSub = (patch: any) =>
        setH({ smoking: { ...(h.smoking || {}), [key]: { ...sub, ...patch } } });
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center pl-4 border-l-2 border-muted">
          <div className="flex items-center gap-2">
            <Checkbox checked={!!sub.active} onCheckedChange={v => setSub({ active: !!v })} />
            <span className="text-sm">{label}</span>
          </div>
          <Select value={sub.frequency || ''} onValueChange={v => setSub({ frequency: v })}>
            <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.habits.frequencyPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {FREQ_OPTION_KEYS.map(o => <SelectItem key={o} value={t(`patientClinicalHistoryCard.freq.${o}`)}>{t(`patientClinicalHistoryCard.freq.${o}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder={t('patientClinicalHistoryCard.habits.amountPlaceholder')}
            value={sub.amount || ''}
            onChange={e => setSub({ amount: e.target.value })}
          />
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <Label className="text-sm font-medium">{t('patientClinicalHistoryCard.habits.title')}</Label>

        {/* Alcoholismo */}
        <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
          <div className="flex items-center gap-2">
            <Wine className="w-4 h-4 text-muted-foreground" />
            <Checkbox
              checked={!!h.alcoholism?.active}
              onCheckedChange={v => setH({ alcoholism: { ...(h.alcoholism || {}), active: !!v } })}
            />
            <span className="text-sm font-medium">{t('patientClinicalHistoryCard.habits.alcoholism')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.drinkPlaceholder')}
              value={h.alcoholism?.drink || ''}
              onChange={e => setH({ alcoholism: { ...(h.alcoholism || {}), drink: e.target.value } })}
            />
            <Select
              value={h.alcoholism?.frequency || ''}
              onValueChange={v => setH({ alcoholism: { ...(h.alcoholism || {}), frequency: v } })}
            >
              <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.habits.frequencyPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTION_KEYS.map(o => <SelectItem key={o} value={t(`patientClinicalHistoryCard.freq.${o}`)}>{t(`patientClinicalHistoryCard.freq.${o}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.amountPlaceholder')}
              value={h.alcoholism?.amount || ''}
              onChange={e => setH({ alcoholism: { ...(h.alcoholism || {}), amount: e.target.value } })}
            />
          </div>
        </div>

        {/* Tabaquismo */}
        <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
          <div className="flex items-center gap-2">
            <Cigarette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('patientClinicalHistoryCard.habits.smoking')}</span>
          </div>
          {renderSubHabit(t('patientClinicalHistoryCard.habits.cigarette'), 'cigarette')}
          {renderSubHabit(t('patientClinicalHistoryCard.habits.vape'), 'vape')}
          {renderSubHabit(t('patientClinicalHistoryCard.habits.hookah'), 'hookah')}
        </div>

        {/* Otras drogas */}
        <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!h.drugs?.active}
              onCheckedChange={v => setH({ drugs: { ...(h.drugs || {}), active: !!v } })}
            />
            <span className="text-sm font-medium">{t('patientClinicalHistoryCard.habits.otherDrugs')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.substancePlaceholder')}
              value={h.drugs?.substance || ''}
              onChange={e => setH({ drugs: { ...(h.drugs || {}), substance: e.target.value } })}
            />
            <Select
              value={h.drugs?.frequency || ''}
              onValueChange={v => setH({ drugs: { ...(h.drugs || {}), frequency: v } })}
            >
              <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.habits.frequencyPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTION_KEYS.map(o => <SelectItem key={o} value={t(`patientClinicalHistoryCard.freq.${o}`)}>{t(`patientClinicalHistoryCard.freq.${o}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.amountPlaceholder')}
              value={h.drugs?.amount || ''}
              onChange={e => setH({ drugs: { ...(h.drugs || {}), amount: e.target.value } })}
            />
          </div>
        </div>

        {/* Actividad física */}
        <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <Checkbox
              checked={!!h.physical_activity?.active}
              onCheckedChange={v =>
                setH({ physical_activity: { ...(h.physical_activity || {}), active: !!v } })
              }
            />
            <span className="text-sm font-medium">{t('patientClinicalHistoryCard.habits.physicalActivity')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.activityTypePlaceholder')}
              value={h.physical_activity?.type || ''}
              onChange={e =>
                setH({ physical_activity: { ...(h.physical_activity || {}), type: e.target.value } })
              }
            />
            <Select
              value={h.physical_activity?.frequency || ''}
              onValueChange={v =>
                setH({ physical_activity: { ...(h.physical_activity || {}), frequency: v } })
              }
            >
              <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.habits.frequencyPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {FREQ_OPTION_KEYS.map(o => <SelectItem key={o} value={t(`patientClinicalHistoryCard.freq.${o}`)}>{t(`patientClinicalHistoryCard.freq.${o}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('patientClinicalHistoryCard.habits.durationPlaceholder')}
              value={h.physical_activity?.amount || ''}
              onChange={e =>
                setH({ physical_activity: { ...(h.physical_activity || {}), amount: e.target.value } })
              }
            />
          </div>
        </div>
      </div>
    );
  };

  const renderChildren = () => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Baby className="w-4 h-4 text-muted-foreground" />
            {t('patientClinicalHistoryCard.children.title')}
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={() => openChildForm()}>
            <Plus className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.children.add')}
          </Button>
        </div>

        {children.length === 0 && !showChildForm && (
          <p className="text-xs text-muted-foreground italic">{t('patientClinicalHistoryCard.children.empty')}</p>
        )}

        {children.map(c => {
          const age = calcAge(c.date_of_birth);
          const adult = age !== null && age >= 18;
          return (
            <div key={c.id} className="p-3 rounded-lg bg-muted/30 border flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {c.name} <span className="text-xs text-muted-foreground">· {age ?? '?'} {t('patientClinicalHistoryCard.children.yearsLabel')}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.blood_type ? `${t('patientClinicalHistoryCard.children.bloodLabel')} ${c.blood_type} · ` : ''}{c.sex || '—'}
                </p>
                {adult && (
                  <Badge variant="outline" className="mt-1 text-xs bg-warning/10 text-warning border-warning/30">
                    {t('patientClinicalHistoryCard.children.adultBadge')}
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                {!adult && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title={t('patientClinicalHistoryCard.children.duplicateTitle')}
                    onClick={async () => {
                      if (!user?.id) return;
                      if (!confirm(`${t('patientClinicalHistoryCard.children.confirmDuplicatePrefix')} ${c.name}?`)) return;
                      const { data: mine } = await supabase
                        .from('patient_clinical_history')
                        .select('*')
                        .eq('patient_id', user.id)
                        .is('child_id', null)
                        .maybeSingle();
                      if (!mine) { toast.error(t('patientClinicalHistoryCard.children.noHistoryYet')); return; }
                      const { id, created_at, updated_at, ...rest } = mine as any;
                      const { error } = await supabase
                        .from('patient_clinical_history')
                        .upsert({ ...rest, patient_id: user.id, child_id: c.id }, { onConflict: 'patient_id,child_id' } as any);
                      if (error) toast.error(`${t('patientClinicalHistoryCard.children.duplicateError')} ${error.message}`);
                      else toast.success(`${t('patientClinicalHistoryCard.children.duplicatedTo')} ${c.name}`);
                    }}
                  >
                    <Copy className="w-3 h-3 text-primary" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" onClick={() => openChildForm(c)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => deleteChild(c.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}

        {showChildForm && (
          <div className="p-3 rounded-lg bg-card border-2 border-primary/20 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.name')}</Label>
                <Input value={childForm.name || ''} onChange={e => setChildForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.dob')}</Label>
                <Input
                  type="date"
                  value={childForm.date_of_birth || ''}
                  onChange={e => setChildForm(p => ({ ...p, date_of_birth: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.sex')}</Label>
                <Select value={childForm.sex || ''} onValueChange={v => setChildForm(p => ({ ...p, sex: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.selectPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">{t('patientClinicalHistoryCard.sex.female')}</SelectItem>
                    <SelectItem value="male">{t('patientClinicalHistoryCard.sex.male')}</SelectItem>
                    <SelectItem value="other">{t('patientClinicalHistoryCard.sex.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.bloodType')}</Label>
                <Select value={childForm.blood_type || ''} onValueChange={v => setChildForm(p => ({ ...p, blood_type: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.selectPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.allergies')}</Label>
                <Textarea rows={2} value={childForm.allergies || ''} onChange={e => setChildForm(p => ({ ...p, allergies: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.chronicConditions')}</Label>
                <Textarea rows={2} value={childForm.chronic_conditions || ''} onChange={e => setChildForm(p => ({ ...p, chronic_conditions: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.currentMedications')}</Label>
                <Textarea rows={2} value={childForm.current_medications || ''} onChange={e => setChildForm(p => ({ ...p, current_medications: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowChildForm(false); setEditingChild(null); }}>
                {t('patientClinicalHistoryCard.cancel')}
              </Button>
              <Button type="button" size="sm" onClick={saveChild}>
                <Check className="w-3 h-3 mr-1" /> {t('patientClinicalHistoryCard.save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const baseFields = [
    { key: 'blood_type', icon: Droplets, labelKey: 'fields.bloodType', type: 'select' },
    { key: 'height_cm', icon: Ruler, labelKey: 'fields.height', type: 'number' },
    { key: 'weight_kg', icon: Weight, labelKey: 'fields.weight', type: 'number' },
    { key: 'allergies', icon: AlertTriangle, labelKey: 'fields.allergies', type: 'textarea' },
    { key: 'chronic_conditions', icon: Heart, labelKey: 'fields.chronicConditions', type: 'textarea' },
    { key: 'current_medications', icon: Pill, labelKey: 'fields.currentMedications', type: 'textarea' },
    { key: 'previous_surgeries', icon: FileText, labelKey: 'fields.previousSurgeries', type: 'textarea' },
    { key: 'family_history', icon: Users, labelKey: 'fields.familyHistory', type: 'textarea' },
    { key: 'emergency_contact_name', icon: Phone, labelKey: 'fields.emergencyContactName', type: 'text' },
    { key: 'emergency_contact_phone', icon: Phone, labelKey: 'fields.emergencyContactPhone', type: 'text' },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    >
      <Card className="mb-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t('patientClinicalHistoryCard.title')}
              </CardTitle>
              <div className="flex items-center gap-2">
                {history && !isEditing && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                    {t('patientClinicalHistoryCard.completed')}
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
              </div>
            </div>
            <CardDescription>
              {t('patientClinicalHistoryCard.subtitle')}
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {!isEditing && !history && (
                <div className="text-center py-4">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('patientClinicalHistoryCard.empty')}
                  </p>
                  <Button size="sm" onClick={() => { setIsEditing(true); setForm({ extended_data: {} }); }}>
                    <Pencil className="w-4 h-4 mr-1" />
                    {t('patientClinicalHistoryCard.fillNow')}
                  </Button>
                </div>
              )}

              {!isEditing && history && (
                <>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setIsEditing(true); setForm(history); }}>
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('patientClinicalHistoryCard.edit')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {baseFields.map(({ key, icon: Icon, labelKey }) => {
                      const val = (history as any)[key];
                      return (
                        <div key={key} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t(`patientClinicalHistoryCard.${labelKey}`)}</p>
                            <p className="text-sm font-medium truncate">
                              {val || <span className="text-muted-foreground italic text-xs">—</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Read-only summary for extended data */}
                  {(history.extended_data?.chronic_other?.length || 0) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>{t('patientClinicalHistoryCard.summary.otherConditions')}</strong> {history.extended_data!.chronic_other!.length} {t('patientClinicalHistoryCard.summary.registered')}
                    </div>
                  )}
                  {(history.extended_data?.surgeries?.length || 0) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>{t('patientClinicalHistoryCard.summary.detailedSurgeries')}</strong> {history.extended_data!.surgeries!.length}
                    </div>
                  )}

                  {isFemale && (
                    <>
                      <Separator />
                      {renderChildren()}
                    </>
                  )}
                </>
              )}

              {isEditing && (
                <div className="space-y-6">
                  {/* Sexo + DOB para activar lógica de hijos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t('patientClinicalHistoryCard.childForm.sex')}</Label>
                      <Select
                        value={form.sex || ''}
                        onValueChange={v => setForm(p => ({ ...p, sex: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.selectPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">{t('patientClinicalHistoryCard.sex.female')}</SelectItem>
                          <SelectItem value="male">{t('patientClinicalHistoryCard.sex.male')}</SelectItem>
                          <SelectItem value="other">{t('patientClinicalHistoryCard.sex.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('patientClinicalHistoryCard.dobLabel')}</Label>
                      <Input
                        type="date"
                        value={form.date_of_birth || ''}
                        onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {baseFields.map(({ key, labelKey, type }) => (
                      <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                        <Label className="text-xs">{t(`patientClinicalHistoryCard.${labelKey}`)}</Label>
                        {type === 'select' ? (
                          <Select value={(form as any)[key] || ''} onValueChange={v => setForm(p => ({ ...p, [key]: v }))}>
                            <SelectTrigger><SelectValue placeholder={t('patientClinicalHistoryCard.selectPlaceholder')} /></SelectTrigger>
                            <SelectContent>
                              {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : type === 'textarea' ? (
                          <Textarea
                            value={(form as any)[key] || ''}
                            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                        ) : (
                          <Input
                            type={type}
                            value={(form as any)[key] || ''}
                            onChange={e =>
                              setForm(p => ({
                                ...p,
                                [key]: type === 'number' ? Number(e.target.value) || null : e.target.value,
                              }))
                            }
                            className="text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <Separator />
                  {renderChronicOther()}

                  <Separator />
                  {renderSurgeries()}

                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('patientClinicalHistoryCard.complications.title')}</Label>
                    <Textarea
                      rows={2}
                      placeholder={t('patientClinicalHistoryCard.complications.placeholder')}
                      value={ext.complications || ''}
                      onChange={e => updateExt({ complications: e.target.value })}
                    />
                  </div>

                  <Separator />
                  {renderFamilyMatrix()}

                  <Separator />
                  {renderHabits()}

                  {isFemale && (
                    <>
                      <Separator />
                      {renderChildren()}
                    </>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setForm(history || { extended_data: {} }); }}>
                      <X className="w-4 h-4 mr-1" />
                      {t('patientClinicalHistoryCard.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                      {t('patientClinicalHistoryCard.save')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}
