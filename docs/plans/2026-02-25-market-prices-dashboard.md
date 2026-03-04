# Market Prices Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/dashboard/prices` page with 3 tabs (Gold, Silver, Symbol Lookup) showing live investment asset prices from the vang247 API and Yahoo Finance.

**Architecture:** Follow the protobuf-first pattern. Add `GetMarketPrices` rpc + messages to `investment.proto` → run `task proto:all` → auto-generated `useQueryGetMarketPrices` hook appears in `hooks.ts`. Backend handler calls the existing `GoldPriceService.FetchAllPrices()` + `SilverPriceService.FetchAllPrices()` in parallel. Frontend page reuses `MobileTable`, `BaseCard`, `Button`, `LoadingSpinner`, `SymbolAutocomplete`, and the tab pattern from `InvestmentDetailModal`.

**Tech Stack:** Go 1.23 (Gin), Next.js 15 (App Router), TypeScript 5, Tailwind CSS 3.4, React Query, Protocol Buffers (single source of truth), existing `GoldPriceService`, `SilverPriceService`

---

## Task 1: Add messages and rpc to `investment.proto`

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

### Step 1: Add the new messages and rpc

In `api/protobuf/v1/investment.proto`, add the following **messages** after the existing `GetMarketPriceResponse` block (after line ~222):

```protobuf
// PriceItem represents a single gold or silver price entry
message PriceItem {
  string typeCode = 1 [json_name = "typeCode"];        // e.g., "SJL1L10", "XAUUSD"
  int64 buy = 2 [json_name = "buy"];                   // Buy price in smallest currency unit
  int64 sell = 3 [json_name = "sell"];                 // Sell price in smallest currency unit
  int64 changeBuy = 4 [json_name = "changeBuy"];       // Change in buy price
  int64 changeSell = 5 [json_name = "changeSell"];     // Change in sell price
  string currency = 6 [json_name = "currency"];        // "VND" or "USD"
  string updatedAt = 7 [json_name = "updatedAt"];      // RFC3339 timestamp
}

// GetMarketPricesRequest for fetching all gold and silver prices
message GetMarketPricesRequest {}

// GetMarketPricesResponse returns all gold and silver prices
message GetMarketPricesResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated PriceItem gold = 3 [json_name = "gold"];
  repeated PriceItem silver = 4 [json_name = "silver"];
  string timestamp = 5 [json_name = "timestamp"];
}
```

Add the **rpc** to the `InvestmentService` service block (after the `GetMarketPrice` rpc, around line 357):

```protobuf
  // GetMarketPrices returns all gold and silver prices in one call
  rpc GetMarketPrices(GetMarketPricesRequest) returns (GetMarketPricesResponse) {
    option (google.api.http) = {
      get: "/api/v1/investments/market-prices"
    };
  }
```

### Step 2: Generate all code

```bash
task proto:all
```

Expected output: Go types generated in `src/go-backend/`, TypeScript types in `src/wj-client/gen/`, and hooks updated in `src/wj-client/utils/generated/hooks.ts`.

### Step 3: Verify the generated hook exists

```bash
grep "useQueryGetMarketPrices" src/wj-client/utils/generated/hooks.ts
```

Expected: Line found with `export function useQueryGetMarketPrices`. Also verify the TypeScript types:

```bash
grep "GetMarketPricesResponse\|PriceItem" src/wj-client/gen/protobuf/v1/investment.ts
```

Expected: Both types exported.

---

## Task 2: Backend — Add `MarketPricesHandler`

**Files:**
- Create: `src/go-backend/handlers/market_prices.go`
- Modify: `src/go-backend/handlers/builder.go` (struct + constructor)
- Modify: `src/go-backend/handlers/routes.go` (register route)

### Step 1: Create the handler file

Create `src/go-backend/handlers/market_prices.go`:

```go
package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	investmentv1 "wealthjourney/gen/protobuf/v1"
	"wealthjourney/domain/service"
)

// MarketPricesHandler handles the combined gold + silver prices endpoint
type MarketPricesHandler struct {
	goldSvc   service.GoldPriceService
	silverSvc service.SilverPriceService
}

// NewMarketPricesHandler creates a new market prices handler
func NewMarketPricesHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService) *MarketPricesHandler {
	return &MarketPricesHandler{
		goldSvc:   goldSvc,
		silverSvc: silverSvc,
	}
}

// GetMarketPrices returns all gold and silver prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	var (
		goldItems   []*investmentv1.PriceItem
		silverItems []*investmentv1.PriceItem
		goldErr     error
		silverErr   error
		wg          sync.WaitGroup
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		prices, err := h.goldSvc.FetchAllPrices(ctx)
		if err != nil {
			goldErr = err
			return
		}
		goldItems = make([]*investmentv1.PriceItem, len(prices))
		for i, p := range prices {
			goldItems[i] = &investmentv1.PriceItem{
				TypeCode:   p.TypeCode,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdatedAt:  p.UpdateTime.Format(time.RFC3339),
			}
		}
	}()

	go func() {
		defer wg.Done()
		prices, err := h.silverSvc.FetchAllPrices(ctx)
		if err != nil {
			silverErr = err
			return
		}
		silverItems = make([]*investmentv1.PriceItem, len(prices))
		for i, p := range prices {
			silverItems[i] = &investmentv1.PriceItem{
				TypeCode:   p.TypeCode,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdatedAt:  p.UpdateTime.Format(time.RFC3339),
			}
		}
	}()

	wg.Wait()

	// Both failed — return error
	if goldErr != nil && silverErr != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Failed to fetch prices",
		})
		return
	}

	// Partial success: return empty slice (never null) for failed one
	if goldItems == nil {
		goldItems = []*investmentv1.PriceItem{}
	}
	if silverItems == nil {
		silverItems = []*investmentv1.PriceItem{}
	}

	c.JSON(http.StatusOK, &investmentv1.GetMarketPricesResponse{
		Success:   true,
		Message:   "Market prices retrieved successfully",
		Gold:      goldItems,
		Silver:    silverItems,
		Timestamp: time.Now().Format(time.RFC3339),
	})
}
```

**Note on import path:** Check the actual Go package path for the generated proto types by looking at an existing handler that imports `investmentv1`. For example, check `handlers/investment.go` import block. The import path may be `wealthjourney/gen/protobuf/v1` or different — use the exact same path found there.

### Step 2: Add `MarketPrices` to `AllHandlers` struct

In `src/go-backend/handlers/builder.go`, add to the `AllHandlers` struct (after `Silver *SilverHandler` on line ~18):

```go
MarketPrices *MarketPricesHandler
```

In `NewHandlers()`, wire it up (after `Silver: NewSilverHandler(),` on line ~63):

```go
MarketPrices: NewMarketPricesHandler(
    service.NewGoldPriceService(deps.RDB.GetClient()),
    service.NewSilverPriceService(deps.RDB.GetClient()),
),
```

If `deps.RDB` may be nil, wrap with a nil check:
```go
var marketPricesHandler *MarketPricesHandler
if deps != nil && deps.RDB != nil {
    marketPricesHandler = NewMarketPricesHandler(
        service.NewGoldPriceService(deps.RDB.GetClient()),
        service.NewSilverPriceService(deps.RDB.GetClient()),
    )
}
// In AllHandlers: MarketPrices: marketPricesHandler,
```

### Step 3: Register the route

In `src/go-backend/handlers/routes.go`, after the `/silver-types` line (~line 163), add:

```go
// All gold + silver prices in one call (must come before :id parameterized route)
investments.GET("/market-prices", h.MarketPrices.GetMarketPrices)
```

If using the nil-check pattern, guard it:
```go
if h.MarketPrices != nil {
    investments.GET("/market-prices", h.MarketPrices.GetMarketPrices)
}
```

### Step 4: Build and verify

```bash
cd src/go-backend && go build ./...
```

Expected: No errors. Fix any import path issues if the generated proto package path differs.

### Step 5: Test the endpoint

Start the backend and call:
```bash
curl -s -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/investments/market-prices | jq '{gold: .gold[0], silver: .silver[0]}'
```

**Critical:** Log the actual `buy` value for a known gold type (SJC, ~₫87-90 million/tael). The `GoldPriceService` multiplies vang247 values by 1000 for VND. Record the exact value to determine the display divisor in the frontend.

---

## Task 3: Frontend — Add route and sidebar nav item

**Files:**
- Modify: `src/wj-client/app/constants.tsx`
- Modify: `src/wj-client/app/dashboard/layout.tsx`

### Step 1: Add `prices` to routes

In `src/wj-client/app/constants.tsx`, add to the `routes` object after `portfolio`:

```typescript
prices: `/dashboard/prices`,
```

### Step 2: Add NavItem to desktop sidebar

In `src/wj-client/app/dashboard/layout.tsx`, after the Portfolio `NavItem` block (~line 402):

```tsx
<NavItem
  href={routes.prices}
  label="Prices"
  isExpanded={isExpanded}
  showTooltip={!isExpanded}
  animationDelay={110}
  icon={
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  }
/>
```

### Step 3: Add to mobile slide-out menu

In `src/wj-client/app/dashboard/layout.tsx`, inside the `navigationItems` useMemo after the Portfolio `ActiveLink` block (~line 170):

```tsx
<ActiveLink
  href={routes.prices}
  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-white/10 transition-colors duration-200 touch-target animate-stagger-fade-in"
>
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
  <span className="font-medium">Prices</span>
</ActiveLink>
```

---

## Task 4: Frontend — Create the prices page

**Files:**
- Create: `src/wj-client/app/dashboard/prices/page.tsx`
- Create: `src/wj-client/app/dashboard/prices/helpers.ts`

**Reused components (no new primitives needed):**
| Component | Import | Used for |
|---|---|---|
| `BaseCard` | `@/components/BaseCard` | Page card wrapper |
| `Button` | `@/components/Button` | Refresh button with `loading` + `leftIcon` |
| `LoadingSpinner` | `@/components/loading/LoadingSpinner` | Full-page fallback |
| `MobileTable` + `MobileColumnDef` | `@/components/table/MobileTable` | Gold and silver price tables |
| `SymbolAutocomplete` | `@/components/forms/SymbolAutocomplete` | Symbol search input |
| `useQueryGetMarketPrices` | `@/utils/generated/hooks` | Auto-generated hook for gold/silver |
| `useQueryGetMarketPrice` | `@/utils/generated/hooks` | Auto-generated hook for symbol lookup |
| Tab pattern | Inline (from `InvestmentDetailModal` lines 525-566) | 3-tab navigation |

### Step 1: Create helpers

Create `src/wj-client/app/dashboard/prices/helpers.ts`:

```typescript
import type { PriceItem } from "@/gen/protobuf/v1/investment";

// Maps vang247 typeCode to display labels
// Add missing codes after verifying real API response (Task 2, Step 5)
const GOLD_LABELS: Record<string, string> = {
  SJL1L10: "SJC 1L-10L (Vàng miếng)",
  SJL1L2: "SJC 1L-2L (Vàng miếng)",
  SJL5C: "SJC 5 chỉ",
  SJL1C: "SJC 1 chỉ",
  "SJL0.5C": "SJC 0.5 chỉ",
  SJL0_5C: "SJC 0.5 chỉ",
  SJR2: "SJC Nhẫn 2-5 chỉ",
  SJR1: "SJC Nhẫn 1 chỉ",
  SJT99: "SJC Trang sức 99.99",
  SJT98: "SJC Trang sức 99.98",
  SJT97: "SJC Trang sức 99.97",
  XAUUSD: "Gold World (XAU/USD)",
};

const SILVER_LABELS: Record<string, string> = {
  XAGUSD: "Silver World (XAG/USD)",
  // Add more after verifying real API typeCodes
};

export function getGoldLabel(typeCode: string): string {
  return GOLD_LABELS[typeCode] ?? typeCode;
}

export function getSilverLabel(typeCode: string): string {
  return SILVER_LABELS[typeCode] ?? typeCode;
}

/**
 * Format a price value from the backend for display.
 *
 * IMPORTANT: Verify the correct divisor by inspecting the raw API response
 * in Task 2 Step 5. The GoldPriceService multiplies vang247 values:
 *   VND: raw × 1000  (e.g. vang247 sends 87500 → stored as 87500000)
 *   USD: raw × 100   (cents)
 *
 * Update VND_DIVISOR below based on actual logged `buy` value vs known price.
 * Known: SJC gold ≈ ₫87,000,000–90,000,000 per tael.
 */
const VND_DIVISOR = 1;    // VERIFY AND UPDATE after Task 2 Step 5
const USD_DIVISOR = 100;  // USD stored as cents

export function formatPriceValue(value: number, currency: string): string {
  if (currency === "VND") {
    const display = value / VND_DIVISOR;
    return `₫${display.toLocaleString("vi-VN")}`;
  }
  return `$${(value / USD_DIVISOR).toFixed(2)}`;
}

export function formatChangeValue(value: number, currency: string): string {
  const abs = Math.abs(value);
  const formatted = formatPriceValue(abs, currency);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

// Re-export PriceItem type for convenience
export type { PriceItem };
```

### Step 2: Create the page

Create `src/wj-client/app/dashboard/prices/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  MobileTable,
  MobileColumnDef,
} from "@/components/table/MobileTable";
import { SymbolAutocomplete } from "@/components/forms/SymbolAutocomplete";
import { SearchResult } from "@/gen/protobuf/v1/investment";
import {
  useQueryGetMarketPrices,
  useQueryGetMarketPrice,
  EVENT_InvestmentGetMarketPrice,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGoldLabel,
  getSilverLabel,
  formatPriceValue,
  formatChangeValue,
  PriceItem,
} from "./helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "gold" | "silver" | "symbol";

const TABS: { key: Tab; label: string }[] = [
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
  { key: "symbol", label: "Symbol Lookup" },
];

// ─── Change indicator cell ─────────────────────────────────────────────────────

function ChangeCell({ value, currency }: { value: number; currency: string }) {
  if (value === 0) return <span className="text-gray-400">—</span>;
  const isUp = value > 0;
  return (
    <span className={isUp ? "text-green-600" : "text-lred"}>
      <svg
        className="inline w-3 h-3 mr-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            isUp
              ? "M5 10l7-7m0 0l7 7m-7-7v18"
              : "M19 14l-7 7m0 0l-7-7m7 7V3"
          }
        />
      </svg>
      {formatChangeValue(value, currency)}
    </span>
  );
}

// ─── Column factory ────────────────────────────────────────────────────────────

function buildColumns(
  getLabelFn: (code: string) => string
): MobileColumnDef<PriceItem>[] {
  return [
    {
      id: "name",
      header: "Type",
      showInCollapsed: true,
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-dark-text">
            {getLabelFn(row.typeCode)}
          </span>
          <span className="ml-1.5 text-xs text-gray-400">{row.currency}</span>
        </div>
      ),
    },
    {
      id: "buy",
      header: "Buy",
      showInCollapsed: true,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-dark-text">
          {formatPriceValue(row.buy, row.currency)}
        </span>
      ),
    },
    {
      id: "sell",
      header: "Sell",
      showInCollapsed: false,
      cell: ({ row }) => (
        <span className="text-gray-500">
          {formatPriceValue(row.sell, row.currency)}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      showInCollapsed: false,
      cell: ({ row }) => (
        <ChangeCell value={row.changeBuy} currency={row.currency} />
      ),
    },
  ];
}

// ─── Symbol Lookup tab ─────────────────────────────────────────────────────────

function SymbolLookupTab() {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [querySymbol, setQuerySymbol] = useState("");

  // Use the auto-generated hook — enabled only when user has searched
  const { data, isLoading, isError } = useQueryGetMarketPrice(
    { symbol: querySymbol, currency: selectedCurrency },
    {
      enabled: !!querySymbol,
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );

  const handleSymbolChange = (symbol: string, result?: SearchResult) => {
    setSelectedSymbol(symbol);
    if (result?.currency) setSelectedCurrency(result.currency);
  };

  const handleSearch = () => {
    const sym = selectedSymbol.trim().toUpperCase();
    if (sym) setQuerySymbol(sym);
  };

  const priceData = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
            Symbol
          </label>
          <SymbolAutocomplete
            value={selectedSymbol}
            onChange={handleSymbolChange}
            placeholder="Search symbol, e.g. AAPL, BTC..."
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={!selectedSymbol || isLoading}
          loading={isLoading}
          aria-label="Search symbol price"
        >
          Search
        </Button>
      </div>

      {isError && (
        <p className="text-lred text-sm">
          Failed to fetch price. The symbol may not be supported or available.
        </p>
      )}

      {priceData && querySymbol && (
        <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-dark-text">
                {querySymbol}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {priceData.isCached ? "Cached" : "Live"} ·{" "}
                {new Date(Number(priceData.timestamp) * 1000).toLocaleTimeString()}
                {priceData.displayUnit && ` · ${priceData.displayUnit}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                {priceData.currency === "VND"
                  ? formatPriceValue(priceData.price, "VND")
                  : `$${priceData.priceDecimal.toFixed(2)}`}
              </p>
              <p className="text-xs text-gray-400">{priceData.currency}</p>
            </div>
          </div>
        </div>
      )}

      {!querySymbol && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Search for a stock, crypto, or ETF symbol to see its current price.
        </p>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("gold");

  // Single query for both Gold and Silver tabs — cached, no re-fetch on tab switch
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQueryGetMarketPrices(
    {},
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  const goldColumns = buildColumns(getGoldLabel);
  const silverColumns = buildColumns(getSilverLabel);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-dark-text">
            Market Prices
          </h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching || activeTab === "symbol"}
          loading={isFetching}
          aria-label="Refresh prices"
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>

      <BaseCard padding="md">
        {/* Tab bar — same pattern as InvestmentDetailModal lines 525-566 */}
        <div className="flex border-b border-gray-200 dark:border-dark-border overflow-x-auto scrollbar-hide mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base cursor-pointer transition-colors duration-150 ${
                activeTab === tab.key
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900 dark:hover:text-dark-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Gold tab */}
        {activeTab === "gold" && (
          <>
            {isError && (
              <p className="text-lred text-sm text-center py-4">
                Failed to load gold prices. Try refreshing.
              </p>
            )}
            <MobileTable<PriceItem>
              data={data?.gold ?? []}
              columns={goldColumns}
              isLoading={isLoading}
              loadingRowCount={8}
              getKey={(item) => item.typeCode}
              emptyMessage="No gold prices available"
              emptyDescription="Could not fetch gold prices from the price provider."
              expandable
            />
          </>
        )}

        {/* Silver tab */}
        {activeTab === "silver" && (
          <>
            {isError && (
              <p className="text-lred text-sm text-center py-4">
                Failed to load silver prices. Try refreshing.
              </p>
            )}
            <MobileTable<PriceItem>
              data={data?.silver ?? []}
              columns={silverColumns}
              isLoading={isLoading}
              loadingRowCount={4}
              getKey={(item) => item.typeCode}
              emptyMessage="No silver prices available"
              emptyDescription="Could not fetch silver prices from the price provider."
              expandable
            />
          </>
        )}

        {/* Symbol Lookup tab */}
        {activeTab === "symbol" && <SymbolLookupTab />}
      </BaseCard>
    </div>
  );
}
```

### Step 3: Verify TypeScript

```bash
cd src/wj-client && npx tsc --noEmit 2>&1 | head -40
```

Expected: No errors. Common issues to fix:
- `PriceItem` import — the generated type name from proto may differ. Check `src/wj-client/gen/protobuf/v1/investment.ts` for the exact exported name
- `Button` `leftIcon` prop — verify exact prop name in `components/Button.tsx`
- `useQueryGetMarketPrices` parameter shape — the generated hook wraps `GetMarketPricesRequest {}`, so `{}` is the correct payload
- `data?.gold` — the `GetMarketPricesResponse` fields `gold` and `silver` are `repeated PriceItem`, which generates as `PriceItem[]` in TypeScript

---

## Task 5: Verify price display formula

**After Task 2 Step 5**, update `VND_DIVISOR` in `helpers.ts`.

Known price: SJC gold ≈ ₫87,000,000–90,000,000 per tael.

| Raw `buy` from API | `VND_DIVISOR` | Display result |
|---|---|---|
| `87500000` | `1` | `₫87,500,000` ✓ |
| `87500000000` | `1000` | `₫87,500,000` ✓ |
| `87500` | needs ×1000 | use `value * 1000` instead |

Update the divisor and re-run `npx tsc --noEmit` to confirm no regressions.

---

## Task 6: Manual Testing Checklist

Run `task dev` and verify:

### Backend
- [ ] `GET /api/v1/investments/market-prices` returns 200 with `gold` and `silver` arrays
- [ ] Both arrays are `[]` (not null) if one service fails
- [ ] Gold array has VND (SJC types) and USD (XAUUSD) entries
- [ ] Silver array has VND and USD (XAGUSD) entries

### Navigation
- [ ] "Prices" appears in desktop sidebar between Portfolio and Reports
- [ ] Sidebar tooltip shows "Prices" when collapsed
- [ ] "Prices" appears in mobile slide-out menu
- [ ] `/dashboard/prices` route loads without error
- [ ] Active link highlights correctly

### Gold Tab (default)
- [ ] Gold tab is active on page load
- [ ] Skeleton loading shows during initial fetch
- [ ] VND gold types show ₫ formatted prices (₫87,000,000 range)
- [ ] USD gold (XAUUSD) shows $ formatted price ($2,800+ range)
- [ ] All type codes have human-readable labels (not raw codes like "SJL1L10")
- [ ] Green up-arrow for positive change, red down-arrow for negative, "—" for zero
- [ ] `MobileTable` expandable rows show Sell and Change when expanded

### Silver Tab
- [ ] Switching Gold → Silver does NOT trigger a network request (same cached query)
- [ ] Silver prices display correctly with labels

### Symbol Lookup Tab
- [ ] `SymbolAutocomplete` renders with placeholder text
- [ ] Typing 2+ chars triggers debounced symbol search
- [ ] Selecting from autocomplete populates the input
- [ ] Clicking Search fetches price via `useQueryGetMarketPrice`
- [ ] Price card shows symbol, formatted price, currency, cached/live indicator, time
- [ ] Error message shows for unsupported symbols

### Refresh Button
- [ ] Refresh button is disabled on Symbol Lookup tab
- [ ] Refresh spins and re-fetches Gold/Silver data
- [ ] Last updated timestamp updates after successful refresh

---

## Implementation Notes

### Why protobuf-first for this endpoint?

Adding the rpc to `investment.proto` means:
1. `task proto:all` auto-generates the Go handler types, TypeScript interfaces, and the React Query hook
2. The frontend uses the same typed `useQueryGetMarketPrices` pattern as all other queries
3. No manual `fetcher` calls — consistent with the rest of the codebase

### VND price storage format

`GoldPriceService.FetchAllPrices()` (line 131-132 of `gold_price_service.go`) converts vang247 floats:
- VND: `int64(apiPrice.Buy * 1000)` — vang247 sends full VND values (e.g. 87500000), so stored as 87500000000 (87.5 billion). **Verify this with real data.**
- USD: `int64(apiPrice.Buy * 100)` — stored as cents

### Silver type codes

The actual vang247 typeCode strings for silver may differ from expectations. Log the real response in Task 2 Step 5 and add all missing codes to `SILVER_LABELS` in `helpers.ts`.

### Generated hook payload

`GetMarketPricesRequest` is an empty message (`{}`). The generated `useQueryGetMarketPrices` takes `{}` as its payload — React Query uses the query key `[EVENT_InvestmentGetMarketPrices, {}]` for caching.
