import { GuideContent } from "./GuideContent";

/**
 * User Guide page — server component entry point.
 *
 * All interactive content (scroll spy, auth check) lives in GuideContent
 * which is a "use client" component.
 *
 * Route: /[locale]/guide
 */
export default function GuidePage() {
  return <GuideContent />;
}
