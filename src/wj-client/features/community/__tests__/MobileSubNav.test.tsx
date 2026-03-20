import { render, screen } from "@testing-library/react";
import { MobileSubNav } from "../components/MobileSubNav";

describe("MobileSubNav", () => {
  it("renders all four navigation tabs", () => {
    render(<MobileSubNav />);
    expect(screen.getByText("Bảng tin")).toBeInTheDocument();
    expect(screen.getByText("Đã lưu")).toBeInTheDocument();
    expect(screen.getByText("Hồ sơ")).toBeInTheDocument();
    expect(screen.getByText("Thông báo")).toBeInTheDocument();
  });

  it("has sticky positioning classes on wrapper", () => {
    const { container } = render(<MobileSubNav />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("sticky");
    expect(wrapper?.className).toContain("top-0");
    expect(wrapper?.className).toContain("z-[5]");
  });
});
