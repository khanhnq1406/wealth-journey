import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "../BottomSheet";

function renderSheet(
  props: Partial<React.ComponentProps<typeof BottomSheet>> = {}
) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: "Test Sheet",
    children: <div data-testid="sheet-content">Content</div>,
  };
  const merged = { ...defaultProps, ...props };
  return {
    ...render(<BottomSheet {...merged} />),
    onClose: merged.onClose,
  };
}

describe("BottomSheet swipe-to-close", () => {
  it("closes when swiping down on the drag handle", () => {
    const { onClose } = renderSheet();
    const dragHandle = screen.getByTestId("bottom-sheet-drag-handle");

    fireEvent.touchStart(dragHandle, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(dragHandle, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(dragHandle, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when swiping down on content", () => {
    const { onClose } = renderSheet();
    const content = screen.getByTestId("sheet-content");

    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
