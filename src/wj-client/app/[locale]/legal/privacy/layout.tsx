import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://congdongvang.com";

  return {
    title: `${t("privacy.title")} | WealthJourney`,
    description: t("privacy.subtitle"),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}/legal/privacy`,
      languages: {
        vi: `${baseUrl}/vi/legal/privacy`,
        en: `${baseUrl}/en/legal/privacy`,
      },
    },
    openGraph: {
      title: `${t("privacy.title")} | WealthJourney`,
      description: t("privacy.subtitle"),
    },
    robots: { index: true, follow: true },
  };
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
