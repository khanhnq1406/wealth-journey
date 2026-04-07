---
type: bug
status: Review
---

## Overview

The system price alert (`CheckAndAlert`) and user price alert (`EvaluateAlerts`) jobs both run on a 15-minute schedule but silently produce zero notifications in almost every cycle. The admin "trigger now" button works fine. Root cause investigation via log analysis reveals three silent failure paths: (1) baseline cold-start always skips the first detection cycle with no log output, (2) cooldown silently suppresses 8 consecutive cycles after an alert fires, and (3) the user alert job found 0 active alerts in DB with no diagnostic output.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-07-fix-alert-auto-trigger-not-working-spec.md` |
| Plan     | `docs/plans/2026-04-07-fix-alert-auto-trigger-not-working-plan.md` |
| Progress | `docs/reports/2026-04-07-fix-alert-auto-trigger-not-working-progress.md` |
| Report   | `docs/reports/2026-04-07-fix-alert-auto-trigger-not-working-report.md` |
