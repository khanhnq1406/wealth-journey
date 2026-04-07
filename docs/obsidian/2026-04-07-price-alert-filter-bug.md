---
type: bug
status: Review
---

## Overview

The status filter tabs on the Price Alerts screen ("Tất cả", "Đang hoạt động", "Đã kích hoạt") do not actually filter alerts — all three tabs always show the same full list. The UI highlights the correct tab, but the backend ignores the filter parameter due to a Gin query-binding failure on proto-generated structs.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-07-price-alert-filter-bug-spec.md` |
| Plan     | `docs/plans/2026-04-07-price-alert-filter-bug-plan.md` |
| Progress | `docs/reports/2026-04-07-price-alert-filter-bug-progress.md` _(added after step 3 starts)_ |
| Report   | `docs/reports/2026-04-07-price-alert-filter-bug-report.md` _(added after step 3 completes)_ |
