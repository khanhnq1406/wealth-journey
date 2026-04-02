"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/utils/api-client";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";

interface CategoryConfig {
  enabled: boolean;
  thresholdPct: number;
  titleTemplate: string;
  bodyTemplate: string;
}

interface PriceAlertConfig {
  cooldownMinutes: number;
  topMoversCount: number;
  userAlertTitleTemplate: string;
  userAlertAboveBodyTemplate: string;
  userAlertBelowBodyTemplate: string;
  categories: Record<string, CategoryConfig>;
}

interface ConfigResponse {
  success: boolean;
  config: PriceAlertConfig;
  message?: string;
}

const CATEGORIES = [
  "gold_vnd",
  "gold_usd",
  "silver_vnd",
  "silver_usd",
] as const;

const PLACEHOLDERS = [
  "moverName",
  "moverCode",
  "direction",
  "directionText",
  "changePct",
  "priceDiff",
  "currentPrice",
  "baselinePrice",
  "priceUnit",
  "currency",
  "category",
  "moverCount",
] as const;

const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  gold_vnd: {
    moverName: "SJC 1L-10L",
    moverCode: "SJL1L10",
    direction: "↑",
    directionText: "tăng",
    changePct: "2.5",
    priceDiff: "1,500,000",
    currentPrice: "85,500,000",
    baselinePrice: "84,000,000",
    priceUnit: "lượng",
    currency: "VND",
    category: "Vàng trong nước",
    moverCount: "3",
  },
  gold_usd: {
    moverName: "Gold World",
    moverCode: "XAU",
    direction: "↓",
    directionText: "giảm",
    changePct: "1.8",
    priceDiff: "-35.00",
    currentPrice: "2,315.00",
    baselinePrice: "2,350.00",
    priceUnit: "oz",
    currency: "USD",
    category: "Vàng thế giới",
    moverCount: "1",
  },
  silver_vnd: {
    moverName: "Bạc hạt SJC",
    moverCode: "SJC_SILVER",
    direction: "↑",
    directionText: "tăng",
    changePct: "3.2",
    priceDiff: "250,000",
    currentPrice: "1,050,000",
    baselinePrice: "800,000",
    priceUnit: "lượng",
    currency: "VND",
    category: "Bạc trong nước",
    moverCount: "2",
  },
  silver_usd: {
    moverName: "Silver World",
    moverCode: "XAG",
    direction: "↓",
    directionText: "giảm",
    changePct: "2.0",
    priceDiff: "-0.58",
    currentPrice: "28.42",
    baselinePrice: "29.00",
    priceUnit: "oz",
    currency: "USD",
    category: "Bạc thế giới",
    moverCount: "1",
  },
};

const USER_ALERT_PLACEHOLDERS = [
  "name",
  "symbol",
  "price",
  "currentPrice",
  "currency",
  "priceSide",
] as const;

const USER_ALERT_SAMPLE_VALUES: Record<string, string> = {
  name: "SJC 9999",
  symbol: "SJC",
  price: "50,000 VND",
  currentPrice: "51,200 VND",
  currency: "VND",
  priceSide: "mua",
};

function resolvePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? values[key] : match,
  );
}

function insertAtCursor(
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  text: string,
  currentValue: string,
  onChange: (newValue: string) => void,
) {
  const el = ref.current;
  if (!el) {
    onChange(currentValue + text);
    return;
  }
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? start;
  const newValue =
    currentValue.substring(0, start) + text + currentValue.substring(end);
  onChange(newValue);
  // Restore cursor position after React re-render
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + text.length;
    el.focus();
  });
}

export function PriceAlertConfigForm() {
  const t = useTranslations("admin.priceAlertConfig");
  const [config, setConfig] = useState<PriceAlertConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "gold_vnd",
  );
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [showUserAlertPlaceholders, setShowUserAlertPlaceholders] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const titleRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const userTitleRef = useRef<HTMLInputElement>(null);
  const userAboveBodyRef = useRef<HTMLTextAreaElement>(null);
  const userBelowBodyRef = useRef<HTMLTextAreaElement>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<ConfigResponse>(
        "/api/v1/admin/price-alert-config",
      );
      const data = res as unknown as ConfigResponse;
      if (data.success) {
        setConfig(data.config);
      }
    } catch {
      setError(t("toast.error"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.put<ConfigResponse>(
        "/api/v1/admin/price-alert-config",
        config,
      );
      const data = res as unknown as ConfigResponse;
      if (data.success) {
        setSuccess(t("toast.success"));
        setConfig(data.config);
      } else {
        setError(data.message || t("toast.error"));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("toast.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setError(null);
    setSuccess(null);
    setShowResetConfirm(false);

    try {
      const res = await apiClient.delete<ConfigResponse>(
        "/api/v1/admin/price-alert-config",
      );
      const data = res as unknown as ConfigResponse;
      if (data.success) {
        setSuccess(t("toast.resetSuccess"));
        setConfig(data.config);
      } else {
        setError(data.message || t("toast.resetError"));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("toast.resetError"));
    } finally {
      setIsResetting(false);
    }
  };

  const updateGlobal = <K extends keyof PriceAlertConfig>(
    key: K,
    value: PriceAlertConfig[K],
  ) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const updateUserAlertField = (field: string, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const updateCategory = (
    cat: string,
    key: keyof CategoryConfig,
    value: string | number | boolean,
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      categories: {
        ...config.categories,
        [cat]: {
          ...config.categories[cat],
          [key]: value,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg px-4 py-3">
        <p className="font-roboto text-sm text-v2-red-negative">{t("toast.error")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h3 className="font-roboto font-semibold text-lg text-v2-text-primary mb-4">
        {t("title")}
      </h3>

      <div className="space-y-6">
        {/* Global Settings */}
        <div className="space-y-4">
          <h4 className="font-roboto font-medium text-sm text-v2-text-secondary uppercase tracking-wide">
            {t("globalSettings")}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1">
                {t("cooldownMinutes")}
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={config.cooldownMinutes}
                onChange={(e) =>
                  updateGlobal("cooldownMinutes", parseInt(e.target.value) || 1)
                }
                className="w-full rounded-lg border border-v2-border-light bg-v2-maroon-900 px-3 py-2 font-roboto text-sm text-v2-text-primary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary"
              />
              <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">
                {t("cooldownHelp")}
              </p>
            </div>

            <div>
              <label className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1">
                {t("topMoversCount")}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.topMoversCount}
                onChange={(e) =>
                  updateGlobal("topMoversCount", parseInt(e.target.value) || 1)
                }
                className="w-full rounded-lg border border-v2-border-light bg-v2-maroon-900 px-3 py-2 font-roboto text-sm text-v2-text-primary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary"
              />
              <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">
                {t("topMoversHelp")}
              </p>
            </div>
          </div>
        </div>

        {/* Per-Category Settings */}
        <div className="space-y-3">
          <h4 className="font-roboto font-medium text-sm text-v2-text-secondary uppercase tracking-wide">
            {t("categorySettings")}
          </h4>

          {CATEGORIES.map((cat) => {
            const catConfig = config.categories[cat];
            if (!catConfig) return null;
            const isExpanded = expandedCategory === cat;

            return (
              <div
                key={cat}
                className="border border-v2-border-light rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-v2-bg-secondary hover:bg-v2-maroon-900 transition-colors"
                >
                  <span className="font-roboto text-sm font-medium text-v2-text-primary">
                    {t(`categories.${cat}`)}
                  </span>
                  <div className="flex items-center gap-3">
                    <label
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={catConfig.enabled}
                        onChange={(e) =>
                          updateCategory(cat, "enabled", e.target.checked)
                        }
                        className="rounded border-v2-border-light text-bg focus:ring-bg/30"
                      />
                      <span className="font-roboto text-xs text-v2-text-secondary">
                        {t("enabled")}
                      </span>
                    </label>
                    <span
                      className={`text-v2-text-tertiary transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 py-4 space-y-3 border-t border-v2-border-light">
                    <div>
                      <label className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1">
                        {t("thresholdPct")}
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        max={50}
                        step={0.1}
                        value={catConfig.thresholdPct}
                        onChange={(e) =>
                          updateCategory(
                            cat,
                            "thresholdPct",
                            parseFloat(e.target.value) || 0.1,
                          )
                        }
                        className="w-full rounded-lg border border-v2-border-light bg-v2-maroon-900 px-3 py-2 font-roboto text-sm text-v2-text-primary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary"
                      />
                    </div>

                    <div>
                      <label className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1">
                        {t("titleTemplate")}
                      </label>
                      <input
                        ref={(el) => {
                          titleRefs.current[cat] = el;
                        }}
                        type="text"
                        maxLength={200}
                        value={catConfig.titleTemplate}
                        onChange={(e) =>
                          updateCategory(cat, "titleTemplate", e.target.value)
                        }
                        className="w-full rounded-lg border border-v2-border-light bg-v2-maroon-900 px-3 py-2 font-roboto text-sm text-v2-text-primary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {PLACEHOLDERS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            title={t(`placeholders.${p}`)}
                            onClick={() =>
                              insertAtCursor(
                                { current: titleRefs.current[cat] ?? null },
                                `{${p}}`,
                                catConfig.titleTemplate,
                                (v) =>
                                  updateCategory(cat, "titleTemplate", v),
                              )
                            }
                            className="font-mono text-[11px] leading-tight bg-v2-maroon-900 hover:bg-v2-maroon-800 text-v2-text-secondary hover:text-v2-gold-primary px-1.5 py-0.5 rounded border border-v2-border-light transition-colors cursor-pointer"
                          >
                            {`{${p}}`}
                          </button>
                        ))}
                      </div>
                      {catConfig.titleTemplate && (
                        <div className="rounded-md bg-v2-maroon-900 mt-1.5 px-2 py-1.5">
                          <span className="font-roboto text-xs font-medium text-v2-text-tertiary">
                            {t("preview")}:
                          </span>
                          <p className="font-roboto text-sm text-v2-text-primary mt-0.5 break-words">
                            {resolvePlaceholders(
                              catConfig.titleTemplate,
                              SAMPLE_VALUES[cat] ?? SAMPLE_VALUES.gold_vnd,
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1">
                        {t("bodyTemplate")}
                      </label>
                      <textarea
                        ref={(el) => {
                          bodyRefs.current[cat] = el;
                        }}
                        maxLength={500}
                        rows={2}
                        value={catConfig.bodyTemplate}
                        onChange={(e) =>
                          updateCategory(cat, "bodyTemplate", e.target.value)
                        }
                        className="w-full rounded-lg border border-v2-border-light bg-v2-maroon-900 px-3 py-2 font-roboto text-sm text-v2-text-primary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary resize-none"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {PLACEHOLDERS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            title={t(`placeholders.${p}`)}
                            onClick={() =>
                              insertAtCursor(
                                { current: bodyRefs.current[cat] ?? null },
                                `{${p}}`,
                                catConfig.bodyTemplate,
                                (v) =>
                                  updateCategory(cat, "bodyTemplate", v),
                              )
                            }
                            className="font-mono text-[11px] leading-tight bg-v2-maroon-900 hover:bg-v2-maroon-800 text-v2-text-secondary hover:text-v2-gold-primary px-1.5 py-0.5 rounded border border-v2-border-light transition-colors cursor-pointer"
                          >
                            {`{${p}}`}
                          </button>
                        ))}
                      </div>
                      {catConfig.bodyTemplate && (
                        <div className="rounded-md bg-v2-maroon-900 mt-1.5 px-2 py-1.5">
                          <span className="font-roboto text-xs font-medium text-v2-text-tertiary">
                            {t("preview")}:
                          </span>
                          <p className="font-roboto text-sm text-v2-text-primary mt-0.5 whitespace-pre-wrap break-words">
                            {resolvePlaceholders(
                              catConfig.bodyTemplate,
                              SAMPLE_VALUES[cat] ?? SAMPLE_VALUES.gold_vnd,
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Alert Templates */}
        <div className="space-y-4">
          <div>
            <h4 className="font-roboto font-medium text-base text-v2-gold-accent">
              {t("userAlertTemplates")}
            </h4>
            <p className="font-roboto text-sm text-v2-text-tertiary mt-0.5">
              {t("userAlertTemplatesDesc")}
            </p>
          </div>

          {/* Title Template */}
          <div>
            <label className="block font-roboto text-sm font-medium text-v2-gold-accent mb-1">
              {t("userAlertTitleTemplate")}
            </label>
            <input
              ref={userTitleRef}
              type="text"
              maxLength={200}
              value={config.userAlertTitleTemplate ?? ""}
              onChange={(e) =>
                updateUserAlertField("userAlertTitleTemplate", e.target.value)
              }
              className="w-full rounded-lg border border-v2-border bg-v2-bg-dark px-3 py-2 font-roboto text-sm text-v2-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus:border-v2-gold-primary min-h-[44px]"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {USER_ALERT_PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  title={t(`userAlertPlaceholders.${p}`)}
                  onClick={() =>
                    insertAtCursor(
                      userTitleRef,
                      `{${p}}`,
                      config.userAlertTitleTemplate ?? "",
                      (v) => updateUserAlertField("userAlertTitleTemplate", v),
                    )
                  }
                  className="font-mono text-[11px] leading-tight bg-v2-bg-dark hover:bg-v2-maroon-600 text-v2-text-secondary hover:text-v2-gold-accent px-1.5 py-0.5 rounded border border-v2-border-light transition-colors cursor-pointer min-h-[44px] flex items-center"
                >
                  {`{${p}}`}
                </button>
              ))}
            </div>
            {config.userAlertTitleTemplate && (
              <div className="rounded-md bg-v2-bg-dark mt-1.5 px-2 py-1.5 border border-v2-border-light">
                <span className="font-roboto text-xs font-medium text-v2-text-tertiary">
                  {t("preview")}:
                </span>
                <p className="font-roboto text-sm text-v2-text-secondary mt-0.5 break-words">
                  {resolvePlaceholders(
                    config.userAlertTitleTemplate,
                    USER_ALERT_SAMPLE_VALUES,
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Above Body Template */}
          <div>
            <label className="block font-roboto text-sm font-medium text-v2-gold-accent mb-1">
              {t("userAlertAboveBodyTemplate")}
            </label>
            <textarea
              ref={userAboveBodyRef}
              maxLength={500}
              rows={2}
              value={config.userAlertAboveBodyTemplate ?? ""}
              onChange={(e) =>
                updateUserAlertField("userAlertAboveBodyTemplate", e.target.value)
              }
              className="w-full rounded-lg border border-v2-border bg-v2-bg-dark px-3 py-2 font-roboto text-sm text-v2-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus:border-v2-gold-primary resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {USER_ALERT_PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  title={t(`userAlertPlaceholders.${p}`)}
                  onClick={() =>
                    insertAtCursor(
                      userAboveBodyRef,
                      `{${p}}`,
                      config.userAlertAboveBodyTemplate ?? "",
                      (v) => updateUserAlertField("userAlertAboveBodyTemplate", v),
                    )
                  }
                  className="font-mono text-[11px] leading-tight bg-v2-bg-dark hover:bg-v2-maroon-600 text-v2-text-secondary hover:text-v2-gold-accent px-1.5 py-0.5 rounded border border-v2-border-light transition-colors cursor-pointer min-h-[44px] flex items-center"
                >
                  {`{${p}}`}
                </button>
              ))}
            </div>
            {config.userAlertAboveBodyTemplate && (
              <div className="rounded-md bg-v2-bg-dark mt-1.5 px-2 py-1.5 border border-v2-border-light">
                <span className="font-roboto text-xs font-medium text-v2-text-tertiary">
                  {t("preview")}:
                </span>
                <p className="font-roboto text-sm text-v2-text-secondary mt-0.5 whitespace-pre-wrap break-words">
                  {resolvePlaceholders(
                    config.userAlertAboveBodyTemplate,
                    USER_ALERT_SAMPLE_VALUES,
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Below Body Template */}
          <div>
            <label className="block font-roboto text-sm font-medium text-v2-gold-accent mb-1">
              {t("userAlertBelowBodyTemplate")}
            </label>
            <textarea
              ref={userBelowBodyRef}
              maxLength={500}
              rows={2}
              value={config.userAlertBelowBodyTemplate ?? ""}
              onChange={(e) =>
                updateUserAlertField("userAlertBelowBodyTemplate", e.target.value)
              }
              className="w-full rounded-lg border border-v2-border bg-v2-bg-dark px-3 py-2 font-roboto text-sm text-v2-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus:border-v2-gold-primary resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {USER_ALERT_PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  title={t(`userAlertPlaceholders.${p}`)}
                  onClick={() =>
                    insertAtCursor(
                      userBelowBodyRef,
                      `{${p}}`,
                      config.userAlertBelowBodyTemplate ?? "",
                      (v) => updateUserAlertField("userAlertBelowBodyTemplate", v),
                    )
                  }
                  className="font-mono text-[11px] leading-tight bg-v2-bg-dark hover:bg-v2-maroon-600 text-v2-text-secondary hover:text-v2-gold-accent px-1.5 py-0.5 rounded border border-v2-border-light transition-colors cursor-pointer min-h-[44px] flex items-center"
                >
                  {`{${p}}`}
                </button>
              ))}
            </div>
            {config.userAlertBelowBodyTemplate && (
              <div className="rounded-md bg-v2-bg-dark mt-1.5 px-2 py-1.5 border border-v2-border-light">
                <span className="font-roboto text-xs font-medium text-v2-text-tertiary">
                  {t("preview")}:
                </span>
                <p className="font-roboto text-sm text-v2-text-secondary mt-0.5 whitespace-pre-wrap break-words">
                  {resolvePlaceholders(
                    config.userAlertBelowBodyTemplate,
                    USER_ALERT_SAMPLE_VALUES,
                  )}
                </p>
              </div>
            )}
          </div>

          {/* User Alert Placeholder Guide */}
          <div className="border border-v2-border-light rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowUserAlertPlaceholders(!showUserAlertPlaceholders)}
              className="w-full flex items-center justify-between px-4 py-3 bg-v2-bg-surface hover:bg-v2-bg-surface-tint transition-colors min-h-[44px] cursor-pointer"
            >
              <span className="font-roboto text-sm font-medium text-v2-text-secondary">
                {t("userAlertPlaceholderGuide")}
              </span>
              <span
                className={`text-v2-text-tertiary transition-transform ${
                  showUserAlertPlaceholders ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {showUserAlertPlaceholders && (
              <div className="px-4 py-3 border-t border-v2-border-light">
                <div className="space-y-1.5">
                  {USER_ALERT_PLACEHOLDERS.map((p) => (
                    <div key={p} className="flex gap-2">
                      <code className="font-mono text-xs bg-v2-bg-dark px-1.5 py-0.5 rounded text-v2-gold-accent whitespace-nowrap">
                        {`{${p}}`}
                      </code>
                      <span className="font-roboto text-xs text-v2-text-tertiary">
                        {t(`userAlertPlaceholders.${p}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Placeholder Guide */}
        <div className="border border-v2-border-light rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPlaceholders(!showPlaceholders)}
            className="w-full flex items-center justify-between px-4 py-3 bg-v2-bg-secondary hover:bg-v2-maroon-900 transition-colors"
          >
            <span className="font-roboto text-sm font-medium text-v2-text-secondary">
              {t("placeholderGuide")}
            </span>
            <span
              className={`text-v2-text-tertiary transition-transform ${
                showPlaceholders ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>
          {showPlaceholders && (
            <div className="px-4 py-3 border-t border-v2-border-light">
              <div className="space-y-1.5">
                {PLACEHOLDERS.map((p) => (
                  <div key={p} className="flex gap-2">
                    <code className="font-mono text-xs bg-v2-maroon-900 px-1.5 py-0.5 rounded text-v2-gold-primary whitespace-nowrap">
                      {`{${p}}`}
                    </code>
                    <span className="font-roboto text-xs text-v2-text-tertiary">
                      {t(`placeholders.${p}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error/Success */}
        {error && (
          <div className="bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg px-4 py-2">
            <p className="font-roboto text-sm text-v2-red-negative">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-v2-bg-dark border border-v2-green-positive/30 rounded-lg px-4 py-2">
            <p className="font-roboto text-sm text-v2-green-positive">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            type={ButtonType.PRIMARY}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
          <Button
            type={ButtonType.SECONDARY}
            onClick={() => setShowResetConfirm(true)}
            loading={isResetting}
          >
            {isResetting ? t("resetting") : t("reset")}
          </Button>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmationDialog
          title={t("resetConfirmTitle")}
          message={t("resetConfirmMessage")}
          confirmText={t("resetConfirm")}
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
          isLoading={isResetting}
          variant="danger"
        />
      )}
    </div>
  );
}
