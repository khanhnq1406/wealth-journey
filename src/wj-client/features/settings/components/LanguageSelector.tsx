"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/lib/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutationUpdatePreferences } from "@/utils/generated/hooks";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

const SUPPORTED_LANGUAGES = [
  { code: "en", nativeLabel: "English" },
  { code: "vi", nativeLabel: "Tiếng Việt" },
] as const;

export function LanguageSelector() {
  const t = useTranslations("settings.language");
  const currentLocale = useLocale();
  const [selected, setSelected] = useState(currentLocale);
  const [error, setError] = useState<string>();
  const router = useRouter();
  const pathname = usePathname();

  const updatePref = useMutationUpdatePreferences({
    onSuccess: () => {
      document.cookie = `wj-locale=${selected}; path=/; SameSite=Lax; Secure; max-age=31536000`;
      router.replace(pathname, { locale: selected });
    },
    onError: (err: any) => {
      setError(err.message || t("failedToUpdate"));
    },
  });

  const handleSave = () => {
    updatePref.mutate({
      preferences: {
        language: selected,
        preferredCurrency: "",
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
 <h3 className="font-medium text-v2-gold-accent">
          {t("title")}
        </h3>
 <p className="text-sm text-v2-text-tertiary">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <label
            key={lang.code}
            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
              selected === lang.code
 ? "border-v2-red-primary bg-v2-red-light"
 : "border-v2-border-light hover:bg-v2-bg-surface-tint"
            }`}
          >
            <input
              type="radio"
              name="language"
              value={lang.code}
              checked={selected === lang.code}
              onChange={() => setSelected(lang.code)}
              className="accent-v2-red-primary"
            />
            <span className="font-medium">{lang.nativeLabel}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-v2-red-negative text-sm">{error}</p>}

      <Button
        type={ButtonType.PRIMARY}
        onClick={handleSave}
        loading={updatePref.isPending}
        disabled={selected === currentLocale}
      >
        {t("save")}
      </Button>
    </div>
  );
}
