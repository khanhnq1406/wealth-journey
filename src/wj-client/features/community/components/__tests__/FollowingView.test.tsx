/**
 * Smoke test for FollowingView tab migration
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=FollowingView
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetFollowing: jest.fn(() => ({ data: null, isLoading: false })),
  useQueryGetFollowers: jest.fn(() => ({ data: null, isLoading: false })),
}));
jest.mock("lucide-react", () => ({
  Users: () => <div />,
  ArrowLeft: () => <div />,
}));
jest.mock("../UserListItem", () => ({
  UserListItem: () => <div />,
}));

import { FollowingView } from "../FollowingView";

describe("FollowingView", () => {
  const currentUser = { id: 1, name: "Test", picture: "" };

  it("renders following and followers tabs with role=tab", () => {
    render(<FollowingView currentUser={currentUser} />);
    // Get all tabs and verify at least 2 exist (following + followers)
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(2);
  });
});
