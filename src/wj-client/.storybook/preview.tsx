import type { Preview } from "@storybook/react";
import "../styles/globals.css";

/**
 * Storybook Preview Configuration
 *
 * Global configuration for all stories:
 * - Theme provider
 * - Dark mode support
 * - Viewport parameters
 */

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#1a1a1a",
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "375px",
            height: "667px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1440px",
            height: "900px",
          },
        },
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light mode" },
          { value: "dark", icon: "moon", title: "Dark mode" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const { theme } = context.globals;

      // Apply theme to document
      if (typeof document !== "undefined") {
        const html = document.documentElement;
        if (theme === "dark") {
          html.classList.add("dark");
        } else {
          html.classList.remove("dark");
        }
      }

      return (
        <div className={theme === "dark" ? "dark" : ""}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
