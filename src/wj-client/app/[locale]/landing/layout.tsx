import { Metadata } from "next";

export const metadata: Metadata = {
  title: "WealthJourney - Track Gold & Silver Prices | Personal Finance Dashboard",
  description: "Monitor live gold and silver prices including SJC, DOJI, and world gold (XAU/USD). Track investments, manage wallets, and build wealth with WealthJourney's all-in-one personal finance platform.",
  keywords: [
    "gold price tracker",
    "silver price tracker",
    "SJC gold price",
    "vàng SJC",
    "giá vàng hôm nay",
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
    "WealthJourney",
  ],
  authors: [{ name: "WealthJourney" }],
  openGraph: {
    title: "WealthJourney - Track Gold & Silver Prices | Personal Finance Dashboard",
    description: "Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with WealthJourney.",
    type: "website",
    url: "https://wealthjourney.app",
    siteName: "WealthJourney",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "WealthJourney Gold & Silver Price Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WealthJourney - Track Gold & Silver Prices | Personal Finance Dashboard",
    description: "Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with WealthJourney.",
    images: ["/og-image.svg"],
    creator: "@wealthjourney",
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
    canonical: "https://wealthjourney.app",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
