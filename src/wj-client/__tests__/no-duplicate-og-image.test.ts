/**
 * Verifies that landing/layout.tsx and guide/layout.tsx no longer have
 * manual openGraph.images or twitter.images entries (cleanup after Phase 2).
 */
import { readFileSync } from "fs";
import { join } from "path";

describe("Phase 2 cleanup — no manual OG image arrays", () => {
  it("landing/layout.tsx should not contain manual og-image.png URL", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("og-image.png");
  });

  it("guide/layout.tsx should not contain manual og-image.png URL", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("og-image.png");
  });
});
