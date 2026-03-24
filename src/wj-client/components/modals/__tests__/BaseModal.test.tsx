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

describe("BaseModal body scroll lock — scroll position preservation", () => {
  beforeEach(() => {
    // Reset body styles before each test
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.top = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.top = "";
  });

  it("captures scrollY and applies it as body top offset when modal opens", () => {
    // Simulate page scrolled down 200px
    Object.defineProperty(window, "scrollY", { value: 200, writable: true });

    renderModal({ isOpen: true });

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-200px");
  });

  it("restores scroll position when modal closes", () => {
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    const scrollToSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {});

    const { rerender } = render(
      <BaseModal isOpen={true} onClose={jest.fn()} title="T">
        <div />
      </BaseModal>
    );

    // Close the modal
    rerender(
      <BaseModal isOpen={false} onClose={jest.fn()} title="T">
        <div />
      </BaseModal>
    );

    expect(scrollToSpy).toHaveBeenCalledWith(0, 300);
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");

    scrollToSpy.mockRestore();
  });
});

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
