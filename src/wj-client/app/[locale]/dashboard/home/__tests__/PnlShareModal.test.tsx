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
  useNotification: () => ({ toast: { error: jest.fn() } }),
}));

// Mock Canvas 2D context — jsdom does not implement canvas drawing
// These are set in beforeEach (not module-level) so jest.restoreAllMocks() in afterEach
// doesn't break subsequent tests.
function makeMockCtx() {
  return {
    scale: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 100 })),
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    drawImage: jest.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    textAlign: "",
  };
}

// Default props
const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  totalNetWorth: 85610004,
  currency: "VND",
  monthPnl: -22589982,
  monthPnlPercent: -20.67,
  userName: "Quốc Khánh Nguyễn",
};

describe("PnlShareModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-apply canvas mocks each test since afterEach restoreAllMocks() removes them
    const mockCtx = makeMockCtx();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx) as any;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(
      () => "data:image/png;base64,canvas-drawn",
    );

    // Mock Image loading for logo
    Object.defineProperty(global, "Image", {
      writable: true,
      value: class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        crossOrigin = "";
        complete = true;
        naturalWidth = 192;
        naturalHeight = 192;
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    });

    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<PnlShareModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading spinner when open (draw in progress)", () => {
    render(<PnlShareModal {...defaultProps} />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows generated image after successful draw", async () => {
    render(<PnlShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: /pnl preview/i })).toBeInTheDocument();
  });

  it("shows download button after successful draw", async () => {
    render(<PnlShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    });
  });

  it("re-draws image each time modal opens", async () => {
    let drawCount = 0;
    (HTMLCanvasElement.prototype.toDataURL as jest.Mock).mockImplementation(() => {
      drawCount++;
      return `data:image/png;base64,draw-${drawCount}`;
    });

    const { rerender } = render(<PnlShareModal {...defaultProps} isOpen={true} />);
    await waitFor(() => expect(drawCount).toBeGreaterThanOrEqual(1));
    const countAfterFirst = drawCount;

    rerender(<PnlShareModal {...defaultProps} isOpen={false} />);
    rerender(<PnlShareModal {...defaultProps} isOpen={true} />);
    await waitFor(() => expect(drawCount).toBeGreaterThan(countAfterFirst));
  });
});
