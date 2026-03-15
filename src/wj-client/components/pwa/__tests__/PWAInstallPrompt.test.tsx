import { screen } from '@testing-library/react';
import { renderWithIntl as render } from '@/test-utils';
import { PWAInstallPrompt } from '../PWAInstallPrompt';

// Mock hooks
jest.mock('@/hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    isInstalled: false,
    platform: 'ios',
    canInstall: true,
    promptInstall: jest.fn(),
  }),
}));

jest.mock('@/hooks/useMobile', () => ({
  useMobile: () => true,
}));

describe('PWAInstallPrompt', () => {
  it('should render prompt for mobile users', async () => {
    render(<PWAInstallPrompt showDelay={0} />);

    // Wait for prompt to appear
    await screen.findByText('Install congdongvang.com');

    expect(screen.getByText(/Get the full app experience/i)).toBeInTheDocument();
  });
});
