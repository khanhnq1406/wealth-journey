import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const baseUrl = "https://congdongvang.com";

  return {
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}/legal`,
      languages: {
        vi: `${baseUrl}/vi/legal`,
        en: `${baseUrl}/en/legal`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
