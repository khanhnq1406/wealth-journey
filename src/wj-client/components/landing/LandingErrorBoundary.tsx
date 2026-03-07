"use client";

import { Component, ReactNode } from "react";
import { useTranslations } from "next-intl";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  strings?: {
    title: string;
    description: string;
    refreshButton: string;
  };
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class LandingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Landing page error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-neutral-50">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {this.props.strings?.title || "Something went wrong"}
              </h1>
              <p className="text-gray-600 mb-6">
                {this.props.strings?.description || "We apologize for the inconvenience. Please try refreshing the page."}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-500 transition-colors focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
              >
                {this.props.strings?.refreshButton || "Refresh Page"}
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export function LandingErrorBoundaryWithTranslations({ children, fallback }: Pick<Props, "children" | "fallback">) {
  const t = useTranslations("landingErrorBoundary");
  return (
    <LandingErrorBoundary
      strings={{
        title: t("title"),
        description: t("description"),
        refreshButton: t("refreshButton"),
      }}
      fallback={fallback}
    >
      {children}
    </LandingErrorBoundary>
  );
}
