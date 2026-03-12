import { useState, useEffect } from "react";

/**
 * Hook to detect if the current viewport is mobile-sized
 * Uses 800px breakpoint to match Tailwind's sm: breakpoint
 *
 * Features:
 * - Prevents SSR hydration mismatch with mounted flag
 * - Throttles resize events (150ms) for performance
 *
 * @returns boolean indicating if viewport is mobile (< 800px)
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setIsMounted(true));

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 800);
      }, 150);
    };

    // Initial check
    queueMicrotask(() => setIsMobile(window.innerWidth < 800));

    // Listen for resize events
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Prevent hydration mismatch by returning false until mounted
  if (!isMounted) return false;

  return isMobile;
}
