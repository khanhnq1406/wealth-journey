import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy compatibility (will be phased out)
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "#008148", // Updated to primary fintech green
        fg: "#F8FAFC", // Mapped to neutral-50
        hgreen: "#006638", // Darker green for hover states
        lred: "#DC2626", // Mapped to danger-600
        hover: "#E2E8F0", // Mapped to neutral-200
        modal: "rgba(0, 0, 0, 0.5)",

        // PRIMARY - Fintech Green (growth, wealth, trust)
        primary: {
          50: "#F0FDF4", // Very light green tint
          100: "#DCFCE7", // Light green background
          200: "#BBF7D0", // Soft green surface
          300: "#86EFAC", // Medium light green
          400: "#4ADE80", // Bright green accent
          500: "#22C55E", // Primary green (emerald)
          600: "#008148", // Main brand green (fintech)
          700: "#006638", // Darker green for hover
          800: "#064E3B", // Deep green
          900: "#064E3B", // Very dark green
          // Dark mode variants
          950: "#022C22", // Almost black green
        },

        // SECONDARY - Teal/Cyan (modern, tech-forward)
        secondary: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6", // Teal accent
          600: "#0D9488", // Darker teal
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },

        // SUCCESS - Bright Growth Green (gains, income, positive)
        success: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
        },

        // DANGER - Alert Red (losses, expenses, warnings)
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },

        // NEUTRAL - Professional Gray Scale
        neutral: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          // Dark mode specific
          950: "#020617",
        },

        // DARK MODE - Specific dark theme colors
        dark: {
          // Background layers (darkest to lightest)
          background: "#020617", // Main dark background
          surface: "#0F172A", // Card/surface background
          "surface-hover": "#1E293B", // Hover state
          "surface-active": "#334155", // Active state

          // Text colors (lightest to darkest)
          text: "#F8FAFC", // Primary text
          "text-secondary": "#94A3B8", // Secondary text
          "text-tertiary": "#64748B", // Tertiary text

          // Borders and dividers
          border: "#1E293B", // Border color
          "border-light": "#334155", // Light border

          // Overlay colors
          overlay: "rgba(0, 0, 0, 0.7)", // Modal/overlay backdrop
          "overlay-light": "rgba(0, 0, 0, 0.5)",
        },

        // CHART COLORS - Green-based Data Visualization Palette
        chart: {
          green: "#22C55E", // Primary green
          emerald: "#10B981", // Emerald green
          teal: "#14B8A6", // Teal accent
          cyan: "#06B6D4", // Cyan highlight
          "light-green": "#86EFAC", // Light green
          "dark-green": "#064E3B", // Dark green
          lime: "#84CC16", // Lime accent
          mint: "#5EEAD4", // Mint fresh
          forest: "#065F46", // Forest green
          sage: "#A7F3D0", // Sage green
          olive: "#84CC16", // Olive
          "sea-green": "#2DD4BF", // Sea green
          "pale-green": "#BBF7D0", // Pale green
          "spring-green": "#4ADE80", // Spring green
        },

        // V2 CHART COLORS - Crimson & Gold
        "chart-v2": {
          gold: "#B8860B",
          red: "#B91C1C",
          "gold-area": "#B8860B33",
          silver: "#4B5563",
        },

        // V2 Crimson & Gold Design System
        v2: {
          "bg-primary": "#FAF9F7",
          "bg-surface": "#FFFFFF",
          "bg-surface-tint": "#FDF6EE",
          "bg-dark": "#1C1917",
          "border-light": "#EDE8E1",
          border: "#DDD8D0",
          "text-primary": "#1C1917",
          "text-secondary": "#57534E",
          "text-tertiary": "#78716C",
          "text-on-dark": "#FAF9F7",
          "red-primary": "#B91C1C",
          "red-dark": "#7F1D1D",
          "red-light": "#FEF2F2",
          "red-negative": "#DC2626",
          "gold-primary": "#B8860B",
          "gold-dark": "#92710C",
          "gold-light": "#FBF3E0",
          "gold-accent": "#D4A017",
          "green-positive": "#15803D",
          "green-light": "#F0FDF4",
          "silver-primary": "#8B929E",
          "silver-dark": "#374151",
          "silver-light": "#EEF0F3",
        },
      },

      // V2 Font Families
      fontFamily: {
        sora: ["var(--font-sora)", "system-ui", "sans-serif"],
        "ibm-mono": ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
        jakarta: ["var(--font-jakarta-sans)", "system-ui", "sans-serif"],
      },

      // Typography Scale
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", fontWeight: "700" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", fontWeight: "700" }],
        "5xl": ["3rem", { lineHeight: "1", fontWeight: "800" }],
        "financial-sm": [
          "1rem",
          { lineHeight: "1.5rem", fontWeight: "600", letterSpacing: "0.025em" },
        ],
        "financial-md": [
          "1.125rem",
          {
            lineHeight: "1.75rem",
            fontWeight: "600",
            letterSpacing: "0.025em",
          },
        ],
        "financial-lg": [
          "1.5rem",
          { lineHeight: "2rem", fontWeight: "700", letterSpacing: "0.025em" },
        ],
      },

      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },

      // Spacing & Touch Targets
      spacing: {
        "11": "2.75rem", // 44px - minimum touch target
        "12": "3rem", // 48px - comfortable touch
        "14": "3.5rem", // 56px - large touch (primary actions)
        "mobile-xs": "0.5rem",
        "mobile-sm": "0.75rem",
        "mobile-md": "1rem",
        "mobile-lg": "1.5rem",
        "desktop-sm": "1rem",
        "desktop-md": "1.5rem",
        "desktop-lg": "2rem",
        "desktop-xl": "3rem",
      },

      // Box Shadow System - Light and Dark mode
      boxShadow: {
        // Light mode shadows
        card: "0 2px 8px rgba(0, 129, 72, 0.08)", // Green-tinted shadow
        "card-hover": "0 4px 12px rgba(0, 129, 72, 0.12)",
        "card-active": "0 1px 4px rgba(0, 129, 72, 0.06)",
        modal: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        dropdown:
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        floating: "0 8px 16px rgba(0, 129, 72, 0.12)", // Green-tinted
        focus: "0 0 0 3px rgba(0, 129, 72, 0.4)", // Green focus ring

        // Dark mode shadows (subtle, use darker colors)
        "dark-card": "0 2px 8px rgba(0, 0, 0, 0.3)",
        "dark-card-hover": "0 4px 12px rgba(0, 0, 0, 0.4)",
        "dark-card-active": "0 1px 4px rgba(0, 0, 0, 0.2)",
        "dark-modal": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        "dark-dropdown":
          "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
        "dark-floating": "0 8px 16px rgba(0, 0, 0, 0.4)",

        // V2 shadows
        "v2-card": "0 2px 12px rgba(0, 0, 0, 0.047)",
      },

      // Keep legacy dropShadow for backward compatibility
      dropShadow: {
        round: "0px 0px 3px rgb(0 0 0 / 0.4)",
      },

      // Border Radius
      borderRadius: {
        none: "0",
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },

      // Z-Index Scale - Centralized layer management
      zIndex: {
        // Base layer (0)
        base: "0",
        // Content layers (1-9)
        content: "1",
        // Sticky/fixed content (10-19)
        sticky: "10",
        // Dropdown menus and popovers (20-29)
        dropdown: "20",
        // Fixed sidebars and navigation (30-39)
        sidebar: "30",
        // Floating action buttons and helpers (40-49)
        floating: "40",
        // Modal overlay backdrop (45)
        "modal-backdrop": "45",
        // Modal base (50)
        modal: "50",
        // Modal stacked (51-59) - for multiple modals
        "modal-raised": "51",
        "modal-stack-2": "52",
        "modal-stack-3": "53",
        "modal-stack-4": "54",
        "modal-stack-5": "55",
        // Toast notifications (60-69)
        toast: "60",
        // Global search (70-79)
        "global-search": "70",
        // Tooltips and feature tour (80-89)
        tooltip: "80",
        tour: "85",
        // Always on top (90-99) - reserved for special cases
        "always-top": "90",
        // Maximum z-index (100) - for critical overlays
        max: "100",
      },

      // Transitions
      transitionDuration: {
        fast: "150ms",
        DEFAULT: "200ms",
        slow: "300ms",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },

      // Grid Breakpoints (standard Tailwind)
      screens: {
        sm: "640px", // Landscape phones
        md: "768px", // Tablets
        lg: "1024px", // Laptops
        xl: "1280px", // Desktops
        "2xl": "1536px", // Large desktops
      },

      // Custom animations
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "stagger-fade-in": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 300ms ease-out",
        "fade-out": "fade-out 300ms ease-in",
        "slide-in": "slide-in 0.3s ease-out",
        "slide-up": "slide-up 300ms ease-out",
        "slide-down": "slide-down 300ms ease-in",
        "scale-in": "scale-in 200ms ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-out-left": "slide-out-left 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-out",
        "stagger-fade-in": "stagger-fade-in 0.3s ease-out both",
      },
      // Animation delays for staggered effects
      animationDelay: {
        "0": "0ms",
        "75": "75ms",
        "100": "100ms",
        "150": "150ms",
        "200": "200ms",
        "300": "300ms",
        "500": "500ms",
        "700": "700ms",
        "1000": "1000ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
