/**
 * TabBar component tests
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=TabBar
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabBar } from "../TabBar";

const TABS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

describe("TabBar", () => {
  it("renders all tab labels", () => {
    render(<TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gamma" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected=true", () => {
    render(<TabBar tabs={TABS} activeTab="b" onTabChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="a" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Beta" }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });

  it("active tab has tabIndex=0, others have tabIndex=-1", () => {
    render(<TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves focus to next tab (wraps)", () => {
    const onTabChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="c" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Gamma" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("a");
  });

  it("ArrowLeft moves focus to previous tab (wraps)", () => {
    const onTabChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="a" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenCalledWith("c");
  });

  it("Home moves focus to first tab", () => {
    const onTabChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="c" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Gamma" }), { key: "Home" });
    expect(onTabChange).toHaveBeenCalledWith("a");
  });

  it("End moves focus to last tab", () => {
    const onTabChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="a" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "End" });
    expect(onTabChange).toHaveBeenCalledWith("c");
  });

  it("skips disabled tabs during keyboard navigation", () => {
    const onTabChange = jest.fn();
    const tabs = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta", disabled: true },
      { id: "c", label: "Gamma" },
    ];
    render(<TabBar tabs={tabs} activeTab="a" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("c");
  });

  it("disabled tabs have pointer-events-none class", () => {
    render(
      <TabBar
        tabs={[{ id: "a", label: "Alpha", disabled: true }]}
        activeTab="x"
        onTabChange={jest.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveClass("pointer-events-none");
  });

  it("renders with pill variant container classes", () => {
    const { container } = render(
      <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} variant="pill" />
    );
    expect(container.querySelector('[role="tablist"]')).toHaveClass("bg-v2-bg-dark");
  });

  it("renders with sticky=true wrapper classes", () => {
    const { container } = render(
      <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} sticky />
    );
    expect(container.querySelector(".sticky")).toBeInTheDocument();
  });

  it("renders empty container when tabs is empty", () => {
    const { container } = render(
      <TabBar tabs={[]} activeTab="" onTabChange={jest.fn()} />
    );
    expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
  });

  it("uses ariaLabel on tablist", () => {
    render(
      <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} ariaLabel="Test navigation" />
    );
    expect(screen.getByRole("tablist", { name: "Test navigation" })).toBeInTheDocument();
  });
});
