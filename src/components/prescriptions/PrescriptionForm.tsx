import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { exportPrescriptionToPDF, type Medication } from '@/lib/generatePrescriptionPDF';
import { FileText, Plus, Trash2, Loader2, Download } from 'lucide-react';

interface PrescriptionFormProps {
  patientId: string;
  patientName: string;
  consultationId?: string;
  onCreated?: () => void;
}

export function PrescriptionForm({ patientId, patientName, consultationId, onCreated }: PrescriptionFormProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientAge, setPatientAge] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' },
  ]);

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleSubmit = async () => {
    if (!user?.id || !user.doctorProfile) return;

    const validMeds = medications.filter(m => m.name.trim());
    if (validMeds.length === 0) {
      toast.error(language === 'es' ? 'Agrega al menos un medicamento' : 'Add at least one medication');
      return;
    }

    setIsSubmitting(true);
    try {
      const prescriptionData = {
        doctor_id: user.id,
        patient_id: patientId,
        consultation_id: consultationId || null,
        patient_name: patientName,
        patient_age: patientAge || null,
        diagnosis: diagnosis || null,
        medications: validMeds as any,
        instructions: instructions || null,
        notes: notes || null,
        doctor_name: user.name || 'Doctor',
        doctor_specialty: user.doctorProfile.specialty,
        doctor_license: user.doctorProfile.license,
        doctor_cedula: user.doctorProfile.cedulaProfesional || null,
      };

      const { data, error } = await supabase
        .from('prescriptions')
        .insert([prescriptionData])
        .select()
        .single();

      if (error) throw error;

      // Auto-generate PDF
      exportPrescriptionToPDF({
        id: data.id,
        patientName,
        patientAge: patientAge || undefined,
        diagnosis: diagnosis || undefined,
        medications: validMeds,
        instructions: instructions || undefined,
        notes: notes || undefined,
        doctorName: user.name || 'Doctor',
        doctorSpecialty: user.doctorProfile.specialty,
        doctorLicense: user.doctorProfile.license,
        doctorCedula: user.doctorProfile.cedulaProfesional || undefined,
        signedAt: new Date(data.signed_at),
      });

      toast.success(language === 'es' ? 'Receta creada exitosamente' : 'Prescription created');
      onCreated?.();
    } catch (error: any) {
      toast.error(error.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {language === 'es' ? 'Nueva Receta Electrónica' : 'New Electronic Prescription'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{language === 'es' ? 'Paciente' : 'Patient'}</Label>
            <Input value={patientName} disabled />
          </div>
          <div>
            <Label>{language === 'es' ? 'Edad' : 'Age'}</Label>
            <Input
              placeholder="Ej: 35 años"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>{language === 'es' ? 'Diagnóstico' : 'Diagnosis'}</Label>
          <Input
            placeholder={language === 'es' ? 'Diagnóstico del paciente' : 'Patient diagnosis'}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </div>

        {/* Medications */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>{language === 'es' ? 'Medicamentos' : 'Medications'}</Label>
            <Button variant="outline" size="sm" onClick={addMedication} className="gap-1">
              <Plus className="w-3 h-3" />
              {language === 'es' ? 'Agregar' : 'Add'}
            </Button>
          </div>
          <div className="space-y-3">
            {medications.map((med, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">#{i + 1}</span>
                  {medications.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMedication(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={language === 'es' ? 'Medicamento *' : 'Medication *'}
                    value={med.name}
                    onChange={(e) => updateMedication(i, 'name', e.target.value)}
                  />
                  <Input
                    placeholder={language === 'es' ? 'Dosis (ej: 500mg)' : 'Dosage'}
                    value={med.dosage}
                    onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                  />
                  <Input
                    placeholder={language === 'es' ? 'Frecuencia (ej: c/8h)' : 'Frequency'}
                    value={med.frequency}
                    onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                  />
                  <Input
                    placeholder={language === 'es' ? 'Duración (ej: 7 días)' : 'Duration'}
                    value={med.duration}
                    onChange={(e) => updateMedication(i, 'duration', e.target.value)}
                  />
                </div>
                <Input
                  placeholder={language === 'es' ? 'Notas del medicamento (opcional)' : 'Medication notes'}
                  value={med.notes || ''}
                  onChange={(e) => updateMedication(i, 'notes', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>{language === 'es' ? 'Indicaciones generales' : 'General instructions'}</Label>
          <Textarea
            placeholder={language === 'es' ? 'Indicaciones para el paciente...' : 'Instructions...'}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label>{language === 'es' ? 'Notas adicionales' : 'Additional notes'}</Label>
          <Textarea
            placeholder={language === 'es' ? 'Observaciones o notas...' : 'Observations...'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2">
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {language === 'es' ? 'Crear Receta y Generar PDF' : 'Create Prescription & Generate PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}
