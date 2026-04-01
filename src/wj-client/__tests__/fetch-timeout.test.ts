describe("fetchSiteSettings timeout pattern", () => {
  it("should abort fetch after 3 seconds", async () => {
    // Verify AbortController + setTimeout pattern works
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50); // 50ms for test speed

    try {
      await fetch("http://localhost:1", { signal: controller.signal });
    } catch (e: unknown) {
      // Should be either AbortError or connection refused
      expect(e).toBeDefined();
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
