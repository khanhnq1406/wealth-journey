import { getTranslations } from "next-intl/server";
import { LanguageSelector } from "@/features/settings/components/LanguageSelector";
import { Link } from "@/lib/navigation";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

 <div className="bg-v2-bg-surface rounded-md drop-shadow-round p-4">
        <LanguageSelector />
      </div>

      <Link
        href="/dashboard/settings/security"
 className="block bg-v2-bg-surface rounded-md drop-shadow-round p-4 hover:bg-v2-bg-surface-tint transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
 className="w-5 h-5 text-v2-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="font-medium text-v2-gold-accent">{t("security.title")}</span>
          </div>
          <svg
            className="w-4 h-4 text-v2-text-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-v2-text-tertiary uppercase tracking-wide px-1">
          {t("legal.title")}
        </h2>

        <Link
          href="/legal/terms"
          className="block bg-v2-bg-surface rounded-md drop-shadow-round p-4 hover:bg-v2-bg-surface-tint transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-v2-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <span className="font-medium text-v2-gold-accent">{t("legal.terms")}</span>
            </div>
            <svg
              className="w-4 h-4 text-v2-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/legal/privacy"
          className="block bg-v2-bg-surface rounded-md drop-shadow-round p-4 hover:bg-v2-bg-surface-tint transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-v2-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium text-v2-gold-accent">{t("legal.privacy")}</span>
            </div>
            <svg
              className="w-4 h-4 text-v2-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

    </div>
  );
}
