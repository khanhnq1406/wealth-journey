---
type: feature
status: Done
---

## Overview

Two related UI improvements targeting the shared table infrastructure: align `TanStackTable`'s desktop styling with the v2 design system (using the price alert table as reference), and extract the drag-and-drop reorder pattern into a generic reusable `SortableList` component. Neither task touches the backend.

## Details

**Task 1 — TanStackTable desktop styling:** The current component uses a darker header background, heavier borders, larger/bolder header text, and hardcoded `neutral-*` colors that break the v2 theme. The goal is for all desktop tables to match the price alert table's header, border, hover, and typography tokens.

**Task 2 — Generic SortableList component:** Extract the drag-and-drop reorder logic from `DraggableWatchlistTable` into a reusable `SortableList` component in `components/table/`. No new dependencies needed — `@dnd-kit` packages are already installed. `DraggableWatchlistTable` will be refactored to use it as proof.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-02-table-ui-enhancements-spec.md` |
| Plan     | `docs/plans/2026-04-02-table-ui-enhancements-plan.md` |
| Progress | `docs/reports/2026-04-02-table-ui-enhancements-progress.md` |
| Report   | `docs/reports/2026-04-02-table-ui-enhancements-report.md` |
