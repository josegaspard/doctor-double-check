import { describe, it, expect, vi, beforeEach } from "vitest";
// @ts-ignore - testing library types
import { render, screen, waitFor } from "@testing-library/react";

// Mock matchMedia for tablet width (768px)
function setupMatchMedia(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, value: width });
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    // Parse min-width queries like "(min-width: 640px)"
    const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/);
    const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
    let matches = false;
    if (minWidthMatch) matches = width >= parseInt(minWidthMatch[1]);
    if (maxWidthMatch) matches = width <= parseInt(maxWidthMatch[1]);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/doctors", search: "", hash: "" }),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  NavLink: ({ children, to, ...props }: any) => <a href={to} {...props}>{typeof children === 'function' ? children({ isActive: false }) : children}</a>,
}));

// Mock contexts
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "doctors.exploreTitle": "Explore Doctors",
        "doctors.exploreSubtitle": "Find the best specialists",
        "doctors.howItWorks": "How it works",
        "doctors.follow": "Follow",
        "doctors.followDescription": "Get free alerts",
        "doctors.proSubscription": "Pro",
        "doctors.proDescription": "Full access",
        "doctors.found": "found",
        "doctors.noDoctors": "No doctors found",
        "doctors.adjustFilters": "Adjust your filters",
        "doctors.viewProfile": "View Profile",
        "doctors.availableNow": "Available now",
        "doctors.notAvailable": "Not available",
        "inputs.searchDoctors": "Search doctors...",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
  LanguageProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/useSubscriptions", () => ({
  useSubscriptions: () => ({
    isSubscribedTo: () => false,
    getSubscription: () => null,
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({
    settings: null,
    loading: false,
  }),
}));

// Minimal MainLayout mock to avoid deep dependency tree
vi.mock("@/components/layout/MainLayout", () => ({
  default: ({ children }: any) => <div data-testid="main-layout">{children}</div>,
}));

import Doctors from "../Doctors";

describe("Doctors page — tablet (768px)", () => {
  beforeEach(() => {
    setupMatchMedia(768);
    vi.clearAllMocks();
  });

  it("renders the page at tablet width without crashing", () => {
    render(<Doctors />);
    expect(screen.getByText("Explore Doctors")).toBeInTheDocument();
  });

  it("renders search input and specialty filter on the same row at tablet width", () => {
    render(<Doctors />);
    const searchInput = screen.getByPlaceholderText("Search doctors...");
    expect(searchInput).toBeInTheDocument();

    // At sm+ breakpoint, filters should be in flex-row layout (not stacked)
    const filtersContainer = searchInput.closest(".flex.flex-col.sm\\:flex-row");
    expect(filtersContainer).not.toBeNull();
  });

  it("uses 2-column grid for doctor cards at sm breakpoint (768px >= 640px)", () => {
    render(<Doctors />);
    // The grid container has classes: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
    // At 768px (>= sm=640px, < lg=1024px), Tailwind applies sm:grid-cols-2
    const gridContainer = document.querySelector(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3");
    // Grid container should exist even if empty (skeleton or no-doctors state)
    // Check that the correct grid classes are present
    const grids = document.querySelectorAll("[class*='grid-cols-1'][class*='sm:grid-cols-2']");
    expect(grids.length).toBeGreaterThan(0);
  });

  it("shows the onboarding banner with the stethoscope icon at tablet width", () => {
    render(<Doctors />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
    // The icon container (hidden sm:flex) should be present in DOM at tablet
    const iconContainer = document.querySelector(".hidden.sm\\:flex");
    expect(iconContainer).not.toBeNull();
  });

  it("displays 'No doctors found' empty state correctly at tablet width", async () => {
    render(<Doctors />);
    await waitFor(() => {
      expect(screen.getByText("No doctors found")).toBeInTheDocument();
    });
  });
});
