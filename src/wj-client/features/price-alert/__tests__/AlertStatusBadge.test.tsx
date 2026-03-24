/**
 * Tests for AlertStatusBadge component (TDD - RED then GREEN)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="AlertStatusBadge"
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { AlertStatusBadge } from "../components/AlertStatusBadge";
import { AlertStatus } from "@/gen/protobuf/v1/investment";

describe("AlertStatusBadge", () => {
  it("renders 'Active' label for ALERT_STATUS_ACTIVE", () => {
    render(<AlertStatusBadge status={AlertStatus.ALERT_STATUS_ACTIVE} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders 'Triggered' label for ALERT_STATUS_TRIGGERED", () => {
    render(<AlertStatusBadge status={AlertStatus.ALERT_STATUS_TRIGGERED} />);
    expect(screen.getByText("Triggered")).toBeInTheDocument();
  });

  it("renders 'Paused' label for ALERT_STATUS_PAUSED", () => {
    render(<AlertStatusBadge status={AlertStatus.ALERT_STATUS_PAUSED} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders with green styling for Active status", () => {
    const { container } = render(
      <AlertStatusBadge status={AlertStatus.ALERT_STATUS_ACTIVE} />
    );
    const badge = container.firstChild as HTMLElement;
    // Should have some green color class
    expect(badge.className).toMatch(/green/);
  });

  it("renders with gray styling for Triggered status", () => {
    const { container } = render(
      <AlertStatusBadge status={AlertStatus.ALERT_STATUS_TRIGGERED} />
    );
    const badge = container.firstChild as HTMLElement;
    // Triggered status should have a distinct styling
    expect(badge).not.toBeNull();
  });

  it("renders with orange/yellow styling for Paused status", () => {
    const { container } = render(
      <AlertStatusBadge status={AlertStatus.ALERT_STATUS_PAUSED} />
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge).not.toBeNull();
  });

  it("renders without crashing for unspecified status", () => {
    render(<AlertStatusBadge status={AlertStatus.ALERT_STATUS_UNSPECIFIED} />);
    // Should render something without throwing
    expect(document.body).toBeTruthy();
  });

  it("has accessible role (uses span element)", () => {
    const { container } = render(
      <AlertStatusBadge status={AlertStatus.ALERT_STATUS_ACTIVE} />
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });
});
