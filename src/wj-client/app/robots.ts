import type { MetadataRoute } from "next";
import { locales } from "@/i18n/request";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.congdongvang.com";

  // Generate disallow rules for all locales
  const disallowPaths = locales.flatMap((locale) => [
    `/${locale}/dashboard/`,
    `/${locale}/auth/`,
  ]);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowPaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
