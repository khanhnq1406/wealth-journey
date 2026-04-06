// Verify i18n keys exist in both locales for the PNL share feature
import enMessages from "@/messages/en/ui.json";
import viMessages from "@/messages/vi/ui.json";

describe("sharePnl i18n keys", () => {
  const requiredKeys = [
    "buttonAriaLabel",
    "modalTitle",
    "generating",
    "download",
    "share",
    "shareTitle",
    "errorCapture",
    "errorShare",
  ];

  requiredKeys.forEach((key) => {
    it(`en/ui.json has dashboard.home.sharePnl.${key}`, () => {
      expect((enMessages as any).dashboard.home.sharePnl[key]).toBeDefined();
      expect(typeof (enMessages as any).dashboard.home.sharePnl[key]).toBe("string");
    });

    it(`vi/ui.json has dashboard.home.sharePnl.${key}`, () => {
      expect((viMessages as any).dashboard.home.sharePnl[key]).toBeDefined();
      expect(typeof (viMessages as any).dashboard.home.sharePnl[key]).toBe("string");
    });
  });
});
