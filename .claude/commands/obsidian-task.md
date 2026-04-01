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

# Instructions

1. **Collect task info** — ask for any missing fields:
   - **Title** (required): short, imperative phrase, e.g. "Fix login redirect"
   - **Type** (required): `bug` or `feature`
   - **Description** (required): 1–3 sentences explaining what needs to be done
   - **Status** (optional, default: `Not Started`): one of `Not Started`, `Next`, `In Progress`, `Done`

   If the user's message already contains enough info, skip asking and proceed.

2. **Create the linked note** at `docs/obsidian/<Title>.md` using this template:

   ```
   ---
   type: <bug|feature>
   status: <status>
   ---

   ## Overview

   <1–3 sentences explaining WHAT the issue/feature is and WHY it matters>

   ## Details

   <For bugs: describe the exact symptom, where it occurs, steps to reproduce if known, and the expected vs actual behavior.>
   <For features: describe the user need, how it should work, and any relevant UI/UX or technical context.>

   ## Acceptance Criteria

   - [ ] <Criterion 1>
   - [ ] <Criterion 2>
   ```

   **Description quality rules:**
   - **Overview** must answer *what* and *why* in plain language (not bullet points)
   - **Details** must be specific — mention component names, routes, or behavior when known
   - **Acceptance Criteria** must be checkable, concrete items (≥ 2)
   - Derive as much detail as possible from the user's message; ask follow-up questions only for critical missing info

3. **Add the task line** to `docs/obsidian/Kanban Board.md` in the correct
   status column, immediately after the column header line (before the blank
   line or next item):

   ```
   - [ ] [[<Title>]]
   ```

   Column header format in the file:
   - `## Not Started`
   - `## Next`
   - `## In Progress`
   - `## Done`

4. **Confirm** to the user: show the task title, type, status, and the two
   files that were created/modified.

# Examples

## Example 1: User provides all info

**User:** "add a bug task: Fix dark mode flash on reload — it flickers white for 200ms before applying the theme"

**Action:**
- Create `docs/obsidian/Fix dark mode flash on reload.md`:
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

  On hard reload, the browser renders unstyled HTML before the theme CSS is
  applied, resulting in a white flash. This is likely caused by the theme class
  being applied via JavaScript after paint rather than via a server-side class
  on `<html>`. Affects all pages; most visible on dark-themed dashboard routes.

  Expected: Theme applies immediately with no flash.
  Actual: ~200ms white flash visible before dark theme kicks in.

  ## Acceptance Criteria

  - [ ] No white flash is visible on hard reload in any supported browser
  - [ ] Theme class is applied before first paint (e.g., via SSR or inline script)
  - [ ] Verified on Chrome, Safari, and Firefox
  ```
- Add `- [ ] [[Fix dark mode flash on reload]]` under `## Not Started` in Kanban Board.md
- Reply: "✅ Task added: **Fix dark mode flash on reload** (bug · Not Started)"

## Example 2: User provides partial info

**User:** "add task: Add CSV export to reports"

**AI asks:** "Type? (`bug` or `feature`) and a short description?"

**User:** "feature — users should be able to download their transaction report as a CSV file"

**Action:**
- Create `docs/obsidian/Add CSV export to reports.md`:
  ```
  ---
  type: feature
  status: Not Started
  ---

  ## Overview

  Users need to export their transaction report as a CSV file so they can
  analyze data in spreadsheet tools like Excel or Google Sheets.

  ## Details

  Add a "Download CSV" button to the `/dashboard/report` page. The export
  should include all visible transactions respecting the current date range
  and filter state. Columns: Date, Description, Category, Amount, Currency,
  Wallet. Use the existing `csv-export.ts` utility in `features/report/`.

  ## Acceptance Criteria

  - [ ] "Download CSV" button visible on the report page
  - [ ] Exported file includes correct columns and respects active filters
  - [ ] File is named `transactions-<date-range>.csv`
  ```
- Add `- [ ] [[Add CSV export to reports]]` under `## Not Started` in Kanban Board.md

## Example 3: User specifies status

**User:** "add feature task: Dark mode toggle, it's already in progress — let users switch between light and dark themes"

**Action:**
- Create note with detailed Overview / Details / Acceptance Criteria
- Add to `## In Progress` column.

# Constraints

- Title must be a valid filename (no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`)
- If title contains invalid chars, sanitize silently (replace with `-` or remove)
- Always insert the new task line AFTER the `## <Status>` header, before any existing tasks in that column — newest tasks go to the top
- Never modify the `%% kanban:settings` block at the bottom of Kanban Board.md
- Kanban Board path: `docs/obsidian/Kanban Board.md` (relative to project root)
- Task notes path: `docs/obsidian/<Title>.md`
- If a note with that title already exists, warn the user before overwriting

<!-- Generated by Skill Creator Ultra v1.0 -->
