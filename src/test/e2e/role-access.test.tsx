import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { buildAuthMock, renderWithRouter, type TestRole } from './helpers';
import AccessGuard from '@/components/AccessGuard';

// Mock useAuth and useLanguage at module level
vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<any>('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'es',
    setLanguage: vi.fn(),
  }),
  LanguageProvider: ({ children }: any) => <>{children}</>,
}));

import { useAuth } from '@/contexts/AuthContext';

function setRole(role: TestRole, opts: Partial<Parameters<typeof buildAuthMock>[0]> = {}) {
  (useAuth as any).mockReturnValue(buildAuthMock({ role, ...opts }));
}

describe('AccessGuard role-based access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visitor (no auth)', () => {
    beforeEach(() => setRole('visitor'));

    it('blocks /chat route requiring patient role', () => {
      renderWithRouter(
        <AccessGuard allowedRoles={['patient']} fallbackType="login" featureLabel="chat">
          <div>chat content</div>
        </AccessGuard>
      );
      expect(screen.queryByText('chat content')).not.toBeInTheDocument();
      // El titular pasó de 'login.title' a 'admin.signInToContinue': sin sesión se
      // invita a entrar en vez de dar un 'acceso denegado'. La intención no cambia.
      expect(screen.getByText(/admin.signInToContinue/i)).toBeInTheDocument();
    });

    it('blocks /vault for visitors', () => {
      renderWithRouter(
        <AccessGuard allowedRoles={['patient']} featureLabel="vault">
          <div>vault content</div>
        </AccessGuard>
      );
      expect(screen.queryByText('vault content')).not.toBeInTheDocument();
    });

    it('blocks admin areas', () => {
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']} fallbackType="forbidden" featureLabel="admin">
          <div>admin content</div>
        </AccessGuard>
      );
      expect(screen.queryByText('admin content')).not.toBeInTheDocument();
    });
  });

  describe('Patient', () => {
    it('allows access to /chat when entitlement present', () => {
      setRole('patient', { hasChatEntitlement: true });
      renderWithRouter(
        <AccessGuard allowedRoles={['patient']} requiresEntitlement="chat">
          <div>chat content</div>
        </AccessGuard>
      );
      expect(screen.getByText('chat content')).toBeInTheDocument();
    });

    it('blocks /chat without entitlement (paywall trigger)', () => {
      setRole('patient', { hasChatEntitlement: false });
      renderWithRouter(
        <AccessGuard allowedRoles={['patient']} requiresEntitlement="chat" fallbackType="upgrade">
          <div>chat content</div>
        </AccessGuard>
      );
      expect(screen.queryByText('chat content')).not.toBeInTheDocument();
    });

    it('blocks doctor-dashboard', () => {
      setRole('patient');
      renderWithRouter(
        <AccessGuard allowedRoles={['doctor']} fallbackType="forbidden">
          <div>doctor dashboard</div>
        </AccessGuard>
      );
      expect(screen.queryByText('doctor dashboard')).not.toBeInTheDocument();
    });

    it('blocks admin pages', () => {
      setRole('patient');
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']} fallbackType="forbidden">
          <div>admin only</div>
        </AccessGuard>
      );
      expect(screen.queryByText('admin only')).not.toBeInTheDocument();
    });
  });

  describe('Doctor', () => {
    it('allows access to doctor-dashboard when approved', () => {
      setRole('doctor', { doctorStatus: 'approved' });
      renderWithRouter(
        <AccessGuard allowedRoles={['doctor']}>
          <div>doctor dashboard</div>
        </AccessGuard>
      );
      expect(screen.getByText('doctor dashboard')).toBeInTheDocument();
    });

    it('blocks admin areas for doctor', () => {
      setRole('doctor');
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']} fallbackType="forbidden">
          <div>admin only</div>
        </AccessGuard>
      );
      expect(screen.queryByText('admin only')).not.toBeInTheDocument();
    });
  });

  describe('Resident', () => {
    it('blocks marketplace (patient/doctor only)', () => {
      setRole('resident');
      renderWithRouter(
        <AccessGuard allowedRoles={['patient', 'doctor']} fallbackType="forbidden">
          <div>marketplace</div>
        </AccessGuard>
      );
      expect(screen.queryByText('marketplace')).not.toBeInTheDocument();
    });

    it('blocks prescription creation (doctors only)', () => {
      setRole('resident');
      renderWithRouter(
        <AccessGuard allowedRoles={['doctor']} fallbackType="forbidden">
          <div>prescription form</div>
        </AccessGuard>
      );
      expect(screen.queryByText('prescription form')).not.toBeInTheDocument();
    });

    it('blocks admin pages', () => {
      setRole('resident');
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']} fallbackType="forbidden">
          <div>admin only</div>
        </AccessGuard>
      );
      expect(screen.queryByText('admin only')).not.toBeInTheDocument();
    });
  });

  describe('Admin', () => {
    it('has access to admin areas', () => {
      setRole('admin');
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']}>
          <div>admin dashboard</div>
        </AccessGuard>
      );
      expect(screen.getByText('admin dashboard')).toBeInTheDocument();
    });

    it('has access to user management', () => {
      setRole('admin');
      renderWithRouter(
        <AccessGuard allowedRoles={['admin']}>
          <div>user management</div>
        </AccessGuard>
      );
      expect(screen.getByText('user management')).toBeInTheDocument();
    });
  });
});
