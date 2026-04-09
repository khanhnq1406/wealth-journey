import * as fs from "fs";
import * as path from "path";

describe("OG Image PNG", () => {
  const pngPath = path.join(process.cwd(), "public", "og-image.png");

  it("should exist at public/og-image.png", () => {
    expect(fs.existsSync(pngPath)).toBe(true);
  });

  it("should be a valid PNG file (starts with PNG magic bytes)", () => {
    const buffer = fs.readFileSync(pngPath);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  it("should be ≤ 300KB", () => {
    const stats = fs.statSync(pngPath);
    expect(stats.size).toBeLessThanOrEqual(300 * 1024);
  });
});
