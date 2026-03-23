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
    </div>
  );
}
