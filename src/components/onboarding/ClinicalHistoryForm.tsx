import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];

interface ClinicalHistoryData {
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  previousSurgeries: string;
  familyHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  heightCm: string;
  weightKg: string;
}

interface ClinicalHistoryFormProps {
  data: ClinicalHistoryData;
  onChange: (data: ClinicalHistoryData) => void;
}

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 25 } }
};

export function ClinicalHistoryForm({ data, onChange }: ClinicalHistoryFormProps) {
  const update = (field: keyof ClinicalHistoryData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Tipo de sangre</Label>
          <Select value={data.bloodType} onValueChange={(v) => update('bloodType', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPES.map(bt => (
                <SelectItem key={bt} value={bt}>{bt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Estatura (cm)</Label>
          <Input type="number" placeholder="170" value={data.heightCm} onChange={e => update('heightCm', e.target.value)} />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Peso (kg)</Label>
          <Input type="number" placeholder="70" value={data.weightKg} onChange={e => update('weightKg', e.target.value)} />
        </div>
        <div />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">Alergias conocidas</Label>
        <Textarea placeholder="Ej: Penicilina, mariscos, látex..." rows={2} value={data.allergies} onChange={e => update('allergies', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">Condiciones crónicas</Label>
        <Textarea placeholder="Ej: Diabetes, hipertensión, asma..." rows={2} value={data.chronicConditions} onChange={e => update('chronicConditions', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">Medicamentos actuales</Label>
        <Textarea placeholder="Ej: Metformina 500mg, Losartán 50mg..." rows={2} value={data.currentMedications} onChange={e => update('currentMedications', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">Cirugías previas</Label>
        <Textarea placeholder="Ej: Apendicectomía (2020)..." rows={2} value={data.previousSurgeries} onChange={e => update('previousSurgeries', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">Antecedentes familiares</Label>
        <Textarea placeholder="Ej: Padre con diabetes, madre con hipertensión..." rows={2} value={data.familyHistory} onChange={e => update('familyHistory', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Contacto de emergencia</Label>
          <Input placeholder="Nombre" value={data.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Teléfono de emergencia</Label>
          <Input placeholder="55 1234 5678" value={data.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} />
        </div>
      </motion.div>
    </div>
  );
}

export type { ClinicalHistoryData };
