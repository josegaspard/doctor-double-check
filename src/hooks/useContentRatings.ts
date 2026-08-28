import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Reseñas con estrellas de contenido, lives y grabaciones (cliente 2026-08-28).
//
// Matriz de quién puede puntuar a quién (la impone la base; aquí sólo se usa
// para no enseñar estrellas que van a fallar):
//   Paciente → Médico ✅   Paciente → Residente ✅   Médico → Paciente ✅
//   Médico → Residente ✅  Residente → Médico ✅     Residente → Paciente ❌
// Y nadie se puntúa a sí mismo.
export type RatingTargetType = 'content' | 'live' | 'recording';

export interface RatingSummary {
  avg: number;
  count: number;
}

const EMPTY: RatingSummary = { avg: 0, count: 0 };

// ── Resumen en lote: 1 llamada por parrilla, no N ────────────────────────────
const cache = new Map<string, RatingSummary>();
const listeners = new Map<string, Set<(s: RatingSummary) => void>>();
const pending = new Map<RatingTargetType, Set<string>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const cacheKey = (type: RatingTargetType, id: string) => `${type}:${id}`;

async function flush() {
  timer = null;
  const batches = Array.from(pending.entries());
  pending.clear();

  for (const [type, idSet] of batches) {
    const ids = Array.from(idSet);
    if (ids.length === 0) continue;
    let got = new Map<string, RatingSummary>();
    try {
      const { data } = await supabase.rpc('get_ratings_summary' as any, {
        p_target_type: type,
        p_target_ids: ids,
      });
      (data as any[] | null)?.forEach((r) => {
        got.set(r.target_id, { avg: Number(r.avg_rating) || 0, count: Number(r.ratings_count) || 0 });
      });
    } catch {
      got = new Map();
    }
    ids.forEach((id) => {
      const k = cacheKey(type, id);
      const s = got.get(id) ?? EMPTY;
      cache.set(k, s);
      listeners.get(k)?.forEach((fn) => fn(s));
    });
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 60);
}

function enqueue(type: RatingTargetType, id: string) {
  let set = pending.get(type);
  if (!set) { set = new Set(); pending.set(type, set); }
  set.add(id);
  schedule();
}

/** Media y nº de reseñas de una pieza. Se agrupan las peticiones de toda la parrilla. */
export function useRatingSummary(type: RatingTargetType, targetId?: string | null): RatingSummary {
  const k = targetId ? cacheKey(type, targetId) : '';
  const [summary, setSummary] = useState<RatingSummary>(
    k && cache.has(k) ? (cache.get(k) as RatingSummary) : EMPTY,
  );

  useEffect(() => {
    if (!targetId) { setSummary(EMPTY); return; }
    const key = cacheKey(type, targetId);
    if (cache.has(key)) { setSummary(cache.get(key) as RatingSummary); return; }
    let set = listeners.get(key);
    if (!set) { set = new Set(); listeners.set(key, set); }
    const fn = (s: RatingSummary) => setSummary(s);
    set.add(fn);
    enqueue(type, targetId);
    return () => { set!.delete(fn); };
  }, [type, targetId]);

  return summary;
}

/** Fuerza a releer el resumen de una pieza (tras votar). */
export function invalidateRatingSummary(type: RatingTargetType, targetId: string) {
  cache.delete(cacheKey(type, targetId));
  enqueue(type, targetId);
}

// ── Mi voto sobre una pieza + envío ──────────────────────────────────────────
export function useMyRating(type: RatingTargetType, targetId?: string | null, userId?: string | null) {
  const [myRating, setMyRating] = useState<number | null>(null);
  const [myComment, setMyComment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!targetId || !userId) { setMyRating(null); setMyComment(''); return; }
    setIsLoading(true);
    supabase
      .from('content_ratings' as any)
      .select('rating, comment')
      .eq('target_type', type)
      .eq('target_id', targetId)
      .eq('rater_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setMyRating((data as any)?.rating ?? null);
        setMyComment((data as any)?.comment ?? '');
        setIsLoading(false);
      });
    return () => { alive = false; };
  }, [type, targetId, userId]);

  const submit = useCallback(
    async (rating: number, comment?: string): Promise<{ error: RatingErrorCode | null }> => {
      if (!targetId || !userId) return { error: 'no_session' };
      setIsSaving(true);
      // target_owner_id lo resuelve la base (trigger): mandamos un valor de
      // relleno porque la columna es NOT NULL, pero el trigger lo sobrescribe.
      const { error } = await supabase
        .from('content_ratings' as any)
        .upsert(
          {
            target_type: type,
            target_id: targetId,
            target_owner_id: userId,
            rater_id: userId,
            rating,
            comment: comment?.trim() ? comment.trim() : null,
          } as any,
          { onConflict: 'target_type,target_id,rater_id' },
        );
      setIsSaving(false);
      if (error) return { error: ratingErrorCode(error.message) };
      setMyRating(rating);
      setMyComment(comment ?? '');
      invalidateRatingSummary(type, targetId);
      return { error: null };
    },
    [type, targetId, userId],
  );

  return { myRating, myComment, isLoading, isSaving, submit };
}

/** Código de error (el componente lo traduce con t('contentRatings.err…')). */
export type RatingErrorCode = 'not_allowed' | 'not_public' | 'not_found' | 'generic' | 'no_session';
function ratingErrorCode(msg: string): RatingErrorCode {
  if (msg.includes('RATING_NOT_ALLOWED')) return 'not_allowed';
  if (msg.includes('RATING_TARGET_NOT_PUBLIC')) return 'not_public';
  if (msg.includes('RATING_TARGET_NOT_FOUND')) return 'not_found';
  return 'generic';
}

/**
 * ¿Puede este rol puntuar al autor? Espejo en el navegador de can_rate_user()
 * de la base — la base sigue siendo la que manda.
 */
export function canRate(myRole?: string | null, authorRole?: string | null, isSelf = false): boolean {
  if (!myRole || isSelf) return false;
  if (myRole === 'resident' && authorRole === 'patient') return false;
  return true;
}
