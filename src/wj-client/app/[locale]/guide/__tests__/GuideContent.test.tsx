/**
 * Tests for GuideContent component — TDD (RED → GREEN → REFACTOR)
 *
 * Run: cd src/wj-client && npx jest --testPathPattern="guide/__tests__/GuideContent" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// ---------------------------------------------------------------------------
// Mocks — all external dependencies
// ---------------------------------------------------------------------------

jest.mock("@/components/landing/LandingNavbar", () => ({
  __esModule: true,
  default: () => <nav data-testid="landing-navbar" />,
}));

jest.mock("@/components/landing/LandingFooter", () => ({
  __esModule: true,
  default: () => <footer data-testid="landing-footer" />,
}));

jest.mock("@/components/landing/LandingErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="landing-error-boundary">{children}</div>
  ),
}));

jest.mock("@/components/decorative/OrnateHeading", () => ({
  OrnateHeading: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ornate-heading">{children}</div>
  ),
}));

jest.mock("@/components/decorative/OrnateDivider", () => ({
  OrnateDivider: () => <hr data-testid="ornate-divider" />,
}));

jest.mock("../GuideTOC", () => ({
  GuideTOC: ({
    sections,
    activeSection,
  }: {
    sections: { id: string; label: string }[];
    activeSection: string;
  }) => (
    <nav
      data-testid="guide-toc"
      data-active={activeSection}
      data-section-count={sections.length}
    />
  ),
}));

jest.mock("../GuideSection", () => ({
  GuideSection: ({
    id,
    title,
    level,
    children,
  }: {
    id: string;
    title: string;
    level?: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
  }) => {
    const Tag = (level === "h3" ? "h3" : "h2") as keyof JSX.IntrinsicElements;
    return (
      <section id={id} data-testid={`guide-section-${id}`}>
        <Tag>{title}</Tag>
        {children}
      </section>
    );
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock auth store
jest.mock("@/features/auth/store/store", () => ({
  store: {
    getState: () => ({
      setAuthReducer: { isAuthenticated: false },
    }),
  },
}));

// Polyfill IntersectionObserver for jsdom (not available in test env)
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  constructor() {}
} as unknown as typeof IntersectionObserver;

// ---------------------------------------------------------------------------
// i18n messages for guide page
// ---------------------------------------------------------------------------

const messages = {
  guide: {
    title: "User Guide",
    subtitle:
      "Learn how to use congdongvang.com to manage your finances and investments effectively.",
    toc: {
      homepage: "Homepage",
      netWorth: "Net Worth",
      wallets: "Wallet Management",
      priceTables: "Market Price Tables",
      pnlTracking: "PNL Tracking",
      investment: "Investment Portfolio",
      addingInvestments: "Adding Investments",
      transactionTypes: "Transaction Types",
      fifoAccounting: "FIFO Accounting",
      goldSilver: "Gold & Silver",
      priceAlerts: "Price Alerts",
      community: "Community",
      creatingPosts: "Creating Posts",
      interactions: "Interactions",
      sentimentVoting: "Sentiment Voting",
    },
    homepage: {
      title: "Dashboard Homepage",
      description: "The dashboard homepage gives you a complete overview.",
      netWorth: {
        title: "Net Worth",
        description: "The net worth card shows total value.",
        tip: "Click net worth card for details.",
      },
      wallets: {
        title: "Wallet Management",
        description: "Wallets are the basic unit.",
        createWallet: {
          title: "Creating a New Wallet",
          steps: ["Step 1", "Step 2"],
        },
        transferMoney: {
          title: "Transferring Money",
          steps: ["Step 1", "Step 2"],
        },
        tip: "Consider separate wallets.",
      },
      priceTables: {
        title: "Market Price Tables",
        description: "Price tables updated automatically.",
        goldTable: "Gold table shows buy/sell.",
        silverTable: "Silver table shows buy/sell.",
        currencyTable: "Currency table shows rates.",
        staleIndicator: "Prices show -- when unavailable.",
        tip: "Click Gold/Silver/Currency tabs.",
      },
      pnlTracking: {
        title: "PNL Tracking",
        description: "PNL card shows total profit/loss.",
        unrealized: "Unrealized PNL explained.",
        realized: "Realized PNL explained.",
        tip: "Green is gain, red is loss.",
      },
    },
    investment: {
      title: "Investment Portfolio",
      description: "Track all investments in one place.",
      addingInvestments: {
        title: "Adding Investments",
        description: "To add, need INVESTMENT wallet.",
        steps: ["Step 1", "Step 2"],
        symbolSearch: {
          title: "Symbol Search",
          description: "Type 2+ chars to search.",
          tip: "Supports VN, US, crypto.",
        },
        customInvestments: {
          title: "Custom Assets",
          description: "For non-market assets.",
          tip: "Update manually via Set Price tab.",
        },
      },
      transactionTypes: {
        title: "Investment Transaction Types",
        description: "Three types supported.",
        buy: { title: "Buy", description: "Buy desc." },
        sell: { title: "Sell", description: "Sell desc." },
        dividend: { title: "Dividend", description: "Dividend desc." },
        tip: "Click investment for history.",
      },
      fifoAccounting: {
        title: "FIFO Accounting",
        description: "FIFO method explained.",
        example: {
          title: "Example",
          description: "100 VCB @ 85k then sell 80.",
        },
        benefits: ["Accurate history", "Precise PNL", "Tracks cost basis"],
      },
      goldSilver: {
        title: "Gold & Silver Investments",
        description: "Specialized support for gold/silver.",
        goldVnd: { title: "Vietnamese Gold", description: "SJC gold." },
        goldUsd: { title: "World Gold", description: "XAU in USD." },
        silverVnd: { title: "Silver VND", description: "Domestic silver." },
        tip: "Enter in tael.",
      },
      priceAlerts: {
        title: "Price Alerts",
        description: "Get notified at threshold.",
        setup: {
          title: "Setting Up",
          steps: ["Go to Settings", "Click Create", "Select asset"],
        },
        status: {
          active: "Active — monitoring.",
          triggered: "Triggered — notified.",
          paused: "Paused — inactive.",
        },
        tip: "Pause without deleting.",
      },
    },
    community: {
      title: "Community Forum",
      description: "Share insights with community.",
      creatingPosts: {
        title: "Creating Posts",
        description: "Share analysis.",
        steps: ["Click Create Post", "Enter content"],
        hashtags: {
          title: "Hashtags",
          description: "Categorize with hashtags.",
        },
        tip: "Quality posts get more engagement.",
      },
      interactions: {
        title: "Community Interactions",
        description: "Engage in multiple ways.",
        commenting: { title: "Commenting", description: "Comment on posts." },
        liking: { title: "Liking", description: "Like posts." },
        following: { title: "Following", description: "Follow investors." },
        savedPosts: { title: "Saving Posts", description: "Bookmark posts." },
        tip: "Follow experienced investors.",
      },
      sentimentVoting: {
        title: "Market Sentiment Voting",
        description: "Vote on gold/silver direction.",
        howToVote: {
          title: "How to Vote",
          steps: ["Find sentiment section", "Select Bull or Bear"],
        },
        interpretation: "Not investment advice.",
        tip: "Votes periodically reset.",
      },
    },
    cta: {
      goToDashboard: "Go to Dashboard",
      getStartedFree: "Get Started Free",
      backToTop: "Back to Top",
    },
  },
};

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GuideContent } from "../GuideContent";

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderGuideContent() {
  return render(<GuideContent />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GuideContent", () => {
  describe("page title (h1)", () => {
    it("renders the page h1 title 'User Guide'", () => {
      renderGuideContent();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    it("h1 contains the guide title text", () => {
      renderGuideContent();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "User Guide"
      );
    });

    it("renders the subtitle paragraph", () => {
      renderGuideContent();
      expect(
        screen.getByText(
          "Learn how to use congdongvang.com to manage your finances and investments effectively."
        )
      ).toBeInTheDocument();
    });
  });

  describe("main three sections render", () => {
    it("renders the Homepage section (h2)", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-homepage")
      ).toBeInTheDocument();
    });

    it("renders the Investment section (h2)", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-investment")
      ).toBeInTheDocument();
    });

    it("renders the Community section (h2)", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-community")
      ).toBeInTheDocument();
    });
  });

  describe("sub-sections render", () => {
    it("renders Homepage sub-sections: net-worth", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-net-worth")
      ).toBeInTheDocument();
    });

    it("renders Homepage sub-sections: wallets", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-wallets")
      ).toBeInTheDocument();
    });

    it("renders Homepage sub-sections: price-tables", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-price-tables")
      ).toBeInTheDocument();
    });

    it("renders Homepage sub-sections: pnl-tracking", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-pnl-tracking")
      ).toBeInTheDocument();
    });

    it("renders Investment sub-sections: adding-investments", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-adding-investments")
      ).toBeInTheDocument();
    });

    it("renders Investment sub-sections: transaction-types", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-transaction-types")
      ).toBeInTheDocument();
    });

    it("renders Investment sub-sections: fifo-accounting", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-fifo-accounting")
      ).toBeInTheDocument();
    });

    it("renders Investment sub-sections: gold-silver", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-gold-silver")
      ).toBeInTheDocument();
    });

    it("renders Investment sub-sections: price-alerts", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-price-alerts")
      ).toBeInTheDocument();
    });

    it("renders Community sub-sections: creating-posts", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-creating-posts")
      ).toBeInTheDocument();
    });

    it("renders Community sub-sections: interactions", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-interactions")
      ).toBeInTheDocument();
    });

    it("renders Community sub-sections: sentiment-voting", () => {
      renderGuideContent();
      expect(
        screen.getByTestId("guide-section-sentiment-voting")
      ).toBeInTheDocument();
    });
  });

  describe("TOC is present", () => {
    it("renders GuideTOC component", () => {
      renderGuideContent();
      const tocs = screen.getAllByTestId("guide-toc");
      expect(tocs.length).toBeGreaterThan(0);
    });

    it("passes correct number of sections (15 sections total) to GuideTOC", () => {
      renderGuideContent();
      // 3 h2 + 4 + 5 + 3 h3 = 15 sections total
      const tocs = screen.getAllByTestId("guide-toc");
      // Each TOC gets the same sections array
      expect(Number(tocs[0].getAttribute("data-section-count"))).toBe(15);
    });
  });

  describe("CTA buttons", () => {
    it("renders a CTA link at the bottom of the page", () => {
      renderGuideContent();
      // Either "Go to Dashboard" or "Get Started Free" must appear
      const ctaText = screen.queryByText("Go to Dashboard") ||
        screen.queryByText("Get Started Free");
      expect(ctaText).toBeInTheDocument();
    });

    it("renders 'Get Started Free' link when not authenticated", () => {
      renderGuideContent();
      expect(screen.getByText("Get Started Free")).toBeInTheDocument();
    });

    it("CTA 'Get Started Free' links to /auth/register", () => {
      renderGuideContent();
      const link = screen.getByText("Get Started Free").closest("a");
      expect(link).toHaveAttribute("href", "/auth/register");
    });
  });

  describe("heading hierarchy (h1 > h2 > h3)", () => {
    it("has exactly one h1 on the page", () => {
      renderGuideContent();
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s).toHaveLength(1);
    });

    it("renders h2 headings for main sections (homepage, investment, community)", () => {
      renderGuideContent();
      const h2s = screen.getAllByRole("heading", { level: 2 });
      const h2Texts = h2s.map((h) => h.textContent);
      expect(h2Texts).toContain("Dashboard Homepage");
      expect(h2Texts).toContain("Investment Portfolio");
      expect(h2Texts).toContain("Community Forum");
    });

    it("renders h3 headings for sub-sections", () => {
      renderGuideContent();
      const h3s = screen.getAllByRole("heading", { level: 3 });
      expect(h3s.length).toBeGreaterThan(0);
      const h3Texts = h3s.map((h) => h.textContent);
      expect(h3Texts).toContain("Net Worth");
    });
  });

  describe("layout structure", () => {
    it("renders LandingNavbar", () => {
      renderGuideContent();
      expect(screen.getByTestId("landing-navbar")).toBeInTheDocument();
    });

    it("renders LandingFooter", () => {
      renderGuideContent();
      expect(screen.getByTestId("landing-footer")).toBeInTheDocument();
    });

    it("renders main element with id='main-content'", () => {
      renderGuideContent();
      const main = document.getElementById("main-content");
      expect(main).toBeInTheDocument();
    });

    it("renders article element for main content area", () => {
      renderGuideContent();
      expect(document.querySelector("article")).toBeInTheDocument();
    });

    it("renders aside element for desktop TOC sidebar", () => {
      renderGuideContent();
      expect(document.querySelector("aside")).toBeInTheDocument();
    });
  });
});
