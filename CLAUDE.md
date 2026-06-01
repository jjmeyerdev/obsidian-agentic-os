# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Obsidian plugin that renders a "command center" dashboard in a main-area leaf
(`agentic-os-view`, opened as a center tab). The layout is a faithful port of a
hand-built HTML/CSS design into the Obsidian plugin API — the markup is static,
generated template strings (see below) — but **live data is painted into it** at
runtime from the local Claude Code usage/session files and the `gh` CLI. The values
baked into the markup are the designer's placeholders; the plugin overwrites them.

## Commands

```sh
pnpm install        # NOTE: esbuild's postinstall is gated — see pnpm-workspace.yaml
pnpm dev            # esbuild watch; rebuilds main.js on save. Does NOT typecheck.
pnpm run build      # tsc -noEmit (typecheck) + esbuild production bundle
pnpm gen-markup     # regenerate markup.ts from the source HTML (see below)
```

There are **no tests and no linter** configured. `pnpm run build` is the only
correctness gate — it runs `tsc -noEmit -skipLibCheck` before bundling, so run it
(not just `pnpm dev`) before considering a change done.

`pnpm install` under pnpm 9+/10+ blocks package build scripts by default. esbuild
needs its postinstall to fetch a native binary; this is pre-approved in
`pnpm-workspace.yaml` via `allowBuilds: { esbuild: true }`. If install ever reports
`ERR_PNPM_IGNORED_BUILDS`, that file is the fix (the old `pnpm.onlyBuiltDependencies`
field in package.json is no longer read by pnpm 11).

## Machine paths live in `.env` (gitignored)

`esbuild.config.mjs` and `scripts/gen-markup.mjs` both read an untracked `.env`
(via a tiny inline parser, no dotenv dependency). Two vars:

- `OBSIDIAN_PLUGIN_DIR` — if set, `pnpm dev`/`build` write `main.js` **directly into
  the vault plugin folder** and copy `manifest.json`, `styles.css`, and
  `fonts/*.woff2` alongside it (see the `sync-statics` esbuild plugin). If unset,
  output falls back to `./main.js` in the repo (clean/CI build).
- `AGENTIC_OS_SRC_DIR` — directory holding the source design HTML that `gen-markup`
  reads. This lives **outside** this repo (the design source is maintained
  separately). If the four HTML files aren't found, regeneration fails with ENOENT —
  that means the path is wrong or stale, not that the build is broken.

A fresh clone has no `.env`; create one to enable in-vault builds and regeneration.

## Architecture

**`markup.ts` is generated, not authored.** It exports four template-literal
strings (`DASHBOARD_MARKUP`, `FULL_RADAR_MARKUP`, `FULL_HN_MARKUP`,
`FULL_BRIEF_MARKUP`), each the full `.dash` element extracted from one source HTML
file. Do **not** hand-edit it for design changes — edit the source HTML in
`$AGENTIC_OS_SRC_DIR` and run `pnpm gen-markup`. The generator also injects
`data-full="full-radar|full-hn|full-brief"` onto the three dashboard "Full ↗" pills
(in DOM order) so the view can wire navigation off them; if a source edit changes
the number of `.pill-link` buttons, the generator throws by design.

**`main.ts` is the whole plugin** (one file). Key pieces:

- `AgenticOSView extends ItemView` holds a `ViewState` =
  `dashboard | full-radar | full-hn | full-brief`. `render()` sets a **single
  scoped `innerHTML`** on a `.agentic-os` root div (the markup is static and trusted;
  `.agentic-os` is the CSS scoping root every selector hangs off). Re-rendering swaps
  the whole pane between the dashboard and a full view.
- Event listeners are tracked in a `cleanups[]` array, flushed on every `render()`
  and in `onClose()` (since `innerHTML` replacement orphans old nodes). Tab switching
  toggles panel `hidden` in place (no re-render); "Full ↗" and the back button call
  `navigate()` which re-renders. `activeTab` is restored when returning from a full
  view so you land back on Research_.
- **Gotcha:** the internal navigation method is named `navigate()`, not `setState()` —
  `View.setState(state, result)` is a real Obsidian API method and shadowing it breaks
  the `ViewCreator` type. Don't reintroduce a `setState` on the view class.
- The ribbon icon and tab icon use a custom registered icon
  (`addIcon("agentic-os-waveform", ...)`), the brand waveform glyph. Obsidian renders
  icons in a fixed `0 0 100 100` viewBox, so the 22×22 art is wrapped in a scaled
  `<g fill="currentColor">` (the `translate/scale` transform is the only fit knob).
- `activateView()` reveals an existing leaf if present rather than opening a duplicate.

**Live data is painted over the static markup.** Three desktop-only data modules
(Node `child_process`/`fs`, so this won't run on mobile) feed the dashboard:

- `usage.ts` — the Token Burn panel, from the local Claude Code usage snapshot. The
  panel reads as a **percentage** off an authoritative snapshot; the token cap is
  self-calibrated (median of tokens÷pct samples, kept per rate-limit window).
- `github.ts` — the Overview stat cards (`readGitHubStats`) and the Projects tab
  (`readProjectStats`, plus the light `readProjectRepos`), all via the `gh` CLI (reuses
  the user's `gh auth`, no stored token). GUI-launched Obsidian doesn't inherit the
  shell PATH, so `runGh` augments PATH with the usual Homebrew/usr spots.
- `session.ts` — the Latest Session card, from the most recent session file on disk.

The pattern: `render()` injects the static markup, then async `refresh*()` methods
fetch and `paint*()` write into known selectors. **Every refresh carries a monotonic
"token" guard** (`burnToken`, `ghToken`, `sessionToken`, `projectsToken`, `reposToken`) —
a slow read bails rather than paint into a newer render. Reads degrade gracefully
(gh missing/unauthed → cards blank or, for Projects, the static design is kept).

Cadence: Token Burn + Latest Session every 60s, GitHub cards + Projects every 30min
(see `*_INTERVAL_MS`), plus an instant repaint on `active-leaf-change` when the pane
becomes active. The Projects tab is the heaviest fetch (paginates each repo's commit
history), so it's **lazy** — fetched on first tab view, not on load — and shows a
shimmer skeleton (`#panel-projects.is-loading`) on that first load so the placeholder
markup never flashes. Opening the tab again refetches just the repo cards via the
light GraphQL-only `readProjectRepos` (no commit pagination); the rest of the panel
keeps to the 30min timer. Settings: `window` (rate-limit window) and `githubUsername`
(blank = the gh-authed user); `openOnStartup` (default off) opens the pane on
`onLayoutReady`.

**Fonts are loaded in code, not CSS.** `injectFonts()` (in `onload`) builds a
`<style id="agentic-os-fonts">` with `@font-face` rules whose `src` is
`app.vault.adapter.getResourcePath(`${this.manifest.dir}/fonts/<file>.woff2`)`.
This is **required**: Obsidian injects a plugin's `styles.css` into the document head,
where relative `url('fonts/...')` paths resolve against the app base (not the plugin
folder) and silently fail (`document.fonts` shows them in `error` state, and the UI
falls back to the default mono/sans). So `styles.css` deliberately contains **no**
`@font-face` — don't re-add it there. The woff2 files are gitignored; download URLs
are in `fonts/README.md`.

**Gotcha — Obsidian's core `.card` collides with ours.** `app.css` defines a bare
`.card { display:flex; flex-direction:column; flex-grow:1; margin:0 10px; padding:15px
30px }`, and the dashboard reuses `class="card"` on every card. Our scoped
`.agentic-os .card` rule therefore resets `display/flex-direction/flex-grow/margin/
padding` so the design's own layout (e.g. Latest Session's horizontal row) isn't
overridden. If you add new generic class names to the markup, check them against
`app.css` for the same kind of bleed.

## Build output is not committed

`main.js`, `node_modules/`, `*.woff2`, and `.env` are gitignored. Obsidian loads the
plugin from `$OBSIDIAN_PLUGIN_DIR`, which needs `main.js` + `manifest.json` +
`styles.css` + `fonts/` together — the build's `sync-statics` step keeps them in sync,
so editing those files in the repo and running a build is the correct workflow (never
edit the copies in the vault folder directly).
