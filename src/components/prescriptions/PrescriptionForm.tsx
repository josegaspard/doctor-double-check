import React, { useState, useRef, useEffect } from 'react';
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
import { fetchDoctorCredentials } from '@/lib/doctorCredentials';
import { 
  FileText, Plus, Trash2, Loader2, Download, Upload, Image, File, X 
} from 'lucide-react';

// Vías de administración (COFEPRIS / uso clínico habitual en México).
const ROUTE_OPTIONS = [
  'Oral', 'Sublingual', 'Intramuscular', 'Intravenosa', 'Subcutánea',
  'Tópica', 'Oftálmica', 'Ótica', 'Nasal', 'Inhalada', 'Rectal', 'Vaginal', 'Otra',
];

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
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', genericName: '', dosage: '', route: '', frequency: '', duration: '' },
  ]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [cedulaVerified, setCedulaVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cédula del médico contra SEP: al abrir el recetario, si aún no está verificada
  // la disparamos contra el registro oficial de la SEP (edge function ya desplegada,
  // usa el Solr público — sin API de pago). Best-effort: nunca bloquea la receta.
  useEffect(() => {
    const ensureCedulaVerified = async () => {
      const cedula = (user as any)?.doctorProfile?.cedulaProfesional;
      if (!user?.id || !cedula) return;
      const { data: existing } = await supabase
        .from('cedula_verifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_verified', true)
        .limit(1);
      if (existing && existing.length > 0) { setCedulaVerified(true); return; }
      try {
        const { data } = await supabase.functions.invoke('verify-cedula-sep', { body: { cedula } });
        if ((data as any)?.verified || (data as any)?.success) setCedulaVerified(true);
      } catch { /* SEP puede estar caída; la receta se emite igual */ }
    };
    ensureCedulaVerified();
  }, [user?.id]);

  const addMedication = () => {
    setMedications([...medications, { name: '', genericName: '', dosage: '', route: '', frequency: '', duration: '' }]);
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

    // Credenciales completas del médico (firma + universidad, hospital, cédulas…)
    // para que la receta muestre el membrete completo.
    const credentials = await fetchDoctorCredentials(user.id);
    const doctorSignatureUrl = credentials.doctorSignatureUrl;

    // Una fila cuenta como "escrita" si tiene comercial O genérico (antes solo
    // miraba name → una fila con solo genérico se perdía en silencio).
    const validMeds = medications.filter(m => m.name.trim() || m.genericName?.trim());

    // Must have at least one medication OR an attached file
    if (validMeds.length === 0 && !attachedFile) {
      toast.error(t('autoI18n.prescForm2'));
      return;
    }

    // Nombre comercial Y genérico obligatorios en cada fila escrita: las
    // farmacias pueden negarse a surtir con solo uno de los dos (pedido cliente).
    if (validMeds.some(m => !m.name.trim() || !m.genericName?.trim())) {
      toast.error(t('rxExtra.genericRequired'));
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
        patient_birth_date: patientBirthDate || null,
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

      // `as any`: patient_birth_date es columna nueva aún no regenerada en los
      // tipos de Supabase (mismo patrón que el resto del repo).
      const { data, error } = await supabase
        .from('prescriptions')
        .insert([prescriptionData as any])
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
          patientBirthDate: patientBirthDate || undefined,
          diagnosis: diagnosis || undefined,
          medications: validMeds,
          instructions: instructions || undefined,
          notes: notes || undefined,
          doctorName: user.name || 'Doctor',
          doctorSpecialty: credentials.doctorSpecialty || user.doctorProfile.specialty,
          doctorLicense: credentials.doctorLicense || user.doctorProfile.license,
          doctorCedula: credentials.doctorCedula || user.doctorProfile.cedulaProfesional || undefined,
          doctorNumeroConsejo: credentials.doctorNumeroConsejo || user.doctorProfile.numeroConsejo || undefined,
          doctorUniversity: credentials.doctorUniversity,
          doctorHospital: credentials.doctorHospital,
          doctorCofepris: credentials.doctorCofepris,
          doctorSignatureUrl,
          signedAt: new Date(data.signed_at),
          cedulaVerified,
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
        <div className="col-span-2 sm:col-span-1">
          <Label>{t('rxExtra.birthDate')}</Label>
          <Input
            type="date"
            value={patientBirthDate}
            onChange={(e) => setPatientBirthDate(e.target.value)}
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
        <div className="flex items-center justify-between mb-1">
          <Label>{t('autoI18n.prescForm19')}</Label>
          <Button variant="outline" size="sm" onClick={addMedication} className="gap-1">
            <Plus className="w-3 h-3" />
            {t('autoI18n.prescForm20')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{t('rxExtra.dciHint')}</p>
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
                  placeholder={t('rxExtra.commercialName')}
                  value={med.name}
                  onChange={(e) => updateMedication(i, 'name', e.target.value)}
                />
                <Input
                  placeholder={t('rxExtra.genericName')}
                  value={med.genericName || ''}
                  onChange={(e) => updateMedication(i, 'genericName', e.target.value)}
                />
                <Input
                  placeholder={t('autoI18n.prescForm22')}
                  value={med.dosage}
                  onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                />
                <select
                  aria-label={t('rxExtra.routeLabel')}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={med.route || ''}
                  onChange={(e) => updateMedication(i, 'route', e.target.value)}
                >
                  <option value="">{t('rxExtra.routePlaceholder')}</option>
                  {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
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
