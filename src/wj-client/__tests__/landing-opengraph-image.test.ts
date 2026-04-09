import * as fs from "fs";
import * as path from "path";

const SOURCE_PATH = path.resolve(
  __dirname,
  "../app/[locale]/landing/opengraph-image.tsx"
);

describe("Landing opengraph-image exports", () => {
  it("should export runtime = 'edge'", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.runtime).toBe("edge");
  });

  it("should export size with width 1200 and height 630", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
  });

  it("should export contentType = 'image/png'", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.contentType).toBe("image/png");
  });

  it("should export a default function Image", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(typeof mod.default).toBe("function");
  });

  it("should export alt string", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(typeof mod.alt).toBe("string");
    expect((mod.alt as string).length).toBeGreaterThan(0);
  });
});

describe("Landing opengraph-image source correctness", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, "utf8");
  });

  it("should await params before accessing locale (Next.js 15 async params)", () => {
    // params must be typed as Promise and awaited before use
    expect(source).toMatch(/params.*Promise/);
    expect(source).toMatch(/await params/);
  });

  it("should not fetch a .woff2 font (Satori only supports TTF/OTF)", () => {
    expect(source).not.toMatch(/\.woff2/);
  });

  it("should guard the TTF URL to fonts.gstatic.com before fetching (SSRF prevention)", () => {
    expect(source).toMatch(/fonts\.gstatic\.com/);
    expect(source).toMatch(/https:/);
  });
});
