import { render, screen } from '@testing-library/react';

// Mock all dependencies
jest.mock('@/utils/generated/hooks', () => ({
  useQueryGetAuthMethods: jest.fn(),
  useMutationLinkGoogle: jest.fn(),
  EVENT_AuthGetAuthMethods: 'EVENT_AuthGetAuthMethods',
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock('@/contexts/NotificationContext', () => ({
  useNotification: jest.fn(() => ({ toast: { success: jest.fn() } })),
}));
jest.mock('@/features/auth/utils/error-mapper', () => ({
  mapLinkGoogleError: jest.fn(() => null),
  mapUnlinkGoogleError: jest.fn(() => null),
}));
jest.mock('next-intl', () => ({
  useTranslations: jest.fn(() => (key: string) => key),
}));
jest.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  GoogleLogin: () => <button>Sign in with Google</button>,
}));
jest.mock('@/components/loading/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

// Mock createPortal to render inline in tests
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock DisconnectGoogleDialog to isolate AuthMethodsCard tests
jest.mock('../DisconnectGoogleDialog', () => ({
  DisconnectGoogleDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="disconnect-google-dialog" /> : null,
}));

import { AuthMethodsCard } from '../AuthMethodsCard';

describe('AuthMethodsCard — Disconnect Google', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useMutationLinkGoogle } = require('@/utils/generated/hooks');
    (useMutationLinkGoogle as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it('shows Disconnect button when Google linked and password set', () => {
    const { useQueryGetAuthMethods } = require('@/utils/generated/hooks');
    (useQueryGetAuthMethods as jest.Mock).mockReturnValue({
      data: { data: { hasGoogle: true, hasPassword: true } },
      isLoading: false,
    });

    render(<AuthMethodsCard />);
    const disconnectBtn = screen.getByRole('button', { name: /disconnectGoogle$/i });
    expect(disconnectBtn).toBeInTheDocument();
    expect(disconnectBtn).not.toBeDisabled();
  });

  it('shows disabled Disconnect button when Google linked but no password', () => {
    const { useQueryGetAuthMethods } = require('@/utils/generated/hooks');
    (useQueryGetAuthMethods as jest.Mock).mockReturnValue({
      data: { data: { hasGoogle: true, hasPassword: false } },
      isLoading: false,
    });

    render(<AuthMethodsCard />);
    const disconnectBtn = screen.getByRole('button', { name: /disconnectGoogle$/i });
    expect(disconnectBtn).toBeInTheDocument();
    expect(disconnectBtn).toBeDisabled();
  });

  it('hides Disconnect button when Google is not linked', () => {
    const { useQueryGetAuthMethods } = require('@/utils/generated/hooks');
    (useQueryGetAuthMethods as jest.Mock).mockReturnValue({
      data: { data: { hasGoogle: false, hasPassword: true } },
      isLoading: false,
    });

    render(<AuthMethodsCard />);
    expect(screen.queryByRole('button', { name: /disconnectGoogle$/i })).not.toBeInTheDocument();
  });
});
