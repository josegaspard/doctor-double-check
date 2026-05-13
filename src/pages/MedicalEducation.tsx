import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { GraduationCap, Plus, MessageCircle, Eye, Stethoscope, Send, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { SearchableFilter } from '@/components/filters/SearchableFilter';
import { SPECIALTIES_LIST } from '@/lib/specialties';
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
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');
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

  useEffect(() => {
    if (role && role !== 'doctor' && role !== 'resident' && role !== 'admin') {
      navigate('/lives');
    }
  }, [role, navigate]);

  const loadCases = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('clinical_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('No se pudieron cargar los casos');
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
        author_name: pmap.get(r.author_id)?.name || 'Médico',
        author_avatar: pmap.get(r.author_id)?.avatar_url || undefined,
        author_role: (rmap.get(r.author_id) as string) || 'doctor',
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadCases();
  }, []);

  const filtered = useMemo(() => {
    if (!specialty || specialty === 'Todas') return cases;
    return cases.filter(c => c.specialty === specialty);
  }, [cases, specialty]);

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
        author_name: pmap.get(r.author_id)?.name || 'Usuario',
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
      toast.error('No se pudo enviar el comentario');
      return;
    }
    setNewComment('');
    openCase(activeCase);
    setCases(cs => cs.map(c => (c.id === activeCase.id ? { ...c, comments_count: c.comments_count + 1 } : c)));
  };

  const submitCase = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.specialty) {
      toast.error('Completa título y especialidad');
      return;
    }
    setSubmitting(true);
    let file_url: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('doctor-content').upload(path, file);
      if (upErr) {
        toast.error('Error al subir archivo');
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
      toast.error('No se pudo publicar el caso');
      return;
    }
    toast.success('Caso clínico publicado');
    setCreateOpen(false);
    setForm({ title: '', specialty: '', description: '', category: '', patient_age: '', patient_sex: '' });
    setFile(null);
    loadCases();
  };

  const isDoctor = role === 'doctor' || role === 'admin';

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="hidden sm:inline-flex mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" />
              Medical Master Education
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Casos clínicos compartidos entre doctores y residentes
            </p>
          </div>
          {isDoctor && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 min-h-[48px]">
                  <Plus className="w-5 h-5" />
                  Subir caso clínico
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nuevo caso clínico</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Título *</Label>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Lesión hepática atípica" />
                  </div>
                  <div>
                    <Label>Especialidad *</Label>
                    <SearchableFilter
                      value={form.specialty}
                      onChange={v => setForm(f => ({ ...f, specialty: v }))}
                      options={SPECIALTIES_LIST}
                      placeholder="Selecciona especialidad"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Edad</Label>
                      <Input type="number" inputMode="numeric" value={form.patient_age} onChange={e => setForm(f => ({ ...f, patient_age: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Sexo</Label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.patient_sex} onChange={e => setForm(f => ({ ...f, patient_sex: e.target.value }))}>
                        <option value="">—</option>
                        <option value="F">F</option>
                        <option value="M">M</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Descripción del caso</Label>
                    <Textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Antecedentes, síntomas, hallazgos, dudas para discusión..." />
                  </div>
                  <div>
                    <Label>Archivo adjunto (opcional)</Label>
                    <Input type="file" accept="image/*,application/pdf,video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                    <p className="text-xs text-muted-foreground mt-1">PDF, imagen o video. No incluyas datos identificativos del paciente.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={submitCase} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Publicar caso
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Aviso "Espacio profesional" — panel sólido para que destaque sobre el fondo
            teal del brandbook (antes con bg-info/5 se perdía completamente). */}
        <Card className="mb-4 bg-card border-l-4 border-l-secondary border border-secondary/20 shadow-sm">
          <CardContent className="p-3 text-xs text-foreground flex items-start gap-2">
            <span aria-hidden className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex-shrink-0">🔒</span>
            <span>
              <strong className="text-secondary font-semibold">Espacio profesional.</strong>{' '}
              <span className="text-muted-foreground">Anonimiza siempre los datos del paciente. El contenido es solo visible para doctores y residentes verificados.</span>
            </span>
          </CardContent>
        </Card>

        <div className="mb-4">
          <SearchableFilter
            value={specialty}
            onChange={setSpecialty}
            options={SPECIALTIES_LIST}
            placeholder="Filtrar por especialidad"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">Aún no hay casos publicados</p>
            <p className="text-sm text-muted-foreground mt-1">Sé el primero en compartir un caso clínico para discusión.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filtered.map(c => (
              <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openCase(c)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">{c.title}</CardTitle>
                    <Badge variant={c.author_role === 'resident' ? 'warning' : 'verified'} className="text-[10px] flex-shrink-0">
                      {c.author_role === 'resident' ? 'Residente' : 'Doctor'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Stethoscope className="w-3 h-3" />
                    {c.specialty}
                    {c.patient_age && <span>· {c.patient_age} años {c.patient_sex || ''}</span>}
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

        {/* Case detail dialog with mini chat */}
        <Dialog open={!!activeCase} onOpenChange={open => !open && setActiveCase(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            {activeCase && (
              <>
                <DialogHeader>
                  <DialogTitle>{activeCase.title}</DialogTitle>
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
                    <a href={activeCase.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="w-4 h-4" /> Ver archivo adjunto
                    </a>
                  )}
                  <div className="border-t pt-3">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" /> Discusión ({comments.length})
                    </h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Aún no hay comentarios. Inicia la discusión.</p>
                      ) : comments.map(cm => (
                        <div key={cm.id} className="bg-muted/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{cm.author_name}</span>
                            <Badge variant={cm.author_role === 'resident' ? 'warning' : 'verified'} className="text-[9px] h-4">
                              {cm.author_role === 'resident' ? 'R' : 'Dr'}
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
                    placeholder="Escribe un comentario..."
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
      </div>
    </MainLayout>
  );
}
