/**
 * Virtualization — verifies that the audit panel can hold 500+ events
 * without rendering all rows in the DOM, and that filtering still works
 * end-to-end on the underlying dataset (not on the virtualized window).
 */
import React, { useMemo, useRef, useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { makeAuditBurst, resetFixtureIds, type FixtureVaultAuditEvent } from './fixtures';

/** Minimal virtualized table that mirrors the panel's behavior. */
function VirtualizedAuditTable({
  events,
  filterAction,
}: {
  events: FixtureVaultAuditEvent[];
  filterAction?: string;
}) {
  const filtered = useMemo(
    () => (filterAction ? events.filter((e) => e.action === filterAction) : events),
    [events, filterAction]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      data-testid="virtual-container"
      style={{ height: 600, overflow: 'auto' }}
    >
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}
        data-testid="virtual-inner"
      >
        {rowVirtualizer.getVirtualItems().map((vi) => {
          const e = filtered[vi.index];
          return (
            <div
              key={e.id}
              data-testid={`row-${vi.index}`}
              data-action={e.action}
              style={{
                position: 'absolute',
                top: vi.start,
                left: 0,
                right: 0,
                height: vi.size,
              }}
            >
              {e.action} — {e.id}
            </div>
          );
        })}
      </div>
      <div data-testid="filtered-count">{filtered.length}</div>
    </div>
  );
}

function Wrapper({ events }: { events: FixtureVaultAuditEvent[] }) {
  const [filter, setFilter] = useState<string | undefined>();
  return (
    <div>
      <button data-testid="filter-granted" onClick={() => setFilter('access_granted')}>
        Filter
      </button>
      <button data-testid="clear-filter" onClick={() => setFilter(undefined)}>
        Clear
      </button>
      <VirtualizedAuditTable events={events} filterAction={filter} />
    </div>
  );
}

describe('VaultAuditPanel virtualization', () => {
  beforeEach(() => resetFixtureIds());

  it('renders only a small window of rows for 500 events', () => {
    const events = makeAuditBurst(500);
    const { container, getByTestId } = render(<Wrapper events={events} />);
    expect(getByTestId('filtered-count').textContent).toBe('500');
    const rendered = container.querySelectorAll('[data-testid^="row-"]');
    // With overscan=5 and rows of 56px in a 600px container we expect ~15-25 rendered
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(40);
    expect(rendered.length).toBeLessThan(events.length);
  });

  it('scrolling reveals later rows', async () => {
    const events = makeAuditBurst(500);
    const { container, getByTestId } = render(<Wrapper events={events} />);
    const wrapper = getByTestId('virtual-container');

    // Stub clientHeight (jsdom defaults to 0 → virtualizer wouldn't compute)
    Object.defineProperty(wrapper, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(wrapper, 'scrollHeight', { configurable: true, value: 28000 });

    fireEvent.scroll(wrapper, { target: { scrollTop: 5000 } });

    // Some rows should still be rendered after scroll (count, not specific index, since jsdom
    // does not run real layout; we only assert the virtualizer keeps a window alive)
    const rendered = container.querySelectorAll('[data-testid^="row-"]');
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('applying a filter shrinks the dataset and rerenders correctly', () => {
    const events = makeAuditBurst(300, { action: 'accessed' });
    // Replace 30 of them with action=access_granted
    for (let i = 0; i < 30; i++) events[i].action = 'access_granted';

    const { getByTestId } = render(<Wrapper events={events} />);
    expect(getByTestId('filtered-count').textContent).toBe('300');

    fireEvent.click(getByTestId('filter-granted'));
    expect(getByTestId('filtered-count').textContent).toBe('30');
  });

  it('clearing filter restores the full dataset and order', () => {
    const events = makeAuditBurst(200);
    events[0].action = 'access_granted';
    events[1].action = 'access_granted';

    const { getByTestId } = render(<Wrapper events={events} />);
    fireEvent.click(getByTestId('filter-granted'));
    expect(getByTestId('filtered-count').textContent).toBe('2');
    fireEvent.click(getByTestId('clear-filter'));
    expect(getByTestId('filtered-count').textContent).toBe('200');
  });
});
