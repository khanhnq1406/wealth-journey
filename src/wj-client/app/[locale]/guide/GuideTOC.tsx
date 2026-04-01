"use client";

interface GuideTOCSection {
  id: string;
  label: string;
}

interface GuideTOCProps {
  sections: GuideTOCSection[];
  activeSection: string;
}

/**
 * GuideTOC — Table of Contents for the user guide page.
 *
 * Desktop (lg+): Sticky vertical sidebar list.
 * Mobile (<lg):  Horizontal scrollable pill bar pinned below navbar.
 */
export function GuideTOC({ sections, activeSection }: GuideTOCProps) {
  function handleClick(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const activeClasses = "bg-v2-gold-primary text-v2-bg-dark font-medium";
  const inactiveClasses =
    "text-v2-text-tertiary hover:text-v2-gold-accent hover:bg-v2-maroon-600";
  const sharedButtonClasses =
    "min-h-[44px] cursor-pointer rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary";

  return (
    <nav
      aria-label="Guide Table of Contents"
      className="lg:sticky lg:top-20 w-full"
    >
      {/* Mobile: Horizontal scrollable pill bar (hidden on desktop) */}
      <div className="lg:hidden overflow-x-auto pb-2">
        <div className="flex flex-row gap-2 min-w-max px-4">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => handleClick(section.id)}
              className={`${sharedButtonClasses} whitespace-nowrap ${
                activeSection === section.id ? activeClasses : inactiveClasses
              }`}
              aria-current={activeSection === section.id ? "true" : undefined}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Vertical sticky list (hidden on mobile) */}
      <div className="hidden lg:flex flex-col gap-1">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            className={`${sharedButtonClasses} text-left w-full ${
              activeSection === section.id ? activeClasses : inactiveClasses
            }`}
            aria-current={activeSection === section.id ? "true" : undefined}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
