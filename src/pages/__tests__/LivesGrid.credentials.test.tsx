import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ===== Pre-populate stale sessionStorage cache version BEFORE imports =====
beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("lives_profile_cache_version", "v1-old");
});

// ===== Mock Supabase with a single live + one doctor with full credentials =====
const mockLiveRow = {
  id: "live-1",
  title: "Cardiology Live",
  description: null,
  doctor_id: "doc-1",
  specialty: "Cardiología",
  status: "live",
  viewer_count: 1,
  likes_count: 0,
  started_at: new Date().toISOString(),
  ended_at: null,
  thumbnail_url: null,
  recording_price: null,
  tags: [],
  daily_room_name: null,
  location: null,
  chat_mode: "free",
  chat_price: 0,
};

const mockProfileRow = {
  id: "doc-1",
  name: "Dr. Test",
  avatar_url: null,
};

const mockDoctorProfileRow = {
  user_id: "doc-1",
  followers_count: 5,
  specialty: "Cardiología",
  cedula_profesional: "CED-DOC-1",
  cofepris_permit: "COF-DOC-1",
  cedula_status: "approved",
  cedula_rejection_reason: null,
  cofepris_status: "approved",
  cofepris_rejection_reason: null,
};

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = (rows: any[]) => {
    const result = { data: rows, error: null };
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => Promise.resolve(result)),
      order: vi.fn(() => Promise.resolve(result)),
      single: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
      lt: vi.fn(() => Promise.resolve(result)),
      update: vi.fn(() => chain),
      insert: vi.fn(() => Promise.resolve(result)),
      delete: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "lives") return buildQuery([mockLiveRow]);
        if (table === "profiles_public") return buildQuery([mockProfileRow]);
        if (table === "doctor_profiles_public") return buildQuery([mockDoctorProfileRow]);
        if (table === "live_likes") return buildQuery([]);
        return buildQuery([]);
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    },
  };
});

// ===== Mock LivePreviewPlayer (Daily.co) =====
vi.mock("@/components/live/LivePreviewPlayer", () => ({
  default: () => <div data-testid="live-preview-player" />,
}));

// ===== Mock heavy/unrelated child components =====
vi.mock("@/components/ads/AdBanner", () => ({ AdBanner: () => null }));
vi.mock("@/components/ads/AdInterstitial", () => ({ AdInterstitial: () => null }));
vi.mock("@/components/availability/UpcomingAvailabilities", () => ({
  UpcomingAvailabilities: () => null,
}));
vi.mock("@/components/news/NewsFeed", () => ({ NewsFeed: () => null }));
vi.mock("@/components/layout/MainLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

// ===== Mock react-router-dom =====
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/lives", search: "", hash: "" }),
}));

// ===== Mock auth/language/subscription/site contexts =====
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, role: "visitor", isAuthenticated: false }),
  AuthContext: React.createContext({ user: null }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "es",
  }),
}));

vi.mock("@/hooks/useSubscriptions", () => ({
  useSubscriptions: () => ({ getSubscription: () => null }),
}));

vi.mock("@/hooks/useSiteToggles", () => ({
  useSiteToggles: () => ({ toggles: { show_news_section: false } }),
}));

// ===== Render the real LivesProvider + LivesGrid =====
import { LivesProvider } from "@/contexts/LivesContext";
import LivesGrid from "@/pages/LivesGrid";

describe("LivesGrid — credentials rendering with stale cache", () => {
  it("renders Cédula and COFEPRIS badges even when sessionStorage cache is stale", async () => {
    // Confirm stale version is in storage before render
    expect(sessionStorage.getItem("lives_profile_cache_version")).toBe("v1-old");

    render(
      <LivesProvider>
        <LivesGrid />
      </LivesProvider>,
    );

    // Cache version should be invalidated and updated to current version
    await waitFor(() => {
      expect(sessionStorage.getItem("lives_profile_cache_version")).toBe(
        "v2-credentials",
      );
    });

    // Both credential badges should appear in the grid
    await waitFor(
      () => {
        expect(screen.getAllByText(/Céd\. Prof\./i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/COFEPRIS/i).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });
});
