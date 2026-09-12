// Cursos (Aprendizaje), 11-sep-2026.
//
// Componente reutilizable por categoría (curso | masterclass | material):
// catálogo publicado + "Mis cursos" del médico con lecciones que enlazan
// contenido, grabaciones, lives o libros ya existentes. Publicar e inscribirse
// pasan por la revisión de useConfirmAction; nada se guarda al primer clic.
// Sin la migración `courses`/`course_lessons`/`course_enrollments`, el hook
// devuelve `pendingActivation` y esto se ve pero no rompe nada (regla del
// contrato de base de datos).
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCourses, Course, CourseLesson, CourseCategory, CourseLevel, LessonItemType, CourseFailure } from '@/hooks/useCourses';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { fmtDate, money } from '@/lib/proFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Plus, Loader2, Trash2, Pencil, Users, GraduationCap, FileText, Film, Radio,
  Link2, CheckCircle2, AlertCircle, Lock, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  category: CourseCategory;
}

const ITEM_ICON: Record<LessonItemType, React.ElementType> = {
  content: FileText,
  recording: Film,
  live: Radio,
  book: BookOpen,
  file: FileText,
  link: Link2,
};

type PickableType = Extract<LessonItemType, 'content' | 'recording' | 'live' | 'book'>;

const emptyLessonForm = () => ({
  id: undefined as string | undefined,
  title: '',
  description: '',
  item_type: 'content' as LessonItemType,
  item_id: '',
  url: '',
  duration_minutes: '' as string | number,
});

export default function CoursesSection({ category }: Props) {
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const canManage = role === 'doctor' || role === 'resident' || role === 'admin';

  const published = useCourses({ scope: 'published', category });
  const mine = useCourses({ scope: 'mine', category });
  const pendingActivation = published.pendingActivation || mine.pendingActivation;

  // --- Crear curso ---
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', level: '' as '' | CourseLevel, price: '0' });

  const submitCreate = async () => {
    if (!form.title.trim()) { toast.error(t('mm2.learning.courses.errors.titleRequired')); return; }
    setCreating(true);
    const res = await mine.createCourse({
      title: form.title,
      category,
      description: form.description,
      level: form.level ? form.level : null,
      price: Number(form.price) || 0,
    });
    setCreating(false);
    if (!res.ok) {
      toast.error(t('mm2.learning.courses.errors.createError'));
      return;
    }
    toast.success(t('mm2.learning.courses.createSuccess'));
    setCreateOpen(false);
    setForm({ title: '', description: '', level: '', price: '0' });
  };

  // --- Detalle / gestión de un curso ---
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const isOwnerView = !!(openCourseId && mine.courses.some(c => c.id === openCourseId));
  const openCourse = useMemo(
    () => (isOwnerView ? mine.courses : published.courses).find(c => c.id === openCourseId) || null,
    [isOwnerView, mine.courses, published.courses, openCourseId],
  );

  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState(emptyLessonForm());
  const [savingLesson, setSavingLesson] = useState(false);
  const [itemOptions, setItemOptions] = useState<{ id: string; label: string }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!lessonOpen) return;
    const type = lessonForm.item_type as PickableType;
    if (!['content', 'recording', 'live', 'book'].includes(type) || !user?.id) { setItemOptions([]); return; }
    let cancelled = false;
    setLoadingOptions(true);
    (async () => {
      let rows: { id: string; label: string }[] = [];
      if (type === 'content' || type === 'book') {
        const { data } = await supabase
          .from('doctor_content')
          .select('id, title, is_book')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(80);
        const all = (data as any[]) || [];
        rows = all.filter(r => (type === 'book' ? r.is_book : !r.is_book)).map(r => ({ id: r.id, label: r.title }));
      } else if (type === 'recording') {
        const { data } = await supabase.from('recordings').select('id, title').eq('doctor_id', user.id).order('created_at', { ascending: false }).limit(50);
        rows = (data || []).map((r: any) => ({ id: r.id, label: r.title }));
      } else if (type === 'live') {
        const { data } = await supabase.from('lives').select('id, title, started_at').eq('doctor_id', user.id).order('started_at', { ascending: false }).limit(50);
        rows = (data || []).map((r: any) => ({ id: r.id, label: r.title }));
      }
      if (!cancelled) { setItemOptions(rows); setLoadingOptions(false); }
    })();
    return () => { cancelled = true; };
  }, [lessonOpen, lessonForm.item_type, user?.id]);

  const openLessonForm = (lesson?: CourseLesson) => {
    setLessonForm(
      lesson
        ? { id: lesson.id, title: lesson.title, description: lesson.description || '', item_type: lesson.item_type, item_id: lesson.item_id || '', url: lesson.url || '', duration_minutes: lesson.duration_minutes ?? '' }
        : emptyLessonForm(),
    );
    setLessonOpen(true);
  };

  const submitLesson = async () => {
    if (!openCourse || !lessonForm.title.trim()) { toast.error(t('mm2.learning.courses.errors.lessonTitleRequired')); return; }
    setSavingLesson(true);
    const res = await mine.upsertLesson({
      id: lessonForm.id,
      course_id: openCourse.id,
      position: lessonForm.id ? (openCourse.lessons?.find(l => l.id === lessonForm.id)?.position ?? 0) : (openCourse.lessons?.length || 0),
      title: lessonForm.title,
      description: lessonForm.description || null,
      item_type: lessonForm.item_type,
      item_id: ['content', 'recording', 'live', 'book'].includes(lessonForm.item_type) ? (lessonForm.item_id || null) : null,
      url: (lessonForm.item_type === 'link' || lessonForm.item_type === 'file') ? (lessonForm.url || null) : null,
      duration_minutes: lessonForm.duration_minutes ? Number(lessonForm.duration_minutes) : null,
    });
    setSavingLesson(false);
    if (!res.ok) { toast.error(t('mm2.learning.courses.errors.lessonSaveError')); return; }
    toast.success(t('mm2.learning.courses.lessonSaved'));
    setLessonOpen(false);
  };

  const removeLesson = async (lesson: CourseLesson) => {
    const ok = await confirm({
      title: t('mm2.learning.courses.confirmDeleteLesson.title'),
      description: t('mm2.learning.courses.confirmDeleteLesson.desc'),
      details: [{ label: t('mm2.learning.courses.fieldTitle'), value: lesson.title }],
      tone: 'destructive',
      confirmLabel: t('mm2.learning.courses.confirmDeleteLesson.confirm'),
    });
    if (!ok) return;
    const res = await mine.deleteLesson(lesson.id);
    if (!res.ok) toast.error(t('mm2.learning.courses.errors.lessonDeleteError'));
    else toast.success(t('mm2.learning.courses.lessonDeleted'));
  };

  const togglePublish = async (course: Course) => {
    const next = !course.is_published;
    const ok = await confirm({
      title: next ? t('mm2.learning.courses.confirmPublish.title') : t('mm2.learning.courses.confirmUnpublish.title'),
      description: next ? t('mm2.learning.courses.confirmPublish.desc') : t('mm2.learning.courses.confirmUnpublish.desc'),
      details: [
        { label: t('mm2.learning.courses.fieldTitle'), value: course.title },
        { label: t('mm2.learning.courses.fieldLessons'), value: String(course.lessons?.length || 0) },
      ],
      confirmLabel: next ? t('mm2.learning.courses.publish') : t('mm2.learning.courses.unpublish'),
    });
    if (!ok) return;
    const res = await mine.updateCourse(course.id, { is_published: next });
    if (!res.ok) toast.error(t('mm2.learning.courses.errors.publishError'));
    else toast.success(next ? t('mm2.learning.courses.publishSuccess') : t('mm2.learning.courses.unpublishSuccess'));
  };

  const removeCourse = async (course: Course) => {
    const ok = await confirm({
      title: t('mm2.learning.courses.confirmDelete.title'),
      description: t('mm2.learning.courses.confirmDelete.desc'),
      details: [{ label: t('mm2.learning.courses.fieldTitle'), value: course.title }],
      tone: 'destructive',
      confirmLabel: t('mm2.learning.courses.confirmDelete.confirm'),
    });
    if (!ok) return;
    const res = await mine.deleteCourse(course.id);
    if (!res.ok) { toast.error(t('mm2.learning.courses.errors.deleteError')); return; }
    toast.success(t('mm2.learning.courses.deleteSuccess'));
    setOpenCourseId(null);
  };

  const [enrolling, setEnrolling] = useState(false);
  const enroll = async (course: Course) => {
    const isFree = !course.price;
    const ok = await confirm({
      title: t('mm2.learning.courses.confirmEnroll.title'),
      description: isFree ? t('mm2.learning.courses.confirmEnroll.descFree') : t('mm2.learning.courses.confirmEnroll.descPaid'),
      details: [
        { label: t('mm2.learning.courses.fieldTitle'), value: course.title },
        { label: t('mm2.learning.courses.fieldPrice'), value: isFree ? t('mm2.learning.courses.free') : money(course.price, language), emphasis: !isFree },
      ],
      tone: isFree ? 'default' : 'payment',
      confirmLabel: t('mm2.learning.courses.confirmEnroll.confirm'),
    });
    if (!ok) return;
    setEnrolling(true);
    const res = await published.enroll(course.id);
    setEnrolling(false);
    if (!res.ok) {
      // Cast explícito: el checker de este repo no estrecha el discriminado
      // `ok` dentro del `if` (mismo workaround que NewConsultationDialog.tsx).
      const reason = (res as { reason: CourseFailure }).reason;
      if (reason === 'paid_course_requires_purchase') toast.error(t('mm2.learning.courses.errors.requiresPurchase'));
      else if (reason === 'not_published') toast.error(t('mm2.learning.courses.errors.notPublished'));
      else toast.error(t('mm2.learning.courses.errors.enrollError'));
      return;
    }
    toast.success(t('mm2.learning.courses.enrollSuccess'));
  };

  const toggleLessonSeen = async (course: Course, lesson: CourseLesson) => {
    const enrollment = published.enrollments.find(e => e.course_id === course.id);
    if (!enrollment) return;
    const seen = { ...(enrollment.progress || {}) };
    if (seen[lesson.id]) delete seen[lesson.id];
    else seen[lesson.id] = true;
    await published.updateProgress(enrollment.id, seen);
  };

  const levelLabel = (lvl: CourseLevel | null) => (lvl ? t(`mm2.learning.courses.level.${lvl}`) : '—');

  const courseCard = (course: Course, owner: boolean) => {
    const enrollment = published.enrollments.find(e => e.course_id === course.id);
    return (
      <Card key={course.id} className="border-l-4 border-l-primary/30 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenCourseId(course.id)}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="truncate">{course.title}</span>
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {course.level && <Badge variant="outline" className="text-[10px]">{levelLabel(course.level)}</Badge>}
              {course.price > 0 ? (
                <Badge variant="warning" className="text-[10px]">{money(course.price, language)}</Badge>
              ) : (
                <Badge variant="success" className="text-[10px]">{t('mm2.learning.courses.free')}</Badge>
              )}
              {owner && (
                <Badge variant={course.is_published ? 'success' : 'secondary'} className="text-[10px]">
                  {course.is_published ? t('mm2.learning.courses.published') : t('mm2.learning.courses.draft')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {course.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{course.description}</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {t('mm2.learning.courses.lessonsCount').replace('{count}', String(course.lessons?.length || 0))}</span>
            {!owner && enrollment && <span className="flex items-center gap-1 text-success font-medium"><CheckCircle2 className="w-3 h-3" /> {t('mm2.learning.courses.enrolled')}</span>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      {pendingActivation && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('mm2.learning.courses.pending.title')}</p>
            <p className="text-xs mt-0.5">{t('mm2.learning.courses.pending.desc')}</p>
          </div>
        </div>
      )}

      {/* Catálogo publicado */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> {t('mm2.learning.courses.catalogTitle')}
          </h3>
        </div>
        {published.loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : published.courses.length === 0 ? (
          <Card className="p-6 text-center border-primary/15">
            <p className="text-sm text-muted-foreground">{t('mm2.learning.courses.catalogEmpty')}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {published.courses.map(c => courseCard(c, false))}
          </div>
        )}
      </section>

      {/* Mis cursos */}
      {canManage && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> {t('mm2.learning.courses.mineTitle')}
            </h3>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)} disabled={pendingActivation}>
              <Plus className="w-4 h-4" /> {t('mm2.learning.courses.create')}
            </Button>
          </div>
          {mine.loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : mine.courses.length === 0 ? (
            <Card className="p-6 text-center border-primary/15">
              <p className="text-sm text-muted-foreground">{t('mm2.learning.courses.mineEmpty')}</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.courses.map(c => courseCard(c, true))}
            </div>
          )}
        </section>
      )}

      {/* Crear curso */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('mm2.learning.courses.newTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>{t('mm2.learning.courses.fieldTitle')}</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>{t('mm2.learning.courses.fieldDescription')}</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('mm2.learning.courses.fieldLevel')}</Label>
                <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v as CourseLevel }))}>
                  <SelectTrigger><SelectValue placeholder={t('mm2.learning.courses.levelPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">{t('mm2.learning.courses.level.basico')}</SelectItem>
                    <SelectItem value="intermedio">{t('mm2.learning.courses.level.intermedio')}</SelectItem>
                    <SelectItem value="avanzado">{t('mm2.learning.courses.level.avanzado')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('mm2.learning.courses.fieldPrice')}</Label>
                <Input type="number" min={0} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('mm2.learning.courses.createHint')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('pro.common.cancel')}</Button>
            <Button onClick={submitCreate} disabled={creating || !form.title.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('mm2.learning.courses.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle / gestión de un curso */}
      <Dialog open={!!openCourseId} onOpenChange={o => { if (!o) setOpenCourseId(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {openCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="min-w-0 truncate">{openCourse.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {openCourse.description && <p className="text-sm text-muted-foreground">{openCourse.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {openCourse.level && <Badge variant="outline">{levelLabel(openCourse.level)}</Badge>}
                  <Badge variant={openCourse.price > 0 ? 'warning' : 'success'}>{openCourse.price > 0 ? money(openCourse.price, language) : t('mm2.learning.courses.free')}</Badge>
                  {isOwnerView && (
                    <Badge variant={openCourse.is_published ? 'success' : 'secondary'}>{openCourse.is_published ? t('mm2.learning.courses.published') : t('mm2.learning.courses.draft')}</Badge>
                  )}
                  <span className="text-muted-foreground">{fmtDate(new Date(openCourse.created_at), language)}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t('mm2.learning.courses.lessonsTitle')}</Label>
                    {isOwnerView && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openLessonForm()}>
                        <Plus className="w-3.5 h-3.5" /> {t('mm2.learning.courses.addLesson')}
                      </Button>
                    )}
                  </div>
                  {(openCourse.lessons || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">{t('mm2.learning.courses.noLessons')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(openCourse.lessons || []).map(lesson => {
                        const Icon = ITEM_ICON[lesson.item_type] || FileText;
                        const enrollment = published.enrollments.find(e => e.course_id === openCourse.id);
                        const seen = !!enrollment?.progress?.[lesson.id];
                        return (
                          <div key={lesson.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{lesson.title}</p>
                              {lesson.duration_minutes ? <p className="text-[11px] text-muted-foreground">{lesson.duration_minutes} {t('pro.common.min')}</p> : null}
                            </div>
                            {!isOwnerView && enrollment && (
                              <button
                                type="button"
                                className={`h-7 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1 ${seen ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground'}`}
                                onClick={() => toggleLessonSeen(openCourse, lesson)}
                              >
                                <CheckCircle2 className="w-3 h-3" /> {seen ? t('mm2.learning.courses.seen') : t('mm2.learning.courses.markSeen')}
                              </button>
                            )}
                            {isOwnerView && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLessonForm(lesson)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeLesson(lesson)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                {isOwnerView ? (
                  <>
                    <Button variant="outline" className="text-destructive hover:text-destructive gap-1.5" onClick={() => removeCourse(openCourse)}>
                      <Trash2 className="w-4 h-4" /> {t('mm2.learning.courses.delete')}
                    </Button>
                    <Button className="gap-1.5" onClick={() => togglePublish(openCourse)} disabled={!(openCourse.lessons || []).length && !openCourse.is_published}>
                      {openCourse.is_published ? <Lock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {openCourse.is_published ? t('mm2.learning.courses.unpublish') : t('mm2.learning.courses.publish')}
                    </Button>
                  </>
                ) : (
                  !published.enrollments.some(e => e.course_id === openCourse.id) && (
                    <Button className="gap-1.5 w-full sm:w-auto" onClick={() => enroll(openCourse)} disabled={enrolling}>
                      {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                      {openCourse.price > 0 ? t('mm2.learning.courses.buyToEnroll') : t('mm2.learning.courses.enrollNow')}
                    </Button>
                  )
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lección */}
      <Dialog open={lessonOpen} onOpenChange={setLessonOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{lessonForm.id ? t('mm2.learning.courses.editLesson') : t('mm2.learning.courses.addLesson')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>{t('mm2.learning.courses.fieldTitle')}</Label>
              <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>{t('mm2.learning.courses.fieldDescription')}</Label>
              <Textarea rows={2} value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('mm2.learning.courses.fieldItemType')}</Label>
                <Select value={lessonForm.item_type} onValueChange={v => setLessonForm(f => ({ ...f, item_type: v as LessonItemType, item_id: '', url: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="content">{t('mm2.learning.courses.itemType.content')}</SelectItem>
                    <SelectItem value="recording">{t('mm2.learning.courses.itemType.recording')}</SelectItem>
                    <SelectItem value="live">{t('mm2.learning.courses.itemType.live')}</SelectItem>
                    <SelectItem value="book">{t('mm2.learning.courses.itemType.book')}</SelectItem>
                    <SelectItem value="link">{t('mm2.learning.courses.itemType.link')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('mm2.learning.courses.fieldDuration')}</Label>
                <Input type="number" min={0} value={lessonForm.duration_minutes} onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>
            {(['content', 'recording', 'live', 'book'] as LessonItemType[]).includes(lessonForm.item_type) ? (
              <div>
                <Label>{t('mm2.learning.courses.fieldLinkedItem')}</Label>
                <Select value={lessonForm.item_id} onValueChange={v => setLessonForm(f => ({ ...f, item_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={loadingOptions ? t('pro.common.loading') : t('mm2.learning.courses.linkedItemPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {itemOptions.length === 0 && !loadingOptions && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('mm2.learning.courses.noItemsOfType')}</div>
                    )}
                    {itemOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>{t('mm2.learning.courses.fieldUrl')}</Label>
                <Input value={lessonForm.url} onChange={e => setLessonForm(f => ({ ...f, url: e.target.value }))} placeholder="https://" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonOpen(false)}>{t('pro.common.cancel')}</Button>
            <Button onClick={submitLesson} disabled={savingLesson || !lessonForm.title.trim()}>
              {savingLesson && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('pro.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}
