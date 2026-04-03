# Step 0: Create Kanban Task

**Input:** Task title, type (`bug` or `feature`), and a short description from the user.

**Goal:** Create a lightweight Kanban bookmark for this feature/bug — capturing what it is and why it matters, so the board stays in sync from the very start. This step does NOT do any analysis or propose solutions. That happens in Step 1 (Brainstorm).

**Output:** Two files created/updated:
- `docs/obsidian/YYYY-MM-DD-<slug>.md` — task note (bookmark)
- `docs/obsidian/Kanban Board.md` — new entry added under `## Not Started`

---

### Process

1. **Collect task info** — ask for any missing fields (one question at a time):
   - **Title** (required): short, imperative phrase, e.g. "Fix login redirect"
   - **Type** (required): `bug` or `feature`
   - **Description** (required): 1–3 sentences describing what is observed/needed — symptoms only, no root cause, no solution

   If the user's message already contains enough info, skip asking and proceed.

2. **Derive the slug and filename:**
   - Slug: lowercase the title, replace spaces and special chars with `-`, strip leading/trailing `-`
   - Filename: `YYYY-MM-DD-<slug>.md` (use today's date)
   - Example: "Fix system price alert for all codes" → `fix-system-price-alert-for-all-codes` → `2026-04-03-fix-system-price-alert-for-all-codes.md`
   - Slug must be a valid filename — sanitize silently (no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`)

3. **Check for existing task note** — if `docs/obsidian/YYYY-MM-DD-<slug>.md` already exists, warn the user before overwriting.

4. **Create the task note** at `docs/obsidian/YYYY-MM-DD-<slug>.md`:

   ```markdown
   ---
   type: <bug|feature>
   status: Not Started
   ---

   ## Overview

   <1–3 sentences: what the feature/bug is and why it matters — observable symptoms/needs only, no root cause or solution>

   ## Pipeline Artifacts

   | Artifact | File |
   | -------- | ---- |
   | Spec     | _(added after step 1)_ |
   | Plan     | _(added after step 2)_ |
   | Progress | _(added after step 3 starts)_ |
   | Report   | _(added after step 3 completes)_ |
   ```

   **Content quality rules:**
   - **Overview** answers *what* and *why* in plain language — no bullet points
   - No root cause analysis, no proposed solutions, no code references, no file paths
   - This note is a **bookmark only** — ideas, approaches, and decisions belong in Step 1 (Brainstorm)

5. **Add the Kanban entry** to `docs/obsidian/Kanban Board.md` under `## Not Started`, immediately after the header line (newest tasks at top):

   ```
   - [ ] [[YYYY-MM-DD-<slug>|<Title>]]
   ```

   - Never modify the `%% kanban:settings` block at the bottom
   - Do NOT create a duplicate entry — if one already exists for this slug, leave it in place

6. **Confirm** to the user: task title, slug filename, type, and the two files created/modified.

---

### Example

**User:** "add bug task: System price alert fires for all asset codes, not just the ones configured in admin"

**Slug:** `fix-system-price-alert-for-all-codes`
**File:** `2026-04-03-fix-system-price-alert-for-all-codes.md`

**Task note:**
```markdown
---
type: bug
status: Not Started
---

## Overview

The system price alert is triggering for all asset codes, including ones not
configured in the admin display config. This causes unwanted alerts for assets
that should not be monitored.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | _(added after step 1)_ |
| Plan     | _(added after step 2)_ |
| Progress | _(added after step 3 starts)_ |
| Report   | _(added after step 3 completes)_ |
```

**Kanban Board.md:** add under `## Not Started`:
```
- [ ] [[2026-04-03-fix-system-price-alert-for-all-codes|Fix system price alert for all codes]]
```

**Confirm:** "Task created: **Fix system price alert for all codes** (`2026-04-03-fix-system-price-alert-for-all-codes`) · bug · Not Started"
