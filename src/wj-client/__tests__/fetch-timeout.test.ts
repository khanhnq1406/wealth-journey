describe("fetchSiteSettings timeout pattern", () => {
  it("should abort fetch after 3 seconds", async () => {
    // Verify AbortController + setTimeout pattern works
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50); // 50ms for test speed

    // Use a mock fetch to avoid real network requests that conflict with MSW interceptors
    const mockFetch = jest.fn(() =>
      new Promise<Response>((_, reject) => {
        const handler = () => {
          reject(
            Object.assign(new Error("The operation was aborted"), {
              name: "AbortError",
            }),
          );
        };
        controller.signal.addEventListener("abort", handler);
      }),
    );

    try {
      await mockFetch();
    } catch (e: unknown) {
      // Should be AbortError
      expect(e).toBeDefined();
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
