import type { Meta, StoryObj } from "@storybook/react";
import { ErrorState, ErrorStates } from "./ErrorState";

const meta: Meta<typeof ErrorState> = {
  title: "UI/ErrorState",
  component: ErrorState,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["network", "server", "permission", "not-found", "generic"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const NetworkError: Story = {
  args: {
    type: "network",
    retryLabel: "Retry",
    onRetry: () => console.log("Retry clicked"),
  },
};

export const ServerError: Story = {
  args: {
    type: "server",
    retryLabel: "Try Again",
    onRetry: () => console.log("Retry clicked"),
  },
};

export const PermissionError: Story = {
  args: {
    type: "permission",
  },
};

export const NotFound: Story = {
  args: {
    type: "not-found",
    retryLabel: "Go Home",
    onRetry: () => console.log("Go home clicked"),
  },
};

export const GenericError: Story = {
  args: {
    type: "generic",
    retryLabel: "Retry",
    onRetry: () => console.log("Retry clicked"),
  },
};

export const CustomMessage: Story = {
  args: {
    title: "Custom Error Title",
    message: "This is a custom error message that explains what went wrong.",
    type: "generic",
    retryLabel: "Try Again",
    onRetry: () => console.log("Retry clicked"),
  },
};

export const WithAdditionalActions: Story = {
  args: {
    type: "network",
    retryLabel: "Retry",
    onRetry: () => console.log("Retry clicked"),
    actions: (
      <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
        Contact Support
      </button>
    ),
  },
};

// Preset error states
export const NetworkErrorPreset: Story = {
  render: () => <ErrorStates.NetworkError onRetry={() => console.log("Retry")} />,
};

export const ServerErrorPreset: Story = {
  render: () => <ErrorStates.ServerError onRetry={() => console.log("Retry")} />,
};

export const PermissionErrorPreset: Story = {
  render: () => <ErrorStates.PermissionError />,
};

export const NotFoundErrorPreset: Story = {
  render: () => <ErrorStates.NotFoundError onRetry={() => console.log("Go home")} />,
};

export const GenericErrorPreset: Story = {
  render: () => <ErrorStates.GenericError onRetry={() => console.log("Retry")} />,
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
  args: {
    type: "network",
    retryLabel: "Retry",
    onRetry: () => console.log("Retry clicked"),
  },
};

export const DarkMode: Story = {
  args: {
    type: "network",
    retryLabel: "Retry",
    onRetry: () => console.log("Retry clicked"),
  },
  globals: {
    theme: "dark",
  },
};
