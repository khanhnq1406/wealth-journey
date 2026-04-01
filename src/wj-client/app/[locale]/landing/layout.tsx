import { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";

const FALLBACK_METADATA: Metadata = {
  title:
    "Giá Vàng Hôm Nay | congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.",
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
    title:
      "Giá Vàng Hôm Nay | congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.",
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
        alt: "congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Giá Vàng Hôm Nay | congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.",
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/public/site-settings`, {
      next: { revalidate: 300 },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
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
    description:
      settings["seo.description"] || (FALLBACK_METADATA.description as string),
    keywords: keywords.length > 0 ? keywords : FALLBACK_METADATA.keywords,
    authors: [{ name: "congdongvang.com" }],
    openGraph: {
      title:
        settings["seo.og_title"] ||
        settings["seo.title"] ||
        (FALLBACK_METADATA.openGraph as any)?.title,
      description:
        settings["seo.og_description"] ||
        settings["seo.description"] ||
        (FALLBACK_METADATA.openGraph as any)?.description,
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
      card:
        (settings["seo.twitter_card"] as "summary" | "summary_large_image") ||
        "summary_large_image",
      title:
        settings["seo.twitter_title"] ||
        settings["seo.title"] ||
        (FALLBACK_METADATA.twitter as any)?.title,
      description:
        settings["seo.twitter_description"] ||
        settings["seo.description"] ||
        (FALLBACK_METADATA.twitter as any)?.description,
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
      canonical:
        settings["seo.canonical"] || "https://www.congdongvang.com/vi/landing",
      languages: {
        vi: "https://www.congdongvang.com/vi/landing",
        en: "https://www.congdongvang.com/en/landing",
        "x-default": "https://www.congdongvang.com/vi/landing",
      },
    },
  };
}

const landingSchemas: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Cộng Đồng Vàng",
    url: "https://www.congdongvang.com",
    logo: "https://www.congdongvang.com/logo.svg",
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "congdongvang.com",
    url: "https://www.congdongvang.com",
    inLanguage: "vi",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Cộng Đồng Vàng - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: "https://www.congdongvang.com",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "VND",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Tại sao chọn congdongvang.com?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "congdongvang.com cung cấp nền tảng tích hợp theo dõi cổ phiếu, ETF, crypto, vàng, bạc và ngân sách trong một ứng dụng miễn phí với kế toán FIFO và dữ liệu thị trường thời gian thực.",
        },
      },
      {
        "@type": "Question",
        name: "congdongvang.com có miễn phí không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Có, congdongvang.com hoàn toàn miễn phí, không có chi phí ẩn hay gói đăng ký trả phí.",
        },
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: "Theo dõi giá vàng và bạc trực tiếp",
    description:
      "Theo dõi giá vàng SJC, DOJI, vàng thế giới (XAU/USD), giá bạc và ngoại tệ trực tiếp tại congdongvang.com",
    url: "https://www.congdongvang.com/vi/landing",
    provider: {
      "@type": "Organization",
      name: "Cộng Đồng Vàng",
    },
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={landingSchemas} />
      {children}
    </>
  );
}
