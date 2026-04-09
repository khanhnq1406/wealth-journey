/**
 * Unit tests verifying metadata Phase 1 + Phase 2 state:
 * - No SVG references remain in layout files
 * - metadataBase is set in root layout
 * - Phase 2: manual og-image.png arrays removed (handled by opengraph-image.tsx file convention)
 */

describe("Landing layout metadata", () => {
  it("should not reference /og-image.svg", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
  });

  it("should not have manual og-image.png URL (Phase 2: file convention handles this)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("og-image.png");
  });
});

describe("Guide layout metadata", () => {
  it("should not reference /og-image.svg", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
  });

  it("should not have manual og-image.png URL (Phase 2: file convention handles this)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("og-image.png");
  });
});

describe("Root layout metadata", () => {
  it("should have metadataBase set to https://www.congdongvang.com", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/layout.tsx"),
      "utf-8"
    );
    expect(source).toContain("metadataBase");
    expect(source).toContain("https://www.congdongvang.com");
  });
});
