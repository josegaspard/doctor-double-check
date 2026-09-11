import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { SEO_SETTINGS_ID, createDefaultSeoConfig, mergeSeoConfig, type SeoConfig } from '@/lib/seo';

// Tipo plano y no unión discriminada: el proyecto compila sin strictNullChecks y ahí
// TypeScript no estrecha por `ok`.
export type SaveResult = { ok: boolean; conflict?: boolean; message?: string };

/**
 * Carga y guarda la configuración SEO (site_settings id='seo_config').
 * Antes de guardar comprueba que nadie haya guardado otra versión mientras se editaba,
 * para no pisar el trabajo de otra persona del equipo sin avisar.
 */
export function useSeoConfig() {
  const { supabaseUser } = useAuth();
  const [config, setConfig] = useState<SeoConfig>(createDefaultSeoConfig);
  const [snapshot, setSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const versionRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('site_settings')
      .select('value, updated_at')
      .eq('id', SEO_SETTINGS_ID)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const merged = mergeSeoConfig(data?.value ?? null);
    versionRef.current = data?.updated_at ?? null;
    setConfig(merged);
    setSnapshot(JSON.stringify(merged));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = !loading && JSON.stringify(config) !== snapshot;

  const save = useCallback(
    async (next?: SeoConfig): Promise<SaveResult> => {
      const toSave = mergeSeoConfig({ ...(next ?? config), updatedAt: new Date().toISOString() });
      setSaving(true);
      try {
        const { data: current, error: readError } = await supabase
          .from('site_settings')
          .select('updated_at')
          .eq('id', SEO_SETTINGS_ID)
          .maybeSingle();
        if (readError) return { ok: false, message: readError.message };
        if ((current?.updated_at ?? null) !== versionRef.current) {
          return { ok: false, conflict: true, message: 'Alguien guardó otra versión del SEO mientras editabas.' };
        }
        const { data, error } = await supabase
          .from('site_settings')
          .upsert({ id: SEO_SETTINGS_ID, value: toSave as unknown as Json, updated_by: supabaseUser?.id })
          .select('updated_at')
          .single();
        if (error) return { ok: false, message: error.message };
        versionRef.current = data.updated_at;
        setConfig(toSave);
        setSnapshot(JSON.stringify(toSave));
        return { ok: true };
      } finally {
        setSaving(false);
      }
    },
    [config, supabaseUser?.id],
  );

  const discard = useCallback(() => {
    if (snapshot) setConfig(JSON.parse(snapshot) as SeoConfig);
  }, [snapshot]);

  return { config, setConfig, loading, saving, dirty, save, discard, reload: load, loadError };
}
