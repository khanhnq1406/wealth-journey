# WealthJourney - Personal Financial Management

## Priority Rule #1

**Re-check the root cause first if the command run error. DON'T retry immediately. If retry error more than 5 times, ask first before continue retry.**

## Project Overview

WealthJourney is a comprehensive personal finance management application built with a modern microservices architecture. The system helps users track their financial life through wallet management, transaction tracking, categorization, investment portfolio, and analytics.

**Tech Stack:**

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 3.4, Redux Toolkit, React Query
- **Backend**: Go 1.23, Gin (HTTP), gRPC, GORM (PostgreSQL ORM)
- **Database**: PostgreSQL 16 (Supabase), Redis 7 (caching/sessions)
- **API Layer**: Protocol Buffers (single source of truth), REST + gRPC dual protocol support

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
│       └── import.proto               # Bank statement import
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
│   │   │       └── db_keepalive_job.go         # Connection keepalive (2m)
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
│   │   │   └── session.go            # Session management
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
│   │   │   ├── dashboard/             # Dashboard pages
│   │   │   │   ├── home/page.tsx      # Main dashboard
│   │   │   │   ├── transaction/page.tsx
│   │   │   │   ├── wallets/page.tsx
│   │   │   │   ├── portfolio/page.tsx # Investment portfolio
│   │   │   │   ├── budget/page.tsx
│   │   │   │   ├── report/page.tsx
│   │   │   │   ├── prices/page.tsx    # Market prices
│   │   │   │   └── settings/          # Settings pages
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

Since Next.js 15 uses App Router (server components by default), any component using:

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

**Custom theme** defined in [tailwind.config.ts](src/wj-client/tailwind.config.ts):

```typescript
colors: {
  bg: "#008148",      // Primary green (CTAs, headers)
  fg: "#F7F8FC",      // Light background
  hgreen: "var(--btn-green)",  // Button green hover
  lred: "#DC2626",    // Error/danger states (updated)
  hover: "#c5c5c9",   // Hover states
  modal: "rgba(0, 0, 0, 0.5)",  // Modal backdrop
},
dropShadow: {
  round: "0px 0px 3px rgb(0 0 0 / 0.4)",  // Card shadows
},
screens: {
  sm: '800px',  // Custom breakpoint
}
```

**Component styling patterns:**

- Use utility classes directly (no CSS modules)
- Responsive: mobile-first with `sm:` breakpoint at 800px
- Wrap cards in `<BaseCard>` for consistent styling
- Use `drop-shadow-round` for card shadows
- Dark mode support via `dark:` variants
- Safe area padding for mobile devices

**Example grid layout:**

```typescript
<div className="sm:grid grid-cols-[75%_25%] divide-x-2">
  {/* Main content 75%, Sidebar 25% on desktop */}
</div>
```

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

### Routing Structure (Next.js App Router)

**File-based routing** in [app/](src/wj-client/app/):

```
app/
├── page.tsx                           # Homepage (redirector)
├── landing/page.tsx                   # Landing page
├── auth/
│   ├── login/page.tsx                # /auth/login
│   └── register/page.tsx             # /auth/register
└── dashboard/
    ├── home/page.tsx                 # /dashboard/home (main dashboard)
    ├── transaction/page.tsx          # /dashboard/transaction
    ├── wallets/page.tsx              # /dashboard/wallets
    ├── portfolio/page.tsx            # /dashboard/portfolio
    ├── budget/page.tsx               # /dashboard/budget
    ├── report/page.tsx               # /dashboard/report
    ├── prices/page.tsx               # /dashboard/prices (market prices)
    └── settings/
        ├── sessions/page.tsx         # /dashboard/settings/sessions
        └── import-templates/page.tsx # /dashboard/settings/import-templates
```

**Route groups and layouts:**

- Use `(group)` folders for route organization without affecting URLs
- `layout.tsx` files for shared UI across routes

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

**Components:**

- **[PWAInstallPrompt.tsx](src/wj-client/components/pwa/PWAInstallPrompt.tsx)** - Main installation prompt modal
- **[InstallSteps.tsx](src/wj-client/components/pwa/InstallSteps.tsx)** - Platform-specific installation instructions
- **[usePWAInstall.ts](src/wj-client/hooks/usePWAInstall.ts)** - PWA detection and installation hook

**Features:**

- Automatic platform detection (iOS Safari, Android Chrome, Desktop browsers)
- One-tap installation for supported browsers (beforeinstallprompt API)
- Step-by-step manual installation guide for iOS Safari
- Smart visibility rules (only shows when installable, dismisses for 7 days)
- LocalStorage-based user preference persistence
- Highlights PWA benefits (offline access, home screen, native feel)

**Usage in Components:**

```typescript
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";

export default function DashboardLayout() {
  return (
    <>
      {/* Your dashboard content */}
      <PWAInstallPrompt />
    </>
  );
}
```

**Hook Usage:**

```typescript
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function CustomInstallButton() {
  const { isInstallable, isInstalled, isPWA, handleInstall } = usePWAInstall();

  if (isInstalled || !isInstallable) return null;

  return (
    <button onClick={handleInstall}>
      {isPWA ? "Install App" : "View Install Instructions"}
    </button>
  );
}
```

**Testing:**

- Desktop Chrome/Edge: Test beforeinstallprompt API flow
- iOS Safari: Test manual installation steps modal
- Installed PWA: Verify prompt doesn't show when already installed
- Dismiss behavior: Verify 7-day cooldown period

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

**Gold Type Options (Frontend):**

Vietnamese gold (VND):
- `SJL1L10` - SJC 1L-10L (Vàng miếng)
- `SJL1L2` - SJC 1L-2L (Vàng miếng)
- `SJL5C` - SJC 5 chỉ (Vàng miếng)
- `SJL1C` - SJC 1 chỉ (Vàng miếng)
- `SJL0_5C` - SJC 0.5 chỉ (Vàng miếng)
- `SJR2` - SJC Nhẫn 2-5 chỉ
- `SJR1` - SJC Nhẫn 1 chỉ
- `SJT99` - SJC Trang sức 99.99
- `SJT98` - SJC Trang sức 99.98
- `SJT97` - SJC Trang sức 99.97

World gold (USD):
- `XAU` - Gold World (XAU/USD)

**Storage Format:**

- **VND Gold**: Stored in grams × 10000 (4 decimal precision)
  - Example: 75 grams = 750000 (75 × 10000)
- **USD Gold**: Stored in ounces × 10000
  - Example: 1 ounce = 10000

**Unit Conversions:**

```typescript
// Convert between gold units
import { convertGoldQuantity } from "@/lib/utils/gold-calculator";

// Convert 2 taels to grams
const grams = convertGoldQuantity(2, "tael", "gram"); // 75

// Convert 1 ounce to grams
const grams = convertGoldQuantity(1, "oz", "gram"); // ~31.1035

// Convert price per tael to price per gram
const pricePerGram = convertGoldPricePerUnit(85000000, "tael", "gram"); // 2,266,667 VND
```

**Price Normalization:**

Market prices from vang.today API need normalization:
- VND gold prices are per tael, must convert to per gram for storage
- USD gold prices are already per ounce (no conversion needed)

```go
// Backend: Convert market price to storage format
normalizedPrice := s.goldConverter.ProcessMarketPrice(price.Buy, currency, investmentType)
```

**API Endpoints:**

- `GET /api/v1/investments/gold-types` - List available gold types (filtered by currency)
- Gold investments use standard investment endpoints with type 8 or 9

**Creating a Gold Investment:**

```typescript
// Frontend: Use gold calculator for conversions
import { calculateGoldFromUserInput } from "@/lib/utils/gold-calculator";

const result = calculateGoldFromUserInput({
  quantity: 2, // User input in taels
  quantityUnit: "tael",
  pricePerUnit: 85000000, // 85M VND per tael
  priceCurrency: "VND",
  priceUnit: "tael",
  investmentType: 8, // GOLD_VND
  walletCurrency: "VND",
  fxRate: 1, // No currency conversion needed
});

// result.storedQuantity: 750000 (75g × 10000)
// result.totalCostNative: 170000000 VND
```

**Frontend Display:**

```typescript
// Format gold quantity for display
import { formatGoldQuantity } from "@/app/dashboard/portfolio/helpers";

const display = formatGoldQuantity(
  750000,
  InvestmentType.INVESTMENT_TYPE_GOLD_VND,
);
// Returns: "2.0000 lượng" (2 taels with 4 decimals)

// Format gold price
import { formatGoldPrice } from "@/app/dashboard/portfolio/helpers";

const price = formatGoldPrice(
  85000000,
  "VND",
  undefined,
  InvestmentType.INVESTMENT_TYPE_GOLD_VND,
);
// Returns: "₫85,000,000/lượng"
```

**vang.today API Integration:**

- Base URL: `https://www.vang.today/api/prices`
- Returns: Gold type codes, buy/sell prices, change, update time
- Caching: 15-minute TTL in Redis
- Used by: `GoldPriceService` → `MarketDataService`

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
task dev                # Start both backend + frontend
task backend:dev        # Backend only (also: task dev:backend)
task frontend:dev       # Frontend only (also: task dev:frontend)

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

# Database migrations
task backend:migrate-categories        # Create default categories for users
task backend:migrate-investments       # Create investment tables
task backend:migrate-sessions          # Create session tables
task backend:migrate-import            # Create import tables
task backend:migrate-fx                # Create FX rate tables
task backend:migrate-portfolio-history # Create portfolio history tables
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

- Go 1.23+
- Node.js 20+
- PostgreSQL 16+ (or Supabase account)
- Redis 7+
- Buf (Protobuf tool)

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

**Note:** Category management is integrated into `transaction.proto`, not a separate file.

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

**Current State:** Limited test coverage

**Recommended:**

- **Backend**: Unit tests for services, integration tests for handlers
- **Frontend**: Component tests with React Testing Library
- **E2E**: Playwright or Cypress for critical user flows

**Running Tests:**

```bash
# Unit tests only (fast, no external dependencies)
go test -short ./...

# Integration tests (requires external services)
go test -tags=integration ./domain/service/...

# All tests
go test ./...

# Frontend tests
cd src/wj-client
npm test
```

**Build Tags:**

- Use `-short` flag for unit tests that skip external API calls
- Use `-tags=integration` for tests that require Yahoo Finance API or database
- Example: Market data integration tests require real Yahoo Finance API access

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

**Last Updated:** 2026-03-05
**Maintainer:** WealthJourney Team

---

This documentation is actively maintained. For full architecture details, see [docs/architecture/](docs/architecture/README.md). If you find discrepancies, verify the codebase implementation as the source of truth.
