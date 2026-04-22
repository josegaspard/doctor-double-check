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

// ============================================================================
// Supabase mocks: query builder, realtime, storage, RPC
// ============================================================================

type ResponseLike = { data?: any; error?: any; count?: number };

interface ChainConfig {
  table: string;
  /** Response for terminal calls (.maybeSingle / .single / await chain) */
  response: ResponseLike;
}

/**
 * Build a chainable query stub that resolves to `response`.
 * Supports: .select().eq().in().not().gte().lte().order().limit().range().maybeSingle().single().insert().update().delete()
 */
export function buildQueryChain(response: ResponseLike) {
  const chain: any = {};
  const passthrough = [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'not',
    'or',
    'and',
    'gte',
    'lte',
    'gt',
    'lt',
    'ilike',
    'like',
    'match',
    'order',
    'limit',
    'range',
    'filter',
    'contains',
    'containedBy',
    'overlaps',
    'textSearch',
    'returns',
  ];
  passthrough.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  // Mutating methods also return chain for further .select/.eq
  ['insert', 'update', 'upsert', 'delete'].forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  // Terminal awaitable methods
  chain.maybeSingle = vi.fn(() => Promise.resolve(response));
  chain.single = vi.fn(() => Promise.resolve(response));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject);
  chain.csv = vi.fn(() => Promise.resolve(response));
  return chain;
}

/**
 * Mock supabase.from(table) so any chain returns the configured response.
 * Returns the spy so assertions can verify it was called with the expected table.
 */
export function mockSupabaseQuery(supabase: any, configs: ChainConfig[]) {
  const map = new Map(configs.map((c) => [c.table, c.response]));
  const spy = vi.fn((table: string) => {
    const resp = map.get(table) ?? { data: [], error: null };
    return buildQueryChain(resp);
  });
  supabase.from = spy;
  return spy;
}

/**
 * Mock supabase realtime channel and capture subscribed event handlers.
 * Returns a controller with `emit(payload)` to fire postgres_changes events.
 */
export function mockRealtimeChannel(supabase: any) {
  const handlers: Array<(payload: any) => void> = [];
  const channel: any = {
    on: vi.fn((_evt: string, _config: any, cb: (payload: any) => void) => {
      handlers.push(cb);
      return channel;
    }),
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
  };
  supabase.channel = vi.fn(() => channel);
  supabase.removeChannel = vi.fn();
  return {
    channel,
    emit: (payload: any) => handlers.forEach((h) => h(payload)),
    handlers,
  };
}

/**
 * Mock supabase.storage.from(bucket) with simulated upload progress and
 * createSignedUrl returning a URL that "expires" after `expiresIn` seconds.
 */
export function mockStorage(
  supabase: any,
  opts: { uploadOk?: boolean; signedUrl?: string; expiresIn?: number } = {}
) {
  const { uploadOk = true, signedUrl = 'https://signed.example/url?token=abc', expiresIn = 3600 } =
    opts;
  const generatedAt = Date.now();
  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn(() =>
        Promise.resolve(uploadOk ? { data: { path: 'mock/path' }, error: null } : { data: null, error: { message: 'upload failed' } })
      ),
      createSignedUrl: vi.fn(() =>
        Promise.resolve({
          data: {
            signedUrl,
            // Custom field for tests to check expiration window
            expiresIn,
            generatedAt,
          },
          error: null,
        })
      ),
      remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: signedUrl } })),
    })),
  };
  supabase.storage = storage;
  return storage;
}

/**
 * Generate a fake signed URL with controllable TTL.
 * `ageMs` lets tests pretend the URL was generated in the past.
 */
export function mockSignedUrl(path: string, expiresInSec = 3600, ageMs = 0) {
  const generatedAt = Date.now() - ageMs;
  const expiresAt = generatedAt + expiresInSec * 1000;
  const isExpired = expiresAt <= Date.now();
  return {
    signedUrl: `https://signed.example/${path}?token=${isExpired ? 'expired' : 'fresh'}`,
    generatedAt,
    expiresAt,
    expiresIn: expiresInSec,
    isExpired,
  };
}

/**
 * Mock supabase.functions.invoke(name, body) with per-function response map.
 */
export function mockFunctionsInvoke(
  supabase: any,
  responses: Record<string, ResponseLike>
) {
  supabase.functions = {
    invoke: vi.fn((name: string, _opts?: any) => {
      const resp = responses[name] ?? { data: null, error: { message: `unknown fn ${name}` } };
      return Promise.resolve(resp);
    }),
  };
  return supabase.functions.invoke;
}

/**
 * Mock supabase.rpc with per-name response map.
 */
export function mockRpc(supabase: any, responses: Record<string, ResponseLike>) {
  supabase.rpc = vi.fn((name: string, _params?: any) => {
    const resp = responses[name] ?? { data: null, error: { message: `unknown rpc ${name}` } };
    return Promise.resolve(resp);
  });
  return supabase.rpc;
}

/**
 * Mock supabase.auth.getSession / getUser for components that read it directly.
 */
export function mockAuthSession(supabase: any, userId: string | null, email = 'test@test.local') {
  const session = userId
    ? { access_token: 'token-' + userId, user: { id: userId, email } }
    : null;
  supabase.auth = {
    ...(supabase.auth || {}),
    getSession: vi.fn(() => Promise.resolve({ data: { session }, error: null })),
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: session?.user ?? null }, error: null })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };
}
