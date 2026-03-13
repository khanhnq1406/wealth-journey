# Landing Page Footer — congdongvang.com

## Summary

Replace the existing WealthJourney-branded footer on the landing page with congdongvang.com community branding. The footer displays the community name, tagline, and advertising contact info as static text. The `LandingFooter` component already exists but needs content replacement and must be imported into the landing page.

## User Stories

- As a landing page visitor, I want to see the congdongvang.com community info at the bottom of the page.

## Functional Requirements

### FR-1: Replace footer content

Replace all existing content in `LandingFooter.tsx` with:
- **Line 1:** `congdongvang.com` (plain text, not a link)
- **Line 2:** `Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính`
- **Line 3:** `Liên hệ quảng cáo : 076.897.2512`

**Acceptance criteria:**
- [ ] Footer renders all three lines
- [ ] congdongvang.com is plain text (not clickable)
- [ ] Footer is visible on both mobile and desktop
- [ ] Vietnamese text renders correctly (Be Vietnam Pro font)

### FR-2: Import footer into landing page

Add `LandingFooter` to `page.tsx` so it renders below the main content.

**Acceptance criteria:**
- [ ] Footer appears at the bottom of the landing page
- [ ] Footer does not overlap with other content

## Architecture Changes (C4)

None — no new components, services, or data flows.

## Runtime Flow Diagrams

None — static content, no business logic.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

- Replace footer content: dark background, centered text, clean typography
- Mobile-first: readable on small screens, scales to desktop

## Security & Risk Assessment

**Risk level: Negligible** — hardcoded static text in JSX. No user input, no API calls, no data handling. No DFD or STRIDE analysis warranted.

## Edge Cases & Error Handling

- Vietnamese characters: handled by Be Vietnam Pro font already loaded in layout
- Long phone number wrapping on very small screens: use `whitespace-nowrap` if needed

## Out of Scope

- Making congdongvang.com a clickable link
- Adding social media links for congdongvang
- i18n translations (content is Vietnamese-only as specified)
