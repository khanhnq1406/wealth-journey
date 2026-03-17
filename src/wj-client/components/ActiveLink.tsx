"use client";

import { usePathname, useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

function ActiveLink({
  children,
  href,
  className,
  disableBuiltInActive,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
  disableBuiltInActive?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = !disableBuiltInActive && pathname === href;

  const handleClick = (e: React.MouseEvent) => {
    // Allow Cmd/Ctrl+click and middle-click to open in new tab
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    router.push(href);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        "text-white w-full flex flex-nowrap gap-3 items-center font-medium min-h-[44px] px-3 py-2.5 rounded-lg transition-all duration-200",
        "hover:bg-white/20 hover:shadow-md",
        isActive
          ? "bg-white/30 shadow-md bfont-semibold"
          : "border-transparent border-none",
        className,
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </a>
  );
}

export default ActiveLink;
