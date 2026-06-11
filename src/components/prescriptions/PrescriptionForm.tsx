import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { exportPrescriptionToPDF, type Medication } from '@/lib/generatePrescriptionPDF';
import { 
  FileText, Plus, Trash2, Loader2, Download, Upload, Image, File, X 
} from 'lucide-react';

interface PrescriptionFormProps {
  patientId: string;
  patientName: string;
  consultationId?: string;
  onCreated?: (prescriptionId?: string) => void;
}

export function PrescriptionForm({ patientId, patientName, consultationId, onCreated }: PrescriptionFormProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientAge, setPatientAge] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' },
  ]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('autoI18n.prescForm1'));
      return;
    }

    setAttachedFile(file);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!user?.id || !user.doctorProfile) return;

    // Fetch doctor signature
    let doctorSignatureUrl: string | undefined;
    try {
      const { data: dp } = await supabase
        .from('doctor_profiles')
        .select('signature_url')
        .eq('user_id', user.id)
        .single();
      doctorSignatureUrl = (dp as any)?.signature_url || undefined;
    } catch {}


    const validMeds = medications.filter(m => m.name.trim());

    // Must have at least one medication OR an attached file
    if (validMeds.length === 0 && !attachedFile) {
      toast.error(t('autoI18n.prescForm2'));
      return;
    }

    // A prescription is a signed medical document: it cannot be issued without
    // the doctor's professional signature on file. (Before, the signature was
    // optional and the PDF was generated unsigned.)
    if (!doctorSignatureUrl) {
      toast.error(t('autoI18n.prescForm3'));
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl: string | null = null;

      // Upload file if present
      if (attachedFile) {
        const ext = attachedFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('prescriptions')
          .upload(filePath, attachedFile, { upsert: false });

        if (uploadError) throw new Error(t('autoI18n.prescForm4').replace('{message}', uploadError.message));
        fileUrl = filePath;
      }

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
        file_url: fileUrl,
      };

      const { data, error } = await supabase
        .from('prescriptions')
        .insert([prescriptionData])
        .select()
        .single();

      if (error) throw error;

      // Record the prescription signature for legal traceability (links the
      // signing doctor to this specific prescription id).
      try {
        await supabase.from('document_signatures').insert({
          user_id: user.id,
          document_type: `prescription:${data.id}`,
          document_version: '1.0',
          signer_name: user.name || 'Doctor',
        });
      } catch { /* never block an already-created prescription on the audit row */ }

      // Notify patient
      await supabase.from('notifications').insert({
        user_id: patientId,
        type: 'system' as any,
        title: t('autoI18n.prescForm5'),
        message: t('autoI18n.prescForm6').replace('{name}', user.name || t('autoI18n.prescForm7')),
        data: { url: `/prescriptions/${data.id}`, prescription_id: data.id },
      });

      // Auto-generate PDF if there are medications
      if (validMeds.length > 0) {
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
          doctorSignatureUrl,
          signedAt: new Date(data.signed_at),
        });
      }

      toast.success(t('autoI18n.prescForm8'));
      onCreated?.(data.id);
    } catch (error: any) {
      toast.error(error.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('autoI18n.prescForm9')}</Label>
          <Input value={patientName} disabled className="bg-muted/50" />
        </div>
        <div>
          <Label>{t('autoI18n.prescForm10')}</Label>
          <Input
            placeholder={t('autoI18n.prescForm11')}
            value={patientAge}
            onChange={(e) => setPatientAge(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>{t('autoI18n.prescForm12')}</Label>
        <Input
          placeholder={t('autoI18n.prescForm13')}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
        />
      </div>

      <Separator />

      {/* File Upload */}
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Upload className="w-4 h-4" />
          {t('autoI18n.prescForm14')}
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          {t('autoI18n.prescForm15')}
        </p>
        
        {attachedFile ? (
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {attachedFile.type.startsWith('image/') ? (
                  <Image className="w-4 h-4 text-info flex-shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-primary flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{attachedFile.name}</span>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {(attachedFile.size / 1024).toFixed(0)} KB
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeFile}>
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            {filePreview && (
              <img 
                src={filePreview} 
                alt={t('autoI18n.prescForm16')}
                className="rounded-md max-h-48 w-auto object-contain border"
              />
            )}
          </div>
        ) : (
          <div 
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('autoI18n.prescForm17')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('autoI18n.prescForm18')}
            </p>
          </div>
        )}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".jpg,.jpeg,.png,.pdf" 
          className="hidden" 
          onChange={handleFileChange} 
        />
      </div>

      <Separator />

      {/* Medications */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>{t('autoI18n.prescForm19')}</Label>
          <Button variant="outline" size="sm" onClick={addMedication} className="gap-1">
            <Plus className="w-3 h-3" />
            {t('autoI18n.prescForm20')}
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
                  placeholder={t('autoI18n.prescForm21')}
                  value={med.name}
                  onChange={(e) => updateMedication(i, 'name', e.target.value)}
                />
                <Input
                  placeholder={t('autoI18n.prescForm22')}
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                />
                <Input
                  placeholder={t('autoI18n.prescForm23')}
                  value={med.frequency}
                  onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                />
                <Input
                  placeholder={t('autoI18n.prescForm24')}
                  value={med.duration}
                  onChange={(e) => updateMedication(i, 'duration', e.target.value)}
                />
              </div>
              <Input
                placeholder={t('autoI18n.prescForm25')}
                value={med.notes || ''}
                onChange={(e) => updateMedication(i, 'notes', e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <Label>{t('autoI18n.prescForm26')}</Label>
        <Textarea
          placeholder={t('autoI18n.prescForm27')}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
        />
      </div>

      <div>
        <Label>{t('autoI18n.prescForm28')}</Label>
        <Textarea
          placeholder={t('autoI18n.prescForm29')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2 h-12">
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {t('autoI18n.prescForm30')}
      </Button>
    </div>
  );
}
