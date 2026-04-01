import { OrnateHeading } from "@/components/decorative/OrnateHeading";
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

interface GuideSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  level?: "h2" | "h3";
  children: React.ReactNode;
}

/**
 * Consistent section wrapper for the User Guide page.
 *
 * - h2 sections: OrnateDivider above + OrnateHeading (lg) for main sections
 * - h3 sections: smaller heading with icon inline for sub-sections
 * - id attribute enables anchor linking from GuideTOC
 * - scroll-mt-20 offsets the fixed navbar + mobile TOC bar
 */
export function GuideSection({
  id,
  title,
  icon,
  level = "h2",
  children,
}: GuideSectionProps) {
  if (level === "h2") {
    return (
      <section id={id} className="scroll-mt-20">
        <OrnateDivider variant="ornate" className="mb-6" />
        <div className="mb-6">
          <OrnateHeading size="lg">
            <span className="flex items-center gap-2">
              {icon}
              {title}
            </span>
          </OrnateHeading>
        </div>
        <div>{children}</div>
      </section>
    );
  }

  // h3 sub-section: icon inline, smaller heading, no divider
  return (
    <section id={id} className="scroll-mt-20">
      <h3 className="flex items-center gap-2 text-v2-gold-accent font-semibold text-base sm:text-lg mb-4">
        {icon}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
