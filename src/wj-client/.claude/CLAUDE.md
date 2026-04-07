# Frontend Guide (wj-client)

## Structure

```
wj-client/
├── app/
│   ├── [locale]/dashboard/    # All dashboard pages (home, transaction, wallets, portfolio, budget, report, prices, finance, settings/*)
│   ├── [locale]/auth/         # Auth pages
│   ├── [locale]/guide/        # User guide
│   └── constants.tsx          # ModalType, ButtonType, EventType enums
├── features/                  # Feature modules (bounded contexts)
├── components/                # Shared UI (25+ subdirs)
├── contexts/                  # CurrencyContext, NotificationContext
├── hooks/                     # Shared hooks
├── utils/generated/hooks.ts   # Auto-generated React Query hooks
├── gen/                       # Auto-generated TS types from proto
└── lib/utils/                 # number-format, etc.
```

## Feature Modules (`features/`)

| Feature | Key Contents |
|---------|-------------|
| `auth/` | hooks/, store/ (Redux auth state) |
| `wallet/` | CreateWalletForm, EditWalletForm |
| `transaction/` | AddTransactionForm, EditTransactionForm, filters |
| `investment/` | AddInvestmentForm, InvestmentDetailModal, gold/silver calculators |
| `price-alert/` | AlertStatusBadge, PriceAlertList, CreatePriceAlertForm (3-step) |
| `market-prices/` | Price display tables |
| `admin/` | AssetDisplayConfigTable, AssetDisplayConfigForm, FetchCodeList |
| `report/` | CSV/PDF export utils |
| `community/`, `feedback/`, `watchlist/`, `settings/`, `import/`, `budget/` | — |

**Import rules (ESLint enforced):**
- Features → features: **FORBIDDEN** (no cross-feature imports)
- Shared → features: **FORBIDDEN**
- Pages/features → `components/`: allowed
- Old paths `@/components/modals/forms/`, `@/redux/`, `@/lib/validation/` → warned, use `features/<domain>/`

## Routing (Non-Obvious)

**All pages under `app/[locale]/`** — never `app/dashboard/` directly.

Routes: `/dashboard/home`, `/dashboard/transaction`, `/dashboard/wallets`, `/dashboard/portfolio`, `/dashboard/budget`, `/dashboard/report`, `/dashboard/prices`, `/dashboard/finance`, `/dashboard/settings/alerts`, `/dashboard/settings/security`, `/dashboard/settings/sessions`, `/dashboard/settings/import-templates`

## Tailwind v2 Tokens (Always Use These — Never Hardcode Colors)

### Backgrounds
| Token | Value | Use |
|-------|-------|-----|
| `bg-v2-bg-primary` | `#5F0202` | Page background |
| `bg-v2-bg-surface` | `#580202` | Cards, modals |
| `bg-v2-bg-surface-tint` | `#5A0A0A` | Table headers, active row hover |
| `bg-v2-bg-dark` | `#3A0101` | Inputs, dropdowns, skeletons |
| `bg-v2-maroon-600` | `#6B0303` | Hover state |

### Text
| Token | Value | Use |
|-------|-------|-----|
| `text-v2-gold-accent` | `#F1BD61` | Headings, primary labels |
| `text-v2-text-secondary` | `#F1BD61` | Body text, table data |
| `text-v2-text-tertiary` | `#fcf2e0` | Muted/helper text |
| `text-v2-text-placeholder` | `rgba(241,189,97,0.45)` | Placeholders |

### Semantic / State
| Intent | Background | Text | Value |
|--------|-----------|------|-------|
| Success/gain | `bg-v2-green-light` | `text-v2-green-positive` | `#4ADE80` |
| Danger/loss | `bg-v2-red-light` | `text-v2-red-negative` | `#F87171` |
| Gold/CTA | `bg-v2-gold-primary` | `text-v2-gold-accent` | `#D78B1C`/`#F1BD61` |
| Brand red | `bg-v2-red-primary` | — | `#9B0111` |

### Asset Colors
| Asset | Text | Background |
|-------|------|-----------|
| Gold | `text-v2-gold-accent` | `bg-v2-gold-primary/20` |
| Silver | `text-v2-silver-primary` | `bg-v2-silver-light` |
| Currency/FX | `text-v2-currency-accent` | `bg-v2-currency-light` |

### Rules
- **No `dark:` classes** — theme is permanent dark maroon
- **No `bg-white`** except `bg-white/10` or `bg-white/20`
- **`v2-bg-deepest` does NOT exist** — don't use it
- Active tab on gold bg → `text-v2-bg-dark` (dark maroon text, readable)
- Min touch target: `min-h-[44px]`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-v2-gold-primary`
- Charts: `chart-v2-gold`, `chart-v2-red`, `chart-v2-silver`, `chart-v2-gold-area`
- Borders: `border-v2-border` (`#D78B1C`), `border-v2-border-light` (30% opacity)
- Shadows: `shadow-card`, `shadow-modal`, `shadow-dropdown`
- Font: Roboto only — `font-vietnam`/`font-jakarta`/`font-jetbrains` all resolve to Roboto

## State Management

- **Redux Toolkit**: auth state only — `features/auth/store/`
- **React Query**: all server state — auto-generated hooks in `utils/generated/hooks.ts`
- **Modals**: component-level `useState` — NOT Redux

## API Hooks Pattern

```typescript
// Query (read)
const { data } = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  { refetchOnMount: "always" }
);
// Access: data?.wallets, data?.total (direct — no data.data wrapper)

// Mutation (write)
const mutation = useMutationCreateWallet({
  onSuccess: () => onSuccess?.(),
  onError: (error: any) => setError(error.message || "fallback message"),
});
mutation.mutate({ walletName: "...", ... });
```

## Modal Pattern

Page manages state; forms are self-contained with `onSuccess` callback:

```typescript
const [modalType, setModalType] = useState<string | null>(null);
// On success: queryClient.invalidateQueries(...); setModalType(null);
```

`BaseModal` features: focus trap, ESC/click-outside close, body scroll lock, swipe-to-dismiss.

## Naming Conventions

| Context | Convention |
|---------|-----------|
| React components | `PascalCase.tsx` |
| Utility files | `kebab-case.ts` |
| Pages/layouts | `page.tsx` / `layout.tsx` (Next.js) |
| Variables/functions | `camelCase` |
| Interfaces/types | `PascalCase` |
| `ButtonType` from | `@/app/constants` (not `@/components/Button`) |

## Key Component Notes

- `"use client"` required for any hook, browser API, or event handler usage
- `SymbolAutocomplete` onChange: `(symbol: string, result?: SearchResult) => void`
- `FormNumberInput` — auto thousand-separator; use `useThousandSeparator={true}` (default)
- `MobileTable` `MobileColumnDef<T>`: fields `id`, `header`, `showInCollapsed?`, `cell?: ({getValue, row}) => ReactNode`; `getKey` receives `(item, index)`
- Bottom nav hardcoded for 6 items — don't add without replacing an existing item
- `ButtonType` exported from `@/app/constants`

## Price Staleness (portfolio)

`getPriceStaleClass(priceUpdatedAt, nowSeconds?)` in `app/[locale]/dashboard/portfolio/helpers.tsx`:

| Age | Class | Meaning |
|-----|-------|---------|
| <15m | `bg-v2-green-positive` | Fresh |
| 15–60m | `bg-yellow-400` | Slightly stale |
| 1–24h | `bg-orange-400` | Stale |
| >24h | `bg-v2-red-negative` | Very stale |
| null/0 | `bg-v2-text-tertiary` | Never updated |

## Testing

```bash
npm test                  # Jest unit tests
npm run test:watch
npm run test:e2e          # Playwright
npm run test:e2e:ui       # Interactive
npm run lint              # ESLint flat config
```

E2E tests in `tests/e2e/` — includes `price-alerts-settings-flow.spec.ts`.
