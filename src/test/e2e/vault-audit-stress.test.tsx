/**
 * Stress test — the audit panel must absorb hundreds of realtime INSERTs
 * without losing events, duplicating, or breaking sort order.
 *
 * We test the pure event-merge logic that mirrors the panel's reducer so
 * the test stays deterministic and fast.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeAuditBurst,
  makeVaultAuditEvent,
  resetFixtureIds,
  type FixtureVaultAuditEvent,
} from './fixtures';

/** Mirrors the dedupe + DESC sort used by VaultAuditPanel on incoming realtime events. */
function mergeRealtimeEvents(
  current: FixtureVaultAuditEvent[],
  incoming: FixtureVaultAuditEvent[]
): FixtureVaultAuditEvent[] {
  const map = new Map<string, FixtureVaultAuditEvent>();
  for (const e of current) map.set(e.id, e);
  for (const e of incoming) map.set(e.id, e); // dedupe by id
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

describe('VaultAuditPanel — realtime stress', () => {
  beforeEach(() => resetFixtureIds());

  it('absorbs 200 INSERTs in 3 bursts without losing events', () => {
    const all = makeAuditBurst(200);
    let state: FixtureVaultAuditEvent[] = [];

    // Burst 1: 70 events
    state = mergeRealtimeEvents(state, all.slice(0, 70));
    expect(state.length).toBe(70);

    // Burst 2: 70 events
    state = mergeRealtimeEvents(state, all.slice(70, 140));
    expect(state.length).toBe(140);

    // Burst 3: 60 events
    state = mergeRealtimeEvents(state, all.slice(140, 200));
    expect(state.length).toBe(200);

    // No event lost
    const ids = new Set(state.map((e) => e.id));
    expect(ids.size).toBe(200);
    for (const e of all) expect(ids.has(e.id)).toBe(true);
  });

  it('deduplicates events with the same id (re-emit on reconnect)', () => {
    const events = makeAuditBurst(50);
    let state = mergeRealtimeEvents([], events);
    // Re-emit half of them — should NOT grow the list
    state = mergeRealtimeEvents(state, events.slice(0, 25));
    expect(state.length).toBe(50);
  });

  it('keeps DESC order by created_at after multiple bursts', () => {
    const events = makeAuditBurst(100);
    // Shuffle insertion order
    const shuffled = [...events].sort(() => Math.random() - 0.5);

    let state: FixtureVaultAuditEvent[] = [];
    // Insert in random batches
    for (let i = 0; i < shuffled.length; i += 7) {
      state = mergeRealtimeEvents(state, shuffled.slice(i, i + 7));
    }

    // Verify DESC by created_at
    for (let i = 1; i < state.length; i++) {
      const prev = new Date(state[i - 1].created_at).getTime();
      const curr = new Date(state[i].created_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('handles single-event bursts back-to-back without race', () => {
    let state: FixtureVaultAuditEvent[] = [];
    const baseTs = Date.now();
    for (let i = 0; i < 100; i++) {
      const e = makeVaultAuditEvent({
        created_at: new Date(baseTs + i * 10).toISOString(),
      });
      state = mergeRealtimeEvents(state, [e]);
    }
    expect(state.length).toBe(100);
    // Newest first
    expect(new Date(state[0].created_at).getTime()).toBe(baseTs + 99 * 10);
  });
});
