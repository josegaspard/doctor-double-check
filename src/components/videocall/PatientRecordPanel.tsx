import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Users, Activity, Syringe, FileText, Phone, Heart, Pill, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  patientId: string | null;
  /** Doctor must be the one consulting; only renders when role === 'doctor' is verified by parent. */
  enabled?: boolean;
}

interface Profile {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface History {
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
  extended_data: any;
}

interface VaxRow {
  vaccine_key: string;
  dose_number: number;
  applied: boolean;
  application_date: string | null;
}

export function PatientRecordPanel({ patientId, enabled = true }: Props) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [vaccinations, setVaccinations] = useState<VaxRow[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled || !patientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [p, h, v, f] = await Promise.all([
        supabase.from('profiles').select('name,email,avatar_url,phone').eq('id', patientId).maybeSingle(),
        supabase.from('patient_clinical_history').select('*').eq('patient_id', patientId).maybeSingle(),
        supabase.from('patient_vaccinations').select('vaccine_key,dose_number,applied,application_date').eq('patient_id', patientId),
        supabase.rpc('get_doctor_accessible_files'),
      ]);
      if (cancelled) return;
      if (p.data) setProfile(p.data as Profile);
      if (h.data) setHistory({ ...(h.data as any), extended_data: (h.data as any).extended_data || {} });
      if (v.data) setVaccinations(v.data as VaxRow[]);
      if (f.data) setFiles((f.data as any[]).filter(x => x.patient_id === patientId));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [patientId, enabled]);

  if (!enabled) return null;

  if (!patientId) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        {t('patientRecordPanel.noPatientAssociated')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const ext = history?.extended_data || {};
  const ageYears = history?.date_of_birth
    ? Math.floor((Date.now() - new Date(history.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;

  const Field = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xs font-medium break-words">
          {value || <span className="text-muted-foreground italic">—</span>}
        </p>
      </div>
    </div>
  );

  return (
    <Card className="h-full overflow-hidden flex flex-col border-0 sm:border shadow-sm">
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="p-3 border-b bg-muted/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{profile?.name || t('patientRecordPanel.defaultPatientName')}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ageYears !== null && `${ageYears} ${t('patientRecordPanel.ageYearsSuffix')} · `}
              {history?.sex === 'female'
                ? t('patientRecordPanel.sexFemaleShort')
                : history?.sex === 'male'
                  ? t('patientRecordPanel.sexMaleShort')
                  : history?.sex || '—'}
              {history?.blood_type && ` · ${history.blood_type}`}
            </p>
          </div>
        </div>

        <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-5 mx-2 mt-2 h-auto">
            <TabsTrigger value="personal" className="text-[10px] px-1 py-1.5"><User className="w-3 h-3" /></TabsTrigger>
            <TabsTrigger value="family" className="text-[10px] px-1 py-1.5"><Users className="w-3 h-3" /></TabsTrigger>
            <TabsTrigger value="habits" className="text-[10px] px-1 py-1.5"><Activity className="w-3 h-3" /></TabsTrigger>
            <TabsTrigger value="vax" className="text-[10px] px-1 py-1.5"><Syringe className="w-3 h-3" /></TabsTrigger>
            <TabsTrigger value="files" className="text-[10px] px-1 py-1.5"><FileText className="w-3 h-3" /></TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="personal" className="p-3 space-y-2 mt-0">
              <Field icon={Heart} label={t('patientRecordPanel.fields.chronicConditions')} value={history?.chronic_conditions} />
              <Field icon={AlertTriangle} label={t('patientRecordPanel.fields.allergies')} value={history?.allergies} />
              <Field icon={Pill} label={t('patientRecordPanel.fields.currentMedications')} value={history?.current_medications} />
              <Field icon={FileText} label={t('patientRecordPanel.fields.previousSurgeries')} value={history?.previous_surgeries} />
              <Field icon={Phone} label={t('patientRecordPanel.fields.emergencyContact')} value={
                history?.emergency_contact_name
                  ? `${history.emergency_contact_name} — ${history.emergency_contact_phone || ''}`
                  : null
              } />
              {ext.chronic_other?.length > 0 && (
                <div className="p-2 rounded-md bg-warning/5 border border-warning/20">
                  <p className="text-[10px] uppercase text-warning mb-1">{t('patientRecordPanel.fields.otherDiseases')}</p>
                  {ext.chronic_other.map((c: any, i: number) => (
                    <div key={i} className="text-xs mb-1">
                      <strong>{c.cual}</strong> · {c.diagnostico} · {c.tratamiento}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="family" className="p-3 space-y-2 mt-0">
              <Field icon={Users} label={t('patientRecordPanel.fields.familyNotes')} value={history?.family_history} />
              {ext.family_matrix && Object.keys(ext.family_matrix).length > 0 && (
                <div className="p-2 rounded-md bg-muted/40">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">{t('patientRecordPanel.fields.familyMatrix')}</p>
                  {Object.entries(ext.family_matrix).map(([disease, rels]: any) => (
                    rels?.length > 0 && (
                      <div key={disease} className="text-xs flex justify-between">
                        <span className="capitalize">{disease}</span>
                        <span className="text-muted-foreground">{rels.join(', ')}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="habits" className="p-3 space-y-2 mt-0">
              {ext.habits_detail ? (
                <>
                  {ext.habits_detail.alcoholism?.active && (
                    <Field icon={Activity} label={t('patientRecordPanel.fields.alcoholism')} value={
                      `${ext.habits_detail.alcoholism.drink || ''} · ${ext.habits_detail.alcoholism.frequency || ''} · ${ext.habits_detail.alcoholism.amount || ''}`
                    } />
                  )}
                  {ext.habits_detail.smoking && (
                    <div className="p-2 rounded-md bg-muted/40">
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">{t('patientRecordPanel.fields.smoking')}</p>
                      {(['cigarette','vape','hookah'] as const).map(k => {
                        const s = ext.habits_detail.smoking?.[k];
                        if (!s?.active) return null;
                        return (
                          <p key={k} className="text-xs">
                            <strong className="capitalize">{k}:</strong> {s.frequency || '—'} · {s.amount || '—'}
                          </p>
                        );
                      })}
                    </div>
                  )}
                  {ext.habits_detail.drugs?.active && (
                    <Field icon={Activity} label={t('patientRecordPanel.fields.drugs')} value={
                      `${ext.habits_detail.drugs.substance || ''} · ${ext.habits_detail.drugs.frequency || ''}`
                    } />
                  )}
                  {ext.habits_detail.physical_activity?.active && (
                    <Field icon={Activity} label={t('patientRecordPanel.fields.physicalActivity')} value={
                      `${ext.habits_detail.physical_activity.type || ''} · ${ext.habits_detail.physical_activity.frequency || ''}`
                    } />
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">{t('patientRecordPanel.habits.empty')}</p>
              )}
            </TabsContent>

            <TabsContent value="vax" className="p-3 space-y-1 mt-0">
              {vaccinations.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t('patientRecordPanel.vax.empty')}</p>
              ) : (
                vaccinations.map(v => (
                  <div key={`${v.vaccine_key}-${v.dose_number}`} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                    <span className="font-medium">{v.vaccine_key} · D{v.dose_number}</span>
                    {v.applied ? (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                        ✓ {v.application_date || t('patientRecordPanel.vax.applied')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                        {t('patientRecordPanel.vax.pending')}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="files" className="p-3 space-y-1 mt-0">
              {files.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t('patientRecordPanel.files.empty')}</p>
              ) : (
                files.map((f: any) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs p-2 rounded bg-muted/30 hover:bg-muted/60 transition truncate"
                  >
                    📎 {f.name}
                  </a>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
