"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/utils/api-client";
import { AdminGuard } from "@/features/admin/components/AdminGuard";
import { BaseCard } from "@/components/BaseCard";
import { FormInput } from "@/components/forms/FormInput";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { FormToggle } from "@/components/forms/FormToggle";
import { TagInput } from "@/components/forms/TagInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useNotification } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

interface SiteSetting {
  key: string;
  value: string;
}

interface SiteSettingsResponse {
  success: boolean;
  settings: SiteSetting[];
}

interface FormValues {
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  seo_og_title: string;
  seo_og_description: string;
  seo_og_image: string;
  seo_og_url: string;
  seo_twitter_card: string;
  seo_twitter_title: string;
  seo_twitter_description: string;
  seo_twitter_creator: string;
  seo_robots_index: string;
  seo_robots_follow: string;
  seo_canonical: string;
  footer_brand_name: string;
  footer_tagline: string;
  footer_contact_info: string;
}

const QUERY_KEY = "admin-site-settings";

function settingsToForm(settings: SiteSetting[]): FormValues {
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(map["seo.keywords"] || "[]");
  } catch {
    keywords = [];
  }

  return {
    seo_title: map["seo.title"] || "",
    seo_description: map["seo.description"] || "",
    seo_keywords: keywords,
    seo_og_title: map["seo.og_title"] || "",
    seo_og_description: map["seo.og_description"] || "",
    seo_og_image: map["seo.og_image"] || "",
    seo_og_url: map["seo.og_url"] || "",
    seo_twitter_card: map["seo.twitter_card"] || "summary_large_image",
    seo_twitter_title: map["seo.twitter_title"] || "",
    seo_twitter_description: map["seo.twitter_description"] || "",
    seo_twitter_creator: map["seo.twitter_creator"] || "",
    seo_robots_index: map["seo.robots_index"] || "true",
    seo_robots_follow: map["seo.robots_follow"] || "true",
    seo_canonical: map["seo.canonical"] || "",
    footer_brand_name: map["footer.brand_name"] || "",
    footer_tagline: map["footer.tagline"] || "",
    footer_contact_info: map["footer.contact_info"] || "",
  };
}

function formToSettings(values: FormValues): SiteSetting[] {
  return [
    { key: "seo.title", value: values.seo_title },
    { key: "seo.description", value: values.seo_description },
    { key: "seo.keywords", value: JSON.stringify(values.seo_keywords) },
    { key: "seo.og_title", value: values.seo_og_title },
    { key: "seo.og_description", value: values.seo_og_description },
    { key: "seo.og_image", value: values.seo_og_image },
    { key: "seo.og_url", value: values.seo_og_url },
    { key: "seo.twitter_card", value: values.seo_twitter_card },
    { key: "seo.twitter_title", value: values.seo_twitter_title },
    { key: "seo.twitter_description", value: values.seo_twitter_description },
    { key: "seo.twitter_creator", value: values.seo_twitter_creator },
    { key: "seo.robots_index", value: values.seo_robots_index },
    { key: "seo.robots_follow", value: values.seo_robots_follow },
    { key: "seo.canonical", value: values.seo_canonical },
    { key: "footer.brand_name", value: values.footer_brand_name },
    { key: "footer.tagline", value: values.footer_tagline },
    { key: "footer.contact_info", value: values.footer_contact_info },
  ];
}

function AdminCMSContent() {
  const { toast } = useNotification();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => apiClient.get<SiteSettingsResponse>("/v1/public/site-settings"),
  });

  const { register, handleSubmit, control, reset } = useForm<FormValues>();

  useEffect(() => {
    const settings = data?.data?.settings;
    if (settings) {
      reset(settingsToForm(settings));
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (settings: SiteSetting[]) =>
      apiClient.put("/v1/admin/site-settings", { settings }),
    onSuccess: () => {
      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save settings");
    },
  });

  const onSubmit = (values: FormValues) => {
    const settings = formToSettings(values);
    mutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner text="Loading settings..." />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* SEO Metadata */}
      <BaseCard padding="lg">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text mb-4">
          SEO Metadata
        </h2>

        <div className="space-y-1">
          {/* Basic SEO */}
          <FormInput
            label="Page Title"
            placeholder="congdongvang.com - Track Gold & Silver Prices"
            {...register("seo_title")}
          />

          <FormTextarea
            name="seo_description"
            control={control}
            label="Meta Description"
            placeholder="Monitor live gold and silver prices..."
            rows={3}
            maxLength={500}
            showCharacterCount
          />

          <TagInput
            name="seo_keywords"
            control={control}
            label="Keywords"
            placeholder="Type a keyword and press Enter"
            helperText="Press Enter or comma to add a keyword"
          />

          {/* Open Graph */}
          <div className="border-t border-neutral-200 dark:border-dark-border pt-4 mt-4">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-dark-text-secondary mb-3">
              Open Graph
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormInput
                label="OG Title"
                placeholder="congdongvang.com"
                {...register("seo_og_title")}
              />
              <FormInput
                label="OG Image URL"
                placeholder="/og-image.svg"
                {...register("seo_og_image")}
              />
            </div>
            <FormInput
              label="OG Description"
              placeholder="Monitor live gold and silver prices..."
              {...register("seo_og_description")}
            />
            <FormInput
              label="OG URL"
              placeholder="https://congdongvang.com"
              {...register("seo_og_url")}
            />
          </div>

          {/* Twitter Card */}
          <div className="border-t border-neutral-200 dark:border-dark-border pt-4 mt-4">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-dark-text-secondary mb-3">
              Twitter Card
            </h3>
            <FormToggle
              name="seo_twitter_card"
              control={control}
              label="Card Type"
              options={[
                { value: "summary", label: "Summary" },
                { value: "summary_large_image", label: "Large Image" },
              ]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormInput
                label="Twitter Title"
                placeholder="congdongvang.com"
                {...register("seo_twitter_title")}
              />
              <FormInput
                label="Twitter Creator"
                placeholder="@congdongvang"
                {...register("seo_twitter_creator")}
              />
            </div>
            <FormInput
              label="Twitter Description"
              placeholder="Monitor live gold and silver prices..."
              {...register("seo_twitter_description")}
            />
          </div>

          {/* Robots & Canonical */}
          <div className="border-t border-neutral-200 dark:border-dark-border pt-4 mt-4">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-dark-text-secondary mb-3">
              Robots & Canonical
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormToggle
                name="seo_robots_index"
                control={control}
                label="Allow Indexing"
                options={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
              />
              <FormToggle
                name="seo_robots_follow"
                control={control}
                label="Allow Following"
                options={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
              />
            </div>
            <FormInput
              label="Canonical URL"
              placeholder="https://congdongvang.com"
              {...register("seo_canonical")}
            />
          </div>
        </div>
      </BaseCard>

      {/* Footer Content */}
      <BaseCard padding="lg">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-dark-text mb-4">
          Footer Content
        </h2>

        <div className="space-y-1">
          <FormInput
            label="Brand Name"
            placeholder="congdongvang.com"
            {...register("footer_brand_name")}
          />
          <FormInput
            label="Tagline"
            placeholder="Sân chơi giao lưu..."
            {...register("footer_tagline")}
          />
          <FormInput
            label="Contact Info"
            placeholder="Liên hệ quảng cáo : 076.897.2512"
            {...register("footer_contact_info")}
          />
        </div>
      </BaseCard>

      {/* Save Button */}
      <div className="flex sm:justify-end">
        <Button
          type={ButtonType.PRIMARY}
          htmlType="submit"
          loading={mutation.isPending}
          className="w-full sm:w-auto"
        >
          Save Settings
        </Button>
      </div>
    </form>
  );
}

export default function AdminCMSPage() {
  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
            Content Management
          </h1>
          <p className="text-sm text-neutral-500 dark:text-dark-text-tertiary mt-1">
            Manage landing page SEO metadata and footer content
          </p>
        </div>

        <AdminCMSContent />
      </div>
    </AdminGuard>
  );
}
