import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  GraduationCap,
  Award,
  Briefcase,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface Education {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  description: string | null;
  document_url: string | null;
  status: string;
}

interface Certification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  document_url: string | null;
  status: string;
}

interface Experience {
  id: string;
  title: string;
  organization: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  status: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved':
      return <Badge variant="default" className="gap-1 bg-success"><CheckCircle className="w-3 h-3" />Aprobado</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rechazado</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
  }
};

interface DoctorCredentialsProps {
  doctorId: string;
  isOwner: boolean;
}

export default function DoctorCredentials({ doctorId, isOwner }: DoctorCredentialsProps) {
  const { user } = useAuth();
  const [education, setEducation] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estado de credenciales oficiales (Céd. Profesional / COFEPRIS) para mostrar alerta
  // de rechazo con motivo y permitir resubir documento al propio doctor.
  const [credCedulaStatus, setCredCedulaStatus] = useState<string | null>(null);
  const [credCedulaReason, setCredCedulaReason] = useState<string | null>(null);
  const [credCofeprisStatus, setCredCofeprisStatus] = useState<string | null>(null);
  const [credCofeprisReason, setCredCofeprisReason] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState<'cedula' | 'cofepris' | null>(null);
  const credFileInputRef = React.useRef<HTMLInputElement>(null);
  const [resubmitTarget, setResubmitTarget] = useState<'cedula' | 'cofepris' | null>(null);

  // Form dialogs
  const [showEduDialog, setShowEduDialog] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [showExpDialog, setShowExpDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '' });
  const [certForm, setCertForm] = useState({ name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_id: '' });
  const [expForm, setExpForm] = useState({ title: '', organization: '', location: '', start_date: '', end_date: '', is_current: false, description: '' });

  useEffect(() => {
    fetchCredentials();
    if (isOwner) fetchOfficialCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, isOwner]);

  const fetchOfficialCredentials = async () => {
    try {
      const { data } = await supabase
        .from('doctor_profiles')
        .select('cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason')
        .eq('user_id', doctorId)
        .maybeSingle();
      if (data) {
        setCredCedulaStatus(data.cedula_status ?? null);
        setCredCedulaReason(data.cedula_rejection_reason ?? null);
        setCredCofeprisStatus(data.cofepris_status ?? null);
        setCredCofeprisReason(data.cofepris_rejection_reason ?? null);
      }
    } catch (err) {
      console.warn('[DoctorCredentials] official creds fetch failed', err);
    }
  };

  const handleResubmitCredential = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = resubmitTarget;
    if (!file || !target) return;
    setResubmitting(target);
    try {
      const ext = file.name.split('.').pop();
      const path = `${doctorId}/${target}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('doctor-credentials')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      // Marcamos status=pending y limpiamos motivo de rechazo para que admin lo revise.
      const updatePayload =
        target === 'cedula'
          ? { cedula_status: 'pending' as const, cedula_rejection_reason: null }
          : { cofepris_status: 'pending' as const, cofepris_rejection_reason: null };
      const { error: updErr } = await supabase
        .from('doctor_profiles')
        .update(updatePayload)
        .eq('user_id', doctorId);
      if (updErr) throw updErr;

      toast.success(
        target === 'cedula'
          ? 'Cédula reenviada — pendiente de nueva revisión'
          : 'Permiso COFEPRIS reenviado — pendiente de nueva revisión'
      );
      await fetchOfficialCredentials();
    } catch (err: any) {
      console.error('[DoctorCredentials] resubmit error', err);
      toast.error(err?.message || 'No se pudo reenviar el documento');
    } finally {
      setResubmitting(null);
      setResubmitTarget(null);
      if (credFileInputRef.current) credFileInputRef.current.value = '';
    }
  };

  const triggerResubmit = (target: 'cedula' | 'cofepris') => {
    setResubmitTarget(target);
    setTimeout(() => credFileInputRef.current?.click(), 0);
  };

  const fetchCredentials = async () => {
    try {
      const [eduRes, certRes, expRes] = await Promise.all([
        supabase.from('doctor_education' as any).select('*').eq('doctor_id', doctorId).order('end_year', { ascending: false, nullsFirst: true }),
        supabase.from('doctor_certifications' as any).select('*').eq('doctor_id', doctorId).order('issue_date', { ascending: false, nullsFirst: true }),
        supabase.from('doctor_experience' as any).select('*').eq('doctor_id', doctorId).order('start_date', { ascending: false, nullsFirst: true }),
      ]);

      if (eduRes.data) setEducation(eduRes.data as any);
      if (certRes.data) setCertifications(certRes.data as any);
      if (expRes.data) setExperience(expRes.data as any);
    } catch (error) {
      console.error('Error fetching credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDocument = async (file: File, type: string, itemId: string) => {
    const filePath = `${doctorId}/${type}_${itemId}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('doctor-credentials').upload(filePath, file);
    if (error) {
      toast.error('Error al subir documento');
      return null;
    }
    return filePath;
  };

  const handleAddEducation = async () => {
    if (!eduForm.institution || !eduForm.degree) { toast.error('Completa los campos requeridos'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('doctor_education' as any).insert({
        doctor_id: doctorId,
        institution: eduForm.institution,
        degree: eduForm.degree,
        field_of_study: eduForm.field_of_study || null,
        start_year: eduForm.start_year ? parseInt(eduForm.start_year) : null,
        end_year: eduForm.end_year ? parseInt(eduForm.end_year) : null,
        description: eduForm.description || null,
      });
      if (error) throw error;
      toast.success('Educación agregada — pendiente de aprobación');
      setShowEduDialog(false);
      setEduForm({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '' });
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCertification = async () => {
    if (!certForm.name || !certForm.issuing_organization) { toast.error('Completa los campos requeridos'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('doctor_certifications' as any).insert({
        doctor_id: doctorId,
        name: certForm.name,
        issuing_organization: certForm.issuing_organization,
        issue_date: certForm.issue_date || null,
        expiry_date: certForm.expiry_date || null,
        credential_id: certForm.credential_id || null,
      });
      if (error) throw error;
      toast.success('Certificación agregada — pendiente de aprobación');
      setShowCertDialog(false);
      setCertForm({ name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_id: '' });
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExperience = async () => {
    if (!expForm.title || !expForm.organization) { toast.error('Completa los campos requeridos'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('doctor_experience' as any).insert({
        doctor_id: doctorId,
        title: expForm.title,
        organization: expForm.organization,
        location: expForm.location || null,
        start_date: expForm.start_date || null,
        end_date: expForm.is_current ? null : (expForm.end_date || null),
        is_current: expForm.is_current,
        description: expForm.description || null,
      });
      if (error) throw error;
      toast.success('Experiencia agregada — pendiente de aprobación');
      setShowExpDialog(false);
      setExpForm({ title: '', organization: '', location: '', start_date: '', end_date: '', is_current: false, description: '' });
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || 'Error al agregar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq('id', id).eq('doctor_id', doctorId);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Eliminado');
    fetchCredentials();
  };

  // Filter: owner sees all, public sees only approved
  const visibleEdu = isOwner ? education : education.filter(e => e.status === 'approved');
  const visibleCert = isOwner ? certifications : certifications.filter(c => c.status === 'approved');
  const visibleExp = isOwner ? experience : experience.filter(e => e.status === 'approved');

  const hasContent = visibleEdu.length > 0 || visibleCert.length > 0 || visibleExp.length > 0;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!hasContent && !isOwner) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          Perfil Académico y Profesional
        </CardTitle>
        {isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            💡 Agrega tu educación, certificaciones y experiencia para que los pacientes conozcan tu trayectoria profesional. Cada entrada será revisada y aprobada por un administrador antes de ser visible públicamente.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Alerta visible sólo al propio doctor cuando alguna credencial oficial fue rechazada */}
        {isOwner && (credCedulaStatus === 'rejected' || credCofeprisStatus === 'rejected') && (
          <div className="mb-4 space-y-2">
            {credCedulaStatus === 'rejected' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-destructive">Cédula Profesional rechazada</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {credCedulaReason?.trim()
                      ? `Motivo: ${credCedulaReason}`
                      : 'El equipo no pudo aprobar tu cédula. Sube un documento legible y vigente.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 mt-1 gap-1"
                    disabled={resubmitting === 'cedula'}
                    onClick={() => triggerResubmit('cedula')}
                  >
                    {resubmitting === 'cedula' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Subir nuevo documento
                  </Button>
                </div>
              </div>
            )}
            {credCofeprisStatus === 'rejected' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-destructive">Permiso COFEPRIS rechazado</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {credCofeprisReason?.trim()
                      ? `Motivo: ${credCofeprisReason}`
                      : 'El equipo no pudo aprobar tu permiso COFEPRIS. Sube un documento legible y vigente.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 mt-1 gap-1"
                    disabled={resubmitting === 'cofepris'}
                    onClick={() => triggerResubmit('cofepris')}
                  >
                    {resubmitting === 'cofepris' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Subir nuevo documento
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={credFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleResubmitCredential}
            />
          </div>
        )}

        <Tabs defaultValue="education" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="education" className="gap-1 text-xs">
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Educación</span>
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1 text-xs">
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Certificaciones</span>
            </TabsTrigger>
            <TabsTrigger value="experience" className="gap-1 text-xs">
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Experiencia</span>
            </TabsTrigger>
          </TabsList>

          {/* Education */}
          <TabsContent value="education" className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowEduDialog(true)}>
                  <Plus className="w-4 h-4" /> Agregar Educación
                </Button>
                {visibleEdu.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Agrega tu formación académica</p>
                    <p className="text-xs text-muted-foreground/70">Universidades, posgrados, maestrías, doctorados...</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleEdu.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin educación registrada</p>
            )}
            {visibleEdu.map(edu => (
                <div key={edu.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{edu.degree}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                      {edu.field_of_study && <p className="text-xs text-muted-foreground">{edu.field_of_study}</p>}
                      {(edu.start_year || edu.end_year) && (
                        <p className="text-xs text-muted-foreground">{edu.start_year || '?'} — {edu.end_year || 'Presente'}</p>
                      )}
                      {edu.description && <p className="text-xs mt-1">{edu.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner && statusBadge(edu.status)}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_education', edu.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </TabsContent>

          {/* Certifications */}
          <TabsContent value="certifications" className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowCertDialog(true)}>
                  <Plus className="w-4 h-4" /> Agregar Certificación
                </Button>
                {visibleCert.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Award className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Agrega tus certificaciones</p>
                    <p className="text-xs text-muted-foreground/70">Especialidades, diplomados, cursos acreditados...</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleCert.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin certificaciones registradas</p>
            )}
            {visibleCert.length > 0 && (
              visibleCert.map(cert => (
                <div key={cert.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{cert.name}</p>
                      <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>
                      {cert.issue_date && <p className="text-xs text-muted-foreground">Emitido: {cert.issue_date}</p>}
                      {cert.expiry_date && <p className="text-xs text-muted-foreground">Expira: {cert.expiry_date}</p>}
                      {cert.credential_id && <p className="text-xs text-muted-foreground">ID: {cert.credential_id}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner && statusBadge(cert.status)}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_certifications', cert.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Experience */}
          <TabsContent value="experience" className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowExpDialog(true)}>
                  <Plus className="w-4 h-4" /> Agregar Experiencia
                </Button>
                {visibleExp.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Agrega tu experiencia profesional</p>
                    <p className="text-xs text-muted-foreground/70">Hospitales, clínicas, consultorios privados...</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleExp.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin experiencia registrada</p>
            )}
            {visibleExp.length > 0 && (
              visibleExp.map(exp => (
                <div key={exp.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{exp.title}</p>
                      <p className="text-sm text-muted-foreground">{exp.organization}</p>
                      {exp.location && <p className="text-xs text-muted-foreground">{exp.location}</p>}
                      <p className="text-xs text-muted-foreground">
                        {exp.start_date || '?'} — {exp.is_current ? 'Presente' : (exp.end_date || '?')}
                      </p>
                      {exp.description && <p className="text-xs mt-1">{exp.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner && statusBadge(exp.status)}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_experience', exp.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Education Dialog */}
      <Dialog open={showEduDialog} onOpenChange={setShowEduDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Educación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Institución *</Label><Input value={eduForm.institution} onChange={e => setEduForm({...eduForm, institution: e.target.value})} placeholder="Universidad Nacional" /></div>
            <div><Label className="text-xs">Título / Grado *</Label><Input value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} placeholder="Médico Cirujano" /></div>
            <div><Label className="text-xs">Campo de estudio</Label><Input value={eduForm.field_of_study} onChange={e => setEduForm({...eduForm, field_of_study: e.target.value})} placeholder="Medicina General" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Año inicio</Label><Input type="number" value={eduForm.start_year} onChange={e => setEduForm({...eduForm, start_year: e.target.value})} placeholder="2010" /></div>
              <div><Label className="text-xs">Año fin</Label><Input type="number" value={eduForm.end_year} onChange={e => setEduForm({...eduForm, end_year: e.target.value})} placeholder="2016" /></div>
            </div>
            <div><Label className="text-xs">Descripción</Label><Textarea value={eduForm.description} onChange={e => setEduForm({...eduForm, description: e.target.value})} placeholder="Detalles adicionales..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEduDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEducation} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Certificación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nombre del certificado *</Label><Input value={certForm.name} onChange={e => setCertForm({...certForm, name: e.target.value})} placeholder="Certificación en Cardiología" /></div>
            <div><Label className="text-xs">Organización emisora *</Label><Input value={certForm.issuing_organization} onChange={e => setCertForm({...certForm, issuing_organization: e.target.value})} placeholder="Consejo Mexicano de Cardiología" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fecha emisión</Label><Input type="date" value={certForm.issue_date} onChange={e => setCertForm({...certForm, issue_date: e.target.value})} /></div>
              <div><Label className="text-xs">Fecha expiración</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm({...certForm, expiry_date: e.target.value})} /></div>
            </div>
            <div><Label className="text-xs">ID de credencial</Label><Input value={certForm.credential_id} onChange={e => setCertForm({...certForm, credential_id: e.target.value})} placeholder="ABC-12345" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddCertification} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Experience Dialog */}
      <Dialog open={showExpDialog} onOpenChange={setShowExpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Experiencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Puesto / Título *</Label><Input value={expForm.title} onChange={e => setExpForm({...expForm, title: e.target.value})} placeholder="Médico Especialista" /></div>
            <div><Label className="text-xs">Organización *</Label><Input value={expForm.organization} onChange={e => setExpForm({...expForm, organization: e.target.value})} placeholder="Hospital General" /></div>
            <div><Label className="text-xs">Ubicación</Label><Input value={expForm.location} onChange={e => setExpForm({...expForm, location: e.target.value})} placeholder="CDMX, México" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fecha inicio</Label><Input type="date" value={expForm.start_date} onChange={e => setExpForm({...expForm, start_date: e.target.value})} /></div>
              <div><Label className="text-xs">Fecha fin</Label><Input type="date" value={expForm.end_date} onChange={e => setExpForm({...expForm, end_date: e.target.value})} disabled={expForm.is_current} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={expForm.is_current} onChange={e => setExpForm({...expForm, is_current: e.target.checked})} className="rounded" />
              Trabajo actual
            </label>
            <div><Label className="text-xs">Descripción</Label><Textarea value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} placeholder="Responsabilidades y logros..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddExperience} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
