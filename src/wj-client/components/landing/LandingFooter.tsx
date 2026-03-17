"use client";

import { useEffect, useState } from "react";

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
        <p className="text-white text-sm sm:text-base mb-2">
          {footer.tagline}
        </p>
        <p className="text-white text-sm whitespace-nowrap">
          {footer.contactInfo}
        </p>
      </div>
    </footer>
  );
}
