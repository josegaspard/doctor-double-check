import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface StorageState {
  used: number;
  limit: number;
  loading: boolean;
  refresh: () => Promise<void>;
  canUpload: (bytes: number) => { ok: boolean; reason?: 'over_quota'; available: number };
  guardOrToast: (bytes: number) => boolean;
}

let pendingUpgradeOpener: (() => void) | null = null;

export function setStorageUpgradeOpener(fn: (() => void) | null) {
  pendingUpgradeOpener = fn;
}

function fmt(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function useStorageGuard(): StorageState {
  const { supabaseUser } = useAuth();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(1073741824);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseUser?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('storage_used_bytes, storage_limit_bytes')
      .eq('id', supabaseUser.id)
      .maybeSingle();
    if (data) {
      setUsed((data as any).storage_used_bytes || 0);
      setLimit((data as any).storage_limit_bytes || 1073741824);
    }
    setLoading(false);
  }, [supabaseUser?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const canUpload = useCallback((bytes: number) => {
    const available = Math.max(0, limit - used);
    return { ok: bytes <= available, available };
  }, [used, limit]);

  const guardOrToast = useCallback((bytes: number) => {
    const check = canUpload(bytes);
    if (check.ok) return true;
    toast.error(
      `Almacenamiento insuficiente. Necesitas ${fmt(bytes)} pero solo tienes ${fmt(check.available)} disponibles.`,
      {
        action: pendingUpgradeOpener
          ? { label: 'Ampliar espacio', onClick: () => pendingUpgradeOpener?.() }
          : undefined,
        duration: 8000,
      }
    );
    return false;
  }, [canUpload]);

  return { used, limit, loading, refresh, canUpload, guardOrToast };
}
