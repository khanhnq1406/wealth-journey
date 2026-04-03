import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://congdongvang.com";

  return {
    title: `${t("terms.title")} | WealthJourney`,
    description: t("terms.subtitle"),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}/legal/terms`,
      languages: {
        vi: `${baseUrl}/vi/legal/terms`,
        en: `${baseUrl}/en/legal/terms`,
      },
    },
    openGraph: {
      title: `${t("terms.title")} | WealthJourney`,
      description: t("terms.subtitle"),
    },
    robots: { index: true, follow: true },
  };
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
