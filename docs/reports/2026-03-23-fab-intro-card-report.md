# FAB Introduction Card Implementation Report

## Summary

Extended the FloatingActionButton to auto-open on the home page and display an admin-configurable introduction card (tagline + contact info) above the existing quick action buttons. Backend adds 3 keys to site settings whitelist with validation and seed data. Frontend extends the FAB component with new props and wires settings via React Query in the dashboard layout. Admin page gets a new "FAB / Welcome" settings section.

## Spec Reference

`docs/specs/2026-03-23-fab-intro-card-spec.md`

## Plan Reference

`docs/plans/2026-03-23-fab-intro-card-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 1   | Add FAB keys to site settings whitelist + validation | Done | `site_settings_service.go` | N/A (extends existing validated map) | N/A |
| 2   | Seed FAB default values in migration | Done | `migrate-site-settings/main.go` | N/A (uses existing FirstOrCreate pattern) | N/A |
| 3   | Extend FloatingActionButton with autoOpen + introContent | Done | `FloatingActionButton.tsx` | N/A | N/A |
| 4   | Fetch FAB settings in dashboard layout and wire to FAB | Done | `dashboard/layout.tsx` | N/A | N/A |
| 5   | Add FAB settings form section in admin page | Done | `dashboard/admin/page.tsx` | N/A | N/A |

## Security Implementation Summary

| Concern          | Implementation                        | Verified |
| ---------------- | ------------------------------------- | -------- |
| Input validation | Key whitelist + fab.enabled boolean validation + 500-char maxLength (client) + 5000-char limit (server) + HTML tag stripping | Yes |
| Authorization    | Read: public endpoint (no auth). Write: admin JWT + AdminGuard | Yes |
| XSS prevention   | Server-side HTML tag stripping (htmlTagRegex) + React auto-escapes on render | Yes |
| Data exposure    | FAB content is intentionally public. toSiteSettingDTOs strips updatedBy | Yes |

## Review Results

### Spec Compliance

All 5 tasks pass spec compliance review. Each task implements exactly what was requested — no missing requirements, no extra/unneeded work.

### Security Review

All tasks pass security review. Key controls verified:
- Key whitelist prevents arbitrary key injection
- fab.enabled validates as boolean string only
- HTML stripping applies to all setting values
- React JSX auto-escapes rendered text (no dangerouslySetInnerHTML)
- Public endpoint for read, admin-only for write

### Code Quality

All tasks pass code quality review. One critical layout issue found during Task 3 review (intro card in flex-row container) was fixed before commit by changing container to `flex flex-col items-end`.

## Known Issues / Technical Debt

- FAB settings query uses `["fab-settings"]` key but fetches all site settings. If other components need site settings, consider using a shared `["site-settings"]` query key.
- Server enforces 5000-char limit globally; 500-char limit is client-side only via `maxLength`. Could add server-side per-key validation.

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/domain/service/site_settings_service.go` | Added 3 keys to whitelist + fab.enabled validation |
| `src/go-backend/cmd/migrate-site-settings/main.go` | Added 3 seed entries |
| `src/wj-client/components/FloatingActionButton.tsx` | Added autoOpen, introContent props, intro card UI, flex-col layout |
| `src/wj-client/app/[locale]/dashboard/layout.tsx` | React Query fetch, fabIntroContent memo, FAB prop wiring |
| `src/wj-client/app/[locale]/dashboard/admin/page.tsx` | FormValues, settingsToForm, formToSettings, FAB/Welcome section |

## How to Test

### Manual Testing Steps

1. **Run migration** to seed FAB defaults:
   ```bash
   task backend:migrate-site-settings
   ```

2. **Verify FAB auto-opens on home page:**
   - Navigate to `/dashboard/home`
   - FAB should auto-open after 500ms showing intro card + action buttons
   - Navigate to any other page — FAB should NOT auto-open

3. **Verify intro card content:**
   - Intro card shows "San choi giao luu..." text with gold accent styling
   - Contact info shows "Lien he quang cao: 076.897.2512" in smaller text
   - Card has rounded corners, maroon background, gold border

4. **Verify admin settings:**
   - Go to `/dashboard/admin?tab=seo`
   - Scroll to "FAB / Welcome" section (after Footer Content)
   - Toggle enabled/disabled
   - Edit intro text (500 char limit with counter)
   - Edit contact info
   - Save and verify changes take effect on next home page load

5. **Verify graceful degradation:**
   - If settings API fails, FAB works normally without intro card
   - If fab.enabled is "false", intro card hidden but action buttons still show

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed. Changes are isolated to:
- Backend: site settings service (whitelist + validation) — no other services affected
- Frontend: FAB component (new optional props, backward compatible), layout (new query), admin page (new form section)
