---
name: obsidian-task
description: |
  Create a new task in the WealthJourney Obsidian Kanban board. Use when the
  user says "add a task", "create a task", "new task", "add to kanban",
  "tạo task", "thêm task", "add bug", "add feature", or describes something
  that needs to be tracked as a task.
---

# Goal

Quickly add a new task to the Obsidian Kanban board at
`docs/obsidian/Kanban Board.md`, creating a linked note with a standard
template — without the user having to touch the files manually.

# Naming Convention

Task note filenames follow the same `YYYY-MM-DD-<feature-slug>` pattern used
by spec, plan, progress, and report files. This keeps all artifacts for a
feature consistently named.

- **Date**: today's date in `YYYY-MM-DD` format
- **Feature slug**: kebab-case imperative phrase derived from the title
  - e.g. "Fix dark mode flash on reload" → `fix-dark-mode-flash-on-reload`
  - e.g. "Add CSV export to reports" → `add-csv-export-to-reports`

**Full filename:** `YYYY-MM-DD-<feature-slug>.md`
**Kanban link display text:** the original human-readable title (alias syntax)

# Instructions

1. **Collect task info** — ask for any missing fields:
   - **Title** (required): short, imperative phrase, e.g. "Fix login redirect"
   - **Type** (required): `bug` or `feature`
   - **Description** (required): 1–3 sentences explaining what needs to be done
   - **Status** (optional, default: `Not Started`): one of `Not Started`, `Next`, `In Progress`, `Done`

   If the user's message already contains enough info, skip asking and proceed.

2. **Derive the slug and filename:**
   - Slug: lowercase the title, replace spaces and special chars with `-`, strip leading/trailing `-`
   - Filename: `YYYY-MM-DD-<slug>.md` (use today's date)
   - Example: title "Fix dark mode flash on reload" → slug `fix-dark-mode-flash-on-reload` → file `2026-04-02-fix-dark-mode-flash-on-reload.md`

3. **Create the linked note** at `docs/obsidian/YYYY-MM-DD-<slug>.md` using this template:

   ```
   ---
   type: <bug|feature>
   status: <status>
   ---

   ## Overview

   <1–3 sentences explaining WHAT the issue/feature is and WHY it matters>

   ## Details

   <For bugs: describe the exact symptom, where it occurs, steps to reproduce if known, and the expected vs actual behavior. Do NOT suggest causes or fixes.>
   <For features: describe the user need and how it should behave from the user's perspective. Do NOT reference code, files, or implementation approach.>
   ```

   **Description quality rules:**
   - **Overview** must answer *what* and *why* in plain language (not bullet points)
   - **Details** stays at the behavior/experience level — no code references, no file paths, no implementation suggestions
   - Derive as much detail as possible from the user's message; ask follow-up questions only for critical missing info

4. **Add the task line** to `docs/obsidian/Kanban Board.md` in the correct
   status column, immediately after the column header line (before the blank
   line or next item).

   Use Obsidian alias syntax so the board shows the human-readable title but
   links to the dated file:

   ```
   - [ ] [[YYYY-MM-DD-<slug>|<Title>]]
   ```

   Column header format in the file:
   - `## Not Started`
   - `## Next`
   - `## In Progress`
   - `## Done`

5. **Confirm** to the user: show the task title, slug filename, type, status,
   and the two files that were created/modified.

# Examples

## Example 1: User provides all info

**User:** "add a bug task: Fix dark mode flash on reload — it flickers white for 200ms before applying the theme"

**Slug:** `fix-dark-mode-flash-on-reload`
**Filename:** `2026-04-02-fix-dark-mode-flash-on-reload.md`

**Action:**
- Create `docs/obsidian/2026-04-02-fix-dark-mode-flash-on-reload.md`:
  ```
  ---
  type: bug
  status: Not Started
  ---

  ## Overview

  The app briefly flashes a white background for ~200ms on page reload before
  applying the dark theme. This causes a jarring visual glitch that degrades
  perceived quality, especially on slow connections.

  ## Details

  Occurs on hard reload across all pages, most noticeable on dark-themed screens.

  Expected: Theme applies immediately with no visible flash.
  Actual: ~200ms white flash appears before the dark theme kicks in.
  ```
- Add `- [ ] [[2026-04-02-fix-dark-mode-flash-on-reload|Fix dark mode flash on reload]]` under `## Not Started` in Kanban Board.md
- Reply: "✅ Task added: **Fix dark mode flash on reload** (`2026-04-02-fix-dark-mode-flash-on-reload`) · bug · Not Started"

## Example 2: User provides partial info

**User:** "add task: Add CSV export to reports"

**AI asks:** "Type? (`bug` or `feature`) and a short description?"

**User:** "feature — users should be able to download their transaction report as a CSV file"

**Slug:** `add-csv-export-to-reports`
**Filename:** `2026-04-02-add-csv-export-to-reports.md`

**Action:**
- Create `docs/obsidian/2026-04-02-add-csv-export-to-reports.md`:
  ```
  ---
  type: feature
  status: Not Started
  ---

  ## Overview

  Users need to export their transaction report as a CSV file so they can
  analyze data in spreadsheet tools like Excel or Google Sheets.

  ## Details

  Users should be able to download their transaction report as a CSV file.
  The export should respect the current date range and active filters.
  Exported columns should include: Date, Description, Category, Amount, Currency, Wallet.
  ```
- Add `- [ ] [[2026-04-02-add-csv-export-to-reports|Add CSV export to reports]]` under `## Not Started` in Kanban Board.md

## Example 3: User specifies status

**User:** "add feature task: Dark mode toggle, it's already in progress — let users switch between light and dark themes"

**Action:**
- Filename: `2026-04-02-dark-mode-toggle.md`
- Create note with detailed Overview / Details
- Add `- [ ] [[2026-04-02-dark-mode-toggle|Dark mode toggle]]` to `## In Progress` column.

# Constraints

- Slug must be a valid filename (no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`)
- If the title contains invalid chars, sanitize silently when building the slug (replace with `-` or remove)
- Always insert the new task line AFTER the `## <Status>` header, before any existing tasks in that column — newest tasks go to the top
- Never modify the `%% kanban:settings` block at the bottom of Kanban Board.md
- Kanban Board path: `docs/obsidian/Kanban Board.md` (relative to project root)
- Task notes path: `docs/obsidian/YYYY-MM-DD-<slug>.md`
- If a note with that filename already exists, warn the user before overwriting

<!-- Generated by Skill Creator Ultra v1.0 -->
