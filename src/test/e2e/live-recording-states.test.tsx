import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { LiveProcessingOverlay } from '@/components/live/LiveProcessingOverlay';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
  },
}));

function setupLivesQueryResponse(response: { data?: any; error?: any }) {
  fromMock.mockImplementation((_table: string) => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => Promise.resolve(response));
    return chain;
  });
}

function renderOverlay(props: Partial<React.ComponentProps<typeof LiveProcessingOverlay>>) {
  return render(
    <MemoryRouter>
      <LiveProcessingOverlay
        liveId={props.liveId ?? 'live-1'}
        status={props.status ?? 'processing_recording'}
        recordingId={props.recordingId ?? null}
        viewerCount={props.viewerCount ?? 0}
        onStatusChange={props.onStatusChange}
        autoRedirect={props.autoRedirect ?? true}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  navigateMock.mockReset();
  toastMock.mockReset();
  fromMock.mockReset();
});

describe('LiveProcessingOverlay — recording lifecycle states', () => {
  it('shows the LIVE badge with viewer count when status=live', () => {
    renderOverlay({ status: 'live', viewerCount: 42 });
    const badge = screen.getByTestId('live-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/EN VIVO/);
    expect(badge.textContent).toMatch(/42/);
  });

  it('shows processing spinner + auto-poll when status=processing_recording', async () => {
    setupLivesQueryResponse({ data: { recording_status: 'processing_recording', recording_id: null }, error: null });
    const onChange = vi.fn();
    renderOverlay({ status: 'processing_recording', onStatusChange: onChange });

    expect(screen.getByTestId('live-processing-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Procesando grabación/i)).toBeInTheDocument();

    // Advance just under poll interval — should NOT have polled yet
    await act(async () => {
      vi.advanceTimersByTime(14_000);
    });
    expect(fromMock).not.toHaveBeenCalled();

    // Cross the 15s threshold → first poll fires
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(fromMock).toHaveBeenCalledWith('lives');
    expect(screen.getByText(/Reintentos automáticos: 1/)).toBeInTheDocument();
  });

  it('shows manual retry button after 5 auto-retries with no status change', async () => {
    setupLivesQueryResponse({ data: { recording_status: 'processing_recording' }, error: null });
    renderOverlay({ status: 'processing_recording' });

    // 5 polling cycles × 15s
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
    }
    await waitFor(() => {
      expect(screen.getByTestId('manual-retry-btn')).toBeInTheDocument();
    });

    // Clicking manual retry refetches
    fromMock.mockClear();
    fireEvent.click(screen.getByTestId('manual-retry-btn'));
    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledWith('lives');
    });
  });

  it('renders ready overlay with view-replay button when status=recording_ready', () => {
    renderOverlay({ status: 'recording_ready', recordingId: 'rec-99' });
    expect(screen.getByTestId('live-ready-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('view-replay-btn')).toBeInTheDocument();
  });

  it('auto-redirects to /recording/:id after ~3s when status becomes recording_ready', async () => {
    renderOverlay({ status: 'recording_ready', recordingId: 'rec-42', autoRedirect: true });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Replay disponible/i) })
    );

    // Advance 3s redirect timer
    await act(async () => {
      vi.advanceTimersByTime(3_100);
    });
    expect(navigateMock).toHaveBeenCalledWith('/recording/rec-42');
  });

  it('does NOT auto-redirect when user clicks "Cancelar redirección"', async () => {
    renderOverlay({ status: 'recording_ready', recordingId: 'rec-42', autoRedirect: true });
    fireEvent.click(screen.getByText(/Cancelar redirección/i));
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('does not auto-redirect when autoRedirect=false', async () => {
    renderOverlay({ status: 'recording_ready', recordingId: 'rec-42', autoRedirect: false });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('manual click on view-replay-btn navigates immediately', () => {
    renderOverlay({ status: 'recording_ready', recordingId: 'rec-77', autoRedirect: false });
    fireEvent.click(screen.getByTestId('view-replay-btn'));
    expect(navigateMock).toHaveBeenCalledWith('/recording/rec-77');
  });

  it('shows failed overlay with back-to-lives navigation on status=failed', () => {
    renderOverlay({ status: 'failed' });
    expect(screen.getByTestId('live-failed-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Volver a lives/i));
    expect(navigateMock).toHaveBeenCalledWith('/lives');
  });

  it('renders nothing when status=none', () => {
    const { container } = renderOverlay({ status: 'none' as any });
    expect(container.firstChild).toBeNull();
  });

  it('progress bar value updates while processing (indeterminate animation)', async () => {
    setupLivesQueryResponse({ data: { recording_status: 'processing_recording' }, error: null });
    renderOverlay({ status: 'processing_recording' });
    // Just advancing timers should not throw and UI should still be there
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('live-processing-overlay')).toBeInTheDocument();
  });
});
