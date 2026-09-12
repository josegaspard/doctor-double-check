// Colecciones de contenido del médico (Contenido > Colecciones), 11-sep-2026.
// Tablas content_collections y content_collection_items (migración 20260912).
// Sin la migración, `pendingActivation` y ninguna escritura.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingDbObject } from '@/hooks/useCreateAppointment';

const sb = supabase as any;

export type CollectionItemType = 'content' | 'recording' | 'live' | 'book';

export interface CollectionItem {
  id: string;
  collection_id: string;
  item_type: CollectionItemType;
  item_id: string;
  position: number;
}

export interface ContentCollection {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  price: number;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
}

export type CollectionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; reason: 'pending_activation' | 'invalid' | 'forbidden' | 'error'; error?: any };

function fail(err: any, onMissing: () => void): { ok: false; reason: 'pending_activation' | 'invalid' | 'forbidden' | 'error'; error?: any } {
  if (isMissingDbObject(err)) {
    onMissing();
    return { ok: false, reason: 'pending_activation', error: err };
  }
  console.error('[useContentCollections]', err);
  const code = String(err?.code || '');
  if (code === '42501') return { ok: false, reason: 'forbidden', error: err };
  if (['23514', '23505', '22P02'].includes(code)) return { ok: false, reason: 'invalid', error: err };
  return { ok: false, reason: 'error', error: err };
}

/** Colecciones propias del médico (mine) o las públicas (public). */
export function useContentCollections(scope: 'mine' | 'public' = 'mine') {
  const { user } = useAuth();
  const [collections, setCollections] = useState<ContentCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActivation, setPendingActivation] = useState(false);
  const markMissing = useCallback(() => setPendingActivation(true), []);

  const load = useCallback(async () => {
    if (scope === 'mine' && !user?.id) return;
    setLoading(true);
    let query = sb
      .from('content_collections')
      .select('*, items:content_collection_items(id, collection_id, item_type, item_id, position)')
      .order('created_at', { ascending: false });
    query = scope === 'mine' ? query.eq('owner_id', user!.id) : query.eq('is_public', true);
    const { data, error } = await query;
    if (error) {
      fail(error, markMissing);
      setCollections([]);
    } else {
      setPendingActivation(false);
      setCollections(
        (data || []).map((c: any) => ({
          ...c,
          price: Number(c.price || 0),
          items: [...(c.items || [])].sort((a: CollectionItem, b: CollectionItem) => a.position - b.position),
        })),
      );
    }
    setLoading(false);
  }, [scope, user?.id, markMissing]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: { title: string; description?: string; cover_url?: string | null; price?: number }): Promise<CollectionResult<ContentCollection>> => {
      if (!user?.id) return { ok: false, reason: 'forbidden' };
      const title = (input.title || '').trim();
      if (!title) return { ok: false, reason: 'invalid' };
      const { data, error } = await sb
        .from('content_collections')
        .insert({ owner_id: user.id, title, description: input.description?.trim() || null, cover_url: input.cover_url || null, price: Math.max(0, Number(input.price || 0)), is_public: false })
        .select('*')
        .single();
      if (error) return fail(error, markMissing);
      await load();
      return { ok: true, data: { ...data, items: [] } };
    },
    [user?.id, load, markMissing],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<ContentCollection, 'title' | 'description' | 'cover_url' | 'price' | 'is_public'>>): Promise<CollectionResult> => {
      const { error } = await sb.from('content_collections').update(patch).eq('id', id);
      if (error) return fail(error, markMissing);
      await load();
      return { ok: true };
    },
    [load, markMissing],
  );

  const remove = useCallback(
    async (id: string): Promise<CollectionResult> => {
      const { error } = await sb.from('content_collections').delete().eq('id', id);
      if (error) return fail(error, markMissing);
      await load();
      return { ok: true };
    },
    [load, markMissing],
  );

  const addItem = useCallback(
    async (collectionId: string, itemType: CollectionItemType, itemId: string): Promise<CollectionResult> => {
      const current = collections.find((c) => c.id === collectionId);
      const position = current ? current.items.length : 0;
      const { error } = await sb
        .from('content_collection_items')
        .insert({ collection_id: collectionId, item_type: itemType, item_id: itemId, position });
      if (error) return fail(error, markMissing);
      await load();
      return { ok: true };
    },
    [collections, load, markMissing],
  );

  const removeItem = useCallback(
    async (itemRowId: string): Promise<CollectionResult> => {
      const { error } = await sb.from('content_collection_items').delete().eq('id', itemRowId);
      if (error) return fail(error, markMissing);
      await load();
      return { ok: true };
    },
    [load, markMissing],
  );

  /** Reordena los ítems de una colección según el orden de ids recibido. */
  const reorder = useCallback(
    async (collectionId: string, orderedItemRowIds: string[]): Promise<CollectionResult> => {
      for (let i = 0; i < orderedItemRowIds.length; i++) {
        const { error } = await sb
          .from('content_collection_items')
          .update({ position: i })
          .eq('id', orderedItemRowIds[i])
          .eq('collection_id', collectionId);
        if (error) return fail(error, markMissing);
      }
      await load();
      return { ok: true };
    },
    [load, markMissing],
  );

  return { collections, loading, pendingActivation, reload: load, create, update, remove, addItem, removeItem, reorder };
}

export default useContentCollections;
