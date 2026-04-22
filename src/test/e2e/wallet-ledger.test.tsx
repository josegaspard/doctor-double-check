import { describe, it, expect } from 'vitest';

interface Tx {
  id: string;
  created_at: string;
  type: 'topup' | 'purchase' | 'earning' | 'refund';
  amount: number;
  status: 'initiated' | 'paid' | 'failed';
  description?: string;
  metadata?: Record<string, any>;
}

function filterAndSort(
  transactions: Tx[],
  statusFilter: 'all' | Tx['status'],
  typeFilter: 'all' | Tx['type']
) {
  return [...transactions]
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function getDeepLink(metadata?: Record<string, any> | null) {
  if (!metadata) return null;
  if (metadata.recording_id) return `/recording/${metadata.recording_id}`;
  if (metadata.session_id) return `/chat?session=${metadata.session_id}`;
  if (metadata.consultation_id) return `/chat?consultation=${metadata.consultation_id}`;
  return null;
}

const mockTxs: Tx[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `tx-${i}`,
  created_at: new Date(2024, 0, i + 1).toISOString(),
  type: (['topup', 'purchase', 'earning', 'refund'] as const)[i % 4],
  amount: i % 2 === 0 ? 100 + i : -(50 + i),
  status: (['initiated', 'paid', 'failed', 'paid'] as const)[i % 4],
  description: `Transacción ${i}`,
  metadata: i === 3 ? { recording_id: 'rec-X' } : i === 5 ? { session_id: 'sess-Y' } : null,
}));

describe('Wallet Ledger', () => {
  it('orders transactions by created_at DESC', () => {
    const result = filterAndSort(mockTxs, 'all', 'all');
    expect(result.length).toBe(10);
    for (let i = 0; i < result.length - 1; i++) {
      expect(new Date(result[i].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(result[i + 1].created_at).getTime()
      );
    }
  });

  it('filters by status=paid only', () => {
    const result = filterAndSort(mockTxs, 'paid', 'all');
    expect(result.every((t) => t.status === 'paid')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters by type=topup only', () => {
    const result = filterAndSort(mockTxs, 'all', 'topup');
    expect(result.every((t) => t.type === 'topup')).toBe(true);
  });

  it('combines status + type filter', () => {
    const result = filterAndSort(mockTxs, 'paid', 'earning');
    expect(result.every((t) => t.status === 'paid' && t.type === 'earning')).toBe(true);
  });

  it('returns empty when no match', () => {
    const result = filterAndSort([], 'paid', 'all');
    expect(result.length).toBe(0);
  });

  it('generates correct deep-link for recording purchase', () => {
    expect(getDeepLink({ recording_id: 'rec-X' })).toBe('/recording/rec-X');
  });

  it('generates correct deep-link for chat session', () => {
    expect(getDeepLink({ session_id: 'sess-Y' })).toBe('/chat?session=sess-Y');
  });

  it('generates correct deep-link for consultation', () => {
    expect(getDeepLink({ consultation_id: 'c-1' })).toBe('/chat?consultation=c-1');
  });

  it('returns null when no actionable metadata', () => {
    expect(getDeepLink(null)).toBeNull();
    expect(getDeepLink({})).toBeNull();
    expect(getDeepLink({ random: 'value' })).toBeNull();
  });
});
