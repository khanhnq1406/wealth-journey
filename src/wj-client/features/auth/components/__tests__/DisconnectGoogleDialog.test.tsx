import { render, screen, fireEvent, act } from '@testing-library/react';
import { DisconnectGoogleDialog } from '../DisconnectGoogleDialog';

// Mock all dependencies
jest.mock('@/utils/generated/hooks', () => ({
  useMutationUnlinkGoogle: jest.fn(),
  EVENT_AuthGetAuthMethods: 'EVENT_AuthGetAuthMethods',
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock('@/contexts/NotificationContext', () => ({
  useNotification: jest.fn(() => ({ toast: { success: jest.fn() } })),
}));
jest.mock('@/features/auth/utils/error-mapper', () => ({
  mapUnlinkGoogleError: jest.fn(() => null),
}));
jest.mock('next-intl', () => ({
  useTranslations: jest.fn(() => (key: string) => key),
}));

// Mock createPortal to render inline in tests
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('DisconnectGoogleDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title and confirm text when open', () => {
    const mockMutate = jest.fn();
    const { useMutationUnlinkGoogle } = require('@/utils/generated/hooks');
    (useMutationUnlinkGoogle as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false });

    render(<DisconnectGoogleDialog isOpen onClose={jest.fn()} />);
    expect(screen.getByText('disconnectGoogleTitle')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { useMutationUnlinkGoogle } = require('@/utils/generated/hooks');
    (useMutationUnlinkGoogle as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });

    render(<DisconnectGoogleDialog isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when isOpen is false', () => {
    const { useMutationUnlinkGoogle } = require('@/utils/generated/hooks');
    (useMutationUnlinkGoogle as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });

    const { container } = render(<DisconnectGoogleDialog isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls mutate when Confirm is clicked', () => {
    const mockMutate = jest.fn();
    const { useMutationUnlinkGoogle } = require('@/utils/generated/hooks');
    (useMutationUnlinkGoogle as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false });

    render(<DisconnectGoogleDialog isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('disconnectGoogleConfirm'));
    expect(mockMutate).toHaveBeenCalledWith({});
  });

  it('shows fallback error message when error has no message', () => {
    let capturedOnError: ((error: any) => void) | undefined;
    const { useMutationUnlinkGoogle } = require('@/utils/generated/hooks');
    (useMutationUnlinkGoogle as jest.Mock).mockImplementation((opts: any) => {
      capturedOnError = opts?.onError;
      return { mutate: jest.fn(), isPending: false };
    });

    render(<DisconnectGoogleDialog isOpen onClose={jest.fn()} />);

    // Trigger error with no message — falls back to t("errors.unlinkGoogleFailed")
    act(() => {
      capturedOnError?.({ message: '' });
    });

    // t() mock returns the key, so we expect the i18n key as text
    expect(screen.getByText('errors.unlinkGoogleFailed')).toBeInTheDocument();
  });
});
