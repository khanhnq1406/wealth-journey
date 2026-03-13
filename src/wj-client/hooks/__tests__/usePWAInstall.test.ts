import { renderHook, act, waitFor } from "@testing-library/react";
import { usePWAInstall } from "../usePWAInstall";

// Helper to flush microtasks
const flushMicrotasks = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  });
};

describe("usePWAInstall", () => {
  let beforeInstallPromptEvent: any;

  beforeEach(() => {
    // Reset all window properties before each test
    beforeInstallPromptEvent = null;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Mock navigator.standalone for iOS
    Object.defineProperty(window.navigator, "standalone", {
      writable: true,
      configurable: true,
      value: false,
    });

    // Reset user agent
    Object.defineProperty(window.navigator, "userAgent", {
      writable: true,
      configurable: true,
      value: "Mozilla/5.0",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("PWA Installation Detection", () => {
    it("should detect when app is not installed", async () => {
      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.isInstalled).toBe(false);
    });

    it("should detect iOS standalone mode", async () => {
      // Mock iOS standalone mode
      Object.defineProperty(window.navigator, "standalone", {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.isInstalled).toBe(true);
    });

    it("should detect Android display-mode: standalone", async () => {
      // Mock Android display-mode
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === "(display-mode: standalone)",
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.isInstalled).toBe(true);
    });
  });

  describe("Platform Detection", () => {
    it("should detect iOS devices", async () => {
      Object.defineProperty(window.navigator, "userAgent", {
        writable: true,
        configurable: true,
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
      });

      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.platform).toBe("ios");
    });

    it("should detect Android devices", async () => {
      Object.defineProperty(window.navigator, "userAgent", {
        writable: true,
        configurable: true,
        value: "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36",
      });

      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.platform).toBe("android");
    });

    it("should return 'other' for non-mobile devices", async () => {
      Object.defineProperty(window.navigator, "userAgent", {
        writable: true,
        configurable: true,
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      });

      const { result } = renderHook(() => usePWAInstall());

      // Wait for microtask state updates to complete
      await flushMicrotasks();

      expect(result.current.platform).toBe("other");
    });
  });

  describe("Install Prompt Handling", () => {
    it("should capture beforeinstallprompt event", async () => {
      const { result } = renderHook(() => usePWAInstall());

      // Wait for initial microtasks
      await flushMicrotasks();

      // Simulate beforeinstallprompt event
      const mockEvent = {
        preventDefault: jest.fn(),
        prompt: jest.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      };

      act(() => {
        window.dispatchEvent(
          new CustomEvent("beforeinstallprompt", { detail: mockEvent })
        );
      });

      await waitFor(() => {
        expect(result.current.canInstall).toBe(true);
      });
    });

    it("should trigger install prompt when available", async () => {
      const { result } = renderHook(() => usePWAInstall());

      // Wait for initial microtasks
      await flushMicrotasks();

      // Mock prompt
      const mockPrompt = jest.fn().mockResolvedValue(undefined);
      const mockEvent = {
        preventDefault: jest.fn(),
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: "accepted" }),
      };

      // Manually set the deferredPrompt
      act(() => {
        // Dispatch event to set deferredPrompt
        const event = new Event("beforeinstallprompt") as any;
        event.preventDefault = mockEvent.preventDefault;
        event.prompt = mockEvent.prompt;
        event.userChoice = mockEvent.userChoice;
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(result.current.canInstall).toBe(true);
      });

      // Trigger install
      await act(async () => {
        await result.current.promptInstall();
      });

      expect(mockPrompt).toHaveBeenCalled();
    });

    it("should not trigger install prompt when not available", async () => {
      const { result } = renderHook(() => usePWAInstall());

      // Wait for initial microtasks
      await flushMicrotasks();

      expect(result.current.canInstall).toBe(false);

      await act(async () => {
        await result.current.promptInstall();
      });

      // Should not throw error and handle gracefully
      expect(result.current.canInstall).toBe(false);
    });
  });

  describe("App Installed Event", () => {
    it("should detect when app is installed via appinstalled event", async () => {
      const { result } = renderHook(() => usePWAInstall());

      // Wait for initial microtasks
      await flushMicrotasks();

      expect(result.current.isInstalled).toBe(false);

      act(() => {
        window.dispatchEvent(new Event("appinstalled"));
      });

      await waitFor(() => {
        expect(result.current.isInstalled).toBe(true);
      });
    });
  });
});
