/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// Mock HTMLCanvasElement.getContext — jsdom does not implement canvas 2D
const mockCtx = {
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  fillStyle: "",
};
HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx) as any;
HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () => "data:image/png;base64,composited"
);

describe("PnlShareModal", () => {
  const mockCardRef = { current: document.createElement("div") };
  const mockOnClose = jest.fn();
  let pnlCardEl: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Add a [data-pnl-card] element to the DOM so captureImage can find it
    pnlCardEl = document.createElement("div");
    pnlCardEl.setAttribute("data-pnl-card", "");
    document.body.appendChild(pnlCardEl);

    // Mock getBoundingClientRect to return non-zero dimensions for the pnl card
    jest.spyOn(pnlCardEl, "getBoundingClientRect").mockReturnValue({
      width: 400, height: 160, x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 160,
      toJSON: () => ({}),
    } as DOMRect);

    // Mock window.getComputedStyle to return display:block for the pnl card
    const origGetComputedStyle = window.getComputedStyle;
    jest.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === pnlCardEl) {
        return { display: "block" } as CSSStyleDeclaration;
      }
      return origGetComputedStyle(el);
    });

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

  afterEach(() => {
    // Clean up the pnl card element
    if (pnlCardEl && pnlCardEl.parentNode) {
      pnlCardEl.parentNode.removeChild(pnlCardEl);
    }
    jest.restoreAllMocks();
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
