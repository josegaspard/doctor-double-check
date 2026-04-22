import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

beforeEach(() => {
  sessionStorage.clear();
});

// ===== Mock data: doctor with Cédula REJECTED + reason, COFEPRIS APPROVED =====
const mockLiveRow = {
  id: "live-rej-1",
  title: "Live with rejected cédula",
  description: null,
  doctor_id: "doc-rej-1",
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
  id: "doc-rej-1",
  name: "Dr. Rechazado",
  avatar_url: null,
};

let currentDoctorRow: any = {
  user_id: "doc-rej-1",
  followers_count: 0,
  specialty: "Cardiología",
  cedula_profesional: "CED-REJ-1",
  cofepris_permit: "COF-REJ-1",
  cedula_status: "rejected",
  cedula_rejection_reason: "Documento ilegible, vuelva a subirlo",
  cofepris_status: "approved",
  cofepris_rejection_reason: null,
};

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = (rowsGetter: () => any[]) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => Promise.resolve({ data: rowsGetter(), error: null })),
      order: vi.fn(() => Promise.resolve({ data: rowsGetter(), error: null })),
      single: vi.fn(() => Promise.resolve({ data: rowsGetter()[0] ?? null, error: null })),
      lt: vi.fn(() => Promise.resolve({ data: rowsGetter(), error: null })),
      update: vi.fn(() => chain),
      insert: vi.fn(() => Promise.resolve({ data: rowsGetter(), error: null })),
      delete: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "lives") return buildQuery(() => [mockLiveRow]);
        if (table === "profiles_public") return buildQuery(() => [mockProfileRow]);
        if (table === "doctor_profiles_public") return buildQuery(() => [currentDoctorRow]);
        if (table === "live_likes") return buildQuery(() => []);
        return buildQuery(() => []);
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

vi.mock("@/components/live/LivePreviewPlayer", () => ({
  default: () => <div data-testid="live-preview-player" />,
}));

vi.mock("@/components/ads/AdBanner", () => ({ AdBanner: () => null }));
vi.mock("@/components/ads/AdInterstitial", () => ({ AdInterstitial: () => null }));
vi.mock("@/components/availability/UpcomingAvailabilities", () => ({
  UpcomingAvailabilities: () => null,
}));
vi.mock("@/components/news/NewsFeed", () => ({ NewsFeed: () => null }));
vi.mock("@/components/layout/MainLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/lives", search: "", hash: "" }),
}));

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

import { LivesProvider } from "@/contexts/LivesContext";
import LivesGrid from "@/pages/LivesGrid";

describe("LivesGrid — inline rejection reason rendering", () => {
  it("shows the Cédula rejection reason inline below the badges, without any click", async () => {
    currentDoctorRow = {
      user_id: "doc-rej-1",
      followers_count: 0,
      specialty: "Cardiología",
      cedula_profesional: "CED-REJ-1",
      cofepris_permit: "COF-REJ-1",
      cedula_status: "rejected",
      cedula_rejection_reason: "Documento ilegible, vuelva a subirlo",
      cofepris_status: "approved",
      cofepris_rejection_reason: null,
    };

    render(
      <LivesProvider>
        <LivesGrid />
      </LivesProvider>,
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(/Cédula:\s*Documento ilegible, vuelva a subirlo/i),
        ).toBeTruthy();
      },
      { timeout: 4000 },
    );

    // COFEPRIS is approved — no rejection text for it
    expect(screen.queryByText(/COFEPRIS:\s*/i)).toBeNull();
  });

  it("shows only the credential with a recorded reason when both are rejected but only one has a message", async () => {
    currentDoctorRow = {
      user_id: "doc-rej-1",
      followers_count: 0,
      specialty: "Cardiología",
      cedula_profesional: "CED-REJ-1",
      cofepris_permit: "COF-REJ-1",
      cedula_status: "rejected",
      cedula_rejection_reason: "Foto borrosa",
      cofepris_status: "rejected",
      cofepris_rejection_reason: null,
    };

    render(
      <LivesProvider>
        <LivesGrid />
      </LivesProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Cédula:\s*Foto borrosa/i)).toBeTruthy();
      },
      { timeout: 4000 },
    );

    // No COFEPRIS specific reason rendered (it's null)
    expect(screen.queryByText(/COFEPRIS:\s*/i)).toBeNull();
  });
});
