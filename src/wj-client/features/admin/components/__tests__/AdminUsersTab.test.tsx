import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-utils";
import { AdminUsersTab } from "../AdminUsersTab";

// Mock api-client
const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    put: (...args: any[]) => mockPut(...args),
  },
}));

// Mock react-redux
jest.mock("react-redux", () => ({
  useSelector: jest.fn(() => ({
    email: "admin@test.com",
    isAdmin: true,
  })),
  useDispatch: jest.fn(() => jest.fn()),
}));

// Mock notification context
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: () => ({ toast: mockToast }),
}));

// Mock ConfirmationDialog to simplify tests
jest.mock("@/components/modals/ConfirmationDialog", () => ({
  ConfirmationDialog: ({ title, onConfirm, onCancel }: any) => (
    <div data-testid="confirmation-dialog">
      <span>{title}</span>
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

const mockUsersResponse = {
  success: true,
  users: [
    {
      id: 1,
      name: "Admin User",
      email: "admin@test.com",
      username: "admin",
      picture: "",
      authProvider: "google",
      isAdmin: true,
      createdAt: 1710720000,
    },
    {
      id: 2,
      name: "Regular User",
      email: "user@test.com",
      username: "user",
      picture: "",
      authProvider: "google",
      isAdmin: false,
      createdAt: 1710720000,
    },
  ],
  pagination: { totalCount: 2, totalPages: 1, page: 1, pageSize: 10 },
};

describe("AdminUsersTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockUsersResponse);
  });

  it("renders loading state then user table", async () => {
    render(<AdminUsersTab />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    expect(screen.getByText("Regular User")).toBeInTheDocument();
  });

  it("renders search input", async () => {
    render(<AdminUsersTab />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /search by name, email/i
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("fetches users on mount", async () => {
    render(<AdminUsersTab />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    const callArg = mockGet.mock.calls[0][0];
    expect(callArg).toContain("/api/v1/admin/users");
  });

  it("shows empty state when no users returned", async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      users: [],
      pagination: { totalCount: 0, totalPages: 0, page: 1, pageSize: 10 },
    });

    render(<AdminUsersTab />);

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });

  it("shows error toast when fetch fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    render(<AdminUsersTab />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("renders Admin/User role badges", async () => {
    render(<AdminUsersTab />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    // Should render role badges
    const adminBadges = screen.getAllByText("Admin");
    const userBadges = screen.getAllByText("User");
    expect(adminBadges.length).toBeGreaterThan(0);
    expect(userBadges.length).toBeGreaterThan(0);
  });
});
