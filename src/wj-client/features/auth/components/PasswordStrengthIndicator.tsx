"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

type StrengthLevel = "weak" | "medium" | "strong" | "veryStrong";

interface StrengthResult {
  level: StrengthLevel;
  score: number; // 0-4
}

function calculateStrength(password: string): StrengthResult {
  if (!password) return { level: "weak", score: 0 };

  let criteria = 0;
  if (/[A-Z]/.test(password)) criteria++;
  if (/[a-z]/.test(password)) criteria++;
  if (/[0-9]/.test(password)) criteria++;
  if (/[^A-Za-z0-9]/.test(password)) criteria++;

  const lengthBonus = password.length >= 12 ? 1 : 0;
  const total = criteria + lengthBonus;

  if (total <= 1) return { level: "weak", score: 1 };
  if (total <= 2) return { level: "medium", score: 2 };
  if (total <= 3) return { level: "strong", score: 3 };
  return { level: "veryStrong", score: 4 };
}

const strengthColors: Record<StrengthLevel, string> = {
  weak: "bg-red-500",
  medium: "bg-orange-500",
  strong: "bg-yellow-500",
  veryStrong: "bg-green-500",
};

const strengthTextColors: Record<StrengthLevel, string> = {
  weak: "text-red-600 dark:text-red-400",
  medium: "text-orange-600 dark:text-orange-400",
  strong: "text-yellow-600 dark:text-yellow-400",
  veryStrong: "text-green-600 dark:text-green-400",
};

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const t = useTranslations("settings.passwordStrength");
  const { level, score } = useMemo(() => calculateStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              segment <= score
                ? strengthColors[level]
                : "bg-neutral-200 dark:bg-neutral-700"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${strengthTextColors[level]}`}>
        {t(level)}
      </p>
    </div>
  );
}
