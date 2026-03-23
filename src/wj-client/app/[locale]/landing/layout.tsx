import { Metadata } from "next";

const FALLBACK_METADATA: Metadata = {
  title: "Giá Vàng Hôm Nay | Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân",
  description:
    "Theo dõi giá vàng SJC, DOJI, giá bạc, ngoại tệ trực tiếp. Quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, cổ phiếu, crypto miễn phí tại congdongvang.com",
  keywords: [
    "giá vàng hôm nay",
    "cộng đồng vàng",
    "cộng đồng đầu tư",
    "quản lý tài chính cá nhân",
    "giá vàng SJC",
    "giá bạc",
    "đầu tư vàng",
    "theo dõi danh mục đầu tư",
    "gold price tracker",
    "silver price tracker",
    "SJC gold price",
    "vàng SJC",
    "giá bạc hôm nay",
    "Vietnamese gold investment",
    "gold investment tracking",
    "silver investment",
    "XAU USD price",
    "personal finance dashboard",
    "investment portfolio tracker",
    "multi-currency portfolio",
    "FIFO accounting",
    "precious metals investment",
    "stock portfolio management",
    "cryptocurrency portfolio",
    "wealth management app",
    "financial freedom tools",
    "congdongvang.com",
  ],
  authors: [{ name: "congdongvang.com" }],
  openGraph: {
    title: "Giá Vàng Hôm Nay | Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân",
    description:
      "Theo dõi giá vàng SJC, DOJI, giá bạc, ngoại tệ trực tiếp. Quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, cổ phiếu, crypto miễn phí tại congdongvang.com",
    type: "website",
    url: "https://www.congdongvang.com",
    siteName: "congdongvang.com",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Cộng Đồng Vàng - Giá vàng hôm nay và quản lý tài chính cá nhân",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Giá Vàng Hôm Nay | Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân",
    description:
      "Theo dõi giá vàng SJC, DOJI, giá bạc, ngoại tệ trực tiếp. Quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, cổ phiếu, crypto miễn phí tại congdongvang.com",
    images: ["/og-image.svg"],
    creator: "@congdongvang",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.congdongvang.com/vi/landing",
    languages: {
      vi: "https://www.congdongvang.com/vi/landing",
      en: "https://www.congdongvang.com/en/landing",
      "x-default": "https://www.congdongvang.com/vi/landing",
    },
  },
};

async function fetchSiteSettings(): Promise<Record<string, string> | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/public/site-settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    const settings = data?.data?.settings;
    if (!Array.isArray(settings)) return null;
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettings();
  if (!settings) return FALLBACK_METADATA;

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(settings["seo.keywords"] || "[]");
  } catch {
    keywords = (FALLBACK_METADATA.keywords as string[]) || [];
  }

  const robotsIndex = settings["seo.robots_index"] !== "false";
  const robotsFollow = settings["seo.robots_follow"] !== "false";

  return {
    title: settings["seo.title"] || FALLBACK_METADATA.title,
    description: settings["seo.description"] || (FALLBACK_METADATA.description as string),
    keywords: keywords.length > 0 ? keywords : FALLBACK_METADATA.keywords,
    authors: [{ name: "congdongvang.com" }],
    openGraph: {
      title: settings["seo.og_title"] || settings["seo.title"] || (FALLBACK_METADATA.openGraph as any)?.title,
      description: settings["seo.og_description"] || settings["seo.description"] || (FALLBACK_METADATA.openGraph as any)?.description,
      type: "website",
      url: settings["seo.og_url"] || "https://www.congdongvang.com",
      siteName: "congdongvang.com",
      images: [
        {
          url: settings["seo.og_image"] || "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "congdongvang.com Gold & Silver Price Dashboard",
        },
      ],
    },
    twitter: {
      card: (settings["seo.twitter_card"] as "summary" | "summary_large_image") || "summary_large_image",
      title: settings["seo.twitter_title"] || settings["seo.title"] || (FALLBACK_METADATA.twitter as any)?.title,
      description: settings["seo.twitter_description"] || settings["seo.description"] || (FALLBACK_METADATA.twitter as any)?.description,
      images: [settings["seo.og_image"] || "/og-image.svg"],
      creator: settings["seo.twitter_creator"] || "@congdongvang",
    },
    robots: {
      index: robotsIndex,
      follow: robotsFollow,
      googleBot: {
        index: robotsIndex,
        follow: robotsFollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: settings["seo.canonical"] || "https://www.congdongvang.com/vi/landing",
      languages: {
        vi: "https://www.congdongvang.com/vi/landing",
        en: "https://www.congdongvang.com/en/landing",
        "x-default": "https://www.congdongvang.com/vi/landing",
      },
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
