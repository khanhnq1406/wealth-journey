import { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Hướng dẫn sử dụng | congdongvang.com",
    description:
      "Hướng dẫn sử dụng congdongvang.com: quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, bạc, cổ phiếu, crypto và tham gia cộng đồng đầu tư.",
    keywords: [
      "hướng dẫn sử dụng",
      "user guide",
      "congdongvang.com",
      "quản lý tài chính cá nhân",
      "danh mục đầu tư",
      "theo dõi giá vàng",
      "cộng đồng đầu tư",
      "personal finance guide",
      "investment portfolio guide",
      "gold investment guide",
    ],
    authors: [{ name: "congdongvang.com" }],
    openGraph: {
      title: "Hướng dẫn sử dụng | congdongvang.com",
      description:
        "Hướng dẫn sử dụng congdongvang.com: quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, bạc, cổ phiếu, crypto và tham gia cộng đồng đầu tư.",
      type: "website",
      url: "https://www.congdongvang.com/vi/guide",
      siteName: "congdongvang.com",
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "Hướng dẫn sử dụng congdongvang.com",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hướng dẫn sử dụng | congdongvang.com",
      description:
        "Hướng dẫn sử dụng congdongvang.com: quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, bạc, cổ phiếu, crypto và tham gia cộng đồng đầu tư.",
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
      canonical: "https://www.congdongvang.com/vi/guide",
      languages: {
        vi: "https://www.congdongvang.com/vi/guide",
        en: "https://www.congdongvang.com/en/guide",
        "x-default": "https://www.congdongvang.com/vi/guide",
      },
    },
  };
}

const guideSchemas: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Hướng dẫn sử dụng congdongvang.com",
    description:
      "Hướng dẫn từng bước sử dụng congdongvang.com để quản lý tài chính cá nhân, theo dõi danh mục đầu tư và tham gia cộng đồng đầu tư.",
    url: "https://www.congdongvang.com/vi/guide",
    inLanguage: "vi",
    step: [
      {
        "@type": "HowToSection",
        name: "Trang chủ & Quản lý tài chính",
        description:
          "Tìm hiểu cách sử dụng trang chủ: xem tổng tài sản, quản lý ví, xem giá vàng/bạc/ngoại tệ và theo dõi PNL.",
        position: 1,
      },
      {
        "@type": "HowToSection",
        name: "Danh mục đầu tư",
        description:
          "Hướng dẫn thêm khoản đầu tư, các loại tài sản (cổ phiếu, vàng, bạc, crypto), kế toán FIFO và cảnh báo giá.",
        position: 2,
      },
      {
        "@type": "HowToSection",
        name: "Cộng đồng đầu tư",
        description:
          "Hướng dẫn tham gia cộng đồng: đăng bài, bình luận, theo dõi người dùng, hashtag và bình chọn cảm xúc vàng/bạc.",
        position: 3,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Hướng dẫn sử dụng congdongvang.com",
    description:
      "Hướng dẫn sử dụng đầy đủ các tính năng của congdongvang.com.",
    url: "https://www.congdongvang.com/vi/guide",
    inLanguage: "vi",
    isPartOf: {
      "@type": "WebSite",
      name: "congdongvang.com",
      url: "https://www.congdongvang.com",
    },
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={guideSchemas} />
      {children}
    </>
  );
}
