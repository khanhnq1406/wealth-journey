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
