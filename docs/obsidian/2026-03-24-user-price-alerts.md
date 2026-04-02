---
type: bug
status: Done
---

## Overview

The user price alert system needs fixes to work correctly for Vietnamese users, including i18n support for alert status labels and error messages displayed in the alerts settings page.

## Details

The price alert UI in `/dashboard/settings/alerts` displays English-only status labels and error messages regardless of the user's locale setting. Vietnamese users see untranslated strings throughout the alerts interface.

Expected: All alert status labels (Active, Triggered, Paused), error messages, and UI copy display in the user's selected language.
Actual: Strings appear in English only.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | _(not yet created)_ |
| Plan     | `docs/plans/2026-03-24-user-price-alerts-plan.md` |
