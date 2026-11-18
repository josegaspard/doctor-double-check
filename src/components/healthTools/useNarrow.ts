// ¿Pantalla de celular? (≤ 720 px). Se actualiza al girar el teléfono.
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 720px)';
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return !!narrow;
}
