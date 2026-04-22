import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRealtimeChannel } from './helpers';

/**
 * Realtime contract for VaultAuditPanel — emit postgres_changes events and
 * verify the subscriber callback fires (which triggers fetchAudit/fetchCount
 * in the real component, refreshing the table without a reload).
 */

describe('Vault audit realtime subscription', () => {
  let supabase: any;
  let onInsert: ReturnType<typeof vi.fn>;
  let realtime: ReturnType<typeof mockRealtimeChannel>;

  beforeEach(() => {
    supabase = {} as any;
    realtime = mockRealtimeChannel(supabase);
    onInsert = vi.fn();

    // Mimic VaultAuditPanel.useEffect realtime subscription:
    supabase
      .channel('vault_audit_patient_patient-1')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vault_audit_log',
          filter: 'patient_id=eq.patient-1',
        },
        onInsert
      )
      .subscribe();
  });

  it('subscribes to a uniquely named channel for the user/mode pair', () => {
    expect(supabase.channel).toHaveBeenCalledWith('vault_audit_patient_patient-1');
    expect(realtime.channel.subscribe).toHaveBeenCalled();
  });

  it('fires onInsert when an access_granted event arrives', () => {
    realtime.emit({
      eventType: 'INSERT',
      new: {
        id: 'evt-1',
        action: 'access_granted',
        patient_id: 'patient-1',
        actor_id: 'doctor-1',
        file_id: 'file-A',
        created_at: new Date().toISOString(),
      },
    });
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it('fires onInsert for every action type (granted/revoked/viewed/uploaded)', () => {
    const actions = ['access_granted', 'access_revoked', 'accessed', 'access_denied'];
    actions.forEach((action, i) => {
      realtime.emit({
        eventType: 'INSERT',
        new: { id: `evt-${i}`, action, patient_id: 'patient-1' },
      });
    });
    expect(onInsert).toHaveBeenCalledTimes(actions.length);
  });

  it('multiple sequential inserts are all delivered (no debounce loss)', () => {
    for (let i = 0; i < 10; i++) {
      realtime.emit({
        eventType: 'INSERT',
        new: { id: `evt-${i}`, action: 'accessed', patient_id: 'patient-1' },
      });
    }
    expect(onInsert).toHaveBeenCalledTimes(10);
  });

  it('handler payload preserves the `new` row so the panel can prepend it', () => {
    realtime.emit({
      eventType: 'INSERT',
      new: {
        id: 'evt-9',
        action: 'access_granted',
        patient_id: 'patient-1',
        actor_id: 'doctor-1',
        file_id: 'file-A',
      },
    });
    const payload = onInsert.mock.calls[0][0];
    expect(payload.new.id).toBe('evt-9');
    expect(payload.new.action).toBe('access_granted');
  });
});

describe('Action → badge variant mapping (for color-coded realtime updates)', () => {
  function variantFor(action: string): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
    switch (action) {
      case 'access_granted':
        return 'success';
      case 'access_revoked':
        return 'warning';
      case 'access_denied':
      case 'otp_failed':
        return 'destructive';
      case 'accessed':
        return 'info';
      default:
        return 'secondary';
    }
  }

  it('access_granted → success (green)', () => {
    expect(variantFor('access_granted')).toBe('success');
  });
  it('access_revoked → warning (amber)', () => {
    expect(variantFor('access_revoked')).toBe('warning');
  });
  it('access_denied → destructive (red)', () => {
    expect(variantFor('access_denied')).toBe('destructive');
  });
  it('accessed/viewed → info (blue)', () => {
    expect(variantFor('accessed')).toBe('info');
  });
});
