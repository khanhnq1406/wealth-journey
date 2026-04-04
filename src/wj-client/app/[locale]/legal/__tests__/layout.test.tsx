import { render } from "@testing-library/react";
import LegalLayout from "../layout";

jest.mock("next-intl/server", () => ({
  getLocale: jest.fn(),
}));

test("renders children", () => {
  const { getByText } = render(
    <LegalLayout>{<div>child</div>}</LegalLayout>
  );
  expect(getByText("child")).toBeInTheDocument();
});
