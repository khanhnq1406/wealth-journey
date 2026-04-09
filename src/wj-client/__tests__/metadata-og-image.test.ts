/**
 * Unit tests verifying that the metadata constants/functions reference
 * the correct absolute PNG URL rather than the SVG path.
 */

describe("Landing FALLBACK_METADATA", () => {
  it("should reference og-image.png (not .svg) in openGraph.images", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
    expect(source).toContain("https://www.congdongvang.com/og-image.png");
  });
});

describe("Guide layout metadata", () => {
  it("should reference og-image.png (not .svg) in openGraph.images", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
    expect(source).toContain("https://www.congdongvang.com/og-image.png");
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
