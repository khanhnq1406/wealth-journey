"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LandingFooter() {
  const t = useTranslations("landing");
  const currentYear = new Date().getFullYear();

  // const footerLinks = {
  //   product: [
  //     { name: "Features", href: "#features" },
  //     { name: "Pricing", href: "#pricing" },
  //     { name: "Security", href: "#security" },
  //   ],
  //   company: [
  //     { name: "About", href: "#about" },
  //     { name: "Blog", href: "#blog" },
  //     { name: "Careers", href: "#careers" },
  //   ],
  //   legal: [
  //     { name: "Privacy", href: "#privacy" },
  //     { name: "Terms", href: "#terms" },
  //     { name: "Cookie Policy", href: "#cookies" },
  //   ],
  // };

  return (
    <footer className="bg-gray-900 text-gray-400 py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <span className="text-xl font-semibold text-white">
                WealthJourney
              </span>
            </Link>
            <p className="text-sm mb-4">
              {t("footer.tagline")}
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <span>{t("footer.builtWith")}</span>
              <span className="text-white">Next.js 15</span>
              <span>+</span>
              <span className="text-white">Go 1.23</span>
            </div>
          </div>

          {/* Product Links */}
          {/* <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bg focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}

          {/* Company Links */}
          {/* <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bg focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}

          {/* Legal Links */}
          {/* <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bg focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center text-sm">
          <p>&copy; {currentYear} WealthJourney. {t("footer.allRightsReserved")}</p>
          <div className="flex items-center space-x-6 mt-4 sm:mt-0">
            <a
              href="https://github.com/khanhnq1406/Personal_Financial_Management"
              className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bg focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1 min-h-[44px] flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="http://linkedin.com/in/khanhnq146/"
              className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-bg focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-md px-2 py-1 min-h-[44px] flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
