# UI Enhancements Batch Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Implement 5 independent frontend-only UI enhancements
**Spec:** `docs/specs/2026-03-16-ui-enhancements-batch-spec.md`
**Architecture:** Frontend-only changes across translation files, shared components, community feature, and dashboard layout. No backend or API changes.
**Tech Stack:** React 19, Next.js 15, Tailwind CSS, lucide-react, next-intl

## Security Implementation Notes

No security concerns — all changes are frontend display/UX only. No new API calls, no data collection, no trust boundary crossings.

## C4 Architecture Diagram Updates

None required.

---

### Task 1: Update Wallet Name Placeholder with Examples

**Files:**
- Modify: `src/wj-client/messages/en/wallet.json`
- Modify: `src/wj-client/messages/vi/wallet.json`

**Security notes:** None — translation string change only.

**Step 1: Update English translation**
In `messages/en/wallet.json`, change `wallet.form.namePlaceholder`:
```json
"namePlaceholder": "e.g. Daily Spending, Savings, Travel Fund"
```

**Step 2: Update Vietnamese translation**
In `messages/vi/wallet.json`, change `wallet.form.namePlaceholder`:
```json
"namePlaceholder": "vd: Chi tiêu hàng ngày, Tiết kiệm, Du lịch"
```

**Step 3: Verify**
No code changes needed — CreateWalletForm and EditWalletForm already use `tForm("namePlaceholder")`.

**Step 4: Commit**

---

### Task 2: Restyle NumberSuggestions to Red Brand Pattern

**Files:**
- Modify: `src/wj-client/components/forms/NumberSuggestions.tsx` (lines 135-146)

**Security notes:** None — CSS class change only.

**Step 1: Update chip button classes**
Replace the green color classes with red brand pattern on the `<button>` element (lines 135-146):

Current:
```
bg-v2-green-light border border-v2-border
text-v2-green-positive font-medium text-sm
...
hover:bg-v2-green-light
...
dark:bg-green-900/20 dark:border-green-700
dark:text-green-300 dark:hover:bg-green-900/30
```

New:
```
bg-v2-red-light border border-v2-border
text-v2-red-primary font-medium text-sm
...
hover:bg-red-100
...
dark:bg-red-900/20 dark:border-red-700
dark:text-red-300 dark:hover:bg-red-900/30
```

Focus ring is already `focus:ring-v2-red-primary` — no change needed.

**Step 2: Verify**
Visually check that chips render with red brand colors matching the rest of the app.

**Step 3: Commit**

---

### Task 3: Sparkline Empty/Single Data Point Horizontal Line

**Files:**
- Modify: `src/wj-client/components/charts/Sparkline.tsx`
- Modify: `src/wj-client/components/cards/WealthCard.tsx` (lines 163-183)
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx` (guard condition)

**Security notes:** None — SVG rendering change only.

**Step 1: Update Sparkline.tsx — handle empty data**
Currently returns `null` for empty data. Change to render a horizontal line at center:

```typescript
if (!data || data.length === 0) {
  // Render a flat horizontal line to indicate "no data"
  return (
    <div className={className} style={{ height }}>
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <line
          x1="0" y1="50%" x2="100%" y2="50%"
          stroke="#9CA3AF"
          strokeWidth={strokeWidth}
          strokeOpacity={0.5}
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
}
```

**Step 2: Update Sparkline.tsx — handle single data point**
After the empty check, if `data.length === 1`, render a solid horizontal line:

```typescript
if (data.length === 1) {
  const trendColor = color ?? "#10b981"; // Default green for single point
  return (
    <div className={className} style={{ height }}>
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <line
          x1="0" y1="50%" x2="100%" y2="50%"
          stroke={trendColor}
          strokeWidth={strokeWidth}
          strokeOpacity={0.5}
        />
        {showDots && (
          <circle cx="50%" cy="50%" r={3} fill={trendColor} />
        )}
      </svg>
    </div>
  );
}
```

**Step 3: Update WealthCard.tsx — handle 0-1 data points**
In `generateSparklinePath` (line 164), currently returns `""` for `data.length < 2`.

Change the sparkline rendering condition (line 263):
```typescript
// Before:
{showSparkline && sparklinePath && !loading && (

// After: also render for 0-1 data points
{showSparkline && !loading && (
```

And add horizontal line fallback when there's no sparklinePath:
```typescript
{showSparkline && !loading && (
  <div className="mb-3 h-8">
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {sparklinePath ? (
        <>
          <path
            d={sparklinePath}
            fill="none"
            stroke={sparklineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`${sparklinePath} L 100,30 L 0,30 Z`}
            fill={sparklineColor}
            fillOpacity="0.2"
            stroke="none"
          />
        </>
      ) : (
        <line
          x1="0" y1="15" x2="100" y2="15"
          stroke={sparklineColor}
          strokeWidth="1.5"
          strokeOpacity="0.4"
          strokeDasharray={sparklineData.length === 0 ? "4 4" : "0"}
        />
      )}
    </svg>
  </div>
)}
```

**Step 4: Update PortfolioSummaryEnhanced guard**
Find and relax the guard condition from `sparklineData.length > 1` to allow single-point rendering (or remove the length check entirely since Sparkline now handles all cases).

**Step 5: Commit**

---

### Task 4: Community Post Donation Button (Coming Soon)

**Files:**
- Modify: `src/wj-client/features/community/components/PostActions.tsx`

**Security notes:** None — UI-only with toast notification, no API calls.

**Step 1: Add Star import and toast hook**
```typescript
import { Heart, MessageCircle, Share2, Bookmark, Star } from "lucide-react";
import { useNotification } from "@/contexts/NotificationContext";
```

**Step 2: Add toast in component**
```typescript
const { toast } = useNotification();
```

**Step 3: Add donation button**
Add between the Share and Save buttons (or after Save):

```tsx
<button
  onClick={() => toast.info("Tính năng Tặng sao sẽ sớm được ra mắt!")}
  className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors font-vietnam text-sm font-medium text-v2-text-secondary hover:bg-v2-bg-primary flex-1 justify-center"
  aria-label="Donate stars"
>
  <Star size={18} />
  <span className="hidden sm:inline">Tặng sao</span>
</button>
```

**Step 4: Commit**

---

### Task 5: Navbar "Hồ sơ của bạn" Navigation Item

**Files:**
- Modify: `src/wj-client/messages/en/nav.json` — add `profile` key
- Modify: `src/wj-client/messages/vi/nav.json` — add `profile` key
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx` — add nav item in premium section
- Modify: `src/wj-client/app/[locale]/dashboard/community/page.tsx` — read `?view=profile` URL param
- Modify: `src/wj-client/app/constants.tsx` — add `communityProfile` route

**Security notes:** URL query param `?view=profile` is read-only, checked against a hardcoded enum — no injection risk.

**Step 1: Add translation keys**
In `messages/en/nav.json`:
```json
"profile": "Your Profile"
```

In `messages/vi/nav.json`:
```json
"profile": "Hồ sơ của bạn"
```

**Step 2: Add route constant**
In `app/constants.tsx`, add:
```typescript
communityProfile: `/dashboard/community?view=profile`,
```

**Step 3: Add nav item in dashboard layout — desktop sidebar**
In `layout.tsx`, add after the Community NavItem in the premium section:

```tsx
<NavItem
  href={routes.communityProfile}
  label={t("profile")}
  icon={<CircleUser size={20} />}
  isActive={pathname === routes.community && /* check for profile view */}
  isExpanded={isExpanded}
  isPremium={true}
  showTooltip={!isExpanded}
  animationDelay={90}
/>
```

Adjust existing animation delays: Finance → 120, Wallets → 150, Settings → 180.

**Step 4: Add nav item in mobile slide-out menu**
Add the same item in the mobile menu section, matching the pattern of existing items.

**Step 5: Read URL param in community page**
In `community/page.tsx`:

```typescript
import { useSearchParams } from "next/navigation";

// Inside component:
const searchParams = useSearchParams();

useEffect(() => {
  const viewParam = searchParams.get("view");
  if (viewParam === "profile") {
    setActiveView("profile");
    setMobileView("profile");
    setProfileUserId(null); // Own profile
  }
}, []); // Run once on mount only
```

**Step 6: Commit**
