/**
 * TDD tests for dynamic tab visibility logic (Task 3)
 *
 * Tests the pure `computeVisibleTabs` helper which drives which tabs are shown
 * based on API fetch status and returned data.
 *
 * Run: cd src/wj-client && npm test -- --testPathPattern="prices/__tests__/tab-visibility" --watchAll=false
 */

import { computeVisibleTabs } from "../helpers";
import type { TabKey } from "../helpers";

// ─── Shared labels fixture ────────────────────────────────────────────────────

const LABELS: Record<TabKey, string> = {
  priceAlerts: "Price Alerts",
  watchlist: "Watchlist",
  gold: "Gold",
  silver: "Silver",
  currency: "Currency",
  symbol: "Symbol Lookup",
};

// ─── Helper ────────────────────────────────────────────────────────────────────

function keys(tabs: { key: TabKey }[]) {
  return tabs.map((t) => t.key);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeVisibleTabs", () => {
  describe("when isSuccess=false (loading / not yet fetched)", () => {
    it("shows all 6 tabs when data is null", () => {
      const result = computeVisibleTabs(false, null, LABELS);
      expect(keys(result)).toEqual([
        "priceAlerts",
        "watchlist",
        "gold",
        "silver",
        "currency",
        "symbol",
      ]);
    });

    it("shows all 6 tabs even when gold array is empty", () => {
      const result = computeVisibleTabs(false, { gold: [], silver: [], currency: [] }, LABELS);
      expect(keys(result)).toContain("gold");
      expect(keys(result)).toContain("silver");
      expect(keys(result)).toContain("currency");
    });

    it("shows all 6 tabs when data is undefined", () => {
      const result = computeVisibleTabs(false, undefined, LABELS);
      expect(result).toHaveLength(6);
    });
  });

  describe("when isSuccess=true and gold is empty", () => {
    it("hides gold tab", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [], silver: [{ typeCode: "SLV1" } as never], currency: [{ typeCode: "USD" } as never] },
        LABELS,
      );
      expect(keys(result)).not.toContain("gold");
    });

    it("still shows silver and currency tabs", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [], silver: [{ typeCode: "SLV1" } as never], currency: [{ typeCode: "USD" } as never] },
        LABELS,
      );
      expect(keys(result)).toContain("silver");
      expect(keys(result)).toContain("currency");
    });
  });

  describe("when isSuccess=true and silver is empty", () => {
    it("hides silver tab", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [{ typeCode: "SJL1" } as never], silver: [], currency: [{ typeCode: "USD" } as never] },
        LABELS,
      );
      expect(keys(result)).not.toContain("silver");
    });

    it("still shows gold and currency tabs", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [{ typeCode: "SJL1" } as never], silver: [], currency: [{ typeCode: "USD" } as never] },
        LABELS,
      );
      expect(keys(result)).toContain("gold");
      expect(keys(result)).toContain("currency");
    });
  });

  describe("when isSuccess=true and currency is empty", () => {
    it("hides currency tab", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [{ typeCode: "SJL1" } as never], silver: [{ typeCode: "SLV1" } as never], currency: [] },
        LABELS,
      );
      expect(keys(result)).not.toContain("currency");
    });

    it("still shows gold and silver tabs", () => {
      const result = computeVisibleTabs(
        true,
        { gold: [{ typeCode: "SJL1" } as never], silver: [{ typeCode: "SLV1" } as never], currency: [] },
        LABELS,
      );
      expect(keys(result)).toContain("gold");
      expect(keys(result)).toContain("silver");
    });
  });

  describe("when isSuccess=true and all arrays are empty", () => {
    it("hides gold, silver, and currency tabs", () => {
      const result = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(keys(result)).not.toContain("gold");
      expect(keys(result)).not.toContain("silver");
      expect(keys(result)).not.toContain("currency");
    });

    it("still shows priceAlerts, watchlist, and symbol tabs", () => {
      const result = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(keys(result)).toContain("priceAlerts");
      expect(keys(result)).toContain("watchlist");
      expect(keys(result)).toContain("symbol");
    });

    it("returns exactly 3 tabs", () => {
      const result = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(result).toHaveLength(3);
    });
  });

  describe("always-visible tabs", () => {
    it("priceAlerts is always first", () => {
      const result = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(result[0].key).toBe("priceAlerts");
    });

    it("symbol is always last", () => {
      const full = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(full[full.length - 1].key).toBe("symbol");
    });

    it("watchlist is always present regardless of data", () => {
      const result = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      expect(keys(result)).toContain("watchlist");
    });
  });

  describe("labels are applied correctly", () => {
    it("uses provided label strings", () => {
      const result = computeVisibleTabs(false, null, LABELS);
      const goldTab = result.find((t) => t.key === "gold");
      expect(goldTab?.label).toBe("Gold");
      const priceAlertsTab = result.find((t) => t.key === "priceAlerts");
      expect(priceAlertsTab?.label).toBe("Price Alerts");
    });
  });

  describe("activeTab reset logic (pure function contract)", () => {
    it("when gold was active and gold is now hidden, gold is not in visibleTabs", () => {
      const visibleTabs = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      const isGoldVisible = visibleTabs.some((t) => t.key === "gold");
      // Simulates: if activeTab === "gold" and !isGoldVisible → reset to "priceAlerts"
      expect(isGoldVisible).toBe(false);
    });

    it("priceAlerts is always a valid reset target", () => {
      const visibleTabs = computeVisibleTabs(true, { gold: [], silver: [], currency: [] }, LABELS);
      const isPriceAlertsVisible = visibleTabs.some((t) => t.key === "priceAlerts");
      expect(isPriceAlertsVisible).toBe(true);
    });
  });
});
