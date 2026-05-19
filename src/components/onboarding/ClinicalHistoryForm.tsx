import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();

  const update = (field: keyof ClinicalHistoryData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">{t('clinicalHistoryForm.bloodType')}</Label>
          <Select value={data.bloodType} onValueChange={(v) => update('bloodType', v)}>
            <SelectTrigger>
              <SelectValue placeholder={t('clinicalHistoryForm.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_TYPES.map(bt => (
                <SelectItem key={bt} value={bt}>
                  {bt === 'No sé' ? t('clinicalHistoryForm.bloodTypeUnknown') : bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('clinicalHistoryForm.heightCm')}</Label>
          <Input type="number" placeholder={t('clinicalHistoryForm.heightPlaceholder')} value={data.heightCm} onChange={e => update('heightCm', e.target.value)} />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">{t('clinicalHistoryForm.weightKg')}</Label>
          <Input type="number" placeholder={t('clinicalHistoryForm.weightPlaceholder')} value={data.weightKg} onChange={e => update('weightKg', e.target.value)} />
        </div>
        <div />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">{t('clinicalHistoryForm.allergies')}</Label>
        <Textarea placeholder={t('clinicalHistoryForm.allergiesPlaceholder')} rows={2} value={data.allergies} onChange={e => update('allergies', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">{t('clinicalHistoryForm.chronicConditions')}</Label>
        <Textarea placeholder={t('clinicalHistoryForm.chronicConditionsPlaceholder')} rows={2} value={data.chronicConditions} onChange={e => update('chronicConditions', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">{t('clinicalHistoryForm.currentMedications')}</Label>
        <Textarea placeholder={t('clinicalHistoryForm.currentMedicationsPlaceholder')} rows={2} value={data.currentMedications} onChange={e => update('currentMedications', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">{t('clinicalHistoryForm.previousSurgeries')}</Label>
        <Textarea placeholder={t('clinicalHistoryForm.previousSurgeriesPlaceholder')} rows={2} value={data.previousSurgeries} onChange={e => update('previousSurgeries', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <Label className="text-sm">{t('clinicalHistoryForm.familyHistory')}</Label>
        <Textarea placeholder={t('clinicalHistoryForm.familyHistoryPlaceholder')} rows={2} value={data.familyHistory} onChange={e => update('familyHistory', e.target.value)} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">{t('clinicalHistoryForm.emergencyContact')}</Label>
          <Input placeholder={t('clinicalHistoryForm.emergencyContactNamePlaceholder')} value={data.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('clinicalHistoryForm.emergencyContactPhone')}</Label>
          <Input placeholder={t('clinicalHistoryForm.emergencyContactPhonePlaceholder')} value={data.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} />
        </div>
      </motion.div>
    </div>
  );
}

export type { ClinicalHistoryData };
