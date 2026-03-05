import { Metadata } from "next";

export const metadata: Metadata = {
  title: "WealthJourney - All-In-One Platform for Stocks, ETFs, Crypto, Gold & Silver",
  description: "Track stocks, ETFs, cryptocurrencies, and precious metals in one unified platform. Features FIFO accounting, real-time market data, Vietnamese SJC gold tracking, comprehensive portfolio analytics, and multi-currency wallet support for investors worldwide.",
  keywords: [
    "all-in-one financial platform",
    "unified investment tracker",
    "stock portfolio management",
    "ETF tracking",
    "cryptocurrency portfolio",
    "gold investment tracking",
    "silver investment",
    "Vietnamese gold SJC",
    "FIFO accounting",
    "cost basis tracking",
    "realized PNL calculator",
    "unrealized gains",
    "investment performance analytics",
    "multi-currency portfolio",
    "market data integration",
    "Yahoo Finance portfolio",
    "personal finance dashboard",
    "investment wealth tracking",
    "asset allocation tools",
    "portfolio rebalancing",
    "dividend tracking",
    "investment transaction history",
    "precious metals investment",
    "comprehensive portfolio management",
    "financial freedom tools",
  ],
  authors: [{ name: "WealthJourney" }],
  openGraph: {
    title: "WealthJourney - All-In-One Platform for Stocks, ETFs, Crypto, Gold & Silver",
    description: "Track stocks, ETFs, cryptocurrencies, and precious metals in one unified platform. Features FIFO accounting, real-time market data, Vietnamese SJC gold tracking, and comprehensive portfolio analytics.",
    type: "website",
    url: "https://wealthjourney.app",
    siteName: "WealthJourney",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "WealthJourney Investment Portfolio Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WealthJourney - All-In-One Platform for Stocks, ETFs, Crypto, Gold & Silver",
    description: "Track stocks, ETFs, cryptocurrencies, and precious metals in one unified platform. Features FIFO accounting, real-time market data, Vietnamese SJC gold tracking, and comprehensive portfolio analytics.",
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
