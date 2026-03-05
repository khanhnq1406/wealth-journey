import { getTranslations } from "next-intl/server";
import { LanguageSelector } from "@/features/settings/components/LanguageSelector";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-md drop-shadow-round p-4">
        <LanguageSelector />
      </div>
    </div>
  );
}
