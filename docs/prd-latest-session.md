# PRD — Latest Session card + sessions history

**Status:** shipped
**Slice:** part of the [dashboard-live effort](README.md)
**PRs:** #3 (Latest Session card), #5 (full sessions view + folder merging)
**Date:** 2026-06-01

## Goal

Paint the Overview's **Latest Session** card from the most recent *finished* Claude
Code session, and a **"Full ↗"** deep-dive listing that folder's session history.

## Source — transcripts on disk

Claude Code writes one JSONL transcript per session at
`~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`, appending a record per turn.
Every figure is derived directly from the transcript records — no stored history.
Desktop-only (Node `fs`/`os`).

## "Finished, not live"

The card surfaces the most recent session you are **not currently sitting in** — the
one you last finished — so it answers "what was I working on?" rather than mirroring
the live window (which you already know).

A session is "live" when a Claude Code process holds it open, recorded in
`~/.claude/sessions/<pid>.json`. That file outlives a crash, so the pid is probed
(`process.kill(pid, 0)` — throws if gone) before it's trusted; a stale entry would
otherwise hide a finished session forever. Live sessions are skipped. If *every*
session with content is live (e.g. only the window you're in exists), the card falls
back to the newest of those, so it's never blank.

## Card figures — `parseSession`

- **Title** — AI-generated session title, else the last prompt, else the first user
  text.
- **Age** — from the last recorded turn's timestamp.
- **Messages** — visible conversation turns only: your prompts + Claude's text
  replies. Tool-result plumbing (a user turn carrying only `tool_result`) and silent
  pure-`tool_use` steps are excluded, so messages / tokens / tool-calls stay
  orthogonal.
- **Tokens** — raw across *all* turns (input + output + cache create + cache read) —
  the true cost, independent of what counts as a "message".
- **Tool calls** — `tool_use` blocks across assistant turns.
- **Model** — trimmed for the badge (`claude-opus-4-8` → `opus-4.8`).
- **Branch + folder** — git branch and the cwd basename (the repo/folder name).

## Full sessions view (PR #5)

The "Full ↗" pill on the card opens a deep-dive listing **every session in the card's
folder**, newest-first (this one *includes* the live session — it's a full history).
A toolbar provides:

- a **Sort** button that cycles orders, and
- a **search** box that filters by title/branch.

Both repaint from the cached rows — no refetch.

### Folder merging

A project that has **moved across paths** (renamed/relocated) leaves its transcripts
scattered across multiple `~/.claude/projects/<encoded-cwd>/` directories. The
**"Merge session folders"** setting unions named directories so the project reads as
one history. Folders are picked with a modal (`FolderPickerModal`, backed by
`listProjectFolders()`) or edited by hand as paths (one per line; a blank line
separates unrelated projects). Transcript files persist under `~/.claude/projects`
even after the source folder is gone, so a merged-away directory still contributes.

## Cadence & settings

- Cadence: **60s** heartbeat + active-leaf repaint; the full view also refreshes on
  active-leaf-change while it's open.
- Setting: `sessionFolderGroups` (machine-specific paths, hence a setting).

## Degradation

No OS home or no readable transcript (mobile, none written yet) → empty card.
