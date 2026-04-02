import React from "react";
import { render, screen } from "@testing-library/react";
import { NotificationItem } from "../NotificationItem";
import type { NotificationItem as NotificationItemType } from "@/gen/protobuf/v1/community";

function makeNotification(
  overrides: Partial<NotificationItemType>
): NotificationItemType {
  return {
    id: 1,
    type: "user_price_alert",
    isRead: false,
    createdAt: Math.floor(Date.now() / 1000),
    actorName: "",
    actorPicture: "",
    postPreview: "",
    metadata: "",
    ...overrides,
  };
}

describe("NotificationItem — user_price_alert", () => {
  it("uses resolvedTitle and resolvedBody from metadata when present", () => {
    const metadata = JSON.stringify({
      alertId: 42,
      symbol: "SJC",
      name: "Vàng SJC",
      direction: "above",
      targetPrice: 75000000,
      currentPrice: 76000000,
      priceSide: "buy",
      currency: "VND",
      resolvedTitle: "Cảnh báo giá Vàng SJC",
      resolvedBody: "Vàng SJC tăng vượt mức 75,000,000 VND",
    });

    render(
      <NotificationItem
        notification={makeNotification({ metadata })}
      />
    );

    // Should show the resolved template text, not hardcoded English
    expect(screen.getByText("Cảnh báo giá Vàng SJC")).toBeInTheDocument();
    expect(
      screen.getByText("Vàng SJC tăng vượt mức 75,000,000 VND")
    ).toBeInTheDocument();
    // Should NOT show hardcoded "triggered"
    expect(screen.queryByText(/triggered/)).not.toBeInTheDocument();
  });

  it("falls back to hardcoded display when resolvedTitle/resolvedBody absent (old notifications)", () => {
    const metadata = JSON.stringify({
      alertId: 42,
      symbol: "SJC",
      name: "Vàng SJC",
      direction: "above",
      targetPrice: 75000000,
      currentPrice: 76000000,
      priceSide: "buy",
      currency: "VND",
      // no resolvedTitle / resolvedBody
    });

    render(
      <NotificationItem
        notification={makeNotification({ metadata })}
      />
    );

    // Falls back to symbol + name display
    expect(screen.getByText(/SJC/)).toBeInTheDocument();
  });
});
