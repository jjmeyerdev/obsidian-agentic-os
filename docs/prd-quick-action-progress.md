# PRD — Quick Action progress notes (living-note slice)

**Status:** v1 shipped (5 commands write/tick notes, verified live); v2 built (`progress.ts`
+ plugin wiring, builds clean) — pending Obsidian verification
**Slice:** dashboard-live effort — Overview tab, Quick Actions + a live progress affordance
**Date:** 2026-06-24

## Goal

Close the feedback gap between clicking a Quick Action and seeing its result. Today a
button fires a headless command that runs silently and only writes a single
`.agentic-os/runs.jsonl` line **when it finishes** (see the [Activity Feed PRD](prd-activity-feed.md)).
Between click and completion there is nothing to look at — "I hit the button and have to
wait to see if it actually did anything."

This slice makes each Quick Action command write a **living note** to a browsable
`dashboard-runs/` folder as it works — a checklist it ticks off step by step, ending in a
clear ✅/❌ — and has the plugin reflect that progress live on the dashboard. The note is
the during-run view; `runs.jsonl` stays the permanent finished-run record.

## The cheap path (chosen approach)

Progress is **model self-reported**: the slash command's prompt instructs it to rewrite a
progress note after each step. The only added token cost is a short prompt instruction plus
a handful of small file writes per run — negligible next to the work the command already
does.

Explicitly **not** this slice: `claude -p --output-format stream-json` (automatic per-tool
progress). That needs a real launcher piping stdout to a file the plugin tails, replacing
the fire-and-forget `executeCommandById` path — more plumbing, not more tokens. It stays a
later upgrade and this design does not block it (the plugin watches a folder either way).

## Sequencing — v1 (note) then v2 (plugin)

Built in two stoppable steps, mirroring how the Activity Feed shipped (producer/data first,
plugin polish after):

- **v1 — the living note.** Teach `/morning-brief` alone to write and tick a `dashboard-runs/`
  note. Verify by **opening that note in Obsidian** and watching it tick as the command runs.
  If the open note already answers "is it doing anything?", v2 is optional — the note *is* the
  live view. No plugin code in v1.
- **v2 — the plugin reflects it.** Only if the open note isn't enough: `progress.ts` +
  `fs.watch` + button running/done/failed states + the on-dashboard progress line, so you get
  the feedback without leaving the dashboard.

Decide whether to do v2 *after* living with v1, not before.

## Success criteria

- Clicking a wired Quick Action immediately puts its button in a **running** state (no
  waiting for the command to start producing output).
- While the command runs, a live progress line near the Quick Actions shows the current
  step (e.g. "Morning Brief — step 2/4: scanning inbox…"), updating as the note updates.
- On completion the button shows a brief ✅ (or ❌ on failure) and the progress line clears;
  the run also lands in the Activity Feed via the existing `runs.jsonl` append.
- The `dashboard-runs/` folder contains a human-readable note per run, openable in Obsidian,
  whose final state shows every step's outcome — so a run that died mid-way is visibly stuck
  rather than silently gone.
- No note / unreadable note / a command that never writes one → the button still reverts
  cleanly (a timeout fallback), never a stuck "running" state and never a crash.
- `pnpm run build` (the only correctness gate — `tsc -noEmit` + bundle) passes.

## Scope

**v1 (in):** the per-run living-note data contract; updating **one** command
(`/morning-brief`, the existing first producer) to write and tick the note as it works; the
visible `dashboard-runs/` folder + a retention cap. No plugin code.

**v2 (in, only if v1's open note isn't enough):** a `progress.ts` Node `fs` read of the
active note for an action; `fs.watch` on `dashboard-runs/` driving a guarded repaint; button
running/done/failed states + a single live progress line in `main.ts`; an optimistic
click→running flip with a timeout fallback.

**Out (later slices):** the `stream-json` launcher upgrade; backfilling the other commands
(they adopt the same note-writing convention over time, like they did the `runs.jsonl`
append); a full-screen run-detail view in the plugin (the note *is* the detail view — open
it in Obsidian); progress for actions not launched from a Quick Action button.

## Where the notes live (decided)

A **visible** vault folder: `dashboard-runs/` (not the hidden `.agentic-os/` dotfolder the
JSONL log uses). The point of this slice is that you can open a run and read it, so it must
be browsable in the file explorer. The plugin reads it via Node `fs` (desktop-only, like
`usage.ts`/`activity.ts`), resolving the vault's absolute path from the `FileSystemAdapter`
base path; the slash commands run with cwd = vault root and write with a plain relative path.

One markdown file per run, named for sortability and human scanning:
`dashboard-runs/2026-06-24-0732-morning-brief.md`.

> Privacy guardrail — `dashboard-runs/` is inside the synced vault, and the standing rule is
> no private data in the synced vault (no email senders/subjects, etc.). Step lines must be
> about *what the command is doing* ("scanning inbox… done"), never the private content it
> touches. Commands that handle email/messages keep specifics out of the note.

## Data contract — a run note

Frontmatter carries machine state; the body is the human checklist. The command rewrites the
whole file on each step (small file, simplest to author correctly):

```markdown
---
action: Morning Brief
status: running        # running | done | failed
started: 2026-06-24T07:32:00
updated: 2026-06-24T07:32:18
step: 2                # 1-based index of the current/last step
steps_total: 4
---

# Morning Brief

- [x] Fetch calendar — 5 events
- [x] Scan inbox — 6 to read
- [ ] ⏳ Pull headlines…
- [ ] Compose brief
```

- `action` (required) — must equal the Quick Action button label exactly, so the plugin can
  match a note to the button that launched it.
- `status` (required) — `running` while working; set to `done` or `failed` as the last write.
- `started` / `updated` (required) — ISO-8601 local; `updated` bumps every step (drives the
  staleness/timeout fallback).
- `step` / `steps_total` (optional) — power the "step 2/4" counter; absent → counter shows
  just the latest checklist text.
- The checklist body is the source of the live progress line: the plugin shows the text of
  the current step (the `⏳`/first-unchecked line, or the last line on completion).

A note that is missing, unparseable, or missing a required field is treated as "no active
run" — the plugin falls back to the click timeout rather than throwing.

## Plugin behavior (v2)

- `progress.ts` — `readActiveRun(vaultBasePath, action): RunProgress | null`. Finds the most
  recent `dashboard-runs/` note whose frontmatter `action` matches, parses status/step/
  checklist, returns typed progress or `null` (missing/malformed/none). Desktop-only.
- **Click → optimistic running.** `wireQuickActions` already runs the command on click; after
  a successful `executeCommandById`, flip that button to a `is-running` state immediately
  (spinner/disabled), and start a per-button timeout (~90s, configurable) that reverts it if
  no note ever appears or `updated` goes stale — so a command with no progress note still
  behaves exactly as today, just with a transient spinner.
- **Watch → paint.** `fs.watch` on `dashboard-runs/` (mirroring `watchSnapshot` for Token
  Burn), guarded by a monotonic `progressToken`. On change, re-read the active run for each
  running button and paint a single live progress line in the Quick Actions panel
  (`<action> — step N/M: <current step text>`). Each `updated` bump resets that button's
  timeout.
- **Completion.** `status: done` → button shows a brief ✅ then reverts; `failed` → ✗ then
  reverts; progress line clears. The Activity Feed picks the run up independently from the
  `runs.jsonl` append (unchanged), so the two stay decoupled.
- Cadence: event-driven via `fs.watch` (progress must feel live); no new polling timer. Only
  active when the dashboard is rendered and the pane is visible, like the other refreshers.

## Command behavior — `/morning-brief` (first producer)

The command's prompt gains a small progress protocol, run alongside its existing work:

1. At start, write `dashboard-runs/<date>-<time>-morning-brief.md` with `status: running`,
   `action: Morning Brief`, and the full step checklist all unchecked (`steps_total` set).
2. After **each** step, rewrite the note: tick that step, mark the next `⏳`, bump `step` and
   `updated`.
3. At the end, set `status: done` (or `failed` with the failing step left unchecked) and
   write the final `updated`.
4. Keep its existing one-line `.agentic-os/runs.jsonl` append on completion (unchanged) —
   the living note does not replace the permanent feed record.

Create `dashboard-runs/` if absent. Other commands adopt this protocol later, the same way
they adopt the `runs.jsonl` append.

## Retention

Living notes accumulate. On a successful start, the command (or the plugin on watch) prunes
`dashboard-runs/` to the most recent **N** notes (lean ~20). Browsable history is the point,
so notes are kept, not deleted on completion — just capped. Stuck `running` notes older than
a day are eligible for prune too (a crashed run leaves one behind).

## Verification

1. Hand-write a `dashboard-runs/…-morning-brief.md` with `status: running` and a half-ticked
   checklist → with the dashboard open, the live progress line shows the current step; edit
   the file to add a tick → the line updates within a second (watch fires).
2. Flip its `status` to `done` → the button flashes ✅ and the line clears.
3. Click a Quick Action whose command writes **no** note → the button spins then reverts via
   the timeout; no stuck state.
4. `pnpm run build` passes.
5. Run `/morning-brief` end to end → the note ticks step by step live, ends `done`, the
   button confirms, and a `brief` row appears in the Activity Feed.

## Resolved decisions

1. **Approach** — model self-reported checkpoints (the cheap path); `stream-json` deferred.
2. **Location** — a visible `dashboard-runs/` folder of per-run markdown notes (browsable),
   distinct from the hidden `.agentic-os/runs.jsonl` feed log.
3. **Note vs feed** — the living note is the during-run view; `runs.jsonl` stays the
   permanent finished record. Both, decoupled.
4. **First producer** — `/morning-brief`; others adopt the protocol over time.
5. **No-note safety** — optimistic click state + timeout fallback so unmigrated commands are
   unaffected.

## Decided defaults (were open)

- **Retention:** keep the most recent **20** notes; prune stuck-`running` notes older than
  **1 day**. Not a setting.
- **Per-step write:** rewrite the whole note each step (notes are tiny; simplest for the model
  to get right) — not append-only.
- **Click timeout (v2):** **90s**, hardcoded. Add a setting only if a real command runs longer.

## Remaining to confirm at v2 authoring

- Whether the live progress line lives in the Quick Actions panel header or as an inline row
  under the buttons (depends on the markup — confirm against the generated `markup.ts`).
