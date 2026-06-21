# Dashboard-live PRDs

The dashboard is a faithful port of a hand-built HTML/CSS design: the markup is
static, generated template strings, and the values baked into it are the designer's
placeholders. The **dashboard-live effort** is the work to paint real data over that
markup — replacing each panel's placeholders with live values read from a local
source (the Claude Code usage snapshot, the `gh` CLI, session transcripts, today's
daily note).

Every slice follows the same pattern, documented in [`../CLAUDE.md`](../CLAUDE.md):
`render()` injects the static markup, then async `refresh*()` methods read a source
and `paint*()` write into known selectors — each guarded by a monotonic stale-paint
token so a slow read never paints into a newer render, and each degrading gracefully
(missing source → blank/empty state, never a crash or a stale placeholder).

The data modules (`usage`, `github`, `session`) use Node `fs`/`child_process`, so the
plugin is **desktop-only**. `dayplan` reads through Obsidian's own vault APIs.

## Slices (shipped order)

| PRD | Panel(s) | Source module | PR(s) |
|-----|----------|---------------|-------|
| [Token Burn](prd-token-burn.md) | Token Burn gauge | `usage.ts` | #1, #8 |
| [GitHub stats](prd-github-stats.md) | Overview stat cards · Projects tab | `github.ts` | #2, #4 |
| [Latest Session](prd-latest-session.md) | Latest Session card · Sessions history | `session.ts` | #3, #5 |
| [Quick Actions](prd-quick-actions.md) | Overview Quick Action buttons | `main.ts` | #6 |
| [Schedule + Daily Tasks](prd-schedule-tasks.md) | Schedule · Daily Tasks | `dayplan.ts` | #7, #9 |

Token Burn and Schedule each had a follow-up slice (live-repaint, 12-hour times);
those are folded into their PRDs above.

## In progress

| PRD | Panel(s) | Source module | Status |
|-----|----------|---------------|--------|
| [Morning Brief](prd-morning-brief.md) | Morning Brief — Headlines · Reading Queue · Note Opportunities (𝕏 Conversation deferred) | `brief.ts` (planned) + a `/morning-brief` command | draft |

First Research-tab panel to go live; mirrors the Schedule + Tasks pattern (a headless
command writes `brief:` into today's daily note, the plugin paints it).
