# Agentic OS

An Obsidian plugin that renders a "command center" dashboard in a right-side pane —
token burn, project metrics, and a research feed — ported from a hand-built HTML/CSS
design into the Obsidian view API.

The UI is static markup (no live data yet): a tabbed dashboard plus three full-screen
"deep dive" views you can navigate into and back out of, all scoped under a single
`.agentic-os` root so nothing leaks into the host theme.

## Features

- Right-pane view (`agentic-os-view`) with three tabs — Overview, Projects, Research.
- "Full ↗" navigation into Release Radar / Hacker News / Morning Brief views, with a
  back button that returns you to where you were.
- Ribbon icon and command (**Open Agentic OS**) that reveal the pane, or focus the
  existing one instead of opening a duplicate.
- Custom waveform icon matching the dashboard's brand mark.
- Setting to open the pane automatically on startup (off by default).

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
| `main.ts` | The plugin: view, view-state navigation, ribbon/command, settings. |
| `markup.ts` | Generated dashboard markup (do not edit by hand). |
| `scripts/gen-markup.mjs` | Regenerates `markup.ts` from the source HTML. |
| `styles.css` | Source stylesheet with bundled `@font-face` declarations prepended. |
| `esbuild.config.mjs` | Bundler; syncs output into the vault when `OBSIDIAN_PLUGIN_DIR` is set. |

See [`CLAUDE.md`](CLAUDE.md) for deeper architecture notes.

## License

MIT
