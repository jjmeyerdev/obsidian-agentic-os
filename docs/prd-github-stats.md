# PRD — GitHub stats (Overview cards + Projects tab)

**Status:** shipped
**Slice:** part of the [dashboard-live effort](README.md)
**PRs:** #2 (Overview cards + Projects data), #4 (Projects loading skeleton + refresh-on-open)
**Date:** 2026-06-01

## Goal

Paint the Overview tab's four GitHub stat cards and the **Projects** ("GitHub
Activity") tab from live GitHub data.

## Auth — `gh` CLI, no stored token

Rather than manage a token, the module shells out to the **`gh` CLI** and reuses the
user's existing `gh auth` — nothing secret to store. GUI-launched Obsidian on macOS
doesn't inherit the shell PATH, so `runGh` augments PATH with the usual
Homebrew/usr spots so `gh` is found by name. Desktop-only (Node `child_process`).

Every figure is a **current count** — no stored history. All are recomputed each
refresh from what the API returns right now. Best-effort: any sub-fetch that fails
degrades just its own field to `null`, so one broken call never blanks the rest.

## Overview stat cards — `readGitHubStats(username)`

Four cards, each a headline total plus a live secondary stat:

- **Repositories** — owned repos (includes private for the gh-authed user;
  public-only for a named user) + repos created this calendar year.
- **Followers / Following.**
- **Stars** — sum of stargazers across owned repos + the most-starred repo.
- **Contributions** — all-time total (the contribution calendar caps at one year, so
  each year since the account opened is queried in parallel and summed) + the count
  so far this calendar month (from the current year's daily grid).

Local time, not UTC, decides "this month"/"this year" — late-evening-local is already
the next day in UTC and would point at an empty future bucket.

## Projects tab — `readProjectStats(username)`

One GraphQL call covers the contribution calendar, the prior-year total, per-repo
metadata, languages, and releases. The day-by-day commit timestamps the calendar
lacks come from **paginating each owned repo's commit history** — the source for
velocity, the peak day/hour, and the heatmap. Outputs:

- 12-month contribution chart with a year-over-year delta and a range label.
- Current and longest streak (today not done yet doesn't break the current streak).
- Weekly commit velocity (this week vs last) and the peak day + time-of-day bucket.
- Top-3 repo cards (by most recent push) — language, stars, open PRs/issues, commits
  in the last year, relative "updated" age.
- Language breakdown (top 5 by bytes across all repos + "Other").
- Newest 3 releases across repos.
- A 7×7 activity heatmap (day × time-of-day bucket, levels 0–4).

## Lazy load, skeleton, and the light refresh (PR #4)

The Projects tab is the **heaviest** fetch (a request per repo to paginate commits),
so:

- It's **lazy** — fetched on first tab view, not on load — and shows a shimmer
  **skeleton** (`#panel-projects.is-loading`) on that first load so the placeholder
  markup never flashes.
- Reopening the tab refetches **only the repo cards** via the light
  `readProjectRepos` (GraphQL only, no commit pagination); the heavier stats stay on
  the 30-minute timer. The repo cards' commit count comes from the default branch's
  `history.totalCount` (one GraphQL field), so the same numbers back both the full
  fetch and the light refresh.

## Repo browser

Clicking a repo card opens that repo's GitHub page in an **embedded browser tab**
(`RepoBrowserView`, an Electron `<webview>` filling a center leaf), reusing one if
already open — so you don't leave Obsidian. URL/title travel via view state so the
tab survives a workspace reload. Desktop-only (the `<webview>` tag is Electron-only).

## Cadence & settings

- Cadence: **30 minutes** (`GITHUB_INTERVAL_MS`) — these figures drift over days —
  plus an instant repaint on active-leaf-change.
- Setting: `githubUsername` (blank = the gh-authenticated user).

## Degradation

`gh` missing, unauthenticated, or no such user → Overview cards blank (`ok: false`);
the Projects tab keeps its static design rather than half-painting.
