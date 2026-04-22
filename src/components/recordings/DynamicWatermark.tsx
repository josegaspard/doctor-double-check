import React, { useEffect, useMemo, useState } from 'react';

interface DynamicWatermarkProps {
  email?: string | null;
  userId?: string | null;
  /** Unique playback session id. If not provided, one is generated on mount. */
  sessionId?: string;
}

const POSITIONS = [
  'top-2 left-2',
  'top-2 right-2',
  'bottom-12 right-2',
  'bottom-12 left-2',
] as const;

function genSessionId(): string {
  // Prefer crypto.randomUUID when available; otherwise fall back to a timestamped random.
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID();
    }
  } catch {
    /* noop */
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Watermark dinámico anti-screen-recording (DRM lite):
 * - Muestra email + userId truncado + sessionId truncado + timestamp actual
 * - Rota entre 4 esquinas cada 60s para impedir masking estático
 * - Recalcula timestamp cada 30s
 * - mix-blend-difference para ser visible sobre cualquier fondo sin tapar contenido
 * - sessionId único por sesión de visualización (verificable en CSV de auditoría)
 */
export function DynamicWatermark({ email, userId, sessionId }: DynamicWatermarkProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [posIndex, setPosIndex] = useState(0);

  // Generate stable session id on mount (only once per render lifecycle)
  const effectiveSessionId = useMemo(() => sessionId || genSessionId(), [sessionId]);

  useEffect(() => {
    const tickClock = setInterval(() => setNow(new Date()), 30_000);
    const rotate = setInterval(() => {
      setPosIndex((i) => (i + 1) % POSITIONS.length);
    }, 60_000);
    return () => {
      clearInterval(tickClock);
      clearInterval(rotate);
    };
  }, []);

  const shortId = userId ? userId.slice(0, 8) : 'anon';
  const shortSession = effectiveSessionId.replace(/-/g, '').slice(0, 6);
  const display = email || 'visitante';
  const stamp = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute z-30 ${POSITIONS[posIndex]} transition-all duration-700 opacity-40`}
      style={{ mixBlendMode: 'difference' }}
      data-testid="dynamic-watermark"
      data-session-id={effectiveSessionId}
      data-position-index={posIndex}
    >
      <div className="text-[10px] leading-tight font-mono text-white px-1.5 py-0.5 rounded bg-black/10 backdrop-blur-[1px]">
        <div className="truncate max-w-[200px]">{display}</div>
        <div>
          {shortId} · <span data-testid="watermark-session">{shortSession}</span> ·{' '}
          <span data-testid="watermark-time">{stamp}</span>
        </div>
      </div>
    </div>
  );
}
