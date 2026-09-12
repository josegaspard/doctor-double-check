// Cursos, masterclass y materiales formativos (Aprendizaje), 11-sep-2026.
// Tablas courses, course_lessons y course_enrollments + rpc enroll_in_course
// (migración 20260912). Sin la migración: `pendingActivation`, sin escrituras.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

const sb = supabase as any;

export type CourseCategory = 'curso' | 'masterclass' | 'material';
export type CourseLevel = 'basico' | 'intermedio' | 'avanzado';
export type LessonItemType = 'content' | 'recording' | 'live' | 'book' | 'file' | 'link';

export interface CourseLesson {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  item_type: LessonItemType;
  item_id: string | null;
  url: string | null;
  duration_minutes: number | null;
}

export interface Course {
  id: string;
  creator_id: string;
  category: CourseCategory;
  title: string;
  description: string | null;
  cover_url: string | null;
  level: CourseLevel | null;
  price: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  lessons?: CourseLesson[];
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  enrolled_at: string;
  progress: Record<string, any>;
}

export type CourseFailure = 'pending_activation' | 'invalid' | 'forbidden' | 'paid_course_requires_purchase' | 'not_published' | 'error';
export type CourseResult<T = void> = { ok: true; data?: T } | { ok: false; reason: CourseFailure; error?: any };

function classify(err: any): CourseFailure {
  const msg = `${err?.message || ''}`.toLowerCase();
  if (msg.includes('paid_course_requires_purchase')) return 'paid_course_requires_purchase';
  if (msg.includes('course_not_published')) return 'not_published';
  const code = String(err?.code || '');
  if (code === '42501') return 'forbidden';
  if (['23514', '23505', '23503', '22P02'].includes(code)) return 'invalid';
  return 'error';
}

interface Options {
  /** Catálogo publicado de una categoría, o los cursos propios del médico. */
  scope?: 'published' | 'mine';
  category?: CourseCategory;
}

export function useCourses({ scope = 'published', category }: Options = {}) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActivation, setPendingActivation] = useState(false);

  const fail = useCallback((err: any): { ok: false; reason: CourseFailure; error?: any } => {
    if (isMissingDbObject(err)) {
      setPendingActivation(true);
      return { ok: false, reason: 'pending_activation', error: err };
    }
    console.error('[useCourses]', err);
    return { ok: false, reason: classify(err), error: err };
  }, []);

  const load = useCallback(async () => {
    if (scope === 'mine' && !user?.id) return;
    setLoading(true);
    let query = sb.from('courses').select('*, lessons:course_lessons(*)').order('created_at', { ascending: false });
    query = scope === 'mine' ? query.eq('creator_id', user!.id) : query.eq('is_published', true);
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) {
      fail(error);
      setCourses([]);
      setLoading(false);
      return;
    }
    setPendingActivation(false);
    setCourses(
      (data || []).map((c: any) => ({
        ...c,
        price: Number(c.price || 0),
        lessons: [...(c.lessons || [])].sort((a: CourseLesson, b: CourseLesson) => a.position - b.position),
      })),
    );
    if (user?.id) {
      const { data: mine } = await sb.from('course_enrollments').select('*').eq('user_id', user.id);
      setEnrollments(mine || []);
    }
    setLoading(false);
  }, [scope, category, user?.id, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const createCourse = useCallback(
    async (input: { title: string; category: CourseCategory; description?: string; cover_url?: string | null; level?: CourseLevel | null; price?: number }): Promise<CourseResult<Course>> => {
      if (!user?.id) return { ok: false, reason: 'forbidden' };
      const title = (input.title || '').trim();
      if (!title) return { ok: false, reason: 'invalid' };
      const { data, error } = await sb
        .from('courses')
        .insert({
          creator_id: user.id,
          category: input.category,
          title,
          description: input.description?.trim() || null,
          cover_url: input.cover_url || null,
          level: input.level || null,
          price: Math.max(0, Number(input.price || 0)),
          is_published: false,
        })
        .select('*')
        .single();
      if (error) return fail(error);
      await load();
      return { ok: true, data: { ...data, lessons: [] } };
    },
    [user?.id, load, fail],
  );

  const updateCourse = useCallback(
    async (id: string, patch: Partial<Pick<Course, 'title' | 'description' | 'cover_url' | 'level' | 'price' | 'category' | 'is_published'>>): Promise<CourseResult> => {
      const { error } = await sb.from('courses').update(patch).eq('id', id);
      if (error) return fail(error);
      await load();
      return { ok: true };
    },
    [load, fail],
  );

  const deleteCourse = useCallback(
    async (id: string): Promise<CourseResult> => {
      const { error } = await sb.from('courses').delete().eq('id', id);
      if (error) return fail(error);
      await load();
      return { ok: true };
    },
    [load, fail],
  );

  const upsertLesson = useCallback(
    async (lesson: Omit<CourseLesson, 'id'> & { id?: string }): Promise<CourseResult> => {
      const row = {
        course_id: lesson.course_id,
        position: lesson.position,
        title: (lesson.title || '').trim(),
        description: lesson.description || null,
        item_type: lesson.item_type,
        item_id: lesson.item_id || null,
        url: lesson.url || null,
        duration_minutes: lesson.duration_minutes ?? null,
      };
      if (!row.title) return { ok: false, reason: 'invalid' };
      const { error } = lesson.id
        ? await sb.from('course_lessons').update(row).eq('id', lesson.id)
        : await sb.from('course_lessons').insert(row);
      if (error) return fail(error);
      await load();
      return { ok: true };
    },
    [load, fail],
  );

  const deleteLesson = useCallback(
    async (id: string): Promise<CourseResult> => {
      const { error } = await sb.from('course_lessons').delete().eq('id', id);
      if (error) return fail(error);
      await load();
      return { ok: true };
    },
    [load, fail],
  );

  const reorderLessons = useCallback(
    async (courseId: string, orderedLessonIds: string[]): Promise<CourseResult> => {
      for (let i = 0; i < orderedLessonIds.length; i++) {
        const { error } = await sb.from('course_lessons').update({ position: i }).eq('id', orderedLessonIds[i]).eq('course_id', courseId);
        if (error) return fail(error);
      }
      await load();
      return { ok: true };
    },
    [load, fail],
  );

  /** Inscripción: solo cursos publicados y gratuitos; los de pago devuelven paid_course_requires_purchase. */
  const enroll = useCallback(
    async (courseId: string): Promise<CourseResult<string>> => {
      const { data, error } = await sb.rpc('enroll_in_course', { p_course_id: courseId });
      if (error) return fail(error);
      await load();
      return { ok: true, data: typeof data === 'string' ? data : String(data) };
    },
    [load, fail],
  );

  const updateProgress = useCallback(
    async (enrollmentId: string, progress: Record<string, any>): Promise<CourseResult> => {
      const { error } = await sb.from('course_enrollments').update({ progress }).eq('id', enrollmentId);
      if (error) return fail(error);
      setEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? { ...e, progress } : e)));
      return { ok: true };
    },
    [fail],
  );

  const isEnrolled = useCallback((courseId: string) => enrollments.some((e) => e.course_id === courseId), [enrollments]);

  return {
    courses,
    enrollments,
    loading,
    pendingActivation,
    reload: load,
    createCourse,
    updateCourse,
    deleteCourse,
    upsertLesson,
    deleteLesson,
    reorderLessons,
    enroll,
    updateProgress,
    isEnrolled,
  };
}

export default useCourses;
