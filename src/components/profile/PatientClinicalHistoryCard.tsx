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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText, Loader2, Pencil, Check, X, ChevronDown, Heart, Pill, AlertTriangle, Phone, Ruler, Weight, Droplets, Users,
} from 'lucide-react';
import { toast } from 'sonner';

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
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function PatientClinicalHistoryCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [history, setHistory] = useState<ClinicalHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<Partial<ClinicalHistory>>({});

  useEffect(() => {
    if (!user?.id) return;
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('patient_clinical_history')
        .select('*')
        .eq('patient_id', user.id)
        .maybeSingle();
      if (data) {
        setHistory(data as ClinicalHistory);
        setForm(data as ClinicalHistory);
      }
      setIsLoading(false);
    };
    fetchHistory();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const payload = {
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
        updated_at: new Date().toISOString(),
      };

      if (history?.id) {
        const { error } = await supabase
          .from('patient_clinical_history')
          .update(payload)
          .eq('id', history.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('patient_clinical_history')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setHistory(data as ClinicalHistory);
      }

      setHistory(prev => prev ? { ...prev, ...payload } : { id: '', ...payload } as ClinicalHistory);
      setIsEditing(false);
      toast.success(t('clinicalHistory.saved') || 'Historial guardado');
    } catch (e) {
      toast.error(t('clinicalHistory.saveError') || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    { key: 'blood_type', icon: Droplets, label: t('clinicalHistory.bloodType') || 'Tipo de Sangre', type: 'select' },
    { key: 'height_cm', icon: Ruler, label: t('clinicalHistory.height') || 'Estatura (cm)', type: 'number' },
    { key: 'weight_kg', icon: Weight, label: t('clinicalHistory.weight') || 'Peso (kg)', type: 'number' },
    { key: 'allergies', icon: AlertTriangle, label: t('clinicalHistory.allergies') || 'Alergias', type: 'textarea' },
    { key: 'chronic_conditions', icon: Heart, label: t('clinicalHistory.conditions') || 'Condiciones Crónicas', type: 'textarea' },
    { key: 'current_medications', icon: Pill, label: t('clinicalHistory.medications') || 'Medicamentos Actuales', type: 'textarea' },
    { key: 'previous_surgeries', icon: FileText, label: t('clinicalHistory.surgeries') || 'Cirugías Previas', type: 'textarea' },
    { key: 'family_history', icon: Users, label: t('clinicalHistory.familyHistory') || 'Antecedentes Familiares', type: 'textarea' },
    { key: 'emergency_contact_name', icon: Phone, label: t('clinicalHistory.emergencyName') || 'Contacto de Emergencia', type: 'text' },
    { key: 'emergency_contact_phone', icon: Phone, label: t('clinicalHistory.emergencyPhone') || 'Teléfono de Emergencia', type: 'text' },
  ];

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

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
                {t('clinicalHistory.title') || 'Historial Clínico'}
              </CardTitle>
              <div className="flex items-center gap-2">
                {history && !isEditing && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                    {t('clinicalHistory.completed') || 'Completado'}
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
              </div>
            </div>
            <CardDescription>
              {t('clinicalHistory.subtitle') || 'Tu historial clínico básico almacenado de forma segura'}
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {!isEditing && !history && (
                <div className="text-center py-4">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('clinicalHistory.empty') || 'No has completado tu historial clínico aún'}
                  </p>
                  <Button size="sm" onClick={() => { setIsEditing(true); setForm({}); }}>
                    <Pencil className="w-4 h-4 mr-1" />
                    {t('clinicalHistory.fillNow') || 'Completar ahora'}
                  </Button>
                </div>
              )}

              {!isEditing && history && (
                <>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setIsEditing(true); setForm(history); }}>
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('common.edit') || 'Editar'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map(({ key, icon: Icon, label }) => {
                      const val = (history as any)[key];
                      return (
                        <div key={key} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-medium truncate">
                              {val || <span className="text-muted-foreground italic text-xs">—</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {isEditing && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(({ key, label, type }) => (
                      <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                        <Label className="text-xs">{label}</Label>
                        {type === 'select' ? (
                          <Select value={(form as any)[key] || ''} onValueChange={v => setForm(p => ({ ...p, [key]: v }))}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
                            onChange={e => setForm(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) || null : e.target.value }))}
                            className="text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setForm(history || {}); }}>
                      <X className="w-4 h-4 mr-1" />
                      {t('common.cancel') || 'Cancelar'}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                      {t('common.save') || 'Guardar'}
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
