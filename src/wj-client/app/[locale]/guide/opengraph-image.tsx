import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 86400; // Cache for 24 hours
export const alt = "Hướng dẫn sử dụng congdongvang.com";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VALID_LOCALES = ["vi", "en"] as const;

// Brand text by locale
const TEXT = {
  vi: {
    tagline: "Cộng Đồng Vàng",
    subtitle: "Sân chơi giao lưu, trao đổi, kiến thức\nvề thị trường đầu tư tài chính",
    badges: "Giá Vàng · Giá Bạc · Ngoại Tệ · Đầu Tư · Miễn Phí",
  },
  en: {
    tagline: "Gold Community",
    subtitle: "Exchange & grow your knowledge\nabout financial investment markets",
    badges: "Gold · Silver · FX · Investment · Free",
  },
} as const;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  // Validate locale — never use it in file paths or external URLs
  const locale: "vi" | "en" = VALID_LOCALES.includes(rawLocale as "vi" | "en")
    ? (rawLocale as "vi" | "en")
    : "vi";

  const text = TEXT[locale];

  // Attempt to load Roboto Bold as TTF — Satori only supports OTF/TTF (not WOFF2).
  // Use Google Fonts CSS API with a legacy user-agent to obtain a TTF src URL.
  let fontData: ArrayBuffer | null = null;
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Roboto:wght@700",
      { headers: { "User-Agent": "Mozilla/4.0" } }
    ).then((res) => res.text());
    const ttfUrl = css.match(/src:\s*url\(([^)]+\.ttf)\)/)?.[1];
    if (ttfUrl) {
      // Guard: only fetch from Google's font CDN — prevents SSRF if CSS is tampered
      const ttfParsed = new URL(ttfUrl);
      if (ttfParsed.hostname === "fonts.gstatic.com" && ttfParsed.protocol === "https:") {
        fontData = await fetch(ttfUrl).then((res) => res.arrayBuffer());
      }
    }
  } catch {
    // Font fetch failed — Satori will use system sans-serif
    fontData = null;
  }

  const imageResponseOptions = {
    ...size,
    ...(fontData
      ? { fonts: [{ name: "Roboto", data: fontData, weight: 700 as const }] }
      : {}),
  };

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #3D0101, #5F0202)",
            position: "relative",
            fontFamily: fontData ? "Roboto" : "Arial, sans-serif",
          }}
        >
          {/* Top gold accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #b8862d, #f0d078, #b8862d)",
            }}
          />

          {/* Bottom gold accent bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #b8862d, #f0d078, #b8862d)",
            }}
          />

          {/* Top-left corner decoration */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Top-right corner decoration */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Bottom-left corner decoration */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Bottom-right corner decoration */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "0 80px",
            }}
          >
            {/* Brand name */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: "#d2a74b",
                letterSpacing: "-1px",
              }}
            >
              congdongvang.com
            </div>

            {/* Gold divider */}
            <div
              style={{
                width: 200,
                height: 2,
                background: "linear-gradient(90deg, transparent, #d2a74b, transparent)",
              }}
            />

            {/* Tagline */}
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#f0d078",
              }}
            >
              {text.tagline}
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: 22,
                color: "#e8c87a",
                textAlign: "center",
                opacity: 0.9,
              }}
            >
              {text.subtitle}
            </div>

            {/* Feature badges */}
            <div
              style={{
                marginTop: 16,
                fontSize: 18,
                color: "#d2a74b",
                letterSpacing: "1px",
                opacity: 0.85,
              }}
            >
              {text.badges}
            </div>
          </div>

          {/* URL at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              fontSize: 16,
              color: "#d2a74b",
              opacity: 0.6,
            }}
          >
            www.congdongvang.com
          </div>
        </div>
      ),
      imageResponseOptions,
    );
  } catch {
    // Fallback: minimal image so crawlers never get a 500
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#3D0101",
          }}
        >
          <div style={{ fontSize: 48, color: "#d2a74b", fontFamily: "Arial, sans-serif" }}>
            congdongvang.com
          </div>
        </div>
      ),
      { ...size },
    );
  }
}
