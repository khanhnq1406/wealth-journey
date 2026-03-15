# ButtonGroup Component - DEPRECATED

**Status**: ⚠️ DEPRECATED - Do not use in new code
**Replacement**: Use [FloatingActionButton](./FloatingActionButton.tsx) instead
**Migration Deadline**: To be determined

---

## Why is ButtonGroup deprecated?

The `ButtonGroup` component has several issues that violate the congdongvang.com Design System:

1. **Old Redux Pattern**: Uses global Redux state for modal management instead of component-level state
2. **Image Icons**: Uses PNG images instead of SVG icons (not scalable, poor for dark mode)
3. **Manual DOM Manipulation**: Uses `.classList.add()/.remove()` instead of React state
4. **Hardcoded Styles**: Uses inline styles and hardcoded colors
5. **Poor Accessibility**: Missing ARIA attributes and keyboard navigation
6. **Not Mobile-First**: Fixed positioning without responsive considerations

---

## Migration Guide

### Old Code (ButtonGroup)

```tsx
import { ButtonGroup } from "@/components/ButtonGroup";

export default function Dashboard() {
  return (
    <div>
      {/* Content */}
      <ButtonGroup />
    </div>
  );
}
```

### New Code (FloatingActionButton)

```tsx
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useState } from "react";

export default function Dashboard() {
  const [modalType, setModalType] = useState<string | null>(null);

  const fabActions = [
    {
      label: "Add Transaction",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      onClick: () => setModalType("add-transaction"),
    },
    {
      label: "Transfer Money",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      ),
      onClick: () => setModalType("transfer-money"),
    },
  ];

  return (
    <div>
      {/* Content */}
      <FloatingActionButton actions={fabActions} />

      {/* Modal rendering */}
      {modalType === "add-transaction" && (
        <AddTransactionModal onClose={() => setModalType(null)} />
      )}
      {modalType === "transfer-money" && (
        <TransferMoneyModal onClose={() => setModalType(null)} />
      )}
    </div>
  );
}
```

---

## Benefits of FloatingActionButton

✅ **Mobile-First**: Only shows on mobile devices (hidden on desktop)
✅ **Modern Design**: Smooth animations, staggered menu expansion
✅ **Accessible**: Proper ARIA labels, keyboard support
✅ **Customizable**: Pass any actions with custom icons and handlers
✅ **Component State**: No global Redux dependency
✅ **Design System Compliant**: Uses design tokens, proper spacing, touch targets

---

## FloatingActionButton Props

```typescript
interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface FABProps {
  actions: FABAction[];
}
```

### Example with Multiple Actions

```tsx
const fabActions = [
  {
    label: "Add Wallet",
    icon: <WalletIcon />,
    onClick: () => handleOpenModal("add-wallet"),
  },
  {
    label: "Add Transaction",
    icon: <TransactionIcon />,
    onClick: () => handleOpenModal("add-transaction"),
  },
  {
    label: "Transfer Money",
    icon: <TransferIcon />,
    onClick: () => handleOpenModal("transfer-money"),
  },
  {
    label: "Add Budget",
    icon: <BudgetIcon />,
    onClick: () => handleOpenModal("add-budget"),
  },
];

<FloatingActionButton actions={fabActions} />;
```

---

## Icon Library

Use SVG icons from your icon library or inline SVG for custom icons:

```tsx
// Using Heroicons-style SVG
const TransactionIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
```

---

## Checklist for Migration

- [ ] Identify all usages of `<ButtonGroup />`
- [ ] Replace with `<FloatingActionButton actions={...} />`
- [ ] Convert modal dispatches to component-level state
- [ ] Test on mobile devices
- [ ] Verify keyboard navigation works
- [ ] Remove ButtonGroup import after migration

---

## Need Help?

See the [FloatingActionButton.tsx](./FloatingActionButton.tsx) source code for implementation details.
