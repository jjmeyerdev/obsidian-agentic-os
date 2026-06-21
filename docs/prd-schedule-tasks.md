# PRD — Schedule + Daily Tasks (live slice)

**Status:** draft for review
**Slice:** 1 of the dashboard-live effort (replacing static panels with live data)
**Date:** 2026-06-02

## Goal

Replace the static **Schedule** and **Daily Tasks** panels (Overview tab) with live
data read from today's daily-note frontmatter, written by a `plan-today` slash command.
Task checkboxes toggle and write back to the note.

## Success criteria

- Run **Plan Today** → today's daily note gets `schedule:` + `tasks:` frontmatter →
  both panels repaint with that real data on next refresh.
- Ticking a task checkbox in the panel updates `done:` in the note's frontmatter and
  round-trips (reopen dashboard, state persists).
- No daily note / no keys → panels show a graceful empty state (`▶ RUN PLAN TODAY`),
  never a crash or stale placeholder.
- `pnpm run build` (the only correctness gate — `tsc -noEmit` + bundle) passes.

## Scope

**In:** `plan-today` + `plan-tomorrow` slash commands; plugin read of frontmatter into
the two panels; interactive checkbox write-back; `+ add task` append.

**Out (later slices):** Activity Feed, Research tab, the other 7 buttons, file
watchers, running-state/toasts.

## Skill form (decided)

**Project-scoped slash commands** in the vault's `.claude/commands/`, invoked headlessly
by the dashboard button as `/Users/jay/.local/bin/claude -p "/plan-today"` with cwd =
vault root. Rationale: buttons are explicit single-purpose triggers (no auto-selection
needed, so a skill is overkill), and co-locating the command with the vault it writes
keeps them versioned together. Absolute `claude` path (`/Users/jay/.local/bin/claude`,
verified 2026-06-02) because GUI-launched Obsidian has a minimal PATH.

(Purely-mechanical commands like `pull-metrics` will be shell scripts instead — out of
scope here.)

## Prerequisite — configure core Daily Notes (one-time)

Core Daily Notes is enabled but unconfigured (defaults to vault root). Set it so every
producer of a daily note agrees on one path:

- **New file location:** `daily-notes`
- **Date format:** `YYYY-MM-DD`

Result: the canonical path is `daily-notes/<YYYY-MM-DD>.md`. (Verified 2026-06-02: no
`daily-notes.json` config and no existing daily notes, so this convention is being *set*,
not discovered.)

## Calendar source — Google Calendar via ICS (decided)

The Schedule panel is a **text agenda** of today's events (the live interactive calendar
already lives in the right sidebar as a Custom Frames webview — but a webview is pixels,
not readable data, so `plan-today` pulls events independently).

- **Source:** Google Calendar's **"Secret address in iCal format"** (`…/basic.ics`),
  read-only, rotatable from the same settings page.
- **Access at runtime:** `curl -s "$GCAL_ICS_URL"` → parse today's `VEVENT`s
  (start time + `SUMMARY`) → write into `schedule:`. Headless-safe, no OAuth.
- **Where the URL lives:** it's a secret needed by the *headless command run* (not the
  plugin, which only reads frontmatter, and not the repo's build-time `.env`). Recommended
  home: the **Shell Commands "Plan Today" command's environment** (set `GCAL_ICS_URL`
  inline or via its Environments tab) so it's available to the spawned `claude` run and
  is never committed. (Final wiring settled at authoring.)
- **Model — snapshot, not live:** `plan-today` snapshots the calendar into frontmatter at
  run time; re-running re-snapshots. The dashboard reads only the frontmatter, so it never
  touches the calendar. (A future slice could make it live; out of scope here.)

## Data contract — daily-note frontmatter

File: `daily-notes/<YYYY-MM-DD>.md`

```yaml
---
schedule:
  - { time: "09:00", label: "Standup" }
  - { time: "11:00", label: "Deep work — plugin slice" }
tasks:
  - { label: "Ship Schedule panel", done: false }
  - { label: "Process reading highlights", done: true, carryover: true }
---
```

- `schedule[]`: `{ time: "HH:MM" (24h), label: string }`. Rendered into
  `.schedule-row__time` / `.schedule-row__name`, sorted by time.
- `tasks[]`: `{ label: string, done: boolean, carryover?: boolean }`. `carryover: true`
  renders the `.task-tag` chip. Order preserved.
- Both keys optional; an absent key → that panel's empty state.

## Command behavior

- **`plan-today`** — builds today's plan from two sources, then writes/merges the
  `schedule:`/`tasks:` keys into **today's** daily note, preserving the note body and any
  other frontmatter. Idempotent: re-running updates in place without duplicating.
  - **`schedule:`** ← today's Google Calendar events (via `$GCAL_ICS_URL`, above).
  - **`tasks:`** ← yesterday's daily note unfinished tasks (`done: false`) carried over
    as `carryover: true`, plus any new tasks it plans for today.
- **`plan-tomorrow`** — identical, targeting **tomorrow's** daily note. (The dashboard
  shows *today*, so its effect isn't visible until tomorrow — expected.)

## Plugin behavior

- New read fn (e.g. `readDayPlan()` in a `dayplan.ts` module, mirroring the
  `usage` / `github` / `session` pattern) parses today's note frontmatter.
- `refreshDayPlan()` / `paintDayPlan()` paint the two panels, carrying a `dayPlanToken`
  guard like the other refreshers. Cadence: with the 60s tick + repaint on
  `active-leaf-change`.
- **Write-back:** checkbox click → `fileManager.processFrontMatter` flips
  `tasks[i].done`; `+ add task` appends `{ label: "", done: false }` and opens the note
  to rename. Both then repaint.
- Degrade: no note / parse error → empty state (matching the "never crash" discipline).

## Verification

1. Author `plan-today`, run via `claude -p "/plan-today"` in the vault → inspect the
   daily note: valid `schedule`/`tasks` frontmatter, body untouched.
2. `pnpm run build` passes.
3. In Obsidian: panels show the real plan; tick a box → frontmatter updates on disk;
   `+ add task` appends and opens the note.
4. Delete the keys → panels fall back to the empty state cleanly.

## Resolved decisions

1. **What `plan-today` weighs** — RESOLVED: `tasks:` from yesterday's unfinished tasks
   (carryover) + new tasks; `schedule:` from Google Calendar.
2. **Schedule source** — RESOLVED: Google Calendar via ICS secret URL (snapshot model).
3. **Daily-note path** — RESOLVED: `daily-notes/<YYYY-MM-DD>.md`, contingent on the
   one-time core Daily Notes config above (done by user 2026-06-02).

## Remaining to confirm at authoring

- Exact runtime home for `GCAL_ICS_URL` (Shell Commands command env vs. a sourced file).
- ICS parsing approach: let the headless `claude` agent parse the `.ics` text directly,
  or a tiny deterministic parser script. (Leaning: agent-parses, since it's already in
  the loop and handling all-day vs timed events is easier to instruct than to script.)

## Dependency note

The plugin can only paint what exists on disk, so the order within this slice is:
configure Daily Notes → author `plan-today` (writes the file) → wire the plugin read.
