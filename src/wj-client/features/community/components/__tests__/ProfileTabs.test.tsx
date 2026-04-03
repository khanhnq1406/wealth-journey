/**
 * Smoke test for ProfileTabs tab migration
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=ProfileTabs
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetUserPosts: jest.fn(() => ({ data: null, isLoading: false })),
  useQueryGetLikedPosts: jest.fn(() => ({ data: null, isLoading: false })),
}));

import { ProfileTabs } from "../ProfileTabs";

describe("ProfileTabs", () => {
  const currentUser = { id: 1, name: "Test User", picture: "" };

  it("renders Posts, Likes, and Shared tabs with role=tab", () => {
    render(<ProfileTabs userId={1} currentUser={currentUser} />);
    expect(screen.getByRole("tab", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Likes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Shared" })).toBeInTheDocument();
  });
});
