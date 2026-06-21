# PRD — Token Burn (live)

**Status:** shipped
**Slice:** part of the [dashboard-live effort](README.md)
**PRs:** #1 (initial wiring), #8 (live-repaint + desktop-only manifest)
**Date:** 2026-05-31, updated 2026-06-21

## Goal

Replace the static Token Burn gauge with the **real Claude Code rate-limit usage** —
how much of the current window has been consumed, when it resets, and a ballpark of
how many tokens that represents.

## The data problem

The authoritative percentage is **not reconstructable** from local token sums: it
comes from Anthropic's server-side rate-limit headers, which Claude Code surfaces to
the statusline. So the panel reads two different qualities of data:

- **Percentage + reset boundary — exact.** The user's statusline script mirrors the
  rate-limit payload to `~/.claude/usage-snapshot.json` expressly for this dashboard.
  The panel reads `rate_limits[window].used_percentage`, `…resets_at`, and the
  snapshot's `ts`.
- **Token figure (e.g. "≈5.67M") — an estimate.** A weighted sum of the local
  `*.jsonl` transcripts under `~/.claude/projects`, counting only messages whose
  timestamp falls in the snapshot's actual window `[resets_at − windowHours, ts]`.
  Cache reads dominate raw counts but are priced at ~a tenth of a fresh token, so
  they're weighted ×0.1 — this weighting only affects the token estimate, never the
  displayed percentage.

## Self-calibrated cap

The "100% =" token cap is not hard-coded (it shifts with model mix and pricing).
It's the **median of `tokens ÷ (pct/100)`** across retained calibration samples, so
the cap converges on the real ceiling as samples accrue. Details:

- Samples below **5%** are skipped — integer-rounded percentages make `tokens÷pct`
  too noisy that low to trust.
- Up to **60** samples retained, newest-win, so the estimate stays current.
- The 5h and 7d windows are **distinct ceilings**, so each keeps its own sample
  history; they never mix.
- Before any samples accrue, the cap falls back to the single live reading.

## Windows

Two rate-limit windows, selectable in settings: `five_hour` (5h) and `seven_day`
(168h). The window length is what aligns the token sum to the percentage's window;
lengths are fixed by Anthropic's limits, not user-tunable.

## Cadence & live-repaint

- **60s heartbeat** (`TOKEN_BURN_INTERVAL_MS`) — the steady "Live" pulse for an idle
  pane.
- **Active-leaf repaint** — an instant re-read when the pane becomes the active leaf.
- **Snapshot watcher** (PR #8) — `watchSnapshot()` repaints within ~400ms of the
  snapshot being rewritten (e.g. any live statusline render), instead of waiting up
  to 60s. The statusline writes **atomically** (temp file + rename), which swaps the
  file's inode, so a watch on the file path goes deaf after the first rename; the
  watcher watches the **parent directory** and filters by basename, debounced 400ms
  to coalesce the write+rename burst into one repaint.
- **"Pull Metrics" on demand** — the quick action re-reads the snapshot itself.
  A headless `claude -p` run never produces the live rate-limit percentage, so it
  writes no snapshot for the watcher to catch; re-reading makes the panel and its
  "last pull" age reflect the snapshot's true current state on click.

## Degradation

No OS home, or no snapshot yet written (mobile, statusline never ran) → `ok: false`
and the panel stays blank rather than showing stale placeholders. PR #8 also set
`isDesktopOnly: true` in the manifest — the data modules use Node `fs`/`os` and never
ran on mobile, so the old `false` was inaccurate.

## Settings

- `window` — which rate-limit window to track (each keeps its own cap calibration).
- `calibration` — the per-window `(tokens, %)` sample history (internal; not a
  user-facing control).
