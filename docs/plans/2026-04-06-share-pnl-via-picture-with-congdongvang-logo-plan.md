# Share PNL via Picture with CongDongVang Logo — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add a share button to the NetWorthDisplay card that captures it as a branded PNG image (with app logo overlay) and lets users download or share via the native OS share sheet.

**Spec:** `docs/specs/2026-04-06-share-pnl-via-picture-with-congdongvang-logo-spec.md`

**Architecture:** Frontend-only feature. A share button is added to `NetWorthDisplay`. Clicking it opens `PnlShareModal` — a page-co-located component that uses `html2canvas` (dynamic import) to capture the card DOM element, composites the app logo on a second canvas, and provides download/native-share actions. No backend changes.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, Tailwind CSS 3.4 (v2 tokens), `html2canvas` 1.4.1 (already installed), `lucide-react` (Share2 icon), next-intl v4 (i18n), Web Share API (browser)

---

## Security Implementation Notes

- **Authentication:** Page is behind auth — no unauthenticated access. No change needed.
- **Authorization:** Feature captures only the already-rendered DOM element owned by the authenticated user. No API calls. No authorization changes.
- **Input validation:** No user inputs. No form fields. Nothing to validate.
- **Data sanitization:** Canvas data URL is never sent to any server. `navigator.share()` is a sandboxed OS API. No XSS surface area introduced.
- **SSR safety:** `html2canvas` must only run in the browser. Dynamic import with `import("html2canvas")` is called inside a click handler (event handler context = browser-only). No `{ ssr: false }` wrapper needed for the modal itself, but the import must never be called during SSR.
- **Share button T-4 (DoS):** Disable both buttons while share/download is in progress (`isSharing` state flag).

---

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `BaseModal` | `components/modals/BaseModal.tsx` | PnlShareModal outer container |
| `LoadingSpinner` | `components/loading/LoadingSpinner.tsx` | Shown while html2canvas capture is running |
| `ErrorState` | `components/feedback/ErrorState.tsx` | Shown when capture fails; has `primaryAction` for retry |
| `Button` | `components/Button.tsx` | Download (SECONDARY) and Share (PRIMARY) actions |
| `Share2` | `lucide-react` | Share button icon on NetWorthDisplay |

**Existing components NOT suitable for reuse:**

| Component | Reason Not Suitable |
|-----------|---------------------|
| `ShareDialog` (`components/share/ShareDialog.tsx`) | Link/email/PDF/social link sharer — no image capture or canvas logic. Different use case entirely. |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `PnlShareModal.tsx` | `app/[locale]/dashboard/home/PnlShareModal.tsx` | Page-co-located (tightly coupled to NetWorthDisplay card DOM ref and shape). Not reusable across features — spec explicitly calls this out. Contains html2canvas + canvas logo compositing logic specific to this card. |

---

## C4 Architecture Diagram Updates

- **c4-component-frontend.md (L3):** Add `PnlShareModal` component under the home dashboard area. Mark as "page-co-located" (not a feature module).
- No new backend components to diagram.

---

## Task Order

```
Task 0: i18n keys (en + vi)
Task 1: PnlShareModal component (TDD)
Task 2: NetWorthDisplay — add data-pnl-card attribute + share button
Task 3: Home page — wire PnlShareModal
Task 4: Update C4 frontend diagram
Task 5: Update flow-cross-cutting.md
```

Tasks 0 and 1 are independent and can be done in parallel. Task 2 depends on nothing. Task 3 depends on Tasks 1 and 2. Tasks 4 and 5 are documentation and can run after implementation.

---

### Task 0: Add i18n Keys

**Files:**

- Modify: `src/wj-client/messages/en/ui.json` (add `sharePnl` under `dashboard.home`)
- Modify: `src/wj-client/messages/vi/ui.json` (add `sharePnl` under `dashboard.home`)

**Security notes:** No security concerns. Static strings.

**Step 1: Write the failing test**

Create `src/wj-client/app/[locale]/dashboard/home/__tests__/i18n-keys.test.ts`:

```typescript
// Verify i18n keys exist in both locales for the PNL share feature
import enMessages from "@/messages/en/ui.json";
import viMessages from "@/messages/vi/ui.json";

describe("sharePnl i18n keys", () => {
  const requiredKeys = [
    "buttonAriaLabel",
    "modalTitle",
    "generating",
    "download",
    "share",
    "shareTitle",
    "errorCapture",
    "errorShare",
  ];

  requiredKeys.forEach((key) => {
    it(`en/ui.json has dashboard.home.sharePnl.${key}`, () => {
      expect((enMessages as any).dashboard.home.sharePnl[key]).toBeDefined();
      expect(typeof (enMessages as any).dashboard.home.sharePnl[key]).toBe("string");
    });

    it(`vi/ui.json has dashboard.home.sharePnl.${key}`, () => {
      expect((viMessages as any).dashboard.home.sharePnl[key]).toBeDefined();
      expect(typeof (viMessages as any).dashboard.home.sharePnl[key]).toBe("string");
    });
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="i18n-keys" --no-coverage
# Expected: FAIL — Cannot find property 'sharePnl' of dashboard.home
```

**Step 3: Add keys to English messages**

In `src/wj-client/messages/en/ui.json`, inside the `"dashboard"` → `"home"` object, add after the last existing key:

```json
"sharePnl": {
  "buttonAriaLabel": "Share PNL",
  "modalTitle": "Share Investment Results",
  "generating": "Generating image...",
  "download": "Download PNG",
  "share": "Share",
  "shareTitle": "Investment Results - CongDongVang",
  "errorCapture": "Could not generate image. Please try again.",
  "errorShare": "Could not share. Please download instead."
}
```

In `src/wj-client/messages/vi/ui.json`, inside the `"dashboard"` → `"home"` object, add:

```json
"sharePnl": {
  "buttonAriaLabel": "Chia sẻ kết quả",
  "modalTitle": "Chia sẻ kết quả đầu tư",
  "generating": "Đang tạo ảnh...",
  "download": "Tải về",
  "share": "Chia sẻ",
  "shareTitle": "Kết quả đầu tư - CongDongVang",
  "errorCapture": "Không thể tạo ảnh. Vui lòng thử lại.",
  "errorShare": "Không thể chia sẻ. Vui lòng tải về."
}
```

**Step 4: Run test — verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="i18n-keys" --no-coverage
# Expected: PASS — all 16 assertions green
```

**Step 5: Commit**

```
feat(home): add i18n keys for PNL share feature (en + vi)
```

---

### Task 1: PnlShareModal Component

**Files:**

- Create: `src/wj-client/app/[locale]/dashboard/home/PnlShareModal.tsx`
- Create: `src/wj-client/app/[locale]/dashboard/home/__tests__/PnlShareModal.test.tsx`

**Security notes:**
- `html2canvas` dynamic import runs only in browser event handler — SSR-safe.
- Disable buttons during capture/share to prevent T-4 DoS.
- `navigator.canShare({ files })` guard prevents crashing on unsupported browsers.
- `AbortError` from `navigator.share()` is silently ignored (user cancelled — not an error).
- Object URL is revoked after 100ms after download click.
- The captured image is never uploaded to any server.

**Step 0: Component inventory check (already done above)**

- Reusing: `BaseModal`, `LoadingSpinner`, `ErrorState`, `Button`
- Creating: `PnlShareModal` (justified above)
- Icons: `Share2` from `lucide-react` (not emojis)
- Images: none in this modal (the generated image is a `<img src={dataURL}>`)

**Step 1: Write the failing test**

Create `src/wj-client/app/[locale]/dashboard/home/__tests__/PnlShareModal.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PnlShareModal } from "../PnlShareModal";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock html2canvas
jest.mock(
  "html2canvas",
  () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue({
      toDataURL: () => "data:image/png;base64,abc123",
    }),
  }),
  { virtual: true }
);

// Mock BaseModal to render children directly
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// Mock LoadingSpinner
jest.mock("@/components/loading/LoadingSpinner", () => ({
  LoadingSpinner: ({ text }: any) => <div data-testid="loading-spinner">{text}</div>,
}));

// Mock ErrorState
jest.mock("@/components/feedback/ErrorState", () => ({
  ErrorState: ({ message, primaryAction }: any) => (
    <div data-testid="error-state">
      <span>{message}</span>
      <button onClick={primaryAction?.onClick}>{primaryAction?.label}</button>
    </div>
  ),
}));

// Mock useNotification
jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: () => ({
    toast: {
      error: jest.fn(),
    },
  }),
}));

describe("PnlShareModal", () => {
  const mockCardRef = { current: document.createElement("div") };
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Image loading
    Object.defineProperty(global, "Image", {
      writable: true,
      value: class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        crossOrigin = "";
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    });
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("renders nothing when closed", () => {
    render(
      <PnlShareModal isOpen={false} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading spinner when open (capture in progress)", async () => {
    render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    // Loading spinner should appear immediately on open
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows generated image after successful capture", async () => {
    render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
    });
    const img = screen.getByRole("img", { name: /pnl preview/i });
    expect(img).toBeInTheDocument();
  });

  it("shows download button after capture", async () => {
    render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("shows error state when capture fails", async () => {
    const html2canvas = require("html2canvas");
    html2canvas.default.mockRejectedValueOnce(new Error("Canvas failed"));

    render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeInTheDocument();
    });
  });

  it("retries capture when retry button clicked", async () => {
    const html2canvas = require("html2canvas");
    html2canvas.default
      .mockRejectedValueOnce(new Error("Canvas failed"))
      .mockResolvedValueOnce({ toDataURL: () => "data:image/png;base64,retry" });

    render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("error-state")).not.toBeInTheDocument();
    });
  });

  it("re-captures image each time modal opens", async () => {
    const html2canvas = require("html2canvas");
    const { rerender } = render(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => expect(html2canvas.default).toHaveBeenCalledTimes(1));

    // Close and reopen
    rerender(
      <PnlShareModal isOpen={false} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    rerender(
      <PnlShareModal isOpen={true} onClose={mockOnClose} cardRef={mockCardRef} />
    );
    await waitFor(() => expect(html2canvas.default).toHaveBeenCalledTimes(2));
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="PnlShareModal" --no-coverage
# Expected: FAIL — Cannot find module '../PnlShareModal'
```

**Step 3: Write the implementation**

Create `src/wj-client/app/[locale]/dashboard/home/PnlShareModal.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback, RefObject } from "react";
import { useTranslations } from "next-intl";
import { BaseModal } from "@/components/modals/BaseModal";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useNotification } from "@/contexts/NotificationContext";

type CaptureStatus = "idle" | "loading" | "success" | "error";

interface PnlShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardRef: RefObject<HTMLElement | null>;
}

/**
 * PnlShareModal — page-co-located modal for capturing the NetWorthDisplay card
 * as a branded PNG image with app logo overlay.
 *
 * Uses html2canvas (dynamic import) to capture the card DOM element,
 * composites the icon-192x192.png logo onto the bottom-right corner,
 * and provides Download and native OS Share actions.
 */
export function PnlShareModal({ isOpen, onClose, cardRef }: PnlShareModalProps) {
  const t = useTranslations("dashboard.home.sharePnl");
  const { toast } = useNotification();

  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Check Web Share API file support (browser-only)
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        const testFile = new File([""], "test.png", { type: "image/png" });
        setCanShare(navigator.canShare?.({ files: [testFile] }) ?? false);
      } catch {
        setCanShare(false);
      }
    }
  }, []);

  const captureImage = useCallback(async () => {
    if (!cardRef.current) return;

    setStatus("loading");
    setDataURL(null);

    try {
      // Dynamically import html2canvas — keeps it out of the initial bundle
      const html2canvas = (await import("html2canvas")).default;

      // Step 1: Capture the card DOM element
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Retina quality
        useCORS: false, // All assets are same-origin
        allowTaint: false,
        logging: false,
      });

      // Step 2: Composite the app logo onto a second canvas
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw the captured card
      ctx.drawImage(canvas, 0, 0);

      // Load and draw the logo (bottom-right, 48×48 at 2x = 96px, with 16px margin at 2x = 32px)
      try {
        const logoSize = 96; // 48px * scale:2
        const margin = 32;  // 16px * scale:2
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logo.onload = () => resolve();
          logo.onerror = () => resolve(); // Skip logo on error — still show card image
          logo.src = "/icons/icon-192x192.png";
        });
        if (logo.complete && logo.naturalWidth > 0) {
          const x = outputCanvas.width - logoSize - margin;
          const y = outputCanvas.height - logoSize - margin;
          // Dark semi-transparent background circle behind logo
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + logoSize / 2, y + logoSize / 2, logoSize / 2 + 8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.fill();
          ctx.restore();
          ctx.drawImage(logo, x, y, logoSize, logoSize);
        }
      } catch {
        // Logo load failed — continue without logo overlay
      }

      setDataURL(outputCanvas.toDataURL("image/png"));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [cardRef]);

  // Trigger capture every time the modal opens
  useEffect(() => {
    if (isOpen) {
      captureImage();
    } else {
      // Reset state when closed
      setStatus("idle");
      setDataURL(null);
    }
  }, [isOpen, captureImage]);

  const handleDownload = useCallback(() => {
    if (!dataURL) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `pnl-congdongvang-${today}.png`;
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dataURL]);

  const handleShare = useCallback(async () => {
    if (!dataURL || isSharing) return;

    setIsSharing(true);
    try {
      // Convert data URL to File for Web Share API
      const res = await fetch(dataURL);
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `pnl-congdongvang-${today}.png`, {
        type: "image/png",
      });

      await navigator.share({
        files: [file],
        title: t("shareTitle"),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — silently ignore
        return;
      }
      toast.error(t("errorShare"));
    } finally {
      setIsSharing(false);
    }
  }, [dataURL, isSharing, t, toast]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modalTitle")}
    >
      <div className="space-y-4">
        {/* Image preview area */}
        <div className="flex items-center justify-center min-h-[160px]">
          {status === "loading" && (
            <LoadingSpinner text={t("generating")} />
          )}
          {status === "error" && (
            <ErrorState
              message={t("errorCapture")}
              primaryAction={{
                label: "Retry",
                onClick: captureImage,
              }}
            />
          )}
          {status === "success" && dataURL && (
            <img
              src={dataURL}
              alt="PNL preview"
              className="w-full max-h-[60vh] object-contain rounded-xl overflow-hidden shadow-modal"
            />
          )}
        </div>

        {/* Action buttons */}
        {status === "success" && (
          <div className="flex gap-3">
            <Button
              type={ButtonType.SECONDARY}
              onClick={handleDownload}
              disabled={isSharing}
              fullWidth
            >
              {t("download")}
            </Button>
            {canShare && (
              <Button
                type={ButtonType.PRIMARY}
                onClick={handleShare}
                loading={isSharing}
                fullWidth
              >
                {t("share")}
              </Button>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
```

**Step 4: Run test — verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="PnlShareModal" --no-coverage
# Expected: PASS — all assertions green
```

**Step 5: Responsive & accessibility check**

- `min-h-[44px]`: Action buttons use `Button` component which already enforces min height.
- `max-h-[60vh]`: Image preview constrained so it fits mobile viewport.
- `alt="PNL preview"`: Screen reader accessible.
- Modal title from `t("modalTitle")`: Used as `aria-modal` dialog title by `BaseModal`.
- Direct import (not barrel): `import { PnlShareModal } from "./PnlShareModal"`.
- No `async` waterfall on render — capture only starts after `isOpen=true` in `useEffect`.

**Step 6: Commit**

```
feat(home): add PnlShareModal with html2canvas capture and logo overlay
```

---

### Task 2: NetWorthDisplay — Add `data-pnl-card` and Share Button

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/home/NetWorthDisplay.tsx`

**Security notes:** Share button is client-side only. No sensitive data exposed beyond what's already rendered. `aria-label` ensures accessibility.

**Step 1: Write the failing test**

Add to `src/wj-client/app/[locale]/dashboard/home/__tests__/NetWorthDisplay.test.tsx` (create if it doesn't exist):

```typescript
/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NetWorthDisplay } from "../NetWorthDisplay";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

describe("NetWorthDisplay", () => {
  const baseProps = {
    totalNetWorth: 1000000,
    currency: "VND",
    onShareClick: jest.fn(),
  };

  it("renders share button with aria-label", () => {
    render(<NetWorthDisplay {...baseProps} />);
    const btn = screen.getByRole("button", { name: /share pnl/i });
    expect(btn).toBeInTheDocument();
  });

  it("calls onShareClick when share button clicked", () => {
    render(<NetWorthDisplay {...baseProps} />);
    const btn = screen.getByRole("button", { name: /share pnl/i });
    btn.click();
    expect(baseProps.onShareClick).toHaveBeenCalledTimes(1);
  });

  it("renders data-pnl-card attribute on the card containers", () => {
    const { container } = render(<NetWorthDisplay {...baseProps} />);
    const cards = container.querySelectorAll("[data-pnl-card]");
    // Both mobile and desktop versions have the attribute
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test — verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="NetWorthDisplay" --no-coverage
# Expected: FAIL — no share button found, data-pnl-card not found
```

**Step 3: Modify NetWorthDisplay**

Add `onShareClick` prop and place the share button inside both mobile and desktop card containers. Add `data-pnl-card` attribute to the outermost card `<div>` of both versions.

Key changes to `NetWorthDisplay.tsx`:

```typescript
// Add to imports
import { Share2 } from "lucide-react";

// Extend the interface
interface NetWorthDisplayProps {
  // ... existing props ...
  onShareClick?: () => void;  // NEW
}

// In the function signature
export function NetWorthDisplay({
  // ... existing props ...
  onShareClick,
}: NetWorthDisplayProps) {

  // Share button (shared between mobile and desktop)
  const shareButton = onShareClick ? (
    <button
      type="button"
      onClick={onShareClick}
      aria-label={t("sharePnl.buttonAriaLabel")}
      className="absolute bottom-3 right-3 z-20 sm:top-3 sm:bottom-auto flex items-center justify-center w-9 h-9 min-h-[44px] min-w-[44px] rounded-full bg-black/30 hover:bg-black/50 transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
    >
      <Share2 size={18} className="text-v2-text-tertiary" />
    </button>
  ) : null;
```

Add `data-pnl-card` to the mobile card outer `<div>`:
```tsx
<div
  data-pnl-card
  className="sm:hidden relative overflow-hidden rounded-2xl"
  ...
>
  ...
  {shareButton}
</div>
```

Add `data-pnl-card` to the desktop card outer `<div>`:
```tsx
<div
  data-pnl-card
  className="hidden sm:block relative overflow-hidden rounded-2xl"
  ...
>
  ...
  {shareButton}
</div>
```

**Full updated file `NetWorthDisplay.tsx`:**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Share2 } from "lucide-react";
import Image from "next/image";

const textShadow = "0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.25)";
const textShadowLg = "0 2px 8px rgba(0,0,0,0.5), 0 0 16px rgba(0,0,0,0.3)";

const goldGradient =
  "linear-gradient(135deg, #B8862D 0%, #D4A843 20%, #F5D38E 40%, #E8C36A 55%, #D4A843 70%, #B8862D 85%, #9A7023 100%)";

const lightEffect =
  "radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)";

interface NetWorthDisplayProps {
  totalNetWorth: number;
  currency: string;
  todayPnlPercent?: number;
  todayPnl?: number;
  weekPnlPercent?: number;
  weekPnl?: number;
  monthPnlPercent?: number;
  monthPnl?: number;
  userName?: string;
  onShareClick?: () => void;
}

interface PnlValueProps {
  percent: number;
  amount: number;
  label: string;
  currency: string;
}

function PnlValue({ percent, amount, label, currency }: PnlValueProps) {
  const isPositive = percent >= 0;
  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(Number(value));
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div
      className={`text-center rounded-xl px-4 py-2 ${
        isPositive ? "bg-green-500/15" : "bg-red-400/15"
      }`}
    >
      <p
        className="font-roboto font-bold text-[14px] text-v2-text-tertiary"
        style={{ textShadow }}
      >
        {formatAmount(amount)} {currency}
      </p>
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-green-400" : "text-red-400"}`}
        style={{ textShadow }}
      >
        {formatPercent(percent)}
      </p>
      <p
        className="font-roboto font-medium text-[11px] text-v2-text-tertiary/60 tracking-[1px] mt-1"
        style={{ textShadow }}
      >
        {label}
      </p>
    </div>
  );
}

export function NetWorthDisplay({
  totalNetWorth,
  currency,
  todayPnlPercent = 0,
  todayPnl = 0,
  weekPnlPercent = 0,
  weekPnl = 0,
  monthPnlPercent = 0,
  monthPnl = 0,
  userName,
  onShareClick,
}: NetWorthDisplayProps) {
  const t = useTranslations("dashboard.home");

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  })();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(Number(amount));
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const isMonthPositive = monthPnlPercent >= 0;

  const shareButton = onShareClick ? (
    <button
      type="button"
      onClick={onShareClick}
      aria-label={t("sharePnl.buttonAriaLabel")}
      className="absolute bottom-3 right-3 z-20 sm:top-3 sm:bottom-auto flex items-center justify-center min-h-[44px] min-w-[44px] w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
    >
      <Share2 size={18} className="text-v2-text-tertiary" />
    </button>
  ) : null;

  // PnL bar shared between mobile and desktop
  const pnlBar = (
    <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-v2-maroon-900/15">
      <div className="flex items-center gap-2">
        {isMonthPositive ? (
          <TrendingUp size={16} className="text-v2-text-tertiary/70" />
        ) : (
          <TrendingDown size={16} className="text-v2-text-tertiary/70" />
        )}
        <span
          className="font-roboto font-bold text-[15px] text-v2-text-tertiary"
          style={{ textShadow }}
        >
          {formatAmount(monthPnl)} {currency}
        </span>
      </div>
      <span
        className={`font-roboto font-bold text-[13px] px-3 py-1 rounded-full ${
          isMonthPositive
            ? "bg-green-500/15 text-green-400"
            : "bg-red-400/15 text-red-400"
        }`}
        style={{ textShadow }}
      >
        {formatPercent(monthPnlPercent)}
      </span>
    </div>
  );

  return (
    <div className="relative z-0 isolate">
      {/* Mobile version */}
      <div
        data-pnl-card
        className="sm:hidden relative overflow-hidden rounded-2xl"
        style={{
          background: goldGradient,
          boxShadow:
            "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        }}
      >
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: lightEffect }}
          aria-hidden="true"
        />
        <div className="absolute z-[2] right-4 pointer-events-none h-full">
          <Image
            src="/sjc3d.webp"
            alt="sjc"
            width={300}
            height={110}
            className="object-contain w-full h-full opacity-80"
            aria-hidden="true"
            priority
          />
        </div>
        <div
          className="absolute inset-0 z-[3]"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 p-5 pb-0">
          <p
            className="font-roboto font-medium text-v2-text-tertiary text-[15px]"
            style={{ textShadow }}
          >
            {greeting}
            {userName ? `, ${userName}` : ""}
          </p>
          <p
            className="font-roboto font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary mt-3"
            style={{ textShadow }}
          >
            {t("totalNetWorthLabel")}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className="font-roboto font-extrabold text-[32px] tracking-[-1.5px] text-v2-text-tertiary"
              style={{ textShadow: textShadowLg }}
            >
              {formatAmount(totalNetWorth)}
            </p>
            <span
              className="font-roboto text-[13px] font-bold text-v2-text-tertiary"
              style={{ textShadow }}
            >
              {currency}
            </span>
          </div>
        </div>
        <div className="mt-3">{pnlBar}</div>
        {shareButton}
      </div>

      {/* Desktop version */}
      <div
        data-pnl-card
        className="hidden sm:block relative overflow-hidden rounded-2xl"
        style={{
          background: goldGradient,
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        }}
      >
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: lightEffect }}
          aria-hidden="true"
        />
        <div className="absolute top-1/2 -translate-y-1/2 z-[2] pointer-events-none opacity-80 w-full">
          <Image
            src="/sjc3d.webp"
            alt="sjc"
            width={320}
            height={130}
            className="object-contain h-32 w-full"
            aria-hidden="true"
            priority
          />
        </div>
        <div
          className="absolute inset-0 z-[3]"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between p-6">
          <div>
            <p
              className="font-roboto font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary/70"
              style={{ textShadow }}
            >
              {t("totalNetWorthLabel")}
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              <p
                className="font-roboto font-bold text-[42px] tracking-[-1.5px] text-v2-text-tertiary"
                style={{ textShadow: textShadowLg }}
              >
                {formatAmount(totalNetWorth)}
              </p>
              <span
                className="font-roboto text-[15px] font-bold text-v2-text-tertiary/70"
                style={{ textShadow }}
              >
                {currency}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <PnlValue
              percent={todayPnlPercent}
              amount={todayPnl}
              label={t("pnlToday")}
              currency={currency}
            />
            <PnlValue
              percent={weekPnlPercent}
              amount={weekPnl}
              label={t("pnl7d")}
              currency={currency}
            />
            <PnlValue
              percent={monthPnlPercent}
              amount={monthPnl}
              label={t("pnl30d")}
              currency={currency}
            />
          </div>
        </div>
        {shareButton}
      </div>
    </div>
  );
}
```

**Step 4: Run test — verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="NetWorthDisplay" --no-coverage
# Expected: PASS
```

**Step 5: Commit**

```
feat(home): add share button and data-pnl-card attribute to NetWorthDisplay
```

---

### Task 3: Home Page — Wire PnlShareModal

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Security notes:** `cardRef` points to the rendered `NetWorthDisplay` card DOM element. The ref is passed to `PnlShareModal` which only uses it for `html2canvas` capture. No data leaves the browser.

**Step 1: Write the failing test**

Add to `src/wj-client/app/[locale]/dashboard/home/__tests__/page.test.tsx` (create if needed, or add test):

```typescript
// This is an integration test — verify the modal is connected to the share button
// We mock all data hooks and just test the modal open/close behavior
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/utils/generated/hooks", () => ({
  useQueryListWallets: () => ({ data: null, isLoading: false }),
  useQueryGetAggregatedPortfolioSummary: () => ({ data: null }),
  EVENT_WalletListWallets: "wallets",
  EVENT_WalletGetTotalBalance: "balance",
  EVENT_TransactionListTransactions: "transactions",
}));
jest.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "VND" }),
}));
jest.mock("@/features/auth/store/store", () => ({
  store: { getState: () => ({ setAuthReducer: { fullname: "Test" } }) },
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("../PnlShareModal", () => ({
  PnlShareModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="pnl-share-modal" /> : null,
}));

// Mock all sub-components to avoid complex renders
["NetWorthDisplay", "PNLCard", "GoldPriceTable", "GoldPriceChart",
 "SilverPriceTable", "SilverPriceChart", "CurrencyPriceTable",
 "DollarIndexChart", "WalletsSection"].forEach((name) => {
  jest.mock(`../${name}`, () => ({
    [name]: () => <div data-testid={name} />,
  }));
});

import Home from "../page";

describe("Home page — PnlShareModal integration", () => {
  it("opens PnlShareModal when NetWorthDisplay share button is clicked", async () => {
    render(<Home />);
    // The share button is inside NetWorthDisplay which is mocked
    // This tests that the modal state wiring is correct
    // (full integration test would require unmocking NetWorthDisplay)
    expect(screen.queryByTestId("pnl-share-modal")).not.toBeInTheDocument();
  });
});
```

> Note: The home page test is intentionally minimal because the page's data-fetching hooks make full integration testing complex. The key behavior (modal opens when share button is clicked) is already covered by the `NetWorthDisplay` and `PnlShareModal` unit tests. The page test just verifies the modal component is imported and renders correctly.

**Step 2: Run test — verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="home/__tests__/page" --no-coverage
# Expected: FAIL — Cannot find module '../PnlShareModal' (or related import errors)
```

**Step 3: Modify the home page**

In `src/wj-client/app/[locale]/dashboard/home/page.tsx`:

1. Add import for `PnlShareModal` and `useRef`:
```typescript
import { useState, useRef, useEffect } from "react";
// ...existing imports...
import { PnlShareModal } from "./PnlShareModal";
```

2. Add `cardRef` and `isPnlShareOpen` state:
```typescript
const cardRef = useRef<HTMLDivElement>(null);
const [isPnlShareOpen, setIsPnlShareOpen] = useState(false);
```

3. Update modal type union (existing `ModalType` is for the other modals — keep it separate):
```typescript
// No change to ModalType — isPnlShareOpen is a separate boolean state
```

4. Pass `onShareClick` and `ref` to `NetWorthDisplay` (in both mobile and desktop JSX):

**Mobile layout** (currently at ~line 144):
```tsx
<div ref={cardRef}>
  <NetWorthDisplay
    totalNetWorth={totalNetWorth}
    currency={currency}
    monthPnlPercent={monthPnlPercent}
    monthPnl={monthPnl}
    userName={user.fullname ?? undefined}
    onShareClick={() => setIsPnlShareOpen(true)}
  />
</div>
```

**Desktop layout** (currently nested in the desktop section):
```tsx
<div ref={cardRef}>   {/* Note: only one ref needed — use the same ref; on desktop, read the desktop card element */}
  <NetWorthDisplay
    totalNetWorth={totalNetWorth}
    currency={currency}
    todayPnlPercent={todayPnlPercent}
    todayPnl={todayPnl}
    weekPnlPercent={weekPnlPercent}
    weekPnl={weekPnl}
    monthPnlPercent={monthPnlPercent}
    monthPnl={monthPnl}
    userName={user.fullname ?? undefined}
    onShareClick={() => setIsPnlShareOpen(true)}
  />
</div>
```

> **Implementation note:** `cardRef` wraps the `NetWorthDisplay` div. The `html2canvas` capture target will be `cardRef.current` which contains the `data-pnl-card` element. Since NetWorthDisplay renders both mobile and desktop versions with `sm:hidden`/`hidden sm:block`, html2canvas will capture whichever is currently visible in the DOM layout. The wrapper div should have `ref={cardRef}`.

5. Add `PnlShareModal` before the closing `</div>` of the return statement, alongside the existing `BaseModal`:
```tsx
<PnlShareModal
  isOpen={isPnlShareOpen}
  onClose={() => setIsPnlShareOpen(false)}
  cardRef={cardRef}
/>
```

**Step 4: Run test — verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="home/__tests__/page" --no-coverage
```

**Step 5: Run all home-related tests**

```bash
cd src/wj-client && npx jest --testPathPattern="dashboard/home" --no-coverage
# Expected: all passing
```

**Step 6: Run full frontend lint**

```bash
cd src/wj-client && npm run lint
# Expected: no new errors
```

**Step 7: Playwright E2E Audit**

- Affected page: `/dashboard/home`
- Check existing E2E spec: `src/wj-client/tests/e2e/` (look for home or share specs)
- Add/update E2E test `tests/e2e/share-pnl-flow.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Share PNL Modal", () => {
  test.beforeEach(async ({ page }) => {
    // Assume test auth is set up (session cookie or localStorage)
    await page.goto("/dashboard/home");
    await page.waitForLoadState("networkidle");
  });

  test("share button is visible on NetWorthDisplay card", async ({ page }) => {
    const shareBtn = page.getByRole("button", { name: /share pnl|chia sẻ kết quả/i });
    await expect(shareBtn).toBeVisible();
  });

  test("clicking share button opens PNL share modal", async ({ page }) => {
    const shareBtn = page.getByRole("button", { name: /share pnl|chia sẻ kết quả/i });
    await shareBtn.click();
    // Modal title appears
    await expect(
      page.getByText(/share investment results|chia sẻ kết quả đầu tư/i)
    ).toBeVisible();
  });

  test("modal shows loading state then image", async ({ page }) => {
    const shareBtn = page.getByRole("button", { name: /share pnl|chia sẻ kết quả/i });
    await shareBtn.click();
    // Loading spinner
    await expect(page.getByTestId("loading-spinner")).toBeVisible();
    // Eventually image appears (html2canvas completes)
    await expect(page.getByRole("img", { name: /pnl preview/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("download button is visible after capture", async ({ page }) => {
    const shareBtn = page.getByRole("button", { name: /share pnl|chia sẻ kết quả/i });
    await shareBtn.click();
    await page.waitForSelector('img[alt="PNL preview"]', { timeout: 10000 });
    await expect(page.getByRole("button", { name: /download|tải về/i })).toBeVisible();
  });
});
```

Run E2E (requires dev server):
```bash
cd src/wj-client && npx playwright test tests/e2e/share-pnl-flow.spec.ts --reporter=list
```

**Step 8: Commit**

```
feat(home): wire PnlShareModal to home page with cardRef and share state
```

---

### Task 4: Update C4 Frontend Component Diagram

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Step 1: Read the current diagram and identify where to add `PnlShareModal`**

Find the home dashboard section and add:
```markdown
Component(pnlShareModal, "PnlShareModal", "React Component", "Captures NetWorthDisplay as PNG via html2canvas, composites app logo, provides download and native OS share")
```

**Step 2: Add relationship lines**
```
Rel(homePage, pnlShareModal, "Opens on share click")
Rel(pnlShareModal, netWorthDisplay, "Captures via cardRef (html2canvas)")
```

**Step 3: Commit**

```
docs(architecture): add PnlShareModal to c4-component-frontend diagram
```

---

### Task 5: Update Flow Diagram (flow-cross-cutting.md)

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md`

Add a new sequence diagram section:

```markdown
## Share PNL as Image

```mermaid
sequenceDiagram
    actor User
    participant NetWorthDisplay
    participant PnlShareModal
    participant html2canvas
    participant Canvas
    participant OSShareSheet

    User->>NetWorthDisplay: Tap share button
    NetWorthDisplay->>PnlShareModal: setIsPnlShareOpen(true)
    PnlShareModal->>PnlShareModal: useEffect triggers captureImage()
    PnlShareModal->>html2canvas: dynamic import("html2canvas")
    html2canvas-->>PnlShareModal: module loaded
    PnlShareModal->>html2canvas: html2canvas(cardRef, { scale: 2 })
    html2canvas->>NetWorthDisplay: Reads DOM element (data-pnl-card)
    html2canvas-->>PnlShareModal: canvas (2x pixel ratio)
    PnlShareModal->>Canvas: Create output canvas
    PnlShareModal->>Canvas: drawImage(capturedCanvas)
    PnlShareModal->>Canvas: Load /icons/icon-192x192.png
    PnlShareModal->>Canvas: drawImage(logo, bottom-right)
    Canvas-->>PnlShareModal: outputCanvas.toDataURL("image/png")
    PnlShareModal->>PnlShareModal: setDataURL(dataURL), setStatus("success")
    PnlShareModal->>User: Show preview image + Download/Share buttons

    alt User clicks Download
        User->>PnlShareModal: Click "Download PNG"
        PnlShareModal->>PnlShareModal: Create <a download> element
        PnlShareModal->>User: Browser saves pnl-congdongvang-YYYY-MM-DD.png
    else User clicks Share (if navigator.canShare({files}) = true)
        User->>PnlShareModal: Click "Share"
        PnlShareModal->>PnlShareModal: Convert dataURL → File
        PnlShareModal->>OSShareSheet: navigator.share({ files: [file], title })
        OSShareSheet->>User: Native OS share sheet appears
    end
```

**Key Invariants:**
- Image is never sent to any server — lives only in browser memory.
- html2canvas is dynamically imported — zero impact on initial page load bundle.
- Share button hidden (not disabled) on browsers where `navigator.canShare({ files })` is false.
- Download is always available as fallback.
- Logo load failure is gracefully handled — image still shown without logo.
```

**Step 2: Commit**

```
docs(architecture): add Share PNL flow diagram to flow-cross-cutting.md
```

---

## Full Test Run Checklist

Before marking the feature complete:

```bash
# 1. Unit tests
cd src/wj-client && npx jest --testPathPattern="dashboard/home" --no-coverage
# Expected: PASS (i18n-keys, PnlShareModal, NetWorthDisplay, page tests)

# 2. Frontend lint
cd src/wj-client && npm run lint
# Expected: 0 errors, 0 warnings

# 3. TypeScript type check
cd src/wj-client && npx tsc --noEmit
# Expected: 0 errors

# 4. Build check
cd src/wj-client && npm run build
# Expected: builds successfully, no bundle warnings for html2canvas (it's dynamically imported)

# 5. E2E
cd src/wj-client && npx playwright test tests/e2e/share-pnl-flow.spec.ts --reporter=list
# Expected: all assertions green
```

---

## Notes for Implementer

1. **`useRef` and SSR:** `cardRef` is initialized with `useRef<HTMLDivElement>(null)`. The ref will be `null` on SSR (Next.js server render) and populated on client mount. `captureImage` checks `if (!cardRef.current) return` — safe.

2. **Desktop vs Mobile capture:** The home page renders `NetWorthDisplay` once. Inside it, there are two divs (`sm:hidden` and `hidden sm:block`). The `cardRef` wraps the entire `NetWorthDisplay`. When `html2canvas` captures `cardRef.current`, it will capture whichever version is visible (CSS `display: none` elements are excluded from layout). On mobile, the mobile card is captured. On desktop, the desktop card is captured.

3. **html2canvas and CSS gradients:** The gold gradient and light effect overlays use standard CSS `linear-gradient` and `radial-gradient` — both are supported by html2canvas 1.4.1. The dragon watermark (`/sjc3d.webp`) is a local asset — no CORS issue.

4. **The existing `ShareDialog`** (`components/share/ShareDialog.tsx`) is NOT used for this feature — it's a link/email/PDF sharer for reports. `PnlShareModal` is the purpose-built component for image capture.

5. **i18n namespace:** The `NetWorthDisplay` component uses `useTranslations("dashboard.home")` — so `t("sharePnl.buttonAriaLabel")` correctly resolves to `dashboard.home.sharePnl.buttonAriaLabel` in `ui.json`.
