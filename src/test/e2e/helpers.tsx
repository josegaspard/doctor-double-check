import React, { ReactNode } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export type TestRole = 'visitor' | 'patient' | 'doctor' | 'resident' | 'admin';

export interface MockAuthOptions {
  role: TestRole;
  authenticated?: boolean;
  doctorStatus?: 'pending' | 'approved' | 'rejected';
  hasChatEntitlement?: boolean;
  email?: string;
}

export function buildAuthMock(opts: MockAuthOptions) {
  const authenticated = opts.authenticated ?? opts.role !== 'visitor';
  const id = authenticated ? `user-${opts.role}` : null;
  const email = opts.email || (authenticated ? `${opts.role}@test.local` : null);

  const entitlements = opts.hasChatEntitlement
    ? [
        {
          id: 'ent-chat',
          type: 'chat',
          isActive: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]
    : [];

  const user = authenticated
    ? {
        id,
        email,
        name: opts.role,
        role: opts.role,
        doctorStatus: opts.doctorStatus,
        entitlements,
      }
    : null;

  const supabaseUser = authenticated ? { id, email } : null;

  return {
    user,
    supabaseUser,
    role: authenticated ? opts.role : null,
    isAuthenticated: authenticated,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    loginAsVisitor: vi.fn(),
    register: vi.fn(),
    resetPassword: vi.fn(),
    updateUser: vi.fn(),
    refreshUser: vi.fn(),
  };
}

export function renderWithRouter(ui: ReactNode, initialPath = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}
