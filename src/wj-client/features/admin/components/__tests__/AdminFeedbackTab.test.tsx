import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-utils";
import { AdminFeedbackTab } from "../AdminFeedbackTab";

// Mock api-client
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

// Mock notification context
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: () => ({ toast: mockToast }),
}));

// Mock ConfirmationDialog
jest.mock("@/components/modals/ConfirmationDialog", () => ({
  ConfirmationDialog: ({ title, onConfirm, onCancel }: any) => (
    <div data-testid="confirmation-dialog">
      <span>{title}</span>
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

// Mock BaseCard
jest.mock("@/components/BaseCard", () => ({
  BaseCard: ({ children }: any) => <div data-testid="base-card">{children}</div>,
}));

// Mock Button
jest.mock("@/components/Button", () => ({
  Button: ({ children, onClick, loading }: any) => (
    <button onClick={onClick} disabled={loading}>
      {children}
    </button>
  ),
}));

jest.mock("@/app/constants", () => ({
  ButtonType: { PRIMARY: "primary", SECONDARY: "secondary" },
}));

const mockFeedbackResponse = {
  success: true,
  feedback: [
    {
      id: 1,
      userId: 1,
      userName: "Alice",
      userEmail: "alice@test.com",
      subject: "Bug Report",
      message: "Found a bug in wallet page",
      status: 1,
      adminNote: "",
      createdAt: 1710720000,
      updatedAt: 1710720000,
    },
    {
      id: 2,
      userId: 2,
      userName: "Bob",
      userEmail: "bob@test.com",
      subject: "Feature Request",
      message: "Please add dark mode",
      status: 2,
      adminNote: "Reviewing",
      createdAt: 1710730000,
      updatedAt: 1710740000,
    },
  ],
  pagination: { totalCount: 2, totalPages: 1, page: 1, pageSize: 10 },
};

describe("AdminFeedbackTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockFeedbackResponse);
  });

  it("renders loading state then feedback table", async () => {
    render(<AdminFeedbackTab />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Bug Report")).toBeInTheDocument();
    });

    expect(screen.getByText("Feature Request")).toBeInTheDocument();
  });

  it("fetches feedback on mount", async () => {
    render(<AdminFeedbackTab />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    const callArg = mockGet.mock.calls[0][0];
    expect(callArg).toContain("/api/v1/admin/feedback");
  });

  it("renders status label", async () => {
    render(<AdminFeedbackTab />);

    await waitFor(() => {
      expect(screen.getByText("Bug Report")).toBeInTheDocument();
    });

    // The "Status:" label should be present
    expect(screen.getByText("Status:")).toBeInTheDocument();
  });

  it("shows empty state when no feedback returned", async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      feedback: [],
      pagination: { totalCount: 0, totalPages: 0, page: 1, pageSize: 10 },
    });

    render(<AdminFeedbackTab />);

    await waitFor(() => {
      expect(screen.getByText(/no feedback found/i)).toBeInTheDocument();
    });
  });

  it("shows error toast when fetch fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    render(<AdminFeedbackTab />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Failed to load feedback"
      );
    });
  });

  it("renders user names in table", async () => {
    render(<AdminFeedbackTab />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
