# Agentic OS

An Obsidian plugin that renders a "command center" dashboard in the main editor area —
token burn, project metrics, and a research feed — ported from a hand-built HTML/CSS
design into the Obsidian view API.

The dashboard is a tabbed view (Overview · Projects · Research) plus full-screen
"deep dive" views you can navigate into and back out of, all scoped under a single
`.agentic-os` root so nothing leaks into the host theme. The markup itself is static
(a port of a hand-built design), but **live data is painted over it** at runtime —
token usage, GitHub stats, your latest Claude Code session, and today's schedule and
tasks. Per-panel design notes live in [`docs/`](docs/).

## Features

- Main-area view (`agentic-os-view`) with three tabs — Overview, Projects, Research —
  with live data painted over the static design:
  - **Token Burn** — your real Claude Code rate-limit usage from the local usage
    snapshot (percentage + reset countdown + an estimated token figure), live-repainted
    as the snapshot updates.
  - **GitHub** — Overview stat cards (repos, followers, stars, contributions) and a
    Projects tab (contribution chart, streaks, velocity, language mix, releases,
    activity heatmap), read via the `gh` CLI.
  - **Latest Session** — your most recent finished Claude Code session, with a "Full ↗"
    history of that folder's sessions (sortable, searchable).
  - **Schedule + Daily Tasks** — today's plan from your daily-note frontmatter, with
    tick-to-toggle task write-back.
- **Quick Action** buttons that run Obsidian commands (e.g. Shell Commands) you map to
  them in settings.
- "Full ↗" navigation into the Sessions, Release Radar, Hacker News, and Morning Brief
  views, with a back button that returns you to where you were.
- Ribbon icon and command (**Open Agentic OS**) that reveal the pane, or focus the
  existing one instead of opening a duplicate.
- Custom waveform icon matching the dashboard's brand mark.
- Setting to open the pane automatically on startup (off by default).

## Live data

The panels read from local sources on your machine — there's no server, and the plugin
stores no history of its own (every figure is recomputed from the source each refresh):

- **Token Burn** ← `~/.claude/usage-snapshot.json` (mirrored there by your Claude Code
  statusline script).
- **GitHub** ← the `gh` CLI, reusing your existing `gh auth` (no token to store).
- **Latest Session** ← your Claude Code transcripts under `~/.claude/projects/`.
- **Schedule + Daily Tasks** ← today's daily-note frontmatter (written by a `plan-today`
  command; ticked tasks write back).

Because these use Node `fs`/`child_process`, the plugin is **desktop-only**. Each panel
degrades gracefully — a missing source shows an empty state, never a crash. Configure
the GitHub username, rate-limit window, session-folder merging, and Quick Action command
mappings in the plugin's settings. See [`docs/`](docs/) for the per-panel PRDs.

## Install (manual)

Until this is in the community plugin browser, install it by hand:

1. Build the plugin (see below), or grab `main.js`, `manifest.json`, and `styles.css`
   from a release.
2. Copy `main.js`, `manifest.json`, `styles.css`, and the `fonts/` folder into
   `<vault>/.obsidian/plugins/agentic-os/`.
3. Download the fonts (see [`fonts/README.md`](fonts/README.md)) — optional; the pane
   falls back to the host sans-serif/monospace fonts if they're absent.
4. Enable **Agentic OS** under Settings → Community plugins.

## Development

Requires [pnpm](https://pnpm.io). Install dependencies (esbuild's native binary build
is pre-approved in `pnpm-workspace.yaml`):

```sh
pnpm install
```

Create a `.env` (gitignored) to control where builds and the markup generator point:

```sh
# Build output goes straight into your vault's plugin folder, and the static
# files (manifest.json, styles.css, fonts/) are synced alongside main.js.
OBSIDIAN_PLUGIN_DIR=/path/to/your-vault/.obsidian/plugins/agentic-os

# Source HTML the markup generator reads (kept outside this repo).
AGENTIC_OS_SRC_DIR=/path/to/design-source
```

If `OBSIDIAN_PLUGIN_DIR` is unset, `main.js` is emitted into the repo root instead.

```sh
pnpm dev          # esbuild watch — rebuilds on save (no typecheck)
pnpm run build    # typecheck (tsc -noEmit) + production bundle
```

Pair `pnpm dev` with the [Hot Reload](https://github.com/pjeby/hot-reload) plugin for
a save → reload loop. There are no tests or linter; `pnpm run build` is the
correctness gate.

## Regenerating the markup

`markup.ts` is **generated**, not hand-written. Each export is the `.dash` element
extracted from one of the source HTML files in `AGENTIC_OS_SRC_DIR`. To change the
dashboard's content or structure, edit that source HTML and regenerate:

```sh
pnpm gen-markup
```

The generator also injects the `data-full` attributes the view uses to wire "Full ↗"
navigation, and fails loudly if the expected markup isn't found.

## Project layout

| Path | Role |
|------|------|
| `main.ts` | The plugin: view, view-state navigation, painting, ribbon/command, settings. |
| `usage.ts` | Token Burn data — the Claude Code usage snapshot + cap calibration. |
| `github.ts` | GitHub data — Overview stat cards and the Projects tab, via the `gh` CLI. |
| `session.ts` | Latest Session + sessions-history data, from Claude Code transcripts. |
| `dayplan.ts` | Schedule + Daily Tasks data, from today's daily-note frontmatter. |
| `markup.ts` | Generated dashboard markup (do not edit by hand). |
| `scripts/gen-markup.mjs` | Regenerates `markup.ts` from the source HTML. |
| `styles.css` | Scoped dashboard stylesheet (fonts are injected at runtime in code, not here). |
| `esbuild.config.mjs` | Bundler; syncs output into the vault when `OBSIDIAN_PLUGIN_DIR` is set. |

See [`CLAUDE.md`](CLAUDE.md) for deeper architecture notes.

## License

MIT
