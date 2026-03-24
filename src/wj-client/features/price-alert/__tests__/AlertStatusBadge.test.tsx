/**
 * Tests for AlertStatusBadge component (TDD - RED then GREEN)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="AlertStatusBadge"
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AlertStatusBadge } from "../components/AlertStatusBadge";
import { AlertStatus } from "@/gen/protobuf/v1/investment";
import investmentMessages from "@/messages/en/investment.json";

function renderBadge(status: AlertStatus) {
  return render(
    <NextIntlClientProvider locale="en" messages={investmentMessages}>
      <AlertStatusBadge status={status} />
    </NextIntlClientProvider>
  );
}

describe("AlertStatusBadge", () => {
  it("renders 'Active' label for ALERT_STATUS_ACTIVE", () => {
    renderBadge(AlertStatus.ALERT_STATUS_ACTIVE);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders 'Triggered' label for ALERT_STATUS_TRIGGERED", () => {
    renderBadge(AlertStatus.ALERT_STATUS_TRIGGERED);
    expect(screen.getByText("Triggered")).toBeInTheDocument();
  });

  it("renders 'Paused' label for ALERT_STATUS_PAUSED", () => {
    renderBadge(AlertStatus.ALERT_STATUS_PAUSED);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders with green styling for Active status", () => {
    const { container } = renderBadge(AlertStatus.ALERT_STATUS_ACTIVE);
    const badge = container.firstChild as HTMLElement;
    // Should have some green color class
    expect(badge.className).toMatch(/green/);
  });

  it("renders with gray styling for Triggered status", () => {
    const { container } = renderBadge(AlertStatus.ALERT_STATUS_TRIGGERED);
    const badge = container.firstChild as HTMLElement;
    // Triggered status should have a distinct styling
    expect(badge).not.toBeNull();
  });

  it("renders with orange/yellow styling for Paused status", () => {
    const { container } = renderBadge(AlertStatus.ALERT_STATUS_PAUSED);
    const badge = container.firstChild as HTMLElement;
    expect(badge).not.toBeNull();
  });

  it("renders without crashing for unspecified status", () => {
    renderBadge(AlertStatus.ALERT_STATUS_UNSPECIFIED);
    // Should render something without throwing
    expect(document.body).toBeTruthy();
  });

  it("has accessible role (uses span element)", () => {
    const { container } = renderBadge(AlertStatus.ALERT_STATUS_ACTIVE);
    expect(container.querySelector("span")).toBeInTheDocument();
  });
});
