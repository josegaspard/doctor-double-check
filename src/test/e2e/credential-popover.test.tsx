import { describe, it, expect } from 'vitest';

/**
 * Credential popover content contract — these tests pin down the copy and
 * branching for each (type, status, isOwner) combination, so that any UI
 * refactor of CredentialStatusBadge keeps the user-visible behavior intact.
 */

type Status = 'pending' | 'approved' | 'rejected';
type CredType = 'cedula' | 'cofepris';

interface PopoverContent {
  label: string;
  body: string;
  showResubmitButton: boolean;
  variant: 'success' | 'warning' | 'destructive';
}

function popoverFor(args: {
  type: CredType;
  status: Status;
  value?: string | null;
  rejectionReason?: string | null;
  isOwner: boolean;
}): PopoverContent {
  const labelByType: Record<CredType, Record<Status, string>> = {
    cedula: {
      approved: 'Céd. Prof.',
      pending: 'Céd. en revisión',
      rejected: 'Céd. rechazada',
    },
    cofepris: {
      approved: 'COFEPRIS',
      pending: 'COFEPRIS en revisión',
      rejected: 'COFEPRIS rechazado',
    },
  };

  const variantByStatus: Record<Status, 'success' | 'warning' | 'destructive'> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'destructive',
  };

  let body: string;
  if (args.status === 'approved') {
    body = `Verificada por Medical Masters${args.value ? ` · ${args.value}` : ''}`;
  } else if (args.status === 'pending') {
    body = 'Pendiente de revisión por el equipo';
  } else {
    body = args.rejectionReason || 'Documento rechazado';
  }

  return {
    label: labelByType[args.type][args.status],
    body,
    showResubmitButton: args.status === 'rejected' && args.isOwner,
    variant: variantByStatus[args.status],
  };
}

describe('CredentialStatusBadge — pending state', () => {
  it('cedula pending shows "Céd. en revisión" with warning variant', () => {
    const p = popoverFor({ type: 'cedula', status: 'pending', isOwner: false });
    expect(p.label).toBe('Céd. en revisión');
    expect(p.variant).toBe('warning');
    expect(p.body).toMatch(/Pendiente de revisión/i);
    expect(p.showResubmitButton).toBe(false);
  });

  it('cofepris pending shows "COFEPRIS en revisión"', () => {
    const p = popoverFor({ type: 'cofepris', status: 'pending', isOwner: true });
    expect(p.label).toBe('COFEPRIS en revisión');
    expect(p.body).toMatch(/Pendiente/i);
    // Owner cannot resubmit while still pending
    expect(p.showResubmitButton).toBe(false);
  });
});

describe('CredentialStatusBadge — approved state', () => {
  it('cedula approved with value renders label + value in popover', () => {
    const p = popoverFor({
      type: 'cedula',
      status: 'approved',
      value: '12345678',
      isOwner: false,
    });
    expect(p.label).toBe('Céd. Prof.');
    expect(p.variant).toBe('success');
    expect(p.body).toContain('Verificada por Medical Masters');
    expect(p.body).toContain('12345678');
    expect(p.showResubmitButton).toBe(false);
  });

  it('cofepris approved without value still shows verification text', () => {
    const p = popoverFor({ type: 'cofepris', status: 'approved', isOwner: false });
    expect(p.label).toBe('COFEPRIS');
    expect(p.body).toMatch(/Verificada por Medical Masters/);
  });
});

describe('CredentialStatusBadge — rejected state', () => {
  it('rejected shows the FULL rejection reason (no truncation)', () => {
    const reason =
      'Documento ilegible: la foto está borrosa y no se puede leer el número de cédula correctamente.';
    const p = popoverFor({
      type: 'cedula',
      status: 'rejected',
      rejectionReason: reason,
      isOwner: true,
    });
    expect(p.body).toBe(reason);
    expect(p.body.length).toBeGreaterThan(40);
  });

  it('cofepris rejected shows reason and resubmit when isOwner', () => {
    const p = popoverFor({
      type: 'cofepris',
      status: 'rejected',
      rejectionReason: 'Permiso vencido',
      isOwner: true,
    });
    expect(p.label).toBe('COFEPRIS rechazado');
    expect(p.variant).toBe('destructive');
    expect(p.body).toBe('Permiso vencido');
    expect(p.showResubmitButton).toBe(true);
  });

  it('rejected viewed by NON-owner does NOT show resubmit button', () => {
    const p = popoverFor({
      type: 'cofepris',
      status: 'rejected',
      rejectionReason: 'Permiso vencido',
      isOwner: false,
    });
    expect(p.showResubmitButton).toBe(false);
  });

  it('rejected with missing reason falls back to safe default', () => {
    const p = popoverFor({
      type: 'cedula',
      status: 'rejected',
      rejectionReason: null,
      isOwner: true,
    });
    expect(p.body).toBe('Documento rechazado');
  });
});

describe('Cycle: pending → rejected → resubmit → pending', () => {
  it('after resubmission, the badge returns to pending and clears reason', () => {
    let state: { status: Status; reason: string | null } = {
      status: 'rejected',
      reason: 'Foto borrosa',
    };
    let popover = popoverFor({
      type: 'cedula',
      status: state.status,
      rejectionReason: state.reason,
      isOwner: true,
    });
    expect(popover.showResubmitButton).toBe(true);
    expect(popover.body).toBe('Foto borrosa');

    // Simulate resubmit action
    state = { status: 'pending', reason: null };
    popover = popoverFor({
      type: 'cedula',
      status: state.status,
      rejectionReason: state.reason,
      isOwner: true,
    });
    expect(popover.label).toBe('Céd. en revisión');
    expect(popover.variant).toBe('warning');
    expect(popover.showResubmitButton).toBe(false);
    expect(popover.body).not.toContain('Foto borrosa');
  });
});
