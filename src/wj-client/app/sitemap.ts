import type { MetadataRoute } from "next";
import { locales } from "@/i18n/request";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.congdongvang.com";

  const entries: MetadataRoute.Sitemap = [];

  // Root redirect page
  entries.push({
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  });

  // Landing pages for each locale
  for (const locale of locales) {
    entries.push({
      url: `${baseUrl}/${locale}/landing`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: locale === "vi" ? 1.0 : 0.8,
    });
  }

  return entries;
}
