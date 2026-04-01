import { routes } from "@/app/constants";

describe("routes.guide", () => {
  it('should be defined and equal "/guide"', () => {
    expect(routes.guide).toBeDefined();
    expect(routes.guide).toBe("/guide");
  });

  it("should be a string", () => {
    expect(typeof routes.guide).toBe("string");
  });
});
