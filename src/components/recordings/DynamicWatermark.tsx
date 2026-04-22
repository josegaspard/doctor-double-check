import React, { useEffect, useState } from 'react';

interface DynamicWatermarkProps {
  email?: string | null;
  userId?: string | null;
}

const POSITIONS = [
  'top-2 left-2',
  'top-2 right-2',
  'bottom-12 right-2',
  'bottom-12 left-2',
] as const;

/**
 * Watermark dinámico anti-screen-recording:
 * - Muestra email + userId truncado + timestamp actual
 * - Rota entre 4 esquinas cada 30s para impedir masking estático
 * - Recalcula timestamp cada 60s
 * - mix-blend-difference para ser visible sobre cualquier fondo
 */
export function DynamicWatermark({ email, userId }: DynamicWatermarkProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [posIndex, setPosIndex] = useState(0);

  useEffect(() => {
    const tickClock = setInterval(() => setNow(new Date()), 60_000);
    const rotate = setInterval(() => {
      setPosIndex((i) => (i + 1) % POSITIONS.length);
    }, 30_000);
    return () => {
      clearInterval(tickClock);
      clearInterval(rotate);
    };
  }, []);

  const shortId = userId ? userId.slice(0, 8) : 'anon';
  const display = email || 'visitante';
  const stamp = now.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute z-30 ${POSITIONS[posIndex]} transition-all duration-700`}
      style={{ mixBlendMode: 'difference' }}
      data-testid="dynamic-watermark"
    >
      <div className="text-[10px] leading-tight font-mono text-white/40 px-1.5 py-0.5 rounded bg-black/10 backdrop-blur-[1px]">
        <div className="truncate max-w-[180px]">{display}</div>
        <div>
          {shortId} · {stamp}
        </div>
      </div>
    </div>
  );
}
