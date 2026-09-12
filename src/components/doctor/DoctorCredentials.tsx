import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { SectionTabs, type SectionTabItem } from '@/components/common/SectionTabs';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
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
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { InlineFileViewer } from '@/components/content/InlineFileViewer';
import { toast } from 'sonner';
import { fill } from '@/lib/proFormat';
import { setCredentialVisibility, type CredentialTable } from '@/hooks/useDoctorPublicCredentials';

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
  /** El médico decide si esto sale en su perfil público (11-sep-2026). Sin
   *  migración aplicada la columna no existe: se trata como `true` (lo que ya
   *  veía todo el mundo antes de que existiera el interruptor). */
  is_public?: boolean | null;
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
  is_public?: boolean | null;
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
  is_public?: boolean | null;
}

const statusBadge = (status: string, t: (key: string) => string) => {
  switch (status) {
    case 'approved':
      return <Badge variant="default" className="gap-1 bg-success"><CheckCircle className="w-3 h-3" />{t('doctorCredentialsComponent.statusApproved')}</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('doctorCredentialsComponent.statusRejected')}</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{t('doctorCredentialsComponent.statusPending')}</Badge>;
  }
};

type CredTab = 'education' | 'certifications' | 'experience';

/** `is_public` por defecto es `true` (mismo comportamiento que antes del
 *  interruptor, y el default real de la columna una vez migrada). */
const isPublicOf = (item: { is_public?: boolean | null }) => item.is_public !== false;

interface DoctorCredentialsProps {
  doctorId: string;
  isOwner: boolean;
}

export default function DoctorCredentials({ doctorId, isOwner }: DoctorCredentialsProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const [education, setEducation] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<CredTab>('education');

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
  // Archivos de documento adjunto (cédula, board, diploma…) para educación y certificaciones.
  const [eduFile, setEduFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  // Documentos cuyo visor está abierto (solo el dueño puede verlos; bucket privado).
  const [shownDocs, setShownDocs] = useState<Set<string>>(new Set());
  const toggleDoc = (id: string) =>
    setShownDocs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
          ? t('doctorCredentialsComponent.toastCedulaResubmitted')
          : t('doctorCredentialsComponent.toastCofeprisResubmitted')
      );
      await fetchOfficialCredentials();
    } catch (err: any) {
      console.error('[DoctorCredentials] resubmit error', err);
      toast.error(err?.message || t('doctorCredentialsComponent.toastResubmitError'));
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

  const handleUploadDocument = async (file: File, type: string): Promise<string | null> => {
    const filePath = `${doctorId}/${type}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('doctor-credentials').upload(filePath, file, { upsert: true });
    if (error) {
      toast.error(t('doctorCredentialsComponent.toastUploadError'));
      return null;
    }
    return filePath;
  };

  const handleAddEducation = async () => {
    if (!eduForm.institution || !eduForm.degree) { toast.error(t('doctorCredentialsComponent.toastFillRequired')); return; }
    setIsSaving(true);
    try {
      let document_url: string | null = null;
      if (eduFile) {
        document_url = await handleUploadDocument(eduFile, 'education');
        if (!document_url) { setIsSaving(false); return; }
      }
      const { error } = await supabase.from('doctor_education' as any).insert({
        doctor_id: doctorId,
        institution: eduForm.institution,
        degree: eduForm.degree,
        field_of_study: eduForm.field_of_study || null,
        start_year: eduForm.start_year ? parseInt(eduForm.start_year) : null,
        end_year: eduForm.end_year ? parseInt(eduForm.end_year) : null,
        description: eduForm.description || null,
        document_url,
      });
      if (error) throw error;
      toast.success(t('doctorCredentialsComponent.toastEducationAdded'));
      setShowEduDialog(false);
      setEduForm({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '' });
      setEduFile(null);
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || t('doctorCredentialsComponent.toastAddError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCertification = async () => {
    if (!certForm.name || !certForm.issuing_organization) { toast.error(t('doctorCredentialsComponent.toastFillRequired')); return; }
    setIsSaving(true);
    try {
      let document_url: string | null = null;
      if (certFile) {
        document_url = await handleUploadDocument(certFile, 'certification');
        if (!document_url) { setIsSaving(false); return; }
      }
      const { error } = await supabase.from('doctor_certifications' as any).insert({
        doctor_id: doctorId,
        name: certForm.name,
        issuing_organization: certForm.issuing_organization,
        issue_date: certForm.issue_date || null,
        expiry_date: certForm.expiry_date || null,
        credential_id: certForm.credential_id || null,
        document_url,
      });
      if (error) throw error;
      toast.success(t('doctorCredentialsComponent.toastCertificationAdded'));
      setShowCertDialog(false);
      setCertForm({ name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_id: '' });
      setCertFile(null);
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || t('doctorCredentialsComponent.toastAddError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExperience = async () => {
    if (!expForm.title || !expForm.organization) { toast.error(t('doctorCredentialsComponent.toastFillRequired')); return; }
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
      toast.success(t('doctorCredentialsComponent.toastExperienceAdded'));
      setShowExpDialog(false);
      setExpForm({ title: '', organization: '', location: '', start_date: '', end_date: '', is_current: false, description: '' });
      fetchCredentials();
    } catch (error: any) {
      toast.error(error.message || t('doctorCredentialsComponent.toastAddError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Borrar SIEMPRE pasa por confirmación (regla del encargo: nada destructivo
  // en el primer clic). `label` es lo que se le enseña al médico en el resumen.
  const handleDelete = async (table: string, id: string, label: string) => {
    const ok = await confirm({
      title: t('mm2.publicProfile.confirmDeleteTitle'),
      description: fill(t('mm2.publicProfile.confirmDeleteDesc'), { item: label || '—' }),
      confirmLabel: t('mm2.publicProfile.confirmDeleteAction'),
      tone: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from(table as any).delete().eq('id', id).eq('doctor_id', doctorId);
    if (error) { toast.error(t('doctorCredentialsComponent.toastDeleteError')); return; }
    toast.success(t('doctorCredentialsComponent.toastDeleted'));
    fetchCredentials();
  };

  // Mostrar/ocultar una credencial YA aprobada en el perfil público. Activarla
  // es «publicar»: pasa por confirmación. Ocultarla es una corrección segura
  // y no la exige (regla del encargo: solo las acciones con consecuencias).
  const handleToggleVisibility = async (table: CredentialTable, id: string, current: boolean) => {
    const next = !current;
    if (next) {
      const ok = await confirm({
        title: t('mm2.publicProfile.confirmPublishTitle'),
        description: t('mm2.publicProfile.confirmPublishDesc'),
        confirmLabel: t('mm2.publicProfile.confirmPublishAction'),
        tone: 'default',
      });
      if (!ok) return;
    }
    const res = await setCredentialVisibility(table, id, next);
    if (!res.ok) {
      // Sin strictNullChecks el discriminante `ok` no estrecha el tipo: se lee el motivo aparte
      // (mismo patrón que useCreateAppointment/NewConsultationDialog).
      const reason = (res as { reason: 'pending_activation' | 'error' }).reason;
      toast.error(
        reason === 'pending_activation'
          ? t('mm2.publicProfile.toastPendingActivation')
          : t('mm2.publicProfile.toastVisibilityError')
      );
      return;
    }
    toast.success(next ? t('mm2.publicProfile.toastPublished') : t('mm2.publicProfile.toastHidden'));
    if (table === 'doctor_education') setEducation(prev => prev.map(e => (e.id === id ? { ...e, is_public: next } : e)));
    if (table === 'doctor_certifications') setCertifications(prev => prev.map(c => (c.id === id ? { ...c, is_public: next } : c)));
    if (table === 'doctor_experience') setExperience(prev => prev.map(x => (x.id === id ? { ...x, is_public: next } : x)));
  };

  /** Interruptor + estado de publicación de un ítem. Solo lo ve el dueño. */
  const VisibilityControl = ({ table, item }: { table: CredentialTable; item: { id: string; is_public?: boolean | null } }) => {
    const pub = isPublicOf(item);
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-medium ${pub ? 'text-success' : 'text-muted-foreground'}`}>
          {pub ? t('mm2.publicProfile.visibilityPublic') : t('mm2.publicProfile.visibilityPrivate')}
        </span>
        <Switch
          checked={pub}
          onCheckedChange={() => handleToggleVisibility(table, item.id, pub)}
          aria-label={t('mm2.publicProfile.toggleAria')}
        />
      </div>
    );
  };

  // Filter: owner sees all, public sees only approved
  const visibleEdu = isOwner ? education : education.filter(e => e.status === 'approved');
  const visibleCert = isOwner ? certifications : certifications.filter(c => c.status === 'approved');
  const visibleExp = isOwner ? experience : experience.filter(e => e.status === 'approved');

  const hasContent = visibleEdu.length > 0 || visibleCert.length > 0 || visibleExp.length > 0;

  // Tipado explícito para que SectionTabs infiera CredTab (y no el `string`
  // genérico) y así `value`/`onChange` sigan casando con el estado del tab.
  const credTabItems: SectionTabItem<CredTab>[] = [
    { id: 'education', label: t('doctorCredentialsComponent.tabEducation'), icon: GraduationCap },
    { id: 'certifications', label: t('doctorCredentialsComponent.tabCertifications'), icon: Award },
    { id: 'experience', label: t('doctorCredentialsComponent.tabExperience'), icon: Briefcase },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!hasContent && !isOwner) return null;

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          {t('doctorCredentialsComponent.cardTitle')}
        </CardTitle>
        {isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('doctorCredentialsComponent.ownerHint')}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Nota de privacidad — el cliente pidió dejar MUY claro que los documentos
            subidos (título, cédula, colegiado, board) sólo los ven el propio doctor
            y el equipo de Medical Masters. Cliente 2026-06-22. */}
        {isOwner && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('doctorCredentialsComponent.privacyNote')}
            </p>
          </div>
        )}

        {/* Qué ve el público — separa privado / pendiente de verificar / verificado /
            publicado, para que el médico entienda las dos condiciones (11-sep-2026). */}
        {isOwner && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <Eye className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('mm2.publicProfile.ownerVisibilityHint')}
            </p>
          </div>
        )}

        {/* Alerta visible sólo al propio doctor cuando alguna credencial oficial fue rechazada */}
        {isOwner && (credCedulaStatus === 'rejected' || credCofeprisStatus === 'rejected') && (
          <div className="mb-4 space-y-2">
            {credCedulaStatus === 'rejected' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-destructive">{t('doctorCredentialsComponent.cedulaRejectedTitle')}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {credCedulaReason?.trim()
                      ? `${t('doctorCredentialsComponent.reasonLabel')}: ${credCedulaReason}`
                      : t('doctorCredentialsComponent.cedulaRejectedDefault')}
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
                    {t('doctorCredentialsComponent.uploadNewDocument')}
                  </Button>
                </div>
              </div>
            )}
            {credCofeprisStatus === 'rejected' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-destructive">{t('doctorCredentialsComponent.cofeprisRejectedTitle')}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {credCofeprisReason?.trim()
                      ? `${t('doctorCredentialsComponent.reasonLabel')}: ${credCofeprisReason}`
                      : t('doctorCredentialsComponent.cofeprisRejectedDefault')}
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
                    {t('doctorCredentialsComponent.uploadNewDocument')}
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

        <div className="space-y-4">
          <SectionTabs<CredTab>
            value={tab}
            onChange={setTab}
            variant="onLight"
            ariaLabel={t('doctorCredentialsComponent.cardTitle')}
            items={credTabItems}
          />

          {/* Education */}
          {tab === 'education' && (
          <div className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowEduDialog(true)}>
                  <Plus className="w-4 h-4" /> {t('doctorCredentialsComponent.addEducation')}
                </Button>
                {visibleEdu.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">{t('doctorCredentialsComponent.educationEmptyTitle')}</p>
                    <p className="text-xs text-muted-foreground/70">{t('doctorCredentialsComponent.educationEmptyHint')}</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleEdu.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('doctorCredentialsComponent.noEducation')}</p>
            )}
            {visibleEdu.map(edu => (
                <div key={edu.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{edu.degree}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution}</p>
                      {edu.field_of_study && <p className="text-xs text-muted-foreground">{edu.field_of_study}</p>}
                      {(edu.start_year || edu.end_year) && (
                        <p className="text-xs text-muted-foreground">{edu.start_year || '?'} — {edu.end_year || t('doctorCredentialsComponent.present')}</p>
                      )}
                      {edu.description && <p className="text-xs mt-1">{edu.description}</p>}
                      {edu.document_url && (
                        <div className="mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-success flex items-center gap-1"><FileText className="w-3 h-3" /> {t('doctorCredentialsComponent.documentAttached')}</p>
                            {isOwner && (
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1" onClick={() => toggleDoc(edu.id)}>
                                {shownDocs.has(edu.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {shownDocs.has(edu.id) ? t('doctorCredentialsComponent.hideDocument') : t('doctorCredentialsComponent.viewDocument')}
                              </Button>
                            )}
                          </div>
                          {isOwner && shownDocs.has(edu.id) && (
                            <InlineFileViewer fileUrl={edu.document_url} bucket="doctor-credentials" className="rounded-md overflow-hidden mt-2" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      {isOwner && statusBadge(edu.status, t)}
                      {isOwner && <VisibilityControl table="doctor_education" item={edu} />}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_education', edu.id, edu.degree)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          )}

          {/* Certifications */}
          {tab === 'certifications' && (
          <div className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowCertDialog(true)}>
                  <Plus className="w-4 h-4" /> {t('doctorCredentialsComponent.addCertification')}
                </Button>
                {visibleCert.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Award className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">{t('doctorCredentialsComponent.certificationsEmptyTitle')}</p>
                    <p className="text-xs text-muted-foreground/70">{t('doctorCredentialsComponent.certificationsEmptyHint')}</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleCert.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('doctorCredentialsComponent.noCertifications')}</p>
            )}
            {visibleCert.length > 0 && (
              visibleCert.map(cert => (
                <div key={cert.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{cert.name}</p>
                      <p className="text-sm text-muted-foreground">{cert.issuing_organization}</p>
                      {cert.issue_date && <p className="text-xs text-muted-foreground">{t('doctorCredentialsComponent.issuedLabel')}: {cert.issue_date}</p>}
                      {cert.expiry_date && <p className="text-xs text-muted-foreground">{t('doctorCredentialsComponent.expiresLabel')}: {cert.expiry_date}</p>}
                      {cert.credential_id && <p className="text-xs text-muted-foreground">{t('doctorCredentialsComponent.idLabel')}: {cert.credential_id}</p>}
                      {cert.document_url && (
                        <div className="mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-success flex items-center gap-1"><FileText className="w-3 h-3" /> {t('doctorCredentialsComponent.documentAttached')}</p>
                            {isOwner && (
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1" onClick={() => toggleDoc(cert.id)}>
                                {shownDocs.has(cert.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {shownDocs.has(cert.id) ? t('doctorCredentialsComponent.hideDocument') : t('doctorCredentialsComponent.viewDocument')}
                              </Button>
                            )}
                          </div>
                          {isOwner && shownDocs.has(cert.id) && (
                            <InlineFileViewer fileUrl={cert.document_url} bucket="doctor-credentials" className="rounded-md overflow-hidden mt-2" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      {isOwner && statusBadge(cert.status, t)}
                      {isOwner && <VisibilityControl table="doctor_certifications" item={cert} />}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_certifications', cert.id, cert.name)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          )}

          {/* Experience */}
          {tab === 'experience' && (
          <div className="space-y-3">
            {isOwner && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => setShowExpDialog(true)}>
                  <Plus className="w-4 h-4" /> {t('doctorCredentialsComponent.addExperience')}
                </Button>
                {visibleExp.length === 0 && (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">{t('doctorCredentialsComponent.experienceEmptyTitle')}</p>
                    <p className="text-xs text-muted-foreground/70">{t('doctorCredentialsComponent.experienceEmptyHint')}</p>
                  </div>
                )}
              </div>
            )}
            {!isOwner && visibleExp.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('doctorCredentialsComponent.noExperience')}</p>
            )}
            {visibleExp.length > 0 && (
              visibleExp.map(exp => (
                <div key={exp.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{exp.title}</p>
                      <p className="text-sm text-muted-foreground">{exp.organization}</p>
                      {exp.location && <p className="text-xs text-muted-foreground">{exp.location}</p>}
                      <p className="text-xs text-muted-foreground">
                        {exp.start_date || '?'} — {exp.is_current ? t('doctorCredentialsComponent.present') : (exp.end_date || '?')}
                      </p>
                      {exp.description && <p className="text-xs mt-1">{exp.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                      {isOwner && statusBadge(exp.status, t)}
                      {isOwner && <VisibilityControl table="doctor_experience" item={exp} />}
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete('doctor_experience', exp.id, exp.title)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          )}
        </div>
      </CardContent>

      {/* Education Dialog */}
      <Dialog open={showEduDialog} onOpenChange={setShowEduDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('doctorCredentialsComponent.addEducation')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('doctorCredentialsComponent.institutionLabel')}</Label><Input value={eduForm.institution} onChange={e => setEduForm({...eduForm, institution: e.target.value})} placeholder={t('doctorCredentialsComponent.institutionPlaceholder')} /></div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.degreeLabel')}</Label><Input value={eduForm.degree} onChange={e => setEduForm({...eduForm, degree: e.target.value})} placeholder={t('doctorCredentialsComponent.degreePlaceholder')} /></div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.fieldOfStudyLabel')}</Label><Input value={eduForm.field_of_study} onChange={e => setEduForm({...eduForm, field_of_study: e.target.value})} placeholder={t('doctorCredentialsComponent.fieldOfStudyPlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('doctorCredentialsComponent.startYearLabel')}</Label><Input type="number" value={eduForm.start_year} onChange={e => setEduForm({...eduForm, start_year: e.target.value})} placeholder="2010" /></div>
              <div><Label className="text-xs">{t('doctorCredentialsComponent.endYearLabel')}</Label><Input type="number" value={eduForm.end_year} onChange={e => setEduForm({...eduForm, end_year: e.target.value})} placeholder="2016" /></div>
            </div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.descriptionLabel')}</Label><Textarea value={eduForm.description} onChange={e => setEduForm({...eduForm, description: e.target.value})} placeholder={t('doctorCredentialsComponent.descriptionPlaceholder')} /></div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> {t('doctorCredentialsComponent.documentLabel')}</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setEduFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground mt-1">{t('doctorCredentialsComponent.documentHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEduDialog(false); setEduFile(null); }}>{t('doctorCredentialsComponent.cancel')}</Button>
            <Button onClick={handleAddEducation} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('doctorCredentialsComponent.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('doctorCredentialsComponent.addCertification')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('doctorCredentialsComponent.certificateNameLabel')}</Label><Input value={certForm.name} onChange={e => setCertForm({...certForm, name: e.target.value})} placeholder={t('doctorCredentialsComponent.certificateNamePlaceholder')} /></div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.issuingOrgLabel')}</Label><Input value={certForm.issuing_organization} onChange={e => setCertForm({...certForm, issuing_organization: e.target.value})} placeholder={t('doctorCredentialsComponent.issuingOrgPlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('doctorCredentialsComponent.issueDateLabel')}</Label><Input type="date" value={certForm.issue_date} onChange={e => setCertForm({...certForm, issue_date: e.target.value})} /></div>
              <div><Label className="text-xs">{t('doctorCredentialsComponent.expiryDateLabel')}</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm({...certForm, expiry_date: e.target.value})} /></div>
            </div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.credentialIdLabel')}</Label><Input value={certForm.credential_id} onChange={e => setCertForm({...certForm, credential_id: e.target.value})} placeholder="ABC-12345" /></div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> {t('doctorCredentialsComponent.documentLabel')}</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground mt-1">{t('doctorCredentialsComponent.documentHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCertDialog(false); setCertFile(null); }}>{t('doctorCredentialsComponent.cancel')}</Button>
            <Button onClick={handleAddCertification} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('doctorCredentialsComponent.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Experience Dialog */}
      <Dialog open={showExpDialog} onOpenChange={setShowExpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('doctorCredentialsComponent.addExperience')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('doctorCredentialsComponent.positionLabel')}</Label><Input value={expForm.title} onChange={e => setExpForm({...expForm, title: e.target.value})} placeholder={t('doctorCredentialsComponent.positionPlaceholder')} /></div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.organizationLabel')}</Label><Input value={expForm.organization} onChange={e => setExpForm({...expForm, organization: e.target.value})} placeholder={t('doctorCredentialsComponent.organizationPlaceholder')} /></div>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.locationLabel')}</Label><Input value={expForm.location} onChange={e => setExpForm({...expForm, location: e.target.value})} placeholder={t('doctorCredentialsComponent.locationPlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{t('doctorCredentialsComponent.startDateLabel')}</Label><Input type="date" value={expForm.start_date} onChange={e => setExpForm({...expForm, start_date: e.target.value})} /></div>
              <div><Label className="text-xs">{t('doctorCredentialsComponent.endDateLabel')}</Label><Input type="date" value={expForm.end_date} onChange={e => setExpForm({...expForm, end_date: e.target.value})} disabled={expForm.is_current} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={expForm.is_current} onChange={e => setExpForm({...expForm, is_current: e.target.checked})} className="rounded" />
              {t('doctorCredentialsComponent.currentJob')}
            </label>
            <div><Label className="text-xs">{t('doctorCredentialsComponent.descriptionLabel')}</Label><Textarea value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} placeholder={t('doctorCredentialsComponent.experienceDescriptionPlaceholder')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpDialog(false)}>{t('doctorCredentialsComponent.cancel')}</Button>
            <Button onClick={handleAddExperience} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('doctorCredentialsComponent.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    {dialog}
    </>
  );
}
