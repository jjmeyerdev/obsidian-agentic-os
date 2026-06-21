# PRD — Quick Action buttons

**Status:** shipped (wiring); button → command targets are user-configured
**Slice:** part of the [dashboard-live effort](README.md)
**PR:** #6
**Date:** 2026-06-01

## Goal

Make the Overview tab's ten **Quick Action** buttons run real commands instead of
being decorative.

## Mechanism

Each button is mapped — by its **exact visible label** — to an Obsidian **command ID**
via the `quickActions` setting (one `Button Label = command-id` per line; blank lines
and `#` comments ignored). On click:

1. The map is parsed *at click time*, so settings edits take effect without a
   re-render.
2. The mapped command runs via `app.commands.executeCommandById(id)` — Obsidian's
   internal command API (the same call Meta Bind's `type: command` action uses).
3. An unmapped button, or a command ID that isn't found (e.g. Shell Commands not
   installed / wrong ID), shows a `Notice` pointing back to settings rather than
   failing silently.

## Typical wiring — Shell Commands

The intended targets are **Shell Commands** plugin commands, which run a headless
`claude -p "/slash-command"` (or a plain shell script) with cwd = the vault root.
This keeps the button a thin trigger and the actual behavior in a versioned,
vault-local command. (See the [Schedule + Daily Tasks PRD](prd-schedule-tasks.md) for
the `plan-today` / `plan-tomorrow` slash commands two of these buttons drive.)

## The ten labels

`Plan Today`, `Plan Tomorrow`, `Morning Brief`, `Inbox Brief`, `Deep Research…`,
`Atomize…`, `Reading Pipeline`, `Weekly Review`, `Vault Cleanup`, `Pull Metrics`.

(Labels must match the button text exactly — including the ellipsis on "Deep
Research…" and "Atomize…".)

## Special case — "Pull Metrics"

After running its command, "Pull Metrics" re-reads the usage snapshot itself. A
headless `claude -p` can't produce the live rate-limit percentage, so it writes no
snapshot for the Token Burn watcher to catch; the explicit re-read makes the panel
and its "last pull" age update on demand. See the
[Token Burn PRD](prd-token-burn.md).

## Status / next step

The wiring shipped in PR #6. As of writing, the ten buttons are pointed at
placeholder echo commands; swapping in the real commands (authoring `plan-today` et
al. and pointing each button at it) is the remaining follow-up and is out of scope
for this slice.
