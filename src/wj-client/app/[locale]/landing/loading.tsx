import { OrnateDivider } from "@/components/decorative/OrnateDivider";

/** Inline shimmer block — replaces Skeleton import (which uses useTranslations) */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`bg-v2-bg-dark rounded relative overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-v2-gold-primary/20 to-transparent" />
    </div>
  );
}

/** Skeleton for a price table section */
function TableSkeleton({
  gradientFrom,
  rows = 9,
}: {
  gradientFrom: string;
  rows?: number;
}) {
  return (
    <div className="bg-v2-bg-surface rounded-lg overflow-hidden shadow-card">
      {/* Header */}
      <div className={`h-10 bg-gradient-to-r ${gradientFrom} to-transparent`} />
      {/* Rows */}
      <div className="divide-y divide-v2-border-light/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <ShimmerBlock className="h-4 w-1/3" />
            <ShimmerBlock className="h-4 w-1/4 ml-auto" />
            <ShimmerBlock className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a chart placeholder */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-v2-bg-surface rounded-lg overflow-hidden shadow-card flex flex-col ${className ?? ""}`}
    >
      {/* Chart title area */}
      <div className="px-4 pt-3 pb-2">
        <ShimmerBlock className="h-5 w-1/3" />
      </div>
      {/* Chart area */}
      <div className="flex-1 px-2 pb-2">
        <ShimmerBlock className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for sentiment card */
function SentimentSkeleton() {
  return (
    <div className="bg-v2-bg-surface rounded-lg p-4 shadow-card">
      <ShimmerBlock className="h-5 w-1/4 mb-3" />
      <ShimmerBlock className="h-10 w-full" />
    </div>
  );
}

/** Skeleton for navbar */
function NavbarSkeleton() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-v2-bg-surface/95 backdrop-blur-sm border-b border-v2-border-light/20">
      <div className="flex justify-between items-center h-14 sm:h-16 px-4 sm:px-8">
        <ShimmerBlock className="h-8 w-28" />
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-9 w-20 rounded-md hidden sm:block" />
          <ShimmerBlock className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for footer */
function FooterSkeleton() {
  return (
    <div className="bg-v2-bg-surface border-t border-v2-border-light/20 py-6 px-4 sm:px-8">
      <div className="flex flex-col items-center gap-2">
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-4 w-64" />
      </div>
    </div>
  );
}

export default function LandingLoading() {
  return (
    <div
      className="min-h-screen bg-v2-bg-primary"
      role="status"
      aria-label="Loading landing page"
    >
      <NavbarSkeleton />

      <main className="pt-14 sm:pt-16">
        {/* Mobile Layout */}
        <div className="sm:hidden px-4 py-4 pb-8 space-y-6">
          <TableSkeleton gradientFrom="from-v2-gold-primary/30" />
          <ChartSkeleton className="h-[400px]" />
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          <TableSkeleton gradientFrom="from-v2-silver-primary/30" />
          <ChartSkeleton className="h-[400px]" />
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          <TableSkeleton gradientFrom="from-v2-currency-accent/30" />
          <ChartSkeleton className="h-[400px]" />
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:block px-8 py-6 space-y-6">
          {/* Row 1: Gold */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-gold-primary/30" />
            <ChartSkeleton className="min-h-[430px]" />
          </div>
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          {/* Row 2: Silver */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-silver-primary/30" />
            <ChartSkeleton className="min-h-[500px]" />
          </div>
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          {/* Row 3: Currency */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-currency-accent/30" />
            <ChartSkeleton className="min-h-[500px]" />
          </div>
        </div>
      </main>

      <FooterSkeleton />
    </div>
  );
}
