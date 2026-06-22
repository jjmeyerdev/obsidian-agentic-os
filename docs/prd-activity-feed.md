# PRD — Activity Feed (live slice)

**Status:** shipped (PR #12)
**Slice:** dashboard-live effort — Overview tab, panel ⑥
**Date:** 2026-06-22

## Goal

Replace the static **Activity Feed** panel (dashboard Overview, the 8 designer rows) with
a live log of recent agentic runs. Each row keeps the mockup's exact shape — a check, a
category **badge**, a one-line **message** of what the run did, the **log** / **{}** chips,
and a relative **time** — but is read from a real run-log that the agentic slash commands
append to.

## Success criteria

- A slash command run (starting with `/morning-brief`) appends one entry to the run-log →
  the Activity Feed shows that run as the top row on the next refresh, newest-first.
- Header meta reads `N runs` reflecting the live row count (capped to the rows shown).
- Each row's badge text = the run `type`; the badge variant (neutral/accent/pos) comes
  from a fixed type→variant map; message = the run `msg`; time = relative age of `ts`.
- No run-log / empty log / parse error → the panel shows a single graceful empty state
  ("No recent runs yet"), never a crash and never the static placeholder rows.
- `pnpm run build` (the only correctness gate — `tsc -noEmit` + bundle) passes.

## Scope

**In:** an append-only JSONL run-log; a `activity.ts` Node `fs` read of its tail into typed
rows; `refreshActivity()` / `paintActivity()` in `main.ts` (heartbeat + active-leaf
repaint, stale-paint token); the empty state; updating `/morning-brief` to append one run
entry as the first producer.

**Out (later slices):** making the `log` / `{}` chips interactive (open the run's log /
show params) — v1 renders them as static affordances to preserve the mockup; backfilling
the other producers (`/plan-today`, future commands) — they adopt the same one-line append
helper over time; a "Full ↗" activity view (no such view exists in the markup; the feed is
dashboard-only).

## Where the run-log lives (decided)

A single append-only JSONL file at the **vault root**: `.agentic-os/runs.jsonl`.

Rationale: it travels with the vault (syncs, inspectable), and the slash commands already
run with cwd = vault root, so they append with a plain relative path. The plugin reads it
via Node `fs` (desktop-only, like `usage.ts`/`session.ts`), resolving the vault's absolute
path from the `FileSystemAdapter` base path. JSONL (not frontmatter) because this is an
unbounded, cross-day, append-only stream — not "today's" one-per-day data, so it does not
belong in the daily note the way `schedule:`/`tasks:`/`brief:` do.

> Flag — a dotfolder (`.agentic-os/`) is hidden in Obsidian's file explorer by default. That
> is fine for v1 (it's machine state, inspected in a text editor when needed); revisit the
> name if it should be browsable in-app.

## Data contract — `runs.jsonl`

One JSON object per line, appended in chronological order (the reader sorts/takes the tail):

```json
{"ts":"2026-06-22T07:32:00","type":"brief","msg":"Compiled morning brief — 3 priorities, 6 inbox items"}
{"ts":"2026-06-22T08:30:00","type":"plan","msg":"Generated today's plan — 8 tasks, 4 scheduled blocks","log":"logs/plan-0830.md","params":{"horizon":"day"}}
```

- `ts` (required) — ISO-8601 local timestamp → the relative `.activity-row__time` ("2m", "1h").
- `type` (required) — short run category → the `.badge` text (`plan`, `research`, `brief`,
  `metrics`, `pipeline`, `cleanup`, `review`, …). Free-form; unknown types still render.
- `msg` (required) — one-line human description → `.activity-row__msg`.
- `log` (optional) — path/string for the `log` chip. v1: chip is static, value unused.
- `params` (optional) — object for the `{}` chip. v1: chip is static, value unused.

A line that is empty, unparseable, or missing a required field is skipped (the read never
throws on a malformed tail-write).

### Type → badge variant (fixed map)

Matches the mockup's three badge styles; default to neutral for unknown types.

| Variant | Types |
|---------|-------|
| `badge--pos` | `metrics`, `pipeline`, `review` |
| `badge--accent` | `research`, `brief`, `atomize` |
| `badge--neutral` | `plan`, `cleanup`, everything else (default) |

## Plugin behavior

- `activity.ts` — `readActivity(vaultBasePath, limit): ActivityRun[]`. Reads
  `<base>/.agentic-os/runs.jsonl`, parses each line, drops malformed/incomplete ones, sorts
  newest-first by `ts`, returns the first `limit` (~8, matching the designer row count).
  Returns `[]` on a missing file or any read error (degrade, never throw). Desktop-only.
- `refreshActivity()` — no-op unless the dashboard is rendered; guarded by a monotonic
  `activityToken` like the other refreshers; resolves the vault base path, reads, paints.
- `paintActivity(root, runs)` — clears the static `.activity-row` rows under `.activity-feed`
  and rebuilds them from `runs` (check svg + badge + msg + `log`/`{}` chips + relative time);
  sets `.panel__meta` to `N runs`. Empty `runs` → one "No recent runs yet" empty row and
  `0 runs`.
- Cadence: the existing 60s heartbeat and the `active-leaf-change` repaint (same group as
  Token Burn / Latest Session). No file watcher in v1 — the log is appended by external
  commands and the 60s tick is timely enough; a `fs.watch` repaint can be added later if
  needed (mirrors `watchSnapshot` for Token Burn).

## Command behavior — `/morning-brief` (first producer)

After it writes `brief:` into the daily note, append one line to `.agentic-os/runs.jsonl`:

```json
{"ts":"<now ISO>","type":"brief","msg":"Compiled morning brief — <N> headlines, <M> to read"}
```

Create `.agentic-os/` if absent; append (never rewrite) so history accumulates. Other
commands adopt the same one-line append later.

## Verification

1. Append a couple of hand-written lines to `.agentic-os/runs.jsonl` → the feed shows them
   newest-first with correct badges/times; `N runs` matches.
2. `pnpm run build` passes.
3. Remove / empty the file → the panel shows "No recent runs yet" cleanly (no placeholders).
4. Run `/morning-brief` → a `brief` row appears at the top after the next refresh.

## Resolved decisions

1. **Row meaning** — typed agentic runs, matching the mockup (not raw sessions or commits).
2. **Source** — a dedicated append-only JSONL run-log at the vault root `.agentic-os/runs.jsonl`.
3. **Empty state** — a single "No recent runs yet" line; placeholder rows are cleared.
4. **First producer** — `/morning-brief`; others adopt the append helper over time.

## Remaining to confirm at authoring

- Row cap (leaning ~8, the designer count) and whether to cap by count or by age.
- Exact `.agentic-os` folder name / dotfolder visibility (flagged above).
- Whether to add a `fs.watch` instant repaint in v1 or defer to the 60s tick.
