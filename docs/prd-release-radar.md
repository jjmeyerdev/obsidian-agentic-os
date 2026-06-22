# PRD — Release Radar (live slice)

**Status:** draft
**Slice:** next in the dashboard-live effort (second Research-tab panel to go live, after Hacker News)
**Date:** 2026-06-22

## Goal

Replace the static **Release Radar** panels — the dashboard radar card and the full
Release Radar view — with live dependency-update data for the user's own projects, drawn
from **both** GitHub accounts. Each tracked dependency shows its newest version, a
severity badge, and which of the user's repos it affects; breaking/security updates are
escalated to the top. A **hybrid** source model: a direct-fetch module computes everything
mechanical (versions, badges, affected repos, grouping) and stands alone; an agentic
`/release-radar` command enriches only the escalated rows with a plain-English "what
changed" sentence read from release notes.

## What the panel shows (from the mockup)

Rows grouped, in order:

- **⚠ Needs Attention** — every escalated dep (BREAKING or SECURITY), across all repos.
- **◆ Active · `<repo>`** — updates for a recently-pushed repo.
- **◇ Idle · `<repo>`** — updates for the rest.

Each row: `owner/repo` slug · new version (`v1.7.0`) · a badge
(`BREAKING` / `SECURITY` / `MINOR` / `PATCH`) · a one-line description. The full view adds
a toolbar (search + All/Attention/Active/Idle chips + sort + count) and a per-row impact
note (e.g. "affects vibe-voicer + fp-tracker").

## Two GitHub accounts (decided)

Track repos from **both** authed accounts merged — `jjmeyerdev` (active) and `JDesigns716`
(personal) — auto-discovered from `gh auth status`, with a settings checklist to
include/exclude each (default: all on). Query each account with its **own token injected
per call** (`gh auth token --user <account>` → `GH_TOKEN` in that call's env), never
`gh auth switch` (global, would disrupt the user's terminal session). `github.ts`'s
`runGh` already builds a custom `env`; extend it to accept an optional token. **Scope:
Radar only** — do not change the existing Overview GitHub stat cards' single-account
behavior.

## The hybrid boundary (decided — the load-bearing design choice)

Everything deterministic is **direct-fetch**; only the human "what changed" prose is
**agentic**. Concretely:

| Field | Source |
|-------|--------|
| Newest published version | **Direct** — npm registry (`registry.npmjs.org/<pkg>/latest`) via `requestUrl` |
| Badge: MINOR / PATCH | **Direct** — semver delta of newest vs the range in `package.json` |
| Badge: BREAKING | **Direct** — a major-version bump |
| Badge: SECURITY | **Direct** — a GitHub Advisory DB hit for `pkg` (`securityVulnerabilities` GraphQL) |
| Affected repos ("affects X + Y") | **Direct** — which of the scanned `package.json`s list the dep |
| Active vs Idle grouping | **Direct** — repo `pushedAt` recency |
| Terse fallback description ("v1.6 → v1.7") | **Direct** |
| Rich description ("Session cookie API changed …") | **Agentic** — `/release-radar` reads release notes / changelog and writes one line |

The direct-fetch module paints a **fully functional** radar with no agentic data present.
The command's job is purely to upgrade the escalated rows' description text from terse to
human.

## Success criteria

- On refresh (card ⟳ / cadence), the radar paints live: tracked deps from both accounts'
  repos, correct newest versions and semver/security badges, affected-repo notes, and
  Attention/Active/Idle grouping — **without** ever running the agentic command.
- Running `/release-radar` upgrades each escalated row's description to a one-line
  plain-English summary; non-escalated rows keep their terse version delta.
- Full view: search filters; the All/Attention/Active/Idle chips filter; counts track the
  list (mirrors the Hacker News full-view toolbar already shipped).
- Degrade gracefully: an account excluded/unauthed, npm/advisory/gh unreachable, a repo
  with no `package.json` → that source contributes nothing; the panel never crashes or
  shows the designer's placeholder data. `gh` entirely absent → keep the static design
  (as the GitHub stats slice does).
- `pnpm run build` (`tsc -noEmit` + bundle) passes.

## Scope

**In:** a `radar.ts` direct-fetch module (enumerate both accounts' repos → read each
`package.json` → newest version + advisory + semver → rows, grouped); the dashboard card
+ `full-radar` paint; the full-view toolbar (search + chips, like HN); a `/release-radar`
command that writes rich descriptions for escalated rows; the card ⟳ trigger; a per-account
settings checklist; `runGh` token injection.

**Out (later / not this slice):** non-npm ecosystems (Cargo, pip, Go); transitive
dependencies (only direct deps in `package.json`); auto-running the command on a schedule;
changing the Overview stat cards; the sort button doing more than one order.

## Source model — direct-fetch base + agentic overlay

1. **`radar.ts` (direct, on a cadence)** — the authoritative row set:
   - For each included account, list repos (token-injected `gh`), keep those with a
     `package.json`; read it (`gh api repos/<owner>/<repo>/contents/package.json`, base64).
   - Union the direct deps into a tracked set; remember which repos list each.
   - Per dep: newest version (npm registry), advisory check (GitHub Advisory DB), semver
     delta → badge; map npm name → display `owner/repo` slug + release-notes URL via the
     package's `repository` field.
   - Group: escalated → Attention; else by owning repo's `pushedAt` → Active / Idle.
   - Stale-paint token (`radarToken`); heaviest fetch in the app, so **lazy + cached**
     like Projects (fetch on first Research-tab view / card visible, then on a slow timer).

2. **`/release-radar` (agentic overlay, on demand)** — a project-scoped command in the
   vault's `.claude/commands/`, invoked via the absolute `claude` path with cwd = vault
   root (mirrors `/morning-brief`). For each **escalated** dep it reads the release
   notes/changelog/advisory and writes a one-line description, into a vault-root
   `.agentic-os/radar.json` keyed by `pkg@version`. The plugin merges this description over
   the terse one when the key matches; absent → the terse delta stands.

## Data contract — `.agentic-os/radar.json` (agentic overlay)

```json
{
  "generated": "2026-06-22T07:30",
  "items": {
    "better-auth@1.7.0": "Session cookie API changed; getSession() signature differs.",
    "nodemailer@8.0.8": "Patches a header-injection advisory (CVE-2026-XXXX)."
  }
}
```

- Keyed by `pkg@newVersion` so a stale entry for an older version simply doesn't match.
- Value is the one-line description; everything else (badge, affected repos, slug, group)
  comes from the live direct fetch, not this file.
- Absent file / no matching key → the row keeps its terse direct description.

## Plugin behavior

- `radar.ts` — `readReleaseRadar(accounts): Promise<RadarRow[]>` (or a grouped shape),
  best-effort, never throws; each sub-fetch degrades its own field.
- `refreshRadar()` / `paintRadar()` paint within `.agentic-os`, in whichever Research view
  is rendered (card shows the top ~6, escalated first; `full-radar` shows all, grouped,
  with the toolbar). Reuse the `.rank-list` / `.rank-row` / `.badge` classes and the
  shipped HN toolbar pattern (cached rows, chips + search filter without refetch).
- Cadence: lazy first load with a skeleton (Projects pattern), then a slow timer
  (~30 min, like GitHub) + active-leaf repaint. The card ⟳ refetches; running
  `/release-radar` rewrites `radar.json` and the plugin re-merges on next refresh.
- Degrade: per the success criteria.

## Settings

- `radarAccounts` — the include/exclude checklist over accounts discovered from
  `gh auth status` (default: all on).
- Possibly `radarRepoLimit` / which repos count (all vs non-fork vs pinned) — resolve at
  authoring; lean to non-archived, non-fork repos with a `package.json`.
- Reuses the `claude` invocation + `.agentic-os/` conventions from Morning Brief / Activity
  Feed; no new path config.

## Verification

1. `radar.ts` standalone: enumerate both accounts' repos, read a known `package.json`,
   confirm correct newest versions + semver/security badges + affected-repo notes — with
   the agentic file absent.
2. `pnpm run build` passes.
3. In Obsidian: card + full view paint live, grouped correctly; toolbar search/chips work.
4. Run `/release-radar` → escalated rows gain plain-English descriptions; re-running is
   idempotent; deleting `radar.json` falls back to terse descriptions cleanly.
5. Toggle an account off in settings → its repos drop out without error.

## Resolved decisions

1. **Hybrid arch** — direct-fetch owns versions/badges/affected/grouping and stands alone;
   the agentic command only enriches escalated rows' description prose.
2. **Both accounts** — auto-discovered, settings checklist, default all; per-call
   `GH_TOKEN` injection, no `gh auth switch`; Radar-scoped (Overview cards untouched).
3. **Ecosystem** — npm / `package.json` direct deps only in v1.

## Remaining to confirm at authoring

- **Active vs Idle threshold** — `pushedAt` within N days (lean ~14); is "Active" capped to
  one repo (the mockup shows a single `◆ Active`) or any recently-pushed repo?
- **Which deps** — `dependencies` only, or also `devDependencies`? A per-repo/global cap to
  bound the npm-registry fan-out.
- **npm name → display slug + release notes** — resolve via the package's `repository`
  field; fallback when it's missing or non-GitHub.
- **Security source** — GitHub Advisory DB via `gh api graphql securityVulnerabilities`
  (lean) vs `npm audit`; whether a patched-version check gates the SECURITY badge.
- **Repo set** — all repos vs non-fork/non-archived vs a pinned/configured list.
- **Card density** — how many rows on the dashboard card, and whether non-escalated repos
  appear there or only in the full view.

## Dependency note

Order within the slice: build `radar.ts` (direct, fully functional alone) and wire the
card + full-view paint **first** — this is the shippable core. Author `/release-radar`
and the merge-overlay **second**, since the radar must read fine with no `radar.json`
present. Reuses the embedded-browser open (rows → release notes/repo), the `.rank-list`
markup, and the HN full-view toolbar — all already shipped.
