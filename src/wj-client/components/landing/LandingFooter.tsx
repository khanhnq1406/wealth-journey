"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface FooterSettings {
  brandName: string;
  tagline: string;
  contactInfo: string;
}

const DEFAULTS: FooterSettings = {
  brandName: "congdongvang.com",
  tagline: "Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính",
  contactInfo: "Liên hệ quảng cáo : 076.897.2512",
};

export default function LandingFooter() {
  const tNav = useTranslations("landing.footer");
  const [footer, setFooter] = useState<FooterSettings>(DEFAULTS);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    if (!apiUrl) return;

    fetch(`${apiUrl}/api/v1/public/site-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const settings = data?.data?.settings;
        if (!Array.isArray(settings)) return;
        const map: Record<string, string> = {};
        for (const s of settings) map[s.key] = s.value;
        setFooter({
          brandName: map["footer.brand_name"] || DEFAULTS.brandName,
          tagline: map["footer.tagline"] || DEFAULTS.tagline,
          contactInfo: map["footer.contact_info"] || DEFAULTS.contactInfo,
        });
      })
      .catch(() => {
        /* use defaults on error */
      });
  }, []);

  return (
    <footer className="bg-v2-red-primary py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-amber-200 text-lg sm:text-xl font-semibold mb-2">
          {footer.brandName}
        </p>
        <p className="text-v2-gold-accent text-sm sm:text-base mb-2">
          {footer.tagline}
        </p>
        <p className="text-v2-gold-accent text-sm whitespace-nowrap">
          {footer.contactInfo}
        </p>
        <div className="flex gap-4 mt-4 text-xs justify-center">
          <Link
            href="/legal/terms"
            className="text-v2-text-tertiary hover:text-v2-gold-accent transition-colors underline underline-offset-2"
          >
            {tNav("termsOfService")}
          </Link>
          <Link
            href="/legal/privacy"
            className="text-v2-text-tertiary hover:text-v2-gold-accent transition-colors underline underline-offset-2"
          >
            {tNav("privacyPolicy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
