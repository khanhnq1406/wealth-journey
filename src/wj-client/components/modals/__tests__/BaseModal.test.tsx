import { render, screen, fireEvent, act } from "@testing-library/react";
import { BaseModal } from "../BaseModal";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock window.visualViewport
Object.defineProperty(window, "visualViewport", {
  value: {
    height: 800,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

function renderModal(
  props: Partial<React.ComponentProps<typeof BaseModal>> = {}
) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: "Test Modal",
    children: <div data-testid="modal-content">Content</div>,
  };
  const merged = { ...defaultProps, ...props };
  return {
    ...render(<BaseModal {...merged} />),
    onClose: merged.onClose,
  };
}

describe("BaseModal swipe-to-close", () => {
  let rafSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      writable: true,
    });
    // Make requestAnimationFrame execute callbacks synchronously so dragY state updates
    rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    jest.useRealTimers();
  });

  it("closes when swiping down on the drag handle", () => {
    const { onClose } = renderModal();
    const dragHandle = screen.getByTestId("modal-drag-handle");

    act(() => {
      fireEvent.touchStart(dragHandle, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
    });
    act(() => {
      fireEvent.touchMove(dragHandle, {
        touches: [{ clientX: 100, clientY: 250 }],
      });
    });
    act(() => {
      fireEvent.touchEnd(dragHandle, {
        changedTouches: [{ clientX: 100, clientY: 250 }],
      });
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when swiping down on modal content", () => {
    const { onClose } = renderModal();
    const content = screen.getByTestId("modal-content");

    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT trigger swipe when touch starts on content and moves to handle area", () => {
    const { onClose } = renderModal();
    const content = screen.getByTestId("modal-content");

    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 300 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 50 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 50 }],
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
