import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the generated hooks
jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetCommunityProfile: () => ({ data: null }),
  useMutationUpdateProfile: () => ({ mutate: jest.fn(), isPending: false }),
  EVENT_CommunityGetCommunityProfile: "community-profile",
}));

import { ProfileCard } from "../components/ProfileCard";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("ProfileCard", () => {
  const currentUser = { id: 1, name: "Test User", picture: "" };

  it("cover banner should not have rounded-t-xl class", () => {
    const { container } = render(
      <ProfileCard currentUser={currentUser} />,
      { wrapper }
    );

    // The cover banner is the first child of the card container
    const cardContainer = container.firstElementChild;
    const coverBanner = cardContainer?.firstElementChild;

    expect(coverBanner?.className).not.toContain("rounded-t-xl");
    expect(coverBanner?.className).toContain("w-full");
    expect(coverBanner?.className).toContain("h-16");
  });

  it("card container has overflow-hidden and rounded-2xl for proper clipping", () => {
    const { container } = render(
      <ProfileCard currentUser={currentUser} />,
      { wrapper }
    );

    const cardContainer = container.firstElementChild;
    expect(cardContainer?.className).toContain("overflow-hidden");
    expect(cardContainer?.className).toContain("rounded-2xl");
  });
});
