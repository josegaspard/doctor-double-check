import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserInterests, interestScore } from '@/hooks/useUserInterests';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { GraduationCap, Plus, MessageCircle, Eye, Stethoscope, Send, ArrowLeft, Loader2, Trash2, CalendarDays, Video, Folder } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { useSpecialties } from '@/hooks/useSpecialties';
import { InlineFileViewer } from '@/components/content/InlineFileViewer';
import DoctorAvailabilityPage from '@/pages/DoctorAvailability';
import Meetings from '@/pages/Meetings';
import RecordingsGrid from '@/pages/RecordingsGrid';
import { toast } from 'sonner';

interface ClinicalCase {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  specialty: string;
  category: string | null;
  patient_age: number | null;
  patient_sex: string | null;
  file_url: string | null;
  comments_count: number;
  views_count: number;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
}

interface CaseComment {
  id: string;
  case_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
}

export default function MedicalEducation() {
  const navigate = useNavigate();
  const { specialtiesList: SPECIALTIES_LIST } = useSpecialties();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  // Sin pestaña activa por defecto (cliente 2026-06-19): al entrar a /education NO
  // debe verse nada abierto; los casos clínicos sólo aparecen al pulsar la pestaña
  // "Casos clínicos". Tabs controlado con value='' = ningún TabsContent montado.
  const [tab, setTab] = useState('');
  const [specialty, setSpecialty] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCase, setActiveCase] = useState<ClinicalCase | null>(null);
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // Form
  const [form, setForm] = useState({
    title: '',
    specialty: '',
    description: '',
    category: '',
    patient_age: '',
    patient_sex: '',
  });
  const [file, setFile] = useState<File | null>(null);

  // Pacientes SÍ entran a MM Education pero SOLO ven "Contenido premium" (cliente 2026-06-29).
  const isPatient = role === 'patient';
  useEffect(() => {
    if (role && role !== 'doctor' && role !== 'resident' && role !== 'admin' && role !== 'patient') {
      navigate('/lives');
    }
    // El paciente solo tiene la pestaña premium → la abrimos directo.
    if (role === 'patient') setTab('premium');
  }, [role, navigate]);

  const loadCases = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('clinical_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error(t('medicalEducationPage.toastLoadError'));
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((rows || []).map(r => r.author_id)));
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', ids),
      supabase.from('user_roles').select('user_id, role').in('user_id', ids),
    ]);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    const rmap = new Map((roles || []).map(r => [r.user_id, r.role]));
    setCases(
      (rows || []).map(r => ({
        ...r,
        author_name: pmap.get(r.author_id)?.name || t('medicalEducationPage.fallbackAuthorDoctor'),
        author_avatar: pmap.get(r.author_id)?.avatar_url || undefined,
        author_role: (rmap.get(r.author_id) as string) || 'doctor',
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadCases();
  }, []);

  const { data: interests = [] } = useUserInterests();
  const filtered = useMemo(() => {
    if (!specialty || specialty === 'Todas') {
      // Recomendación (cliente 2026-06-30): sin filtro, priorizar casos afines a los intereses.
      if (!interests.length) return cases;
      return [...cases].sort((a, b) =>
        interestScore(`${b.title} ${b.specialty}`, interests) -
        interestScore(`${a.title} ${a.specialty}`, interests)
      );
    }
    return cases.filter(c => c.specialty === specialty);
  }, [cases, specialty, interests]);

  const openCase = async (c: ClinicalCase) => {
    setActiveCase(c);
    const { data } = await supabase
      .from('clinical_case_comments')
      .select('*')
      .eq('case_id', c.id)
      .order('created_at', { ascending: true });
    const ids = Array.from(new Set((data || []).map(r => r.author_id)));
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, name').in('id', ids),
      supabase.from('user_roles').select('user_id, role').in('user_id', ids),
    ]);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    const rmap = new Map((roles || []).map(r => [r.user_id, r.role]));
    setComments(
      (data || []).map(r => ({
        ...r,
        author_name: pmap.get(r.author_id)?.name || t('medicalEducationPage.fallbackAuthorUser'),
        author_role: (rmap.get(r.author_id) as string) || 'doctor',
      }))
    );
  };

  const sendComment = async () => {
    if (!user || !activeCase || !newComment.trim()) return;
    setPosting(true);
    const { error } = await supabase.from('clinical_case_comments').insert({
      case_id: activeCase.id,
      author_id: user.id,
      content: newComment.trim(),
    });
    setPosting(false);
    if (error) {
      toast.error(t('medicalEducationPage.toastCommentError'));
      return;
    }
    setNewComment('');
    openCase(activeCase);
    setCases(cs => cs.map(c => (c.id === activeCase.id ? { ...c, comments_count: c.comments_count + 1 } : c)));
  };

  const submitCase = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.specialty) {
      toast.error(t('medicalEducationPage.toastValidationRequired'));
      return;
    }
    setSubmitting(true);
    let file_url: string | null = null;
    if (file) {
      // Sanitize filename + extension. Images go to /clinical-cases/ folder to
      // match storage RLS (auth.uid() = first folder segment).
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('doctor-content')
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (upErr) {
        console.error('clinical_case upload error', upErr);
        toast.error(`${t('medicalEducationPage.toastUploadError')}: ${upErr.message}`);
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from('doctor-content').getPublicUrl(path);
      file_url = pub.publicUrl;
    }
    const { error } = await supabase.from('clinical_cases').insert({
      author_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      specialty: form.specialty,
      category: form.category || null,
      patient_age: form.patient_age ? Number(form.patient_age) : null,
      patient_sex: form.patient_sex || null,
      file_url,
    });
    setSubmitting(false);
    if (error) {
      console.error('clinical_cases insert error', error);
      toast.error(`${t('medicalEducationPage.toastPublishError')}: ${error.message}`);
      return;
    }
    toast.success(t('medicalEducationPage.toastPublishSuccess'));
    setCreateOpen(false);
    setForm({ title: '', specialty: '', description: '', category: '', patient_age: '', patient_sex: '' });
    setFile(null);
    loadCases();
  };

  const isDoctor = role === 'doctor' || role === 'admin';
  // Residentes también pueden subir contenido/casos (cliente 2026-06-29).
  const canUpload = role === 'doctor' || role === 'admin' || role === 'resident';

  const [deletingCase, setDeletingCase] = useState<ClinicalCase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = (c: ClinicalCase) => !!user && (c.author_id === user.id || role === 'admin');

  const handleDelete = async () => {
    if (!deletingCase) return;
    setDeleting(true);
    try {
      // Borra archivo en storage si existe
      if (deletingCase.file_url) {
        const m = deletingCase.file_url.match(/\/doctor-content\/(.+?)(\?|$)/);
        if (m && m[1]) {
          await supabase.storage.from('doctor-content').remove([decodeURIComponent(m[1])]);
        }
      }
      const { error } = await supabase.from('clinical_cases').delete().eq('id', deletingCase.id);
      if (error) {
        toast.error(`${t('medicalEducationPage.toastDeleteError')}: ${error.message}`);
        setDeleting(false);
        return;
      }
      setCases(cs => cs.filter(c => c.id !== deletingCase.id));
      if (activeCase?.id === deletingCase.id) setActiveCase(null);
      toast.success(t('medicalEducationPage.toastDeleteSuccess'));
      setDeletingCase(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Button variant="back" size="sm" onClick={() => navigate(-1)} className="hidden sm:inline-flex mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('medicalEducationPage.back')}
        </Button>

        {/* Cabecera con EXACTAMENTE el mismo estilo que la de /recordings "Contenido Premium"
            (cliente 2026-06-17): tarjeta clara bg-card + borde primary, título navy (text-foreground)
            e ícono teal (text-primary) dentro de una caja suave bg-primary/20. */}
        <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-card p-5 sm:p-6 shadow-xl dark:bg-[hsl(223,55%,18%)]">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            {t('medicalEducationPage.pageTitle')}
          </h1>
        </div>

        {/* Panel limpio por pestañas (rediseño cliente 2026-06-16): cada cosa en su
            propia pestaña clara — Casos clínicos · Reuniones · Mi calendario · Premium —
            en lugar de una sola página larga con secciones anidadas. */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="inline-flex h-auto w-auto gap-1.5 bg-white/95 backdrop-blur-md ring-1 ring-[#163a83]/10 shadow-lg shadow-[#0b1d45]/25 p-1.5 rounded-2xl">
              {/* "Contenido premium" como PESTAÑA: al pulsarla se abre TODO el contenido
                  premium (grabaciones) ABAJO, igual que Casos clínicos / Reuniones /
                  Calendario — ya no navega a /recordings. Cliente 2026-06-22. */}
              <TabsTrigger value="premium" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#163a83]/65 hover:text-[#163a83] transition-colors data-[state=active]:!bg-primary data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30">
                <Folder className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('nav.recordings')}</span>
              </TabsTrigger>
              {!isPatient && (
                <TabsTrigger value="feed" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#163a83]/65 hover:text-[#163a83] transition-colors data-[state=active]:!bg-primary data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30">
                  <GraduationCap className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('medicalEducationPage.tabCases')}</span>
                </TabsTrigger>
              )}
              {(role === 'doctor' || role === 'resident') && (
                <TabsTrigger value="meetings" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#163a83]/65 hover:text-[#163a83] transition-colors data-[state=active]:!bg-primary data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30">
                  <Video className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('meetings.title')}</span>
                </TabsTrigger>
              )}
              {(role === 'doctor' || role === 'resident') && (
                <TabsTrigger value="calendar" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-[#163a83]/65 hover:text-[#163a83] transition-colors data-[state=active]:!bg-primary data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/30">
                  <CalendarDays className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('medicalEducationPage.tabCalendar')}</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* ---- Casos clínicos ---- */}
          <TabsContent value="feed" className="mt-0 space-y-4 focus-visible:outline-none">
            {/* Barra de herramientas: filtro + subir caso */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchableFilter
                  value={specialty}
                  onChange={setSpecialty}
                  options={SPECIALTIES_LIST}
                  placeholder={t('medicalEducationPage.filterPlaceholder')}
                />
              </div>
              {canUpload && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="gap-2 min-h-[48px] bg-live hover:bg-live/90 text-white font-semibold shadow-lg shadow-live/30 sm:flex-shrink-0">
                      <Plus className="w-5 h-5" />
                      {t('medicalEducationPage.uploadCase')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{t('medicalEducationPage.newCaseTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div>
                        <Label>{t('medicalEducationPage.fieldTitle')}</Label>
                        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('medicalEducationPage.titlePlaceholder')} />
                      </div>
                      <div>
                        <Label>{t('medicalEducationPage.fieldSpecialty')}</Label>
                        <SearchableFilter
                          value={form.specialty}
                          onChange={v => setForm(f => ({ ...f, specialty: v }))}
                          options={SPECIALTIES_LIST}
                          placeholder={t('medicalEducationPage.specialtyPlaceholder')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('medicalEducationPage.fieldAge')}</Label>
                          <Input type="number" inputMode="numeric" value={form.patient_age} onChange={e => setForm(f => ({ ...f, patient_age: e.target.value }))} />
                        </div>
                        <div>
                          <Label>{t('medicalEducationPage.fieldSex')}</Label>
                          <select aria-label={t('medicalEducationPage.fieldSex')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.patient_sex} onChange={e => setForm(f => ({ ...f, patient_sex: e.target.value }))}>
                            <option value="">—</option>
                            <option value="F">{t('medicalEducationPage.sexFemale')}</option>
                            <option value="M">{t('medicalEducationPage.sexMale')}</option>
                            <option value="Otro">{t('medicalEducationPage.sexOther')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label>{t('medicalEducationPage.fieldDescription')}</Label>
                        <Textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('medicalEducationPage.descriptionPlaceholder')} />
                      </div>
                      <div>
                        <Label>{t('medicalEducationPage.fieldAttachment')}</Label>
                        <Input type="file" accept="image/*,application/pdf,video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                        <p className="text-xs text-muted-foreground mt-1">{t('medicalEducationPage.attachmentHint')}</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('medicalEducationPage.cancel')}</Button>
                      <Button onClick={submitCase} disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t('medicalEducationPage.publishCase')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Aviso "Espacio profesional" — callout con paleta de marca balanceada
                (tinte teal→navy, borde lateral teal, badge de candado teal→cian). */}
            <div className="relative flex items-start gap-3 text-xs rounded-xl pl-3 pr-3.5 py-2.5 bg-card border border-primary/20 border-l-4 border-l-primary shadow-md shadow-[#0b1d45]/15">
              <span aria-hidden className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-white text-[11px] font-bold flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #227787, #839ed5)' }}>🔒</span>
              <span className="leading-relaxed">
                <strong className="text-secondary font-semibold">{t('medicalEducationPage.professionalSpaceTitle')}</strong>{' '}
                <span className="text-muted-foreground">{t('medicalEducationPage.professionalSpaceBody')}</span>
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-10 text-center border-primary/15">
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-3 mx-auto">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </span>
                <p className="font-medium">{t('medicalEducationPage.emptyTitle')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('medicalEducationPage.emptyBody')}</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {filtered.map(c => (
                  <Card key={c.id} className="cursor-pointer border-l-4 border-l-primary/30 hover:border-l-primary hover:border-primary/40 hover:shadow-md transition-all" onClick={() => openCase(c)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base sm:text-lg">{c.title}</CardTitle>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant={c.author_role === 'resident' ? 'secondary' : 'verified'} className="text-[10px]">
                            {c.author_role === 'resident' ? t('medicalEducationPage.roleResident') : t('medicalEducationPage.roleDoctor')}
                          </Badge>
                          {canDelete(c) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeletingCase(c); }}
                              aria-label={t('medicalEducationPage.deleteCaseAria')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <Stethoscope className="w-3 h-3 text-primary" />
                        {c.specialty}
                        {c.patient_age && <span>· {c.patient_age} {t('medicalEducationPage.yearsOld')} {c.patient_sex || ''}</span>}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {c.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.author_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {c.comments_count}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {c.views_count}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- Reuniones ---- */}
          {(role === 'doctor' || role === 'resident') && (
            <TabsContent value="meetings" className="mt-0 focus-visible:outline-none">
              <Meetings embedded />
            </TabsContent>
          )}

          {/* ---- Mi calendario (disponibilidad) — residentes con la misma paridad que doctores (cliente 2026-06-30) ---- */}
          {(role === 'doctor' || role === 'resident') && (
            <TabsContent value="calendar" className="mt-0 focus-visible:outline-none">
              <DoctorAvailabilityPage embedded />
            </TabsContent>
          )}

          {/* ---- Contenido premium (grabaciones) — se abre ABAJO igual que las demás
                  pestañas, sin salir de /education (cliente 2026-06-22). ---- */}
          <TabsContent value="premium" className="mt-0 focus-visible:outline-none">
            <RecordingsGrid embedded />
          </TabsContent>

        </Tabs>

        {/* Case detail dialog with mini chat */}
        <Dialog open={!!activeCase} onOpenChange={open => !open && setActiveCase(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            {activeCase && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <DialogTitle className="flex-1 min-w-0">{activeCase.title}</DialogTitle>
                    {canDelete(activeCase) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 h-8"
                        onClick={() => setDeletingCase(activeCase)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t('medicalEducationPage.delete')}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <Stethoscope className="w-3 h-3" />
                    {activeCase.specialty} · {activeCase.author_name}
                  </p>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                  {activeCase.description && (
                    <p className="text-sm whitespace-pre-wrap">{activeCase.description}</p>
                  )}
                  {activeCase.file_url && (
                    <InlineFileViewer fileUrl={activeCase.file_url} />
                  )}
                  <div className="border-t pt-3">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" /> {t('medicalEducationPage.discussion')} ({comments.length})
                    </h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">{t('medicalEducationPage.noComments')}</p>
                      ) : comments.map(cm => (
                        <div key={cm.id} className="bg-muted/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{cm.author_name}</span>
                            <Badge variant={cm.author_role === 'resident' ? 'secondary' : 'verified'} className="text-[9px] h-4">
                              {cm.author_role === 'resident' ? t('medicalEducationPage.roleResidentShort') : t('medicalEducationPage.roleDoctorShort')}
                            </Badge>
                          </div>
                          <p className="text-sm">{cm.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-3">
                  <Input
                    placeholder={t('medicalEducationPage.commentPlaceholder')}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendComment()}
                    className="min-h-[44px]"
                  />
                  <Button onClick={sendComment} disabled={posting || !newComment.trim()} className="min-h-[44px] min-w-[44px]">
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingCase} onOpenChange={open => !open && setDeletingCase(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('medicalEducationPage.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingCase?.title && <><strong>{deletingCase.title}</strong><br /></>}
                {t('medicalEducationPage.deleteConfirmBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t('medicalEducationPage.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-white">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                {t('medicalEducationPage.deleteFinal')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
