# WealthJourney - Personal Financial Management

## Priority Rule #1

**Re-check the root cause first if the command run error. DON'T retry immediately. If retry error more than 5 times, ask first before continue retry.**

## Project Overview

WealthJourney is a comprehensive personal finance management application built with a modern microservices architecture. The system helps users track their financial life through wallet management, transaction tracking, categorization, investment portfolio, and analytics.

**Tech Stack:**

- **Frontend**: Next.js 16.2 (App Router + i18n via next-intl), React 19, TypeScript 5, Tailwind CSS 3.4, Redux Toolkit, React Query v5
- **Backend**: Go 1.25, Gin (HTTP), gRPC, GORM (PostgreSQL ORM)
- **Database**: PostgreSQL 16 (Supabase), Redis 7 (caching/sessions)
- **API Layer**: Protocol Buffers (single source of truth), REST + gRPC dual protocol support
- **i18n**: next-intl v4 — all pages live under `app/[locale]/` route segment

## Critical Patterns (Non-Obvious)

### Backend Response Format
- Use helper functions from `pkg/handler/response.go` — NOT raw `gin.H{}`
  - Success: `handler.Success(c, result)` → HTTP 200, raw protobuf/JSON body (no envelope)
  - Created: `handler.Created(c, result)` → HTTP 201, raw body
  - Errors: `handler.HandleError(c, err)` / `handler.BadRequest(c, err)` / `handler.Unauthorized(c, msg)`
- **Success responses**: data serialized directly (no wrapper) — `protojson.Marshal` for proto messages, `json.Marshal` for plain Go structs
- **Error responses**: wrapped in `{success: false, error: {code, message, details}, timestamp}`
- Proto fields use `json_name` annotations (camelCase) — enforced by `protojson.MarshalOptions{UseProtoNames: false}`

### Proto Hook Response Access
- Generated hooks return raw JSON mapped directly to proto TS interface
- Access response fields **directly**: `data?.wallets` — NOT `data?.data?.wallets`
- Example: `const { data } = useQueryListWallets(...)` → `data?.wallets`, `data?.total`

### golangci-lint Depguard (Architecture Enforcement)
- Domain/service layer must NOT import `gorm.io/gorm`, `go-redis`, or `gin-gonic/gin` directly
- Only repository layer touches GORM; only handlers touch Gin
- Violations fail `task ci:backend-lint` — fix by moving DB/cache logic to repository layer

### i18n Routing (next-intl)
- All pages are under `app/[locale]/` — never create pages directly under `app/dashboard/`
- Server components use `getTranslations()` from `next-intl/server`
- Client components use `useTranslations()` hook

## Architecture

Full C4 architecture documentation lives in [docs/architecture/](docs/architecture/README.md) — start there for diagrams, trust boundaries, and ADRs.

### Project Structure

```
Personal_Financial_Management/
├── api/                               # Protocol Buffers API definitions (single source of truth)
│   └── protobuf/v1/                   # v1 API definitions
│       ├── auth.proto                 # Authentication service
│       ├── common.proto               # Shared types (Money, Pagination)
│       ├── transaction.proto          # Transaction & category management
│       ├── user.proto                 # User management
│       ├── wallet.proto               # Wallet management
│       ├── budget.proto               # Budget management
│       ├── investment.proto           # Investment portfolio management
│       ├── session.proto              # Session management
│       ├── import.proto               # Bank statement import
│       ├── admin.proto                # Admin operations
│       ├── community.proto            # Community features
│       ├── feedback.proto             # Feedback API
│       ├── watchlist.proto            # Watchlist management
│       └── gold_sentiment.proto       # Gold sentiment voting
│
├── src/
│   ├── go-backend/                    # Go backend (Railway deployment)
│   │   ├── internal/                  # Application bootstrap (ADR-001, ADR-002)
│   │   │   ├── app/                   # App lifecycle & DI providers
│   │   │   │   ├── app.go            # Application init & graceful shutdown
│   │   │   │   └── providers.go      # Manual dependency injection (no Wire)
│   │   │   └── scheduler/            # Background job scheduler
│   │   │       ├── scheduler.go      # Scheduler init & job registration
│   │   │       ├── price_update_job.go        # Market price refresh (15m)
│   │   │       ├── portfolio_snapshot_job.go   # Portfolio history (1h)
│   │   │       ├── session_cleanup_adapter.go  # Expired sessions (6h)
│   │   │       ├── file_cleanup_job.go         # Orphaned uploads (1h)
│   │   │       ├── db_keepalive_job.go         # Connection keepalive (2m)
│   │   │       ├── price_alert_job.go          # System price alert evaluation
│   │   │       ├── user_price_alert_job.go     # User price alert evaluation (NEW)
│   │   │       └── price_cache_job.go          # Asset price DB cache refresh (15m)
│   │   ├── domain/                    # Domain layer (DDD pattern)
│   │   │   ├── auth/                  # Authentication logic
│   │   │   ├── gateway/               # gRPC-Gateway proxy
│   │   │   ├── grpcserver/            # gRPC server implementations
│   │   │   ├── models/                # Database models (GORM)
│   │   │   ├── repository/            # Data access layer
│   │   │   └── service/               # Business logic layer
│   │   ├── handlers/                  # REST API handlers
│   │   │   ├── builder.go            # Handler DI builder
│   │   │   ├── dependencies.go       # Handler dependencies
│   │   │   ├── routes.go             # Route definitions
│   │   │   ├── middleware.go          # HTTP middleware
│   │   │   ├── health.go             # Health check
│   │   │   ├── auth.go               # Authentication
│   │   │   ├── user_v2.go            # User management
│   │   │   ├── wallet_v2.go          # Wallet management
│   │   │   ├── transaction.go        # Transactions
│   │   │   ├── category.go           # Categories
│   │   │   ├── budget.go             # Budgets
│   │   │   ├── investment.go         # Investments
│   │   │   ├── market_prices.go      # Combined market prices
│   │   │   ├── gold.go               # Gold types
│   │   │   ├── silver.go             # Silver types
│   │   │   ├── import.go             # Bank statement import
│   │   │   ├── session.go            # Session management
│   │   │   ├── user_price_alert.go   # Price alert CRUD (NEW)
│   │   │   ├── community.go          # Community features
│   │   │   ├── admin_user.go         # Admin user management
│   │   │   ├── feedback.go           # Feedback submission
│   │   │   ├── watchlist.go          # Symbol watchlist
│   │   │   └── push.go               # Push notifications
│   │   ├── cmd/                       # CLI commands (server, migrate)
│   │   │   ├── main.go               # Server entrypoint
│   │   │   └── migrate-*/            # Migration commands
│   │   └── pkg/                       # Shared packages
│   │       ├── config/                # Configuration
│   │       ├── yahoo/                 # Yahoo Finance API client
│   │       ├── gold/                  # Gold conversion utilities
│   │       ├── silver/                # Silver conversion utilities
│   │       ├── cache/                 # Redis caching
│   │       └── metrics/               # Prometheus metrics
│   │
│   ├── wj-client/                     # Next.js frontend (feature-based, ADR-003)
│   │   ├── app/                       # Next.js App Router pages
│   │   │   ├── page.tsx               # Homepage (redirector)
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── landing/page.tsx       # Landing page
│   │   │   ├── auth/                  # Authentication pages
│   │   │   ├── [locale]/              # i18n route segment (next-intl)
│   │   │   │   ├── dashboard/         # Dashboard pages
│   │   │   │   │   ├── home/page.tsx      # Main dashboard
│   │   │   │   │   ├── transaction/page.tsx
│   │   │   │   │   ├── wallets/page.tsx
│   │   │   │   │   ├── portfolio/page.tsx # Investment portfolio
│   │   │   │   │   ├── budget/page.tsx
│   │   │   │   │   ├── report/page.tsx
│   │   │   │   │   ├── prices/page.tsx    # Market prices
│   │   │   │   │   ├── community/page.tsx # Community
│   │   │   │   │   ├── admin/page.tsx     # Admin panel
│   │   │   │   │   ├── feedback/page.tsx  # User feedback
│   │   │   │   │   └── settings/          # Settings pages
│   │   │   │   │       ├── page.tsx       # Settings hub
│   │   │   │   │       ├── security/page.tsx
│   │   │   │   │       ├── sessions/page.tsx
│   │   │   │   │       ├── import-templates/page.tsx
│   │   │   │   │       └── alerts/page.tsx # Price alerts (NEW)
│   │   │   │   └── auth/              # Authentication pages
│   │   │   └── constants.tsx          # App constants
│   │   ├── features/                  # Feature modules (bounded contexts)
│   │   │   ├── auth/                  # Auth: hooks/, store/
│   │   │   ├── wallet/                # Wallet: components/, forms/, utils/
│   │   │   ├── transaction/           # Transaction: forms/, hooks/, utils/
│   │   │   ├── budget/                # Budget: forms/, utils/
│   │   │   ├── investment/            # Investment: components/, forms/, hooks/, utils/
│   │   │   ├── import/                # Import: components/, forms/
│   │   │   ├── market-prices/         # Market Prices: components/
│   │   │   └── report/                # Report: utils/export/
│   │   ├── components/                # Shared reusable UI components
│   │   │   ├── cards/                 # Card components
│   │   │   ├── charts/                # Chart/visualization components
│   │   │   ├── forms/                 # Reusable form components (FormInput, FormSelect, etc.)
│   │   │   ├── modals/                # Modal components (BaseModal, BottomSheet, etc.)
│   │   │   ├── select/                # Select/dropdown components
│   │   │   ├── table/                 # Table components (MobileTable, etc.)
│   │   │   ├── loading/               # Loading indicators
│   │   │   ├── feedback/              # EmptyState, ErrorState, Toast
│   │   │   ├── icons/                 # SVG icon library
│   │   │   ├── navigation/            # Navigation components
│   │   │   ├── pwa/                   # PWA components
│   │   │   └── ...                    # 25+ component subdirectories
│   │   ├── contexts/                  # React Contexts
│   │   │   ├── CurrencyContext.tsx
│   │   │   └── NotificationContext.tsx
│   │   ├── hooks/                     # Shared custom React hooks
│   │   ├── utils/                     # Utility functions
│   │   │   └── generated/             # Auto-generated API clients & hooks
│   │   ├── lib/                       # Library code (shared utils, number-format, etc.)
│   │   ├── gen/                       # Generated TypeScript types from protobuf
│   │   ├── types/                     # TypeScript definitions
│   │   └── tailwind.config.ts         # Tailwind theme
│   │
│   └── wj-server/                     # Legacy Node.js backend (being phased out)
│
├── docs/                              # Documentation
│   ├── architecture/                  # C4 model diagrams & ADRs
│   │   ├── c4-context.md             # L1: System context
│   │   ├── c4-container.md           # L2: Containers & trust boundaries
│   │   ├── c4-component-backend.md   # L3: Backend components
│   │   ├── c4-component-frontend.md  # L3: Frontend components
│   │   ├── c4-code-investment.md     # L4: Investment domain classes
│   │   ├── flow-*.md                 # Dynamic behavior diagrams (5 files)
│   │   └── adr-*.md                  # Architecture Decision Records (3 ADRs)
│   ├── plans/                         # Implementation plans
│   └── features/                      # Feature documentation
└── Taskfile.yml                       # Task automation (like Makefile)
```

### API Design Philosophy: Protocol Buffer First

**Critical**: All API changes must start in [protobuf definitions](api/protobuf/v1/). This is the single source of truth.

1. **Define API contract** in `.proto` files (e.g., [wallet.proto](api/protobuf/v1/wallet.proto))
2. **Generate code** for both Go backend and TypeScript frontend
3. **Implement handlers** in Go using generated types
4. **Use generated hooks** in React components

```bash
# After modifying protobuf files
task proto:all  # Generates both Go and TypeScript code
```

**Note:** Category management is integrated into `transaction.proto`, not a separate file.

## Frontend Development Guide (wj-client)

### Feature-Based Module Architecture (ADR-003)

The frontend uses **feature-based modules** under `features/` — each feature owns its components, forms, hooks, utils, and validation schemas. See [C4 Frontend Components](docs/architecture/c4-component-frontend.md).

```
features/
├── auth/              # hooks/, store/ (Redux auth state)
├── wallet/            # components/, forms/, utils/
├── transaction/       # forms/, hooks/, utils/
├── budget/            # forms/, utils/
├── investment/        # components/, forms/, hooks/, utils/
├── import/            # components/, forms/
├── market-prices/     # components/
├── price-alert/       # components/, forms/, utils/, __tests__/ (NEW)
├── settings/          # User settings components
├── watchlist/         # Symbol watchlist
├── community/         # Posts, comments, likes, follows
├── admin/             # Admin panel features
├── feedback/          # User feedback collection
└── report/            # utils/export/
```

**Import rules (enforced via ESLint `no-restricted-imports`):**
- Pages → features (allowed)
- Pages → shared components (allowed)
- Features → shared components (allowed)
- Features → features (FORBIDDEN — no cross-feature imports)
- Shared → features (FORBIDDEN — shared must not know about features)

**Where to put new code:**
- **Feature-specific** forms, hooks, utils → `features/<domain>/`
- **Reusable** across features → `components/` (shared layer)
- **Feature-specific validation** → `features/<domain>/utils/` (NOT `lib/validation/`)

### Component Patterns

#### Functional Components with TypeScript

All components use functional components with proper TypeScript interfaces:

```typescript
// src/wj-client/components/BaseCard.tsx
export function BaseCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md drop-shadow-round">{children}</div>
  );
}
```

**Naming Conventions:**

| Context                  | Convention                                   | Examples                                                              |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------- |
| **React Components**     | `PascalCase.tsx`                             | `BaseCard.tsx`, `Button.tsx`, `FormInput.tsx`, `TransactionTable.tsx` |
| **Utility Files**        | `kebab-case.ts` / `kebab-case.tsx`           | `currency-formatter.tsx`, `fetcher.tsx`, `csv-export.ts`              |
| **Page Files**           | `page.tsx` (lowercase, Next.js convention)   | `app/page.tsx`, `app/dashboard/home/page.tsx`                         |
| **Layout Files**         | `layout.tsx` (lowercase, Next.js convention) | `app/layout.tsx`, `app/dashboard/layout.tsx`                          |
| **Type/Constants Files** | `PascalCase.ts` / `PascalCase.tsx`           | `constants.tsx`, `api.ts`, `forms.ts`                                 |
| **Variables/Functions**  | `camelCase`                                  | `modalType`, `handleClick`, `getListWallets`                          |
| **Interfaces/Types**     | `PascalCase`                                 | `AuthPayload`, `ModalPayload`, `BaseModalProps`                       |
| **Enum/Const Objects**   | `PascalCase` (exported objects)              | `ModalType`, `ButtonType`, `EventType`                                |
| **Go Files**             | `lowercase.go` / `lowercase_underscore.go`   | `wallet.go`, `wallet_service.go`, `wallet_repository.go`              |

#### "use client" Directive

Since Next.js 16 uses App Router (server components by default), any component using:

- React hooks (`useState`, `useEffect`, etc.)
- Browser APIs (`localStorage`, etc.)
- Event handlers (`onClick`, etc.)

Must include `"use client"` at the top of the file.

Example from [BaseModal.tsx](src/wj-client/components/modals/BaseModal.tsx):

```typescript
"use client";

import { useState } from "react";
// ...
```

### Number Input with Thousand Separator

**Automatic thousand separator formatting** for money input fields:

```typescript
import { FormNumberInput } from "@/components/forms/FormNumberInput";

<FormNumberInput
  name="amount"
  control={control}
  label="Amount"
  suffix="VND"
  useThousandSeparator={true}  // Default: true
  required
/>
```

**Features:**
- Automatically formats numbers with commas (1,000; 10,000; 100,000)
- Maintains decimal precision
- Works with all currencies (VND, USD, EUR, etc.)
- Form submission receives clean numeric value (no commas)
- Mobile-optimized with AmountKeypad component

**Utilities:**
```typescript
import {
  formatNumberWithCommas,
  parseNumberWithCommas,
  isValidNumberInput,
} from "@/lib/utils/number-format";

// Format for display
const display = formatNumberWithCommas(1000); // "1,000"

// Parse for calculation
const value = parseNumberWithCommas("1,000"); // "1000"

// Validate user input
const valid = isValidNumberInput("1,000.50"); // true
```

**Note:** The `FormNumberInput` component handles formatting automatically. No manual formatting needed in forms.

### State Management

**Two-tier state management:**

1. **Redux Toolkit** - Authentication state only
   - Auth store now in [features/auth/store/](src/wj-client/features/auth/store/) (moved from `redux/`)
   - **Note:** Modals are managed at component level, NOT in Redux

2. **React Query (@tanstack/react-query)** - Server state
   - Auto-generated hooks in [utils/generated/hooks.ts](src/wj-client/utils/generated/hooks.ts)
   - Handles caching, refetching, loading states

**Example: Using generated hooks**

```typescript
import { useQueryListWallets } from "@/utils/generated/hooks";

export default function Home() {
  const getListWallets = useQueryListWallets(
    { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );
  // getListWallets.data, .isLoading, .error, .refetch()
}
```

### API Integration Patterns

**Auto-generated from Protobuf:**

1. **Mutation hooks** for writes (create, update, delete)
2. **Query hooks** for reads (get, list)
3. **TypeScript types** auto-generated in [gen/](src/wj-client/gen/)

**Pattern for mutations:**

```typescript
const createWalletMutation = useMutationCreateWallet({
  onSuccess: () => {
    // Call the success callback to refresh data and close modal
    onSuccess?.();
  },
  onError: (error: any) => {
    setError(error.message || "Failed to create wallet. Please try again");
  },
});

// Later in component:
createWalletMutation.mutate({
  walletName: walletInput.name,
  initialBalance: { amount: walletInput.initialBalance, currency: "VND" },
  type: walletInput.walletType,
});
```

**Pattern for queries:**

```typescript
const getListWallets = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  { refetchOnMount: "always" },
);
```

### Styling with Tailwind CSS

**Mihong.vn dark maroon & gold theme** — permanent dark, no toggle. Defined in [tailwind.config.ts](src/wj-client/tailwind.config.ts). Always use `v2-*` tokens for new code.

#### Backgrounds

| Token | Value | Use |
|-------|-------|-----|
| `bg-v2-bg-primary` | `#5F0202` | Page background |
| `bg-v2-bg-surface` | `#580202` | Cards, modals |
| `bg-v2-bg-surface-tint` | `#5A0A0A` | Table headers, active row hover |
| `bg-v2-bg-dark` | `#3A0101` | Inputs, dropdowns, skeleton loaders |
| `bg-v2-maroon-600` | `#6B0303` | Hover state on interactive elements |

#### Text

| Token | Value | Use |
|-------|-------|-----|
| `text-v2-gold-accent` | `#F1BD61` | Headings, symbol names, primary labels |
| `text-v2-text-secondary` | `#F1BD61` | Body text, table data |
| `text-v2-text-tertiary` | `#fcf2e0` | Muted/helper text, subtitles |
| `text-v2-text-placeholder` | `rgba(241,189,97,0.45)` | Input placeholders |

#### Borders

| Token | Use |
|-------|-----|
| `border-v2-border` | Standard gold border (`#D78B1C`) |
| `border-v2-border-light` | Subtle dividers (`rgba(215,139,28,0.3)`) |

#### Semantic / State Colors

| Intent | Background token | Text token | Value |
|--------|-----------------|------------|-------|
| **Success / gain / up** | `bg-v2-green-light` | `text-v2-green-positive` | `#4ADE80` |
| **Danger / loss / down** | `bg-v2-red-light` | `text-v2-red-negative` | `#F87171` |
| **Gold / CTA / active** | `bg-v2-gold-primary` | `text-v2-gold-accent` | `#D78B1C` / `#F1BD61` |
| **Brand red** | `bg-v2-red-primary` | — | `#9B0111` |

> **Never use hardcoded colors** like `text-green-400`, `text-red-400`, `bg-orange-500/20`, `text-gray-400` — always use the semantic v2 tokens above.

#### Active tab / selected button text

Active state on a gold background: use `text-v2-bg-dark` (dark maroon text on gold — readable). **`v2-bg-deepest` does not exist** — do not use it.

#### Asset type colors

| Asset | Text token | Background token |
|-------|-----------|-----------------|
| Gold | `text-v2-gold-accent` | `bg-v2-gold-primary/20` |
| Silver | `text-v2-silver-primary` | `bg-v2-silver-light` |
| Currency / FX | `text-v2-currency-accent` | `bg-v2-currency-light` |

#### Charts

Use `chart-v2` palette: `chart-v2-gold`, `chart-v2-red`, `chart-v2-silver`, `chart-v2-gold-area`. The legacy `chart-*` (green-based) scale is still referenced in some older chart components.

#### Typography

Roboto only (400/500/700/900 weights). Aliases `font-vietnam`, `font-jakarta`, `font-jetbrains` all resolve to Roboto/Roboto Mono for backward compat.

#### Breakpoints

Standard Tailwind: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`. The old custom `sm:800px` was removed.

#### Other utilities

- Shadows: `shadow-card`, `shadow-modal`, `shadow-dropdown`, `shadow-focus` (gold focus ring)
- Z-index: named scale — `z-modal`, `z-toast`, `z-dropdown`, `z-sidebar`, `z-tooltip`
- Animations: `animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-stagger-fade-in`
- Legacy: `drop-shadow-round` still works but prefer `shadow-card` for new components
- Decorative: `OrnateHeading`, `OrnateDivider` in `components/decorative/` (gold diamond/line motifs)

#### Rules

- No `dark:` classes — they were stripped from all files; `ThemeProvider`/`ThemeToggle` deleted
- No `bg-white` except `bg-white/10` or `bg-white/20` for transparent gradient overlays
- Min touch target: `min-h-[44px]` on all interactive elements
- Focus ring: `focus-visible:ring-2 focus-visible:ring-v2-gold-primary`

### Shared Components (components/)

Reusable components shared across features, organized by category (25+ subdirectories):

| Category | Key Components | Location |
|----------|---------------|----------|
| **Cards** | BaseCard | `components/cards/` or `components/BaseCard.tsx` |
| **Buttons** | Button, ButtonGroup, FloatingActionButton | `components/Button.tsx` |
| **Forms** | FormInput, FormSelect, FormNumberInput, SymbolAutocomplete | `components/forms/` |
| **Modals** | BaseModal, BottomSheet, ConfirmationDialog, Success | `components/modals/` |
| **Selects** | Select, CreatableSelect, MultiSelect, CurrencySelector | `components/select/` |
| **Charts** | BarChart, LineChart, DonutChart, Sparkline | `components/charts/` |
| **Tables** | MobileTable, TanStackTable, VirtualizedList | `components/table/` |
| **Loading** | LoadingSpinner, FullPageLoading, Skeleton variants | `components/loading/` |
| **Feedback** | EmptyState, ErrorState, Toast, Notification | `components/feedback/` |
| **Icons** | SVG icon library (actions, finance, navigation, ui) | `components/icons/` |
| **Navigation** | BottomNav, Sidebar, ActiveLink | `components/navigation/` |
| **PWA** | PWAInstallPrompt, InstallSteps | `components/pwa/` |

**React Contexts** in `contexts/`: `CurrencyContext`, `NotificationContext`

### Modal Management Pattern

The application uses a **component-level state management** pattern for modals (NOT Redux).

**Core Modal Component** - [BaseModal.tsx](src/wj-client/components/modals/BaseModal.tsx):

```typescript
export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

**Features:**

- Focus trap for accessibility
- ESC key to close
- Click outside to close
- Prevents body scroll when open
- ARIA attributes (`aria-modal`, `role="dialog"`)
- Swipe-to-dismiss on mobile

**Modal Implementation Pattern:**

```typescript
// Page component manages modal state
export default function HomePage() {
  const [modalType, setModalType] = useState<string | null>(null);

  const handleOpenModal = (type: string) => setModalType(type);
  const handleCloseModal = () => setModalType(null);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
    handleCloseModal();
  };

  return (
    <>
      {/* Page content */}
      <Button onClick={() => handleOpenModal("add-wallet")}>Add Wallet</Button>

      {/* Modal rendering */}
      <BaseModal
        isOpen={modalType !== null}
        onClose={handleCloseModal}
        title={getModalTitle(modalType)}
      >
        {modalType === "add-wallet" && (
          <CreateWalletForm onSuccess={handleSuccess} />
        )}
        {modalType === "add-transaction" && (
          <AddTransactionForm onSuccess={handleSuccess} />
        )}
      </BaseModal>
    </>
  );
}
```

**Form Component Pattern:**

Each form component is self-contained with its own state:

```typescript
interface AddTransactionFormProps {
  onSuccess?: () => void; // Callback to refresh data and close modal
}

export function AddTransactionForm({ onSuccess }: AddTransactionFormProps) {
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  const createMutation = useMutationCreateTransaction({
    onSuccess: (data) => {
      setShowSuccess(true);
    },
    onError: (error: any) => {
      setErrorMessage(error.message);
    },
  });

  // Show success state
  if (showSuccess) {
    return <Success message="Transaction added!" onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
      {/* Form fields */}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <Button type="submit" loading={createMutation.isPending}>
        Add Transaction
      </Button>
    </form>
  );
}
```

**Available Modal Types** (from [constants.ts](src/wj-client/app/constants.ts)):

- `ADD_TRANSACTION` - Add new transaction
- `EDIT_TRANSACTION` - Edit existing transaction
- `TRANSFER_MONEY` - Transfer between wallets
- `CREATE_WALLET` - Create new wallet
- `EDIT_WALLET` - Edit wallet details
- `DELETE_WALLET` - Delete wallet with confirmation
- `SUCCESS` - Success message display
- `CONFIRM` - Confirmation dialog
- `ADD_BUDGET` / `EDIT_BUDGET` - Budget management
- `ADD_INVESTMENT` - Add investment holding
- `INVESTMENT_DETAIL` - Investment details with tabs
- `IMPORT_TRANSACTIONS` - Bank statement import

**Specialized Modal Components:**

- **[ConfirmationDialog.tsx](src/wj-client/components/modals/ConfirmationDialog.tsx)** - Confirmation prompts
- **[Success.tsx](src/wj-client/components/modals/Success.tsx)** - Success message display
- **[InvestmentDetailModal.tsx](src/wj-client/components/modals/InvestmentDetailModal.tsx)** - Complex multi-tab modal with Overview, Transactions, Add Transaction, and Set Price tabs

### Routing Structure (Next.js App Router + next-intl)

**All routes are under `app/[locale]/`** — the `[locale]` segment is handled by next-intl middleware.

```
app/
├── page.tsx                           # Root redirector
└── [locale]/                          # i18n segment (en, vi, etc.)
    ├── landing/page.tsx               # /landing
    ├── auth/
    │   ├── login/page.tsx            # /auth/login
    │   └── register/page.tsx         # /auth/register
    └── dashboard/
        ├── home/page.tsx             # /dashboard/home
        ├── transaction/page.tsx      # /dashboard/transaction
        ├── wallets/page.tsx          # /dashboard/wallets
        ├── portfolio/page.tsx        # /dashboard/portfolio
        ├── budget/page.tsx           # /dashboard/budget
        ├── report/page.tsx           # /dashboard/report
        ├── prices/page.tsx           # /dashboard/prices (market prices)
        ├── community/page.tsx        # /dashboard/community
        ├── admin/page.tsx            # /dashboard/admin
        ├── feedback/page.tsx         # /dashboard/feedback
        └── settings/
            ├── page.tsx              # /dashboard/settings (hub)
            ├── security/page.tsx     # /dashboard/settings/security
            ├── sessions/page.tsx     # /dashboard/settings/sessions
            ├── import-templates/page.tsx
            └── alerts/page.tsx       # /dashboard/settings/alerts (price alerts)
```

**Route groups and layouts:**

- Use `(group)` folders for route organization without affecting URLs
- `layout.tsx` files for shared UI across routes
- Never create pages directly under `app/dashboard/` — always use `app/[locale]/dashboard/`

### Mobile Bottom Navigation

**Mobile Bottom Navigation Items (6 total):**
- Home (`/dashboard/home`)
- Transactions (`/dashboard/transaction`)
- Wallets (`/dashboard/wallets`)
- Portfolio (`/dashboard/portfolio`)
- Reports (`/dashboard/report`)
- Budget (`/dashboard/budget`)

**Implementation:** [BottomNav.tsx](src/wj-client/components/BottomNav.tsx)

**Note:** The mobile bottom nav accommodates 6 items with `max-w-[16.66%]` width per item.

### PWA Installation Prompt

- `PWAInstallPrompt.tsx` — main modal, `InstallSteps.tsx` — platform steps, `usePWAInstall.ts` — hook
- Auto-detects platform (iOS Safari, Android Chrome, Desktop); dismisses for 7 days via localStorage
- Add `<PWAInstallPrompt />` to dashboard layout to enable install prompt

### Data Handling Patterns

**Monetary values:**

- Backend: Stored as `int64` in smallest currency unit (VND × 100 for 2 decimals)
- Frontend: Display formatted with proper decimal places
- Currency: ISO 4217 codes (default "VND" for Vietnam Dong)

**Date handling:**

- API: Unix timestamps (seconds since epoch)
- Display: Use `Intl.DateTimeFormat` or date-fns for formatting

**Pagination:**

```typescript
{ pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } }
```

## Backend Development Guide (go-backend)

### Domain-Driven Design Structure

**Clean architecture** with clear separation (see [C4 Backend Components](docs/architecture/c4-component-backend.md)):

```
go-backend/
├── internal/            # Application bootstrap (ADR-001: Manual DI, ADR-002: Constructor Injection)
│   ├── app/             # App lifecycle, DI providers (providers.go)
│   └── scheduler/       # Background jobs (price updates, snapshots, cleanup)
├── domain/
│   ├── models/          # GORM database models
│   ├── repository/      # Data access interfaces + implementations
│   ├── service/         # Business logic layer
│   ├── auth/            # Authentication service
│   ├── grpcserver/      # gRPC service implementations
│   └── gateway/         # gRPC-Gateway proxy
├── handlers/            # REST HTTP handlers + builder.go (DI wiring)
├── pkg/                 # Shared utilities (yahoo, gold, silver, cache, config)
└── cmd/                 # Application entrypoints & migrations
```

**Key architectural decisions:**
- **ADR-001**: Manual DI provider functions in `internal/app/providers.go` (no Google Wire)
- **ADR-002**: Constructor injection — all dependencies passed upfront, no `Set*()` methods
- Wire new handlers in `handlers/builder.go` → `AllHandlers` struct + `NewHandlers()` function

### Linting & Formatting

```bash
# Backend
cd src/go-backend && task ci:backend-lint  # golangci-lint (depguard + staticcheck + errcheck)
cd src/go-backend && gofmt -w .            # Format Go files

# Frontend
cd src/wj-client && npm run lint           # ESLint flat config (eslint.config.mjs)
```

**golangci-lint depguard rules** enforce clean architecture — domain/service layer cannot import `gorm.io/gorm`, `go-redis`, or `gin-gonic/gin` directly.

### Repository Pattern

**Interface-based** for testability:

Example from [repository/wallet_repository.go](src/go-backend/domain/repository/wallet_repository.go):

```go
type WalletRepository interface {
    Create(ctx context.Context, wallet *models.Wallet) error
    GetByID(ctx context.Context, id int32) (*models.Wallet, error)
    ListByUserID(ctx context.Context, userID int32, pagination *types.Pagination) ([]*models.Wallet, error)
    Update(ctx context.Context, wallet *models.Wallet) error
    Delete(ctx context.Context, id int32) error
}
```

### Service Layer Pattern

**Business logic** lives in services:

Example from [service/wallet_service.go](src/go-backend/domain/service/wallet_service.go):

```go
func (s *walletService) CreateWallet(ctx context.Context, userID int32, req *walletv1.CreateWalletRequest) (*walletv1.CreateWalletResponse, error) {
    // 1. Validate inputs
    if err := validator.ID(userID); err != nil {
        return nil, err
    }

    // 2. Verify dependencies exist
    user, err := s.userRepo.GetByID(ctx, userID)
    if user == nil {
        return nil, apperrors.NewNotFoundError("user")
    }

    // 3. Business logic
    wallet := &models.Wallet{
        UserID:     userID,
        WalletName: req.WalletName,
        Balance:    initialBalance,
        Currency:   currency,
        Type:       req.Type,
    }

    // 4. Persist
    if err := s.walletRepo.Create(ctx, wallet); err != nil {
        return nil, err
    }

    // 5. Return response
    return &walletv1.CreateWalletResponse{...}, nil
}
```

### Database Models (GORM)

**Models** in [models/](src/go-backend/domain/models/):

Example from [models/wallet.go](src/go-backend/domain/models/wallet.go):

```go
type Wallet struct {
    ID         int32          `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID     int32          `gorm:"not null;index" json:"userId"`
    WalletName string         `gorm:"size:50" json:"walletName"`
    Balance    int64          `gorm:"type:bigint;default:0;not null" json:"balance"`
    Currency   string         `gorm:"size:3;default:'USD';not null" json:"currency"`
    CreatedAt  time.Time      `json:"createdAt"`
    UpdatedAt  time.Time      `json:"updatedAt"`
    DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`  // Soft delete
    User       *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
    Type       v1.WalletType  `gorm:"type:int;default:0;not null" json:"type"`
}

func (Wallet) TableName() string {
    return "wallet"
}
```

**Patterns:**

- Use `int64` for monetary values
- Soft deletes with `gorm.DeletedAt`
- Foreign key relationships
- JSON tags for API serialization
- GORM tags for database constraints

## Business Domains

### Wallet Management

- **Models**: [Wallet](src/go-backend/domain/models/wallet.go)
- **Service**: [WalletService](src/go-backend/domain/service/wallet_service.go)
- **Repository**: [WalletRepository](src/go-backend/domain/repository/wallet_repository.go)
- **API**: [wallet.proto](api/protobuf/v1/wallet.proto)

**Features:**

- Multiple wallets per user (BASIC, INVESTMENT types)
- Balance tracking with multi-currency support
- Money transfers between wallets
- Transaction history per wallet
- Wallet analytics and summaries

### Transaction Management

- **Models**: [Transaction](src/go-backend/domain/models/transaction.go), [Category](src/go-backend/domain/models/category.go)
- **Service**: [TransactionService](src/go-backend/domain/service/transaction_service.go), [CategoryService](src/go-backend/domain/service/category_service.go)
- **Repository**: [TransactionRepository](src/go-backend/domain/repository/transaction_repository.go), [CategoryRepository](src/go-backend/domain/repository/category_repository.go)
- **API**: [transaction.proto](api/protobuf/v1/transaction.proto) (includes category management)

**Features:**

- Income vs expense categorization
- Custom categories per user
- Default categories for new users
- Transaction history with filtering and search
- CSV export functionality
- Bank statement import

**Note:** Category functionality is integrated into `transaction.proto`, not a separate `category.proto` file.

### Authentication

- **Models**: [User](src/go-backend/domain/models/user.go), [Session](src/go-backend/domain/models/session.go)
- **Service**: [AuthService](src/go-backend/domain/auth/auth.go)
- **Handlers**: [auth.go](src/go-backend/handlers/auth.go)
- **API**: [auth.proto](api/protobuf/v1/auth.proto), [session.proto](api/protobuf/v1/session.proto)

**Features:**

- Google OAuth integration
- JWT tokens with Redis whitelist
- Session management with device tracking
- Active session listing and revocation

### Investment Portfolio Management

- **Models**: [Investment](src/go-backend/domain/models/investment.go), [InvestmentTransaction](src/go-backend/domain/models/investment_transaction.go), [InvestmentLot](src/go-backend/domain/models/investment_lot.go), [MarketData](src/go-backend/domain/models/market_data.go), [PortfolioHistory](src/go-backend/domain/models/portfolio_history.go)
- **Service**: [InvestmentService](src/go-backend/domain/service/investment_service.go), [PortfolioHistoryService](src/go-backend/domain/service/portfolio_history_service.go)
- **Repository**: [InvestmentRepository](src/go-backend/domain/repository/investment_repository.go), [InvestmentTransactionRepository](src/go-backend/domain/repository/investment_transaction_repository.go), [InvestmentLotRepository](src/go-backend/domain/repository/investment_lot_repository.go), [MarketDataRepository](src/go-backend/domain/repository/market_data_repository.go)
- **API**: [investment.proto](api/protobuf/v1/investment.proto)
- **Frontend**: [Portfolio Page](src/wj-client/app/dashboard/portfolio/page.tsx)

**Features:**

- Portfolio tracking across investment wallets (INVESTMENT wallet type)
- Support for stocks, crypto, ETFs, gold, silver, and other asset types
- **Custom investments for non-market assets** (see [custom-investments.md](docs/features/custom-investments.md))
- FIFO (First-In, First-Out) cost basis accounting
- Realized and unrealized PNL tracking
- Transaction history (buy, sell, dividend)
- Market price updates and caching
- **Manual price override for custom investments**
- Performance analytics and portfolio summary
- Portfolio history tracking for performance charts

**Models:**

- **Investment**: Individual holdings (symbol, name, type, exchange, quantity, average price)
- **InvestmentTransaction**: Transaction records (buy/sell/dividend with quantity, price, date)
- **InvestmentLot**: FIFO cost basis tracking (purchase price, remaining quantity, cost basis)
- **MarketData**: Cached price data for PNL calculations
- **PortfolioHistory**: Historical portfolio values for performance tracking

**API Endpoints:**

- `POST /api/v1/investments` - Create new investment (supports `isCustom: true` for custom assets)
- `PUT /api/v1/investments/{id}` - Update investment (supports manual price updates via `currentPrice` field)
- `GET /api/v1/wallets/{walletId}/investments` - List investments for wallet
- `POST /api/v1/investments/{investmentId}/transactions` - Add transaction (buy/sell/dividend)
- `GET /api/v1/investments/{investmentId}/transactions` - Get transaction history
- `GET /api/v1/wallets/{walletId}/portfolio-summary` - Portfolio analytics
- `PUT /api/v1/investments/market-price` - Update market price
- `GET /api/v1/investments/symbols/search` - Search for investment symbols (with autocomplete support)

**Investment Detail Modal Tabs:**

The `InvestmentDetailModal` component provides a comprehensive view with multiple tabs:
- **Overview** - Summary of holdings, PNL, allocation
- **Transactions** - Transaction history with filtering
- **Add Transaction** - Form to add buy/sell/dividend transactions
- **Set Price** - Form to manually update current price (via `UpdateInvestmentPriceForm`)

**FIFO Cost Basis Example:**

```
Buy 100 VCB @ 85,000 = 8,500,000 total cost
Sell 30 VCB @ 90,000 = 2,700,000 proceeds
Cost basis for sale: 30 * 85,000 = 2,550,000
Realized PNL: 2,700,000 - 2,550,000 = 150,000

Remaining: 70 shares @ 85,000 avg = 5,950,000 cost basis
```


### Market Data & Yahoo Finance Integration

- **Models**: [MarketData](src/go-backend/domain/models/market_data.go)
- **Service**: [MarketDataService](src/go-backend/domain/service/market_data_service.go)
- **Yahoo Client**: [pkg/yahoo/client.go](src/go-backend/pkg/yahoo/client.go)
- **Yahoo Search**: [pkg/yahoo/search.go](src/go-backend/pkg/yahoo/search.go)
- **Yahoo Quote**: [pkg/yahoo/quote.go](src/go-backend/pkg/yahoo/quote.go)
- **Throttler**: [pkg/yahoo/throttler.go](src/go-backend/pkg/yahoo/throttler.go)
- **API**: Uses [github.com/oscarli916/yahoo-finance-api](https://pkg.go.dev/github.com/oscarli916/yahoo-finance-api)

**Features:**

- Real-time market price data from Yahoo Finance API
- Symbol search with configurable parameters for autocomplete
- Automatic caching with 15-minute TTL (configurable)
- Rate limiting (120 requests/minute)
- Graceful fallback to stale cache on API failure
- Support for stocks, ETFs, crypto, and more
- Multi-currency support with validation

**API Integration:**

- **Client**: Encapsulates Yahoo Finance API calls
- **Throttler**: Prevents rate limit violations
- **Service Layer**: Manages caching and fallback logic
- **Configuration**: Environment-based feature flags

**Configuration:**

| Environment Variable             | Default | Description                      |
| -------------------------------- | ------- | -------------------------------- |
| `YAHOO_FINANCE_ENABLED`          | `true`  | Enable/disable Yahoo Finance API |
| `YAHOO_FINANCE_TIMEOUT`          | `10s`   | API request timeout              |
| `YAHOO_FINANCE_MAX_RETRIES`      | `3`     | Maximum retry attempts           |
| `YAHOO_FINANCE_CACHE_MAX_AGE`    | `15m`   | Cache TTL                        |
| `YAHOO_FINANCE_REQUESTS_PER_MIN` | `120`   | Rate limit                       |

**Symbol Search Functionality:**

The Yahoo Finance integration includes symbol search with configurable `SearchParams`:

| Parameter                    | Type   | Default  | Description                         |
| ---------------------------- | ------ | -------- | ----------------------------------- |
| `Query`                      | string | required | Search query (symbol, company name) |
| `QuotesCount`                | int    | 10       | Number of quote results (max 20)    |
| `EnableFuzzyQuery`           | bool   | false    | Enable fuzzy matching               |
| `EnableEnhancedTrivialQuery` | bool   | true     | Better trivial query handling       |
| `EnableCccBoost`             | bool   | true     | Cryptocurrency search boost         |
| `EnablePrivateCompany`       | bool   | true     | Include private companies           |
| `Lang`                       | string | "en-US"  | Language code                       |

**Usage Example:**

```go
// Simple search
results, err := yahoo.SearchSymbols(ctx, "AAPL", 10)

// Custom search with parameters
params := yahoo.DefaultSearchParams("AAPL", 10)
params.EnableFuzzyQuery = true
params.Lang = "vi-VN"
results, err := yahoo.SearchSymbolsWithOptions(ctx, params)
```

**Frontend Autocomplete:**

The `SymbolAutocomplete` component provides a user-friendly search interface:

- Debounced search (300ms) to reduce API calls
- Minimum 2 characters before search triggers
- Custom result layout showing symbol, type, exchange, and company name
- Keyboard navigation (arrow keys, enter, escape, tab)
- 5-minute cache for search results
- Auto-fills investment name when symbol is selected

**Testing:**

- Unit tests: `go test -short ./pkg/yahoo/...`
- Integration tests: `go test -tags=integration ./domain/service/...`

### Asset Price Cache

- **Model**: [AssetPrice](src/go-backend/domain/models/asset_price.go) — `asset_price` table, composite unique index `(type_code, currency)`, `IsStale bool`, `FetchedAt time.Time`
- **Service**: [AssetPriceService](src/go-backend/domain/service/asset_price_service.go)
- **Repository**: [AssetPriceRepository](src/go-backend/domain/repository/asset_price_repository.go)
- **Scheduler**: `internal/scheduler/price_cache_job.go` — runs every 15 minutes (10s startup delay)
- **Handlers**: `GetMarketPrices` and `GetPublicMarketTypes` read from `asset_price` table (not live APIs)
- **Migration**: `task backend:migrate-asset-prices`

**Architecture pattern** — background-job-driven DB cache:
1. `PriceCacheJob` calls `AssetPriceService.RefreshAllPrices()` every 15 minutes
2. Service fetches from live price services (gold/silver/currency), upserts to DB
3. HTTP handlers read from DB — zero external API calls per HTTP request
4. On fetch failure: `MarkStaleByAssetType` sets `is_stale=true`; existing prices preserved
5. Frontend displays `"--"` when `buy/sell === 0` OR `isStale === true`

**Key behavior:**
- Each asset type (gold/silver/currency) fetched independently — one failure doesn't block others
- `GetPublicMarketTypes` falls back to static type registries on cold start (empty DB)
- `GetMarketPrices` returns empty arrays (not error) on cold start
- Admin price overrides applied at handler level, on top of DB data

### Gold Investment Management

- **Models**: [Investment](src/go-backend/domain/models/investment.go) (extended with gold types)
- **Gold Package**: [pkg/gold/](src/go-backend/pkg/gold/) - Gold conversion utilities
- **Service**: [GoldPriceService](src/go-backend/domain/service/gold_price_service.go)
- **Client**: [pkg/gold/client.go](src/go-backend/pkg/gold/client.go) - vang.today API client
- **Handlers**: [gold.go](src/go-backend/handlers/gold.go)
- **Frontend Utilities**: [gold-calculator.ts](src/wj-client/lib/utils/gold-calculator.ts)
- **Frontend Components**: [AddInvestmentForm.tsx](src/wj-client/components/modals/forms/AddInvestmentForm.tsx)

**Features:**

- Support for Vietnamese gold (VND) and World gold (USD/ounce)
- Automatic unit conversions (tael ↔ gram ↔ ounce)
- Currency conversion support via FX rates
- Price fetching from vang.today API
- Gold type registry (SJC variants, DOJI, XAU)
- Multi-currency wallet support

**Gold Types:**

| Type     | Value | Currency | Storage Unit | Market Price Unit | Description           |
| -------- | ----- | -------- | ------------ | ----------------- | --------------------- |
| GOLD_VND | 8     | VND      | gram         | tael              | Vietnamese gold (SJC) |
| GOLD_USD | 9     | USD      | ounce        | ounce             | World gold (XAU)      |

**Gold Type Options (Frontend):** SJC variants (`SJL1L10`, `SJL1C`, `SJR2`, etc.) for VND; `XAU` for USD. See `pkg/gold/` for full registry.

**Storage Format:**

- **VND Gold**: Stored in grams × 10000 (4 decimal precision)
  - Example: 75 grams = 750000 (75 × 10000)
- **USD Gold**: Stored in ounces × 10000
  - Example: 1 ounce = 10000

**Storage Format:** VND gold in grams × 10000; USD gold in ounces × 10000. VND market prices (per tael) are normalized via `goldConverter.ProcessMarketPrice()` before storage.

**API Endpoints:**

- `GET /api/v1/investments/gold-types` - List available gold types (filtered by currency)
- Gold investments use standard investment endpoints with type 8 or 9

**Utilities:** `@/lib/utils/gold-calculator` — `convertGoldQuantity()`, `calculateGoldFromUserInput()`. Display helpers in `@/app/[locale]/dashboard/portfolio/helpers`.

**Testing:**

- Unit tests: `go test -short ./pkg/gold/...`
- Integration tests: `go test -tags=integration ./domain/service/gold_investment_integration_test.go`
- Frontend tests: Jest tests in [gold-calculator.test.ts](src/wj-client/lib/utils/gold-calculator.test.ts)

### Silver Investment Management

- **Models**: [Investment](src/go-backend/domain/models/investment.go) (extended with silver types)
- **Silver Package**: [pkg/silver/](src/go-backend/pkg/silver/) - Silver conversion utilities
- **Service**: [SilverPriceService](src/go-backend/domain/service/silver_price_service.go)
- **Handlers**: [silver.go](src/go-backend/handlers/silver.go)
- **Frontend Utilities**: [silver-calculator.ts](src/wj-client/lib/utils/silver-calculator.ts)

**Features:**

- Similar to gold investment management
- Support for Vietnamese silver (VND) and World silver (USD/ounce)
- Automatic unit conversions
- Price fetching from silver price APIs
- Multi-currency wallet support

**Note:** Silver investment follows the same patterns as gold investment with similar storage formats and conversion logic.

### Bank Statement Import

- **Models**: [BankTemplate](src/go-backend/domain/models/bank_template.go), [ImportBatch](src/go-backend/domain/models/import_batch.go)
- **Service**: [ImportService](src/go-backend/domain/service/import_service.go)
- **Handlers**: [import.go](src/go-backend/handlers/import.go)
- **API**: [import.proto](api/protobuf/v1/import.proto)
- **Frontend**: [ImportTransactionsForm.tsx](src/wj-client/components/modals/forms/ImportTransactionsForm.tsx)
- **Settings**: [import-templates/page.tsx](src/wj-client/app/dashboard/settings/import-templates/page.tsx)

**Features:**

- Import transactions from bank CSV statements
- Custom bank template configuration
- Field mapping (date, amount, description, etc.)
- Transaction categorization during import
- Import history and batch tracking
- Template management in settings

**API Endpoints:**

- `POST /api/v1/import/upload` - Upload and parse CSV file
- `POST /api/v1/import/process` - Process imported transactions
- `GET /api/v1/import/templates` - List bank templates
- `POST /api/v1/import/templates` - Create bank template
- `PUT /api/v1/import/templates/{id}` - Update bank template

### User Price Alerts (NEW)

- **Model**: [user_price_alert.go](src/go-backend/domain/models/user_price_alert.go)
- **Service**: [user_price_alert_service.go](src/go-backend/domain/service/user_price_alert_service.go)
- **Handler**: [user_price_alert.go](src/go-backend/handlers/user_price_alert.go)
- **Scheduler**: `user_price_alert_job.go` — evaluates alerts on schedule
- **API**: `investment.proto` — `CreateUserPriceAlert`, `ListUserPriceAlerts`, `UpdateUserPriceAlert`, `DeleteUserPriceAlert`
- **Frontend**: `features/price-alert/` — `AlertStatusBadge`, `PriceAlertList`, `CreatePriceAlertForm` (3-step)
- **Settings page**: `/dashboard/settings/alerts`
- **Migration**: `task backend:migrate-user-price-alerts`

**AlertStatus enum:** `UNSPECIFIED`, `ACTIVE`, `TRIGGERED`, `PAUSED`

### Foreign Exchange (FX) Rates

- **Models**: [FXRate](src/go-backend/domain/models/fx_rate.go)
- **Service**: [FXRateService](src/go-backend/domain/service/fx_rate_service.go)
- **Repository**: [FXRateRepository](src/go-backend/domain/repository/fx_rate_repository.go)

**Features:**

- Multi-currency support across wallets and investments
- Automatic FX rate fetching and caching
- Historical FX rate tracking
- Currency conversion for cross-currency transactions and holdings

## Development Workflow

### Task Commands (Taskfile.yml)

```bash
# Development
task dev                # Start Docker + backend + frontend
task backend:dev        # Backend only (also: task dev:backend)
task frontend:dev       # Frontend only (also: task dev:frontend)

# Docker (Postgres + Redis)
task docker:up          # Start local Postgres + Redis containers
task docker:down        # Stop containers

# Protobuf generation
task proto:all          # Generate all (Go + TypeScript + API client)
task proto:build        # Generate Go code only
task proto:types        # Generate TypeScript types only
task proto:api          # Generate REST API client only

# Building
task build:all          # Build both
task backend:build      # Build Go backend
task frontend:build     # Build Next.js frontend

# Testing
task test:all           # Run all tests
task ci:backend         # Backend CI: lint + build + test
task ci:backend-lint    # Backend lint + build only (no DB needed)
task ci:frontend        # Frontend CI checks
task ci:frontend-e2e    # Playwright E2E tests

# Database migrations (run task --list | grep migrate for full list)
task backend:migrate-categories        # Create default categories for users
task backend:migrate-investments       # Create investment tables
task backend:migrate-sessions          # Create session tables
task backend:migrate-import            # Create import tables
task backend:migrate-fx                # Create FX rate tables
task backend:migrate-portfolio-history # Create portfolio history tables
task backend:migrate-user-price-alerts # Create user_price_alert table (NEW)
task backend:migrate-asset-prices      # Create asset_price cache table
```

### Adding a New Feature

**Step 1: Define API in Protobuf**
Edit appropriate `.proto` file in [api/protobuf/v1/](api/protobuf/v1/):

```protobuf
service WalletService {
  rpc MyNewFeature(MyNewFeatureRequest) returns (MyNewFeatureResponse) {
    option (google.api.http) = {
      post: "/api/v1/wallets/my-feature"
      body: "*"
    };
  }
}
```

**Step 2: Generate Code**

```bash
task proto:all
```

**Step 3: Implement Backend**

1. Add method to service interface in [service/interfaces.go](src/go-backend/domain/service/interfaces.go)
2. Implement in service layer (e.g., [service/wallet_service.go](src/go-backend/domain/service/wallet_service.go))
3. Add REST handler in [handlers/](src/go-backend/handlers/)
4. Wire handler in [handlers/builder.go](src/go-backend/handlers/builder.go) → `AllHandlers` struct + `NewHandlers()`
5. Register routes in [handlers/routes.go](src/go-backend/handlers/routes.go)

**Step 4: Use in Frontend**
Auto-generated hooks are available. Place feature-specific code in the appropriate `features/<domain>/` module:

```typescript
import { useMutationMyNewFeature } from "@/utils/generated/hooks";

const mutation = useMutationMyNewFeature({
  onSuccess: () => {
    // Handle success
  },
});

mutation.mutate({
  /* request data */
});
```

### Common Patterns

**Error Handling:**

```typescript
// Frontend
onError: (error: any) => {
  setError(error.message || "User-friendly error message");
}

// Backend
if err != nil {
    return nil, apperrors.NewValidationError("invalid input")
}
```

**Loading States:**

```typescript
<Button
  type={ButtonType.PRIMARY}
  onClick={handleSubmit}
  loading={mutation.isPending}
>
  Save
</Button>
```

**Modal Flow:**

```typescript
// Open modal - Set state
const [modalType, setModalType] = useState<string | null>(null);
const handleOpenModal = (type: string) => setModalType(type);

// Close modal - Clear state
const handleCloseModal = () => setModalType(null);

// Handle success - Refresh data and close
const handleSuccess = () => {
  queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
  handleCloseModal();
};
```

## Important Conventions

### Code Style

- **TypeScript**: Strict mode, proper typing (no `any` unless absolutely necessary)
- **Go**: Standard gofmt, error handling first
- **Components**: Functional, hooks-based
- **File organization**: Co-locate related files (component + types + hooks)

### Data Integrity

- **Money**: Always use `int64` for amounts, never float
- **Currency**: Use ISO 4217 codes
- **Dates**: Unix timestamps in API, format for display
- **Deletes**: Soft deletes with `gorm.DeletedAt`

### Security

- **Authentication**: JWT stored in localStorage, included in all API calls
- **Authorization**: Verify user owns resource before operations
- **Input validation**: Server-side validation required (Zod schemas on frontend)
- **SQL injection**: Use GORM parameterized queries

### Performance

- **Caching**: Redis for JWT tokens, market data, gold/silver prices
- **Lazy loading**: Use React Query's caching
- **Pagination**: Default page size 10-50
- **N+1 queries**: Use GORM `Preload` for relationships

## Environment Setup

**Required:**

- Go 1.25+
- Node.js 20+
- PostgreSQL 16+ (or Supabase account)
- Redis 7+
- Buf (Protobuf tool)
- Docker (for local Postgres + Redis via `task docker:up`)

**Setup:**

```bash
# Install dependencies
task setup

# Copy environment files
cp .env.example .env.local

# Run database migrations
# See available migrations: task --list | grep migrate

# Start services
task dev
```

## Key Files Reference

### Protobuf API Definitions

| File                                                                   | Purpose                                 |
| ---------------------------------------------------------------------- | --------------------------------------- |
| [api/protobuf/v1/common.proto](api/protobuf/v1/common.proto)           | Shared types (Money, Pagination)        |
| [api/protobuf/v1/auth.proto](api/protobuf/v1/auth.proto)               | Authentication API                      |
| [api/protobuf/v1/user.proto](api/protobuf/v1/user.proto)               | User management API                     |
| [api/protobuf/v1/wallet.proto](api/protobuf/v1/wallet.proto)           | Wallet API                              |
| [api/protobuf/v1/transaction.proto](api/protobuf/v1/transaction.proto) | Transaction & category API              |
| [api/protobuf/v1/budget.proto](api/protobuf/v1/budget.proto)           | Budget API                              |
| [api/protobuf/v1/investment.proto](api/protobuf/v1/investment.proto)   | Investment portfolio API                |
| [api/protobuf/v1/session.proto](api/protobuf/v1/session.proto)         | Session management API                  |
| [api/protobuf/v1/import.proto](api/protobuf/v1/import.proto)           | Bank statement import API               |
| [api/protobuf/v1/admin.proto](api/protobuf/v1/admin.proto)             | Admin operations API                    |
| [api/protobuf/v1/community.proto](api/protobuf/v1/community.proto)     | Community features API                  |
| [api/protobuf/v1/feedback.proto](api/protobuf/v1/feedback.proto)       | Feedback API                            |
| [api/protobuf/v1/watchlist.proto](api/protobuf/v1/watchlist.proto)     | Watchlist API                           |
| [api/protobuf/v1/gold_sentiment.proto](api/protobuf/v1/gold_sentiment.proto) | Gold sentiment voting API          |

**Notes:**
- Category management is integrated into `transaction.proto`, not a separate file
- Price alert RPCs (`CreateUserPriceAlert` etc.) are in `investment.proto`

### Frontend (wj-client)

**Shared components & infrastructure:**

| File | Purpose |
|------|---------|
| [src/wj-client/app/constants.tsx](src/wj-client/app/constants.tsx) | App constants (ModalType, ButtonType) |
| [src/wj-client/utils/generated/hooks.ts](src/wj-client/utils/generated/hooks.ts) | Auto-generated React Query hooks |
| [src/wj-client/tailwind.config.ts](src/wj-client/tailwind.config.ts) | Tailwind theme configuration |
| [src/wj-client/contexts/CurrencyContext.tsx](src/wj-client/contexts/CurrencyContext.tsx) | Currency context provider |
| [src/wj-client/contexts/NotificationContext.tsx](src/wj-client/contexts/NotificationContext.tsx) | Notification context provider |
| [src/wj-client/components/modals/BaseModal.tsx](src/wj-client/components/modals/BaseModal.tsx) | Modal container |
| [src/wj-client/components/forms/](src/wj-client/components/forms/) | Shared form components (FormInput, FormSelect, etc.) |
| [src/wj-client/components/table/](src/wj-client/components/table/) | Table components (MobileTable, etc.) |
| [src/wj-client/components/charts/](src/wj-client/components/charts/) | Chart components |
| [src/wj-client/components/select/](src/wj-client/components/select/) | Select components |
| [src/wj-client/components/pwa/](src/wj-client/components/pwa/) | PWA components |

**Feature modules:**

| Feature | Location | Key Contents |
|---------|----------|-------------|
| Auth | `features/auth/` | hooks/, store/ (Redux auth state) |
| Wallet | `features/wallet/` | CreateWalletForm, EditWalletForm, wallet utils |
| Transaction | `features/transaction/` | AddTransactionForm, EditTransactionForm, filters |
| Budget | `features/budget/` | Budget forms, utils |
| Investment | `features/investment/` | AddInvestmentForm, InvestmentDetailModal, portfolio helpers, gold/silver calculators |
| Import | `features/import/` | Import wizard components, template management |
| Market Prices | `features/market-prices/` | Price display tables, symbol lookup |
| Price Alerts | `features/price-alert/` | AlertStatusBadge, PriceAlertList, CreatePriceAlertForm (NEW) |
| Settings | `features/settings/` | Settings page components |
| Watchlist | `features/watchlist/` | Symbol watchlist |
| Community | `features/community/` | Posts, comments, likes, follows |
| Admin | `features/admin/` | Admin panel |
| Feedback | `features/feedback/` | Feedback forms |
| Report | `features/report/` | Financial tables, CSV/PDF export utils |

### Backend (go-backend)

| File | Purpose |
|------|---------|
| [src/go-backend/internal/app/app.go](src/go-backend/internal/app/app.go) | Application lifecycle & init |
| [src/go-backend/internal/app/providers.go](src/go-backend/internal/app/providers.go) | Manual DI provider functions |
| [src/go-backend/internal/scheduler/scheduler.go](src/go-backend/internal/scheduler/scheduler.go) | Background job scheduler |
| [src/go-backend/cmd/main.go](src/go-backend/cmd/main.go) | Server entrypoint |
| [src/go-backend/handlers/builder.go](src/go-backend/handlers/builder.go) | Handler DI builder |
| [src/go-backend/handlers/routes.go](src/go-backend/handlers/routes.go) | REST API routes |
| [src/go-backend/domain/service/wallet_service.go](src/go-backend/domain/service/wallet_service.go) | Wallet business logic |
| [src/go-backend/domain/service/investment_service.go](src/go-backend/domain/service/investment_service.go) | Investment business logic |
| [src/go-backend/domain/service/market_data_service.go](src/go-backend/domain/service/market_data_service.go) | Market data & Yahoo Finance |
| [src/go-backend/domain/service/asset_price_service.go](src/go-backend/domain/service/asset_price_service.go) | Asset price cache service (DB-backed) |
| [src/go-backend/domain/repository/asset_price_repository.go](src/go-backend/domain/repository/asset_price_repository.go) | Asset price persistence (upsert, list, mark stale) |
| [src/go-backend/internal/scheduler/price_cache_job.go](src/go-backend/internal/scheduler/price_cache_job.go) | Background price cache refresh job (15m) |
| [src/go-backend/domain/service/gold_price_service.go](src/go-backend/domain/service/gold_price_service.go) | Gold price service |
| [src/go-backend/domain/service/silver_price_service.go](src/go-backend/domain/service/silver_price_service.go) | Silver price service |
| [src/go-backend/domain/service/fx_rate_service.go](src/go-backend/domain/service/fx_rate_service.go) | FX rate service |
| [src/go-backend/domain/service/import_service.go](src/go-backend/domain/service/import_service.go) | Bank statement import |
| [src/go-backend/domain/gateway/server.go](src/go-backend/domain/gateway/server.go) | gRPC-Gateway proxy |
| [src/go-backend/pkg/yahoo/](src/go-backend/pkg/yahoo/) | Yahoo Finance client (client, search, quote, throttler) |
| [src/go-backend/pkg/gold/](src/go-backend/pkg/gold/) | Gold types, converter, vang.today client |
| [src/go-backend/pkg/silver/](src/go-backend/pkg/silver/) | Silver types & converter |
| [src/go-backend/pkg/cache/](src/go-backend/pkg/cache/) | Redis caching (gold prices, etc.) |

## Testing Strategy

**Running Tests:**

```bash
# Backend unit tests (fast, no external dependencies)
cd src/go-backend && go test -short ./...

# Backend integration tests (requires Docker: task docker:up first)
cd src/go-backend && go test -tags=integration ./domain/service/...

# All backend tests
cd src/go-backend && go test ./...

# Frontend unit tests (Jest)
cd src/wj-client && npm test
cd src/wj-client && npm run test:watch

# E2E tests (Playwright)
cd src/wj-client && npm run test:e2e
cd src/wj-client && npm run test:e2e:ui    # Interactive UI mode
cd src/wj-client && npm run test:e2e:debug # Debug mode

# Or via Task
task ci:backend         # lint + build + test
task ci:frontend-e2e    # Playwright E2E
```

**Build Tags:**

- `-short` — skip external API calls (unit tests only)
- `-tags=integration` — requires real Postgres + Redis (start with `task docker:up`)

**E2E Tests** live in `src/wj-client/tests/e2e/` — includes `price-alerts-settings-flow.spec.ts`

## Deployment

**Backend:**

- Railway deployment
- Environment variables configured in Railway dashboard

**Frontend:**

- Vercel deployment from `wj-client` directory
- Static asset optimization via Next.js
- PWA manifest and service worker

**Commands:**

```bash
task deploy:backend          # Deploy backend
task deploy:backend:preview  # Preview deployment
```

## File Organization Best Practices

### Where to Put New Code

| Code Type | Location | Example |
|-----------|----------|---------|
| **Feature-specific forms** | `features/<domain>/forms/` | `features/wallet/forms/CreateWalletForm.tsx` |
| **Feature-specific hooks** | `features/<domain>/hooks/` | `features/investment/hooks/usePortfolio.ts` |
| **Feature-specific utils** | `features/<domain>/utils/` | `features/transaction/utils/filters.ts` |
| **Feature validation schemas** | `features/<domain>/utils/` | `features/investment/utils/validation.ts` |
| **Shared UI components** | `components/<category>/` | `components/forms/FormInput.tsx` |
| **Page-specific components** | Co-locate in `app/<path>/` | `app/dashboard/home/AccountBalance.tsx` |
| **Shared hooks** | `hooks/` | `hooks/useMobile.ts` |
| **Shared utilities** | `lib/utils/` | `lib/utils/number-format.ts` |
| **React contexts** | `contexts/` | `contexts/CurrencyContext.tsx` |

### Import Path Conventions

**Use absolute imports with `@` alias:**

```typescript
// Feature modules
import { AddInvestmentForm } from "@/features/investment/forms/AddInvestmentForm";

// Shared components
import { Button } from "@/components/Button";
import { BaseModal } from "@/components/modals/BaseModal";

// Generated API hooks
import { useQueryListWallets } from "@/utils/generated/hooks";

// Constants
import { ModalType } from "@/app/constants";
```

**ESLint enforces migration from old paths** — importing from `@/components/modals/forms/`, `@/redux/`, or `@/lib/validation/` will trigger warnings pointing to the new `features/` locations.

## Validation

**Frontend validation** uses Zod schemas — now co-located with features in `features/<domain>/utils/`:

- Type-safe validation schemas
- Integration with React Hook Form
- Client-side validation before API calls

**Backend validation** uses custom validators and GORM constraints:

- Input validation in service layer
- Database constraints in models
- Error handling with typed errors (apperrors)

---

**Last Updated:** 2026-03-24
**Maintainer:** WealthJourney Team

---

This documentation is actively maintained. For full architecture details, see [docs/architecture/](docs/architecture/README.md). If you find discrepancies, verify the codebase implementation as the source of truth.
