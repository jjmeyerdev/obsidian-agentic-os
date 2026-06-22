# PRD — Inbox (live slice)

**Status:** Phase 1 (GitHub) **built** — `inbox.ts` + `main.ts` wiring land and typecheck;
dark until the design adds the panel. Phase 2 (email) designed, not built.
**Slice:** new Morning Brief panel — what's waiting across the user's accounts (GitHub
notifications + email), **multi-account**, fetched **live**.
**Date:** 2026-06-22

## Goal

Add an **Inbox** to the Morning Brief: one panel surfacing what's waiting for the user
across their accounts — unread GitHub notifications (every authed `gh` account) and
unread/important mail (multiple Gmail accounts). A brand-new panel, sibling to Headlines /
Reading Queue / Note Opportunities.

## Why live, not the brief snapshot (decided)

The brief's other panels are a daily snapshot written to the daily note by `/morning-brief`.
The Inbox is **not** — it's fetched live by the plugin, like the GitHub stat cards / Token
Burn / Latest Session (`usage.ts`, `github.ts`, `session.ts`). Two reasons:

1. **Privacy** — email never touches the vault. It's fetched into memory, painted into the
   panel's DOM, and gone when the view closes. Obsidian persists workspace layout, not a
   custom view's rendered HTML, so nothing inbox-related lands on disk to sync (the user may
   enable Obsidian Sync / iCloud later). See [[no-private-data-in-synced-vault]] in memory.
2. **Freshness** — an inbox wants to be current, not a 7am snapshot.

The only persisted secret is the Gmail OAuth **refresh token**, kept **outside the vault**
at `~/.config/agentic-os/gmail.json` (so vault sync never carries it). No email content and
no secret in anything that syncs.

## Resolved decisions

| # | Decision | Choice |
|---|----------|--------|
| Scope | what the Inbox covers | **Email + GitHub**, multi-account |
| Source model | snapshot vs live | **Live** (plugin fetch; nothing written to disk) |
| Email auth | headless Gmail credential | **Gmail API + per-account OAuth refresh token** (read-only scope), token at `~/.config/agentic-os/gmail.json` |
| GitHub auth | both accounts | reuse `gh`: per-account token via `gh auth token --user <login>`, then `GH_TOKEN=… gh api notifications`. **Zero config** — accounts auto-discovered from `gh auth status` |
| Layout | one panel vs two | **One merged "Inbox" panel** (rows tagged by kind/account) |
| Panel markup | how it enters `markup.ts` | **User adds the panel to the design source HTML**, then `pnpm gen-markup` (+ `.inbox-item*` CSS in `styles.css`) |
| Privacy | what lands on disk | **Nothing** — moot under the live model |

## Source model — live plugin fetch

`inbox.ts` is a live data module (Node `child_process`; desktop-only). `readInbox(): Promise<Inbox>`
fetches and returns the merged, newest-first item list; the plugin paints it. No
`/morning-brief` involvement — the Inbox is independent of the brief snapshot.

```ts
type InboxKind = "github" | "email";
interface InboxItem { kind; account; title; source; badge; type; meta; ts }
interface Inbox { ok: boolean; items: InboxItem[] }  // ok:false ⇒ no source readable (gh missing)
```

- **GitHub (Phase 1, built):** `ghAccounts()` parses `gh auth status` → every login; for each,
  `gh auth token --user <login>` → token → `gh api notifications` (unread). Mapped to
  `{ kind:"github", account, title:subject.title, source:repo, badge:reason→label, type:subject.type, meta:age, ts }`.
  Best-effort per account — an un-authed account degrades to no rows, never sinks the others.
- **Email (Phase 2):** for each account in `gmail.json`, refresh-token grant → access token →
  `users.messages.list?q=is:unread in:inbox` + per-message metadata → `{ kind:"email", account, title:subject, source:from, badge:"email", meta:age, ts }`.

## Panel contract — what the design must provide

The plugin paints into a panel it expects to find; until that panel exists in the markup, the
Inbox refresh **no-ops and skips the `gh` fetch entirely** (`INBOX_LIST_SEL` guard in `main.ts`).
Add to the design (both the dashboard brief **card** and the full **Morning Brief** view, or
whichever should carry it):

```html
<div class="brief__panel" aria-label="Inbox">
  <div class="brief__panel-head">
    <span class="brief__panel-title">Inbox</span>
    <span class="inbox__count">Inbox <b>0</b></span>   <!-- optional; plugin sets the count -->
  </div>
  <div class="inbox-list"></div>                        <!-- plugin fills this -->
</div>
```

Each row the plugin builds into `.inbox-list` (so the CSS needs these classes — add them to
`styles.css` and your design source so they stay in parity):

```html
<div class="inbox-item" data-kind="github">          <!-- data-kind = github | email, for styling -->
  <span class="inbox-item__badge">review</span>
  <div class="inbox-item__body">
    <span class="inbox-item__title">Review requested: fix flaky test</span>
    <span class="inbox-item__meta">
      <span class="inbox-item__source">user/repo</span>
      <span class="inbox-item__account">jjmeyerdev</span>
      <span class="inbox-item__time">3h</span>
    </span>
  </div>
</div>
```

- Empty / unauthed states reuse the existing `.brief-empty` class (already styled).
- The aria-label **must be exactly `Inbox`** — that's the selector hook (mirrors how the other
  brief panels are addressed by `aria-label`).

## Plugin behavior (built)

- `refreshInbox()` — guards: off the `dashboard`/`full-brief` views → no-op; panel absent →
  no-op (no fetch); then `readInbox()` behind an `inboxToken` stale-paint guard.
- `paintInbox()` — clears `.inbox-list`, renders rows (card caps at 4, full view shows all),
  `ok:false` → "Sign in with gh…", empty → "Inbox zero — nothing waiting", and sets the
  optional `.inbox__count b`.
- Cadence: `INBOX_INTERVAL_MS` = 5 min, plus active-leaf-change and the brief-view render.
  **Not** wired to the daily-note watcher (the Inbox isn't in the note).

## Phase 2 — email (Gmail), not yet built

- One-time setup (I'll scaffold a token-minting script): a Google Cloud project + Gmail API
  enabled + a **Desktop OAuth client** + **publish the consent screen to Production** (Testing
  mode expires refresh tokens in 7 days) + one consent click per account → refresh token.
- `~/.config/agentic-os/gmail.json`: `[{ account, client_id, client_secret, refresh_token }]`,
  `chmod 600`, outside the vault. (Optional hardening: macOS Keychain instead of a file.)
- `readEmailInbox()` added to `inbox.ts`, merged into `readInbox()`; scope `gmail.readonly`.

## Remaining open decisions

1. **Gmail addresses** — which accounts to cover (you supply; the contract is account-agnostic,
   so count doesn't block anything). Phase 2 only.
2. **GitHub notification filter** — Phase 1 currently shows **all** unread notifications (your
   real GitHub inbox), badged by reason, newest first, capped 12. If the noisy reasons
   (`ci_activity`, `subscribed`) should be dropped, say so — one-line change.
3. **Confirm** GitHub accounts = `jjmeyerdev` + `JDesigns716` (both already authed in `gh` here —
   verified). Auto-discovery means any account you `gh auth login` is picked up automatically.

## Verification

1. `pnpm run build` (tsc + bundle) passes. ✅ (typecheck green; `inbox.ts` + wiring compile.)
2. After the design lands the panel: in Obsidian the Inbox paints unread notifications across
   both accounts, account-tagged; count matches; un-authed / inbox-zero show the empty states.
3. No panel in markup → refresh no-ops, no `gh` calls, no errors (dark slice).

## Dependency note

Phase 1's only remaining dependency is the **panel markup** (your design edit per the contract
above) — the data + paint code already ship. Phase 2 depends on the Gmail OAuth setup.
