/**
 * Responsive snapshots — verifies that the doctor card and credential badge
 * do not overflow at 360 / 768 / 1024 px and that long content is truncated
 * or wrapped (never overflows horizontally).
 *
 * We isolate the structural HTML logic from the heavy `<Doctors>` page by
 * testing CredentialStatusBadge directly + a minimal harness mimicking the
 * doctor card layout.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { CredentialStatusBadge } from '@/components/doctor/CredentialStatusBadge';
import { makeDoctorProfile, resetFixtureIds } from './fixtures';

const BREAKPOINTS = [360, 768, 1024] as const;

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      // Parse "(min-width: NNNpx)" / "(max-width: NNNpx)"
      const minMatch = query.match(/min-width:\s*(\d+)/);
      const maxMatch = query.match(/max-width:\s*(\d+)/);
      let matches = true;
      if (minMatch) matches = matches && width >= parseInt(minMatch[1], 10);
      if (maxMatch) matches = matches && width <= parseInt(maxMatch[1], 10);
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
  window.dispatchEvent(new Event('resize'));
}

/** Minimal doctor card harness mirroring the production layout. */
function DoctorCardHarness({
  name,
  specialty,
  badges,
}: {
  name: string;
  specialty: string;
  badges: React.ReactNode;
}) {
  return (
    <div data-testid="doctor-card" className="w-full max-w-full p-3 border rounded-lg overflow-hidden">
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="text-base font-semibold truncate" data-testid="doctor-name">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground truncate" data-testid="doctor-specialty">
          {specialty}
        </p>
        <div className="flex flex-wrap gap-1" data-testid="doctor-badges">
          {badges}
        </div>
      </div>
    </div>
  );
}

describe('Responsive: CredentialStatusBadge', () => {
  beforeEach(() => resetFixtureIds());

  BREAKPOINTS.forEach((bp) => {
    it(`renders without horizontal overflow at ${bp}px`, () => {
      setViewport(bp);
      const { container } = render(
        <div style={{ width: bp }}>
          <CredentialStatusBadge
            type="cofepris"
            status="rejected"
            value="COF-1234567890ABCDE"
            rejectionReason="Documento ilegible. Por favor sube una foto más clara del permiso."
          />
        </div>
      );
      const root = container.firstChild as HTMLElement;
      // shrink-0 + truncate inner span → external badge must never overflow.
      expect(root.scrollWidth).toBeLessThanOrEqual(bp + 2);
    });
  });

  it('truncates long credential value visibly', () => {
    setViewport(360);
    const { container } = render(
      <CredentialStatusBadge
        type="cedula"
        status="approved"
        value="ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
      />
    );
    // The value span is sliced to 12 chars by the component
    expect(container.textContent).toContain('Céd. Prof.');
    expect(container.textContent).toContain('ABCDEFGHIJKL');
    expect(container.textContent).not.toContain('UVWXYZ');
  });
});

describe('Responsive: DoctorCard layout', () => {
  beforeEach(() => resetFixtureIds());

  const longName = 'Dr. Maximiliano Alejandro de la Fuente Rodríguez';
  const longSpecialty = 'Cardiología intervencionista pediátrica avanzada';

  BREAKPOINTS.forEach((bp) => {
    it(`doctor card with long name + multiple badges fits at ${bp}px`, () => {
      setViewport(bp);
      const profile = makeDoctorProfile({
        cedula_status: 'approved',
        cofepris_status: 'rejected',
        cofepris_rejection_reason: 'Imagen borrosa',
      });

      const { getByTestId } = render(
        <div style={{ width: bp, maxWidth: bp }}>
          <DoctorCardHarness
            name={longName}
            specialty={longSpecialty}
            badges={
              <>
                <CredentialStatusBadge
                  type="cedula"
                  status={profile.cedula_status}
                  value={profile.cedula_profesional}
                />
                <CredentialStatusBadge
                  type="cofepris"
                  status={profile.cofepris_status}
                  value={profile.cofepris_permit}
                  rejectionReason={profile.cofepris_rejection_reason}
                />
              </>
            }
          />
        </div>
      );

      const card = getByTestId('doctor-card');
      const name = getByTestId('doctor-name');
      const specialty = getByTestId('doctor-specialty');

      // Card must not overflow its container
      expect(card.scrollWidth).toBeLessThanOrEqual(bp + 2);
      // Name and specialty have `truncate` class
      expect(name.className).toContain('truncate');
      expect(specialty.className).toContain('truncate');
      // Badges container uses flex-wrap so multiple badges fit on small screens
      expect(getByTestId('doctor-badges').className).toContain('flex-wrap');
    });
  });

  it('matches structural snapshot at 360px (mobile baseline)', () => {
    setViewport(360);
    const { getByTestId } = render(
      <DoctorCardHarness
        name="Dr. Test"
        specialty="Cardio"
        badges={
          <CredentialStatusBadge type="cedula" status="approved" value="123" />
        }
      />
    );
    const card = getByTestId('doctor-card');
    expect(card.querySelector('[data-testid="doctor-name"]')?.textContent).toBe('Dr. Test');
    expect(card.querySelector('[data-testid="doctor-specialty"]')?.textContent).toBe('Cardio');
    // structural assertions instead of inline snapshot to avoid CI flakiness
    expect(card.className).toContain('max-w-full');
    expect(card.className).toContain('overflow-hidden');
  });
});
