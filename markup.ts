// AUTO-GENERATED from the source HTML dashboards (preview.html, research-full-*.html).
// Each constant is the full `.dash` element; the view injects it under a scoped `.agentic-os` root.
// Do not edit by hand — regenerate with `pnpm gen-markup` after changing the source HTML.

export const DASHBOARD_MARKUP = `<div class="dash" role="region" aria-label="Agentic OS command center">

      <!-- ── HEADER ─────────────────────────────────────────────── -->
      <header class="shell-head">
        <div class="shell-head__brand">
          <svg class="waveform" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="0"  y="8"  width="2.4" height="6"  rx="1.2" />
            <rect x="4"  y="4"  width="2.4" height="14" rx="1.2" />
            <rect x="8"  y="1"  width="2.4" height="20" rx="1.2" />
            <rect x="12" y="5"  width="2.4" height="12" rx="1.2" />
            <rect x="16" y="9"  width="2.4" height="4"  rx="1.2" />
            <rect x="20" y="6"  width="2.4" height="10" rx="1.2" />
          </svg>
          <span class="wordmark">Agentic OS</span>
        </div>

        <div class="shell-head__actions">
          <span class="status-pill" data-tone="live">
            <span class="status-pill__dot"></span>
            Live
          </span>
          <button class="icon-btn" type="button" aria-label="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ── TAB BAR ────────────────────────────────────────────── -->
      <nav class="tabbar" role="tablist" aria-label="Screens">
        <button class="tab" type="button" role="tab" aria-selected="true"  id="tab-overview"  aria-controls="panel-overview">Overview</button>
        <button class="tab" type="button" role="tab" aria-selected="false" id="tab-projects"  aria-controls="panel-projects">Projects</button>
        <button class="tab" type="button" role="tab" aria-selected="false" id="tab-research_"  aria-controls="panel-research">Research_</button>
      </nav>

      <!-- ── SCREEN BODY — Screen 1 · OVERVIEW ────────────────────── -->
      <div class="dash__body" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">

        <!-- ① TOKEN BURN ───────────────────────────────────────── -->
        <section class="card token-hero" aria-label="Token burn">
          <div class="token-hero__top">
            <span class="micro-label">$ Token Burn · 5H Window · <span class="micro-label__live"><span class="live-dot">●</span> Live</span></span>
            <span class="token-hero__pull">last pull 6m ago</span>
          </div>

          <div class="token-hero__main">
            <div class="token-hero__pct">16<span class="token-hero__glyph">%</span></div>

            <div class="meter">
              <div class="meter__track">
                <div class="meter__fill" style="width:15.6%"><span class="meter__shimmer"></span></div>
              </div>
              <div class="meter__ticks">
                <span>0</span><span>500K</span><span>1M</span><span>1.5M</span><span>2.00M</span>
              </div>
            </div>

            <div class="token-hero__figure">
              <div class="token-hero__value">312.51K</div>
              <div class="token-hero__sub">/ 2.00M</div>
              <div class="token-hero__sub token-hero__sub--proj">→ 1.05M PROJ</div>
            </div>
          </div>
        </section>

        <!-- ② STAT CARD ROW (Variant B: bare brand glyph + 120px glow) ── -->
        <div class="stat-row">

          <!-- PUBLIC REPOS -->
          <article class="card stat-card stat-card--repos">
            <span class="status-dot status-dot--live stat-card__status"></span>
            <span class="stat-card__glyph" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
            </span>
            <span class="micro-label stat-card__label">Public Repos</span>
            <div class="stat-card__body">
              <div class="stat-card__value">142</div>
              <div class="stat-card__delta stat-card__delta--up">▲ +5.6%<span class="stat-card__sub">Last 12 months</span></div>
            </div>
          </article>

          <!-- CONTRIBUTIONS -->
          <article class="card stat-card stat-card--contrib">
            <span class="status-dot status-dot--live stat-card__status"></span>
            <span class="stat-card__glyph" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
            </span>
            <span class="micro-label stat-card__label">Contributions</span>
            <div class="stat-card__body">
              <div class="stat-card__value">3,204</div>
              <div class="stat-card__delta stat-card__delta--up">▲ +18.2%<span class="stat-card__sub">Last 12 months</span></div>
            </div>
          </article>

          <!-- FOLLOWERS -->
          <article class="card stat-card stat-card--followers">
            <span class="status-dot status-dot--live stat-card__status"></span>
            <span class="stat-card__glyph" aria-hidden="true">
              <svg width="42" height="42" viewBox="0 0 16 16"><path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"/></svg>
            </span>
            <span class="micro-label stat-card__label">Followers</span>
            <div class="stat-card__body">
              <div class="stat-card__value">8,247</div>
              <div class="stat-card__delta stat-card__delta--up">▲ +3.1%<span class="stat-card__sub">@jjmeyerdev</span></div>
            </div>
          </article>

          <!-- TOTAL STARS -->
          <article class="card stat-card stat-card--stars">
            <span class="status-dot status-dot--live stat-card__status"></span>
            <span class="stat-card__glyph" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
            </span>
            <span class="micro-label stat-card__label">Total Stars</span>
            <div class="stat-card__body">
              <div class="stat-card__value">23,891</div>
              <div class="stat-card__delta stat-card__delta--up">▲ +12.4%<span class="stat-card__sub">Last 12 months</span></div>
            </div>
          </article>

        </div>

        <!-- ③ LATEST SESSION ───────────────────────────────────── -->
        <section class="card latest-session" aria-label="Latest session">
          <span class="latest-session__glyph" aria-hidden="true">
            <svg viewBox="0 0 13 8" role="img" aria-label="Clawd, the Claude Code crab">
              <rect x="0" y="0" width="1" height="1"/><rect x="1" y="0" width="1" height="1"/><rect x="11" y="0" width="1" height="1"/><rect x="12" y="0" width="1" height="1"/>
              <rect x="0" y="1" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="2" y="1" width="1" height="1"/><rect x="10" y="1" width="1" height="1"/><rect x="11" y="1" width="1" height="1"/><rect x="12" y="1" width="1" height="1"/>
              <rect x="2" y="2" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="9" y="2" width="1" height="1"/><rect x="10" y="2" width="1" height="1"/>
              <rect x="2" y="3" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect class="eye" x="4" y="3" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="7" y="3" width="1" height="1"/><rect class="eye" x="8" y="3" width="1" height="1"/><rect x="9" y="3" width="1" height="1"/><rect x="10" y="3" width="1" height="1"/>
              <rect x="2" y="4" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="5" y="4" width="1" height="1"/><rect x="6" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="8" y="4" width="1" height="1"/><rect x="9" y="4" width="1" height="1"/><rect x="10" y="4" width="1" height="1"/>
              <rect x="2" y="5" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/><rect x="9" y="5" width="1" height="1"/><rect x="10" y="5" width="1" height="1"/>
              <rect x="3" y="6" width="1" height="1"/><rect x="5" y="6" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/><rect x="9" y="6" width="1" height="1"/>
              <rect x="3" y="7" width="1" height="1"/><rect x="5" y="7" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/><rect x="9" y="7" width="1" height="1"/>
            </svg>
          </span>
          <div class="latest-session__main">
            <div class="latest-session__top">
              <span class="micro-label micro-label--accent latest-session__kicker">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 6 14 12 8 18"/></svg>
                Latest Session
              </span>
              <span class="latest-session__age"><span class="status-dot status-dot--live"></span>11h old</span>
            </div>
            <h3 class="latest-session__title">Building a command center plugin for Obsidian</h3>
            <div class="latest-session__stats">
              <span><b>142</b><span class="u">messages</span></span>
              <span><b>847K</b><span class="u">tokens</span></span>
              <span><b>63</b><span class="u">tool calls</span></span>
            </div>
            <div class="latest-session__meta">
              <span class="badge badge--accent">opus-4.8</span>
              <span class="chip">&#9282; feat/command-center</span>
              <span class="chip">&#9166; obsidian-command-center</span>
            </div>
          </div>
        </section>

        <!-- ④ QUICK ACTIONS ────────────────────────────────────── -->
        <div class="quick-actions" role="group" aria-label="Quick actions">
          <button class="quick-action" type="button">Plan Today</button>
          <button class="quick-action" type="button">Plan Tomorrow</button>
          <button class="quick-action" type="button">Morning Brief</button>
          <button class="quick-action" type="button">Inbox Brief</button>
          <button class="quick-action" type="button">Deep Research…</button>
          <button class="quick-action" type="button">Atomize…</button>
          <button class="quick-action" type="button">Reading Pipeline</button>
          <button class="quick-action" type="button">Weekly Review</button>
          <button class="quick-action" type="button">Vault Cleanup</button>
          <button class="quick-action" type="button">Pull Metrics</button>
        </div>

        <!-- ⑤ SPLIT ROW — SCHEDULE · TASKS ─────────────────────── -->
        <div class="split-row">

          <section class="card schedule-panel" aria-label="Schedule">
            <div class="panel__head">
              <span class="panel__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                Schedule
              </span>
              <span class="panel__meta">↻ 8 events</span>
            </div>
            <div class="schedule-grid">
              <div class="schedule-row"><span class="schedule-row__time">07:30</span><span class="schedule-row__name">Morning brief</span></div>
              <div class="schedule-row"><span class="schedule-row__time">09:00</span><span class="schedule-row__name">Deep work — script</span></div>
              <div class="schedule-row"><span class="schedule-row__time">11:00</span><span class="schedule-row__name">Standup sync</span></div>
              <div class="schedule-row"><span class="schedule-row__time">12:30</span><span class="schedule-row__name">Lunch / walk</span></div>
              <div class="schedule-row"><span class="schedule-row__time">14:00</span><span class="schedule-row__name">Record episode 14</span></div>
              <div class="schedule-row"><span class="schedule-row__time">16:00</span><span class="schedule-row__name">Edit + thumbnail</span></div>
              <div class="schedule-row"><span class="schedule-row__time">17:30</span><span class="schedule-row__name">Inbox triage</span></div>
              <div class="schedule-row"><span class="schedule-row__time">20:00</span><span class="schedule-row__name">Plan tomorrow</span></div>
            </div>
          </section>

          <section class="card tasks-panel" aria-label="Daily tasks">
            <div class="panel__head">
              <span class="panel__title">Daily Tasks</span>
              <span class="panel__meta">1/8</span>
            </div>
            <div class="task-progress"><span class="task-progress__fill" style="width:12.5%"></span></div>

            <div class="task-grid">
              <label class="task-row">
                <input class="task-check" type="checkbox" checked />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Triage inbox</span>
              </label>
              <label class="task-row task-row--carry">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Process reading highlights <span class="task-tag">carryover</span></span>
              </label>
              <label class="task-row">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Review PR #42</span>
              </label>
              <label class="task-row">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Refactor side-project API</span>
              </label>
              <label class="task-row task-row--carry">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Link orphan notes <span class="task-tag">carryover</span></span>
              </label>
              <label class="task-row">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Update project log</span>
              </label>
              <label class="task-row">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Outline new MOC</span>
              </label>
              <label class="task-row">
                <input class="task-check" type="checkbox" />
                <span class="task-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                <span class="task-label">Summarize book notes</span>
              </label>
            </div>

            <button class="task-add" type="button">+ add task</button>
          </section>

        </div>

        <!-- ⑥ ACTIVITY FEED ────────────────────────────────────── -->
        <section class="card activity-feed" aria-label="Activity feed">
          <div class="panel__head">
            <span class="panel__title">Activity Feed</span>
            <span class="panel__meta">8 runs</span>
          </div>

          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--neutral">plan</span>
            <span class="activity-row__msg">Generated today's plan — 8 tasks, 4 scheduled blocks</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">2m</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--accent">research</span>
            <span class="activity-row__msg">Synthesized 12 sources on retrieval-augmented agents</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">14m</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--accent">atomize</span>
            <span class="activity-row__msg">Split a research note into 6 atomic notes, linked to 3 MOCs</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">31m</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--pos">metrics</span>
            <span class="activity-row__msg">Pulled weekly metrics — 18 notes added, 92% tasks done, 3 streaks held</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">1h</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--accent">brief</span>
            <span class="activity-row__msg">Compiled morning brief — 3 priorities, 6 inbox items</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">1h</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--pos">pipeline</span>
            <span class="activity-row__msg">Ran 3 articles through ingest → permanent note</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">2h</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--neutral">cleanup</span>
            <span class="activity-row__msg">Merged 14 orphan notes, fixed 9 broken wikilinks</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">3h</span>
          </div>
          <div class="activity-row">
            <svg class="activity-row__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span class="badge badge--pos">review</span>
            <span class="activity-row__msg">Closed out weekly review — 23 done, 5 carried over</span>
            <span class="chip">log</span><span class="chip">{}</span>
            <span class="activity-row__time">5h</span>
          </div>
        </section>

      </div>

      <!-- ── SCREEN BODY — Screen 2 · PROJECTS (GitHub Activity) ────── -->
      <div class="dash__body" id="panel-projects" role="tabpanel" aria-labelledby="tab-projects" hidden>

        <!-- ① CONTRIBUTION CHART ───────────────────────────────── -->
        <section class="card gh-chart" aria-label="Contributions in the last year">
          <div class="gh-chart__head">
            <div class="gh-chart__head-l">
              <span class="gh-chart__kicker">Contributions</span>
              <h2 class="gh-chart__title">Activity over the last year</h2>
            </div>
            <span class="gh-chart__delta gh-chart__delta--pos">+18%</span>
          </div>
          <div class="gh-chart__area">
            <div class="gh-chart__rules">
              <div class="gh-chart__rule"></div>
              <div class="gh-chart__rule"></div>
              <div class="gh-chart__rule"></div>
              <div class="gh-chart__rule"></div>
              <div class="gh-chart__rule"></div>
            </div>
            <div class="gh-chart__bars">
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:66%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:53%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:47%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:72%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:82%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:62%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:43%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:76%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:92%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:84%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:67%"></div></div>
              <div class="gh-chart__bar-wrap"><div class="gh-chart__bar" style="height:56%"></div></div>
            </div>
          </div>
          <div class="gh-chart__x-labels">
            <div class="gh-chart__x-label">Jun</div>
            <div class="gh-chart__x-label">Jul</div>
            <div class="gh-chart__x-label">Aug</div>
            <div class="gh-chart__x-label">Sep</div>
            <div class="gh-chart__x-label">Oct</div>
            <div class="gh-chart__x-label">Nov</div>
            <div class="gh-chart__x-label">Dec</div>
            <div class="gh-chart__x-label">Jan</div>
            <div class="gh-chart__x-label">Feb</div>
            <div class="gh-chart__x-label">Mar</div>
            <div class="gh-chart__x-label">Apr</div>
            <div class="gh-chart__x-label">May</div>
          </div>
          <div class="gh-chart__foot">
            <div class="gh-chart__total-row">
              <span class="status-dot status-dot--live"></span>
              <span class="gh-chart__total">704</span>
              <span class="micro-label">contributions this year</span>
            </div>
            <span class="micro-label">Jun 2025 &rarr; May 2026</span>
          </div>
        </section>

        <!-- ② STAT ROW — STREAK · VELOCITY · PEAK ───────────────── -->
        <div class="gh-stat-row">
          <article class="card gh-stat-card" aria-label="Current streak">
            <span class="gh-stat-card__label">Current Streak</span>
            <div class="gh-stat-card__value gh-stat-card__value--accent">14 days</div>
            <div class="gh-stat-card__sub">Longest: 31 days</div>
          </article>
          <article class="card gh-stat-card" aria-label="Commit velocity">
            <span class="gh-stat-card__label">Commit Velocity</span>
            <div class="gh-stat-card__value gh-stat-card__value--pos">41 commits</div>
            <div class="gh-stat-card__sub">&uarr; +86% vs last week</div>
            <div class="velocity-mini-bars">
              <div class="velocity-bar velocity-bar--dim" style="height:44%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:59%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:76%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:46%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:68%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:85%"></div>
              <div class="velocity-bar velocity-bar--dim" style="height:54%"></div>
              <div class="velocity-bar velocity-bar--current" style="height:100%"></div>
            </div>
          </article>
          <article class="card gh-stat-card" aria-label="Most active time">
            <span class="gh-stat-card__label">Peak Activity</span>
            <div class="gh-stat-card__value gh-stat-card__value--warn">Wednesday</div>
            <div class="gh-stat-card__sub">Peak: 10 AM &ndash; 12 PM</div>
          </article>
        </div>

        <!-- ③ REPO CARDS ───────────────────────────────────────── -->
        <div class="gh-repo-grid">
          <article class="card gh-repo" aria-label="Repository: llm-wiki-kit">
            <div class="gh-repo__head">
              <div class="gh-repo__name-row">
                <svg class="gh-repo__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>
                <span class="gh-repo__name">llm-wiki-kit</span>
              </div>
              <span class="gh-repo__updated micro-label">Updated 2d ago</span>
            </div>
            <p class="gh-repo__desc">LLM-maintained Obsidian wiki scaffold — schema, ingest, query, and lint workflows.</p>
            <div class="gh-repo__stats">
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">847</span><span class="gh-repo__stat-label">Commits</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">3</span><span class="gh-repo__stat-label">Open PRs</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">5</span><span class="gh-repo__stat-label">Issues</span></div>
            </div>
            <div class="gh-repo__foot">
              <div class="gh-repo__lang">
                <svg class="gh-repo__lang-logo" viewBox="0 0 128 128" aria-hidden="true"><path fill="#3776AB" d="M63.391 1.988c-4.222.02-8.252.379-11.8 1.007-10.45 1.846-12.346 5.71-12.346 12.837v9.411h24.693v3.137H29.977c-7.176 0-13.46 4.313-15.426 12.521-2.268 9.405-2.368 15.275 0 25.096 1.755 7.311 5.947 12.519 13.124 12.519h8.491V67.234c0-8.151 7.051-15.34 15.426-15.34h24.665c6.866 0 12.346-5.654 12.346-12.548V15.833c0-6.693-5.646-11.72-12.346-12.837-4.244-.706-8.645-1.027-12.866-1.008zM50.037 9.557c2.55 0 4.634 2.117 4.634 4.721 0 2.593-2.083 4.69-4.634 4.69-2.56 0-4.633-2.097-4.633-4.69-.001-2.604 2.073-4.721 4.633-4.721z"/><path fill="#FFD43B" d="M91.682 28.38v10.966c0 8.5-7.208 15.655-15.426 15.655H51.591c-6.756 0-12.346 5.783-12.346 12.549v23.515c0 6.691 5.818 10.628 12.346 12.547 7.816 2.297 15.312 2.713 24.665 0 6.216-1.801 12.346-5.423 12.346-12.547v-9.412H63.938v-3.138h37.012c7.176 0 9.852-5.005 12.348-12.519 2.578-7.735 2.467-15.174 0-25.096-1.774-7.145-5.161-12.521-12.348-12.521h-9.268zM77.809 87.927c2.561 0 4.634 2.097 4.634 4.692 0 2.602-2.074 4.719-4.634 4.719-2.55 0-4.633-2.117-4.633-4.719 0-2.595 2.083-4.692 4.633-4.692z"/></svg>
                <span class="gh-repo__lang-name gh-repo__lang-name--python">Python</span>
              </div>
              <div class="gh-repo__star"><svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>2.1k</div>
            </div>
          </article>
          <article class="card gh-repo" aria-label="Repository: agentic-os">
            <div class="gh-repo__head">
              <div class="gh-repo__name-row">
                <svg class="gh-repo__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>
                <span class="gh-repo__name">agentic-os</span>
              </div>
              <span class="gh-repo__updated micro-label">Updated 5d ago</span>
            </div>
            <p class="gh-repo__desc">Obsidian plugin — command center pane with token tracking, quick actions, and task management.</p>
            <div class="gh-repo__stats">
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">1,204</span><span class="gh-repo__stat-label">Commits</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">7</span><span class="gh-repo__stat-label">Open PRs</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">12</span><span class="gh-repo__stat-label">Issues</span></div>
            </div>
            <div class="gh-repo__foot">
              <div class="gh-repo__lang">
                <svg class="gh-repo__lang-logo" viewBox="0 0 128 128" aria-hidden="true"><path fill="#F7DF1E" d="M1.408 1.408h125.184v125.184H1.408z"/><path fill="#323330" d="M116.347 96.736c-.917-5.711-4.641-10.508-15.672-14.981-3.832-1.761-8.104-3.022-9.377-5.926-.452-1.69-.512-2.642-.226-3.665.821-3.32 4.784-4.355 7.925-3.403 2.023.678 3.938 2.237 5.093 4.724 5.402-3.498 5.391-3.475 9.163-5.879-1.381-2.141-2.118-3.129-3.022-4.045-3.249-3.629-7.676-5.498-14.756-5.355l-3.688.477c-3.534.893-6.902 2.748-8.877 5.235-5.926 6.724-4.236 18.492 2.975 23.335 7.58 5.483 18.57 6.555 20.023 11.658.697 4.082-3.022 5.394-6.809 5.926-5.093.959-9.523-1.078-13.218-5.713l-9.435 5.402c1.15 2.547 2.355 3.738 4.019 5.545 8.553 9.553 30.917 9.072 35.441-4.511.468-1.079 1.047-3.345.82-6.996zM75.002 32.012h-11.94L60.328 43.79c0 10.332.005 20.656-.016 30.988-.076 5.272-1.637 7.83-5.026 9.271-4.816 1.537-9.064-.67-11.498-4.938l-9.711 5.9c2.133 4.389 5.605 7.785 9.947 9.499 5.274 2.059 11.042 1.964 16.113-.189 6.406-2.851 10.135-8.545 10.135-17.311V32.012z"/></svg>
                <span class="gh-repo__lang-name gh-repo__lang-name--javascript">JavaScript</span>
              </div>
              <div class="gh-repo__star"><svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>847</div>
            </div>
          </article>
          <article class="card gh-repo" aria-label="Repository: dotfiles">
            <div class="gh-repo__head">
              <div class="gh-repo__name-row">
                <svg class="gh-repo__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>
                <span class="gh-repo__name">dotfiles</span>
              </div>
              <span class="gh-repo__updated micro-label">Updated 1w ago</span>
            </div>
            <p class="gh-repo__desc">macOS + fish shell config — Ghostty, VS Code, Homebrew, and CLI tooling across all machines.</p>
            <div class="gh-repo__stats">
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">392</span><span class="gh-repo__stat-label">Commits</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">1</span><span class="gh-repo__stat-label">Open PRs</span></div>
              <div class="gh-repo__stat"><span class="gh-repo__stat-value">2</span><span class="gh-repo__stat-label">Issues</span></div>
            </div>
            <div class="gh-repo__foot">
              <div class="gh-repo__lang">
                <svg class="gh-repo__lang-logo" viewBox="0 0 128 128" aria-hidden="true"><path fill="#89E051" d="M36.075 0C32.796 0 30.19 1.92 28.956 4.693L.545 69.849c-.594 1.35-.545 2.832.135 4.13.68 1.296 1.89 2.24 3.327 2.596l18.444 4.547V99.98c0 1.92.955 3.695 2.543 4.742 1.587 1.05 3.6 1.248 5.363.527l13.278-5.43 13.16 13.91c1.02 1.077 2.444 1.68 3.93 1.68.573 0 1.15-.088 1.707-.27l26.72-8.535c2.375-.759 3.98-2.976 3.98-5.474V85.063l18.72-4.617c1.437-.354 2.647-1.298 3.327-2.595.68-1.298.73-2.78.135-4.13L87.797 4.693C86.563 1.92 83.957 0 80.678 0H36.075zm.343 10.42h43.917l26.99 61.4L90.1 75.883V101.1l-22.952 7.333-14.118-14.918-15.688 6.415V73.993L18.428 69.82l17.99-59.4zM57.89 31.72l-3.85 23.394 5.57 1.83-.015.003 5.577 1.83-3.85-23.394L57.89 31.72zm-13.278 2.72l-2.204 2.204-2.204 2.204 17.316 17.316 2.204-2.204 2.204-2.204L44.612 34.44zm27.53 0L54.826 51.756l2.204 2.204 2.204 2.204 17.316-17.316-2.204-2.204-2.204-2.204z"/></svg>
                <span class="gh-repo__lang-name gh-repo__lang-name--shell">Shell</span>
              </div>
              <div class="gh-repo__star"><svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>312</div>
            </div>
          </article>
        </div>

        <!-- ④ LANGUAGE BREAKDOWN ────────────────────────────────── -->
        <section class="card lang-bar-card" aria-label="Language breakdown">
          <div class="lang-bar-card__head">
            <span class="micro-label">&#9655; Language Breakdown &middot; All Repos</span>
          </div>
          <div class="lang-bar-track">
            <span class="lang-bar-track__seg lang-bar-track__seg--python" style="flex:38"></span>
            <span class="lang-bar-track__seg lang-bar-track__seg--javascript" style="flex:27"></span>
            <span class="lang-bar-track__seg lang-bar-track__seg--shell" style="flex:14"></span>
            <span class="lang-bar-track__seg lang-bar-track__seg--typescript" style="flex:12"></span>
            <span class="lang-bar-track__seg lang-bar-track__seg--other" style="flex:9"></span>
          </div>
          <div class="lang-legend">
            <div class="lang-legend__item"><span class="lang-legend__dot lang-legend__dot--python"></span>Python <span class="lang-legend__pct">38%</span></div>
            <div class="lang-legend__item"><span class="lang-legend__dot lang-legend__dot--javascript"></span>JavaScript <span class="lang-legend__pct">27%</span></div>
            <div class="lang-legend__item"><span class="lang-legend__dot lang-legend__dot--shell"></span>Shell <span class="lang-legend__pct">14%</span></div>
            <div class="lang-legend__item"><span class="lang-legend__dot lang-legend__dot--typescript"></span>TypeScript <span class="lang-legend__pct">12%</span></div>
            <div class="lang-legend__item"><span class="lang-legend__dot lang-legend__dot--other"></span>Other <span class="lang-legend__pct">9%</span></div>
          </div>
        </section>

        <!-- ⑤ RECENT RELEASES ──────────────────────────────────── -->
        <section class="card releases-card" aria-label="Recent releases">
          <div class="releases-card__head">
            <span class="micro-label">&#9655; Recent Releases</span>
            <span class="micro-label">3 tags</span>
          </div>
          <div class="release-row">
            <span class="release-tag">v1.9.2</span>
            <span class="release-repo">agentic-os</span>
            <span class="release-desc">Compound vault — concurrent write locking, hybrid BM25 retrieval</span>
            <span class="release-age">2d ago</span>
          </div>
          <div class="release-row">
            <span class="release-tag">v0.4.1</span>
            <span class="release-repo">llm-wiki-kit</span>
            <span class="release-desc">Lint pass improvements, orphan detection, log grep helper</span>
            <span class="release-age">1w ago</span>
          </div>
          <div class="release-row">
            <span class="release-tag">v2.0.0</span>
            <span class="release-repo">dotfiles</span>
            <span class="release-desc">Fish shell migration complete — Ghostty + fnm + pnpm defaults</span>
            <span class="release-age">3w ago</span>
          </div>
        </section>

        <!-- ⑥ ACTIVITY HEATMAP ─────────────────────────────────── -->
        <section class="card active-time-card" aria-label="Activity by day and time">
          <div class="active-time-card__head">
            <span class="micro-label">&#9655; Activity Pattern &middot; Day / Time</span>
            <span class="micro-label">Peak: Wed &middot; 10 AM&ndash;2 PM</span>
          </div>
          <div class="activity-legend" aria-label="Activity intensity legend">
            <span class="micro-label">Less</span>
            <span class="activity-legend__swatch activity-legend__swatch--0"></span>
            <span class="activity-legend__swatch activity-legend__swatch--1"></span>
            <span class="activity-legend__swatch activity-legend__swatch--2"></span>
            <span class="activity-legend__swatch activity-legend__swatch--3"></span>
            <span class="activity-legend__swatch activity-legend__swatch--4"></span>
            <span class="micro-label">More</span>
          </div>
          <div class="day-grid">
            <div class="day-col">
              <div class="day-col__label">Mon</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Tue</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="4"></div><div class="day-slot" data-level="4"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="1"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Wed</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="4"></div><div class="day-slot" data-level="4"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Thu</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="4"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Fri</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="3"></div><div class="day-slot" data-level="2"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Sat</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div>
            </div>
            <div class="day-col">
              <div class="day-col__label">Sun</div>
              <div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="1"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div><div class="day-slot" data-level="0"></div>
            </div>
          </div>
          <div class="time-labels">
            <div class="time-label">AM</div>
            <div class="time-label">10</div>
            <div class="time-label">12</div>
            <div class="time-label">2PM</div>
            <div class="time-label">4</div>
            <div class="time-label">6</div>
            <div class="time-label">Eve</div>
          </div>
        </section>

      </div>

      <!-- ── SCREEN BODY — Screen 3 · RESEARCH ─────────────────────── -->
      <div class="dash__body" id="panel-research" role="tabpanel" aria-labelledby="tab-research_" hidden>

        <!--
          Each .rank-list and .brief__panel renders one of four states.
          Shown below is the populated (default) state. The other three:

            Loading →  <div class="skel-row skel-row--wide"></div>
                       <div class="skel-row skel-row--mid"></div>
                       <div class="skel-row skel-row--short"></div>

            Empty   →  <button class="run-pill" type="button">▶ Run [Skill Name]</button>

            Error   →  <div class="state-error">
                         <span class="state-error__msg">Fetch failed</span>
                         <button class="state-error__retry" type="button">Retry</button>
                       </div>
        -->

        <!-- ① RESEARCH TOP — Release Radar · Hacker News ────────── -->
        <div class="research-top">

          <!-- RELEASE RADAR — active repo's deps, with breaking/security escalated -->
          <section class="card" aria-label="Release radar">
            <div class="rsrch-head">
              <span class="rsrch-head__title">Release Radar</span>
              <div class="rsrch-head__right">
                <button class="pill-link" type="button" data-full="full-radar">Full <span aria-hidden="true">↗</span></button>
                <button class="icon-btn" type="button" aria-label="Refresh release radar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
                </button>
                <span class="rsrch-date">2026-05-15</span>
              </div>
            </div>
            <div class="rank-list">
              <div class="rank-group rank-group--attention">⚠ Needs Attention</div>
              <div class="rank-row">
                <span class="rank-row__num">1</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">better-auth/better-auth<span class="rank-row__pts">v1.7.0</span><span class="badge badge--breaking">BREAKING</span></div>
                  <div class="rank-row__desc">Session cookie API changed — affects vibe-voicer + fp-tracker.</div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">2</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">nodemailer/nodemailer<span class="rank-row__pts">v8.0.8</span><span class="badge badge--security">SECURITY</span></div>
                  <div class="rank-row__desc">Patches a header-injection advisory — used in vibe-voicer.</div>
                </div>
              </div>

              <div class="rank-group">◆ Active · <span class="rank-group__repo">movie-db</span></div>
              <div class="rank-row">
                <span class="rank-row__num">3</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">vercel/next.js<span class="rank-row__pts">v16.3.0</span><span class="badge badge--pos">MINOR</span></div>
                  <div class="rank-row__desc">Turbopack production builds stable; faster App Router cold starts.</div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">4</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">facebook/react<span class="rank-row__pts">v19.3.0</span><span class="badge badge--pos">MINOR</span></div>
                  <div class="rank-row__desc">Adds the &lt;Activity&gt; component; clearer hydration mismatch errors.</div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">5</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">tailwindlabs/tailwindcss<span class="rank-row__pts">v4.3.0</span><span class="badge badge--pos">MINOR</span></div>
                  <div class="rank-row__desc">New container-query variants; smaller generated CSS.</div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">6</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">prisma/prisma<span class="rank-row__pts">v7.3.1</span><span class="badge badge--neutral">PATCH</span></div>
                  <div class="rank-row__desc">Fixes a JSON filter on the pg adapter — movie-db's ORM.</div>
                </div>
              </div>
            </div>
          </section>

          <!-- HACKER NEWS -->
          <section class="card" aria-label="Hacker News">
            <div class="rsrch-head">
              <span class="rsrch-head__title">Hacker News</span>
              <div class="rsrch-head__right">
                <button class="pill-link" type="button" data-full="full-hn">Full <span aria-hidden="true">↗</span></button>
                <button class="icon-btn" type="button" aria-label="Refresh Hacker News">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
                </button>
                <span class="rsrch-date">2026-05-15</span>
              </div>
            </div>
            <div class="rank-list">
              <div class="rank-row">
                <span class="rank-row__num">1</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">Show HN: I built a local-first sync engine in Rust<span class="rank-row__pts">412↑</span></div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">2</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">The hidden cost of microservices nobody talks about<span class="rank-row__pts">387↑</span></div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">3</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">Why SQLite is the database of the decade<span class="rank-row__pts">298↑</span></div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">4</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">A from-scratch guide to writing a toy compiler<span class="rank-row__pts">256↑</span></div>
                </div>
              </div>
              <div class="rank-row">
                <span class="rank-row__num">5</span>
                <div class="rank-row__body">
                  <div class="rank-row__line1">Postgres full-text search is criminally underrated<span class="rank-row__pts">201↑</span></div>
                </div>
              </div>
            </div>
          </section>

        </div>

        <!-- ② MORNING BRIEF ─────────────────────────────────────── -->
        <section class="card brief" aria-label="Morning brief">
          <div class="brief__head">
            <div class="brief__head-l">
              <span class="brief__title">§ Morning Brief</span>
              <span class="brief__date">2026-05-14</span>
            </div>
            <div class="brief__counts" aria-label="In today's brief">
              <span class="brief__count">Headlines <b>5</b></span>
              <span class="brief__count">Reading <b>6</b></span>
              <span class="brief__count">𝕏 Voices <b>4</b></span>
              <span class="brief__count">Notes <b>4</b></span>
            </div>
            <div class="brief__head-r">
              <button class="pill-link" type="button" data-full="full-brief">Full <span aria-hidden="true">↗</span></button>
              <button class="icon-btn" type="button" aria-label="Refresh morning brief">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
              </button>
            </div>
          </div>

          <div class="brief__grid">

            <!-- HEADLINES -->
            <div class="brief__panel" aria-label="Headlines">
              <div class="brief__panel-head"><span class="brief__panel-title">Headlines</span></div>
              <div class="brief__bullets">
                <div class="brief__bullet">Anthropic ships an extended context window tuned for agentic coding workloads.</div>
                <div class="brief__bullet">EU AI Act enforcement begins — high-risk system audits start in Q3.</div>
                <div class="brief__bullet">An open-weights model matches frontier benchmarks at a tenth of the params.</div>
              </div>
            </div>

            <!-- READING QUEUE -->
            <div class="brief__panel" aria-label="Reading queue">
              <div class="brief__panel-head"><span class="brief__panel-title">Reading Queue</span></div>
              <div class="reading-list">
                <div class="reading-item">
                  <span class="reading-item__title">The Hidden Cost of Microservices</span>
                  <span class="reading-item__meta"><span class="reading-item__src">martinfowler.com</span><span class="reading-item__time">14 min read</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">Local-First Software: You Own Your Data</span>
                  <span class="reading-item__meta"><span class="reading-item__src">inkandswitch.com</span><span class="reading-item__time">saved 2d ago</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">A Decade of Dynamo, and the Next Wave</span>
                  <span class="reading-item__meta"><span class="reading-item__src">allthingsdistributed.com</span><span class="reading-item__time">9 min read</span></span>
                </div>
              </div>
            </div>

            <!-- 𝕏 CONVERSATION -->
            <div class="brief__panel" aria-label="X conversation">
              <div class="brief__panel-head"><span class="brief__panel-title">𝕏 Conversation</span></div>
              <div class="x-list">
                <div class="x-block">
                  <span class="x-block__label">Mood</span>
                  <span class="x-block__text">Cautiously bullish on agent reliability after this week's releases.</span>
                </div>
                <div class="x-block">
                  <span class="x-block__label">Top voices</span>
                  <div class="x-voices">
                    <span class="chip">@karpathy</span>
                    <span class="chip">@swyx</span>
                    <span class="chip">@simonw</span>
                  </div>
                </div>
                <div class="x-block">
                  <span class="x-block__label">Hot takes</span>
                  <span class="x-block__text">“Context windows are the new RAM — stop optimizing prompts, start optimizing memory.”</span>
                </div>
              </div>
            </div>

            <!-- NOTE OPPORTUNITIES -->
            <div class="brief__panel" aria-label="Note opportunities">
              <div class="brief__panel-head"><span class="brief__panel-title">Note Opportunities</span></div>
              <div class="opp-list">
                <div class="opp-item">
                  <span class="opp-item__num">1</span>
                  <span class="opp-item__text">No note yet on <em>local-first sync</em> — three sources cited it this week.</span>
                </div>
                <div class="opp-item">
                  <span class="opp-item__num">2</span>
                  <span class="opp-item__text">Atomize your “Agent Architectures” capture into linked atomic notes.</span>
                </div>
                <div class="opp-item">
                  <span class="opp-item__num">3</span>
                  <span class="opp-item__text">Link today's CRDT reading to your <em>Distributed Systems</em> MOC.</span>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>

    </div>`;

export const FULL_RADAR_MARKUP = `<div class="dash" role="region" aria-label="Agentic OS — Research full view">

      <!-- ── HEADER ───────────────────────────────────────────────
           Reused verbatim from preview.html so the app identity is
           continuous between the dashboard and any full view.        -->
      <header class="shell-head">
        <div class="shell-head__brand">
          <svg class="waveform" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="0"  y="8"  width="2.4" height="6"  rx="1.2" />
            <rect x="4"  y="4"  width="2.4" height="14" rx="1.2" />
            <rect x="8"  y="1"  width="2.4" height="20" rx="1.2" />
            <rect x="12" y="5"  width="2.4" height="12" rx="1.2" />
            <rect x="16" y="9"  width="2.4" height="4"  rx="1.2" />
            <rect x="20" y="6"  width="2.4" height="10" rx="1.2" />
          </svg>
          <span class="wordmark">Agentic OS</span>
        </div>

        <div class="shell-head__actions">
          <span class="status-pill" data-tone="live">
            <span class="status-pill__dot"></span>
            Live
          </span>
          <button class="icon-btn" type="button" aria-label="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ── FULL BAR  (generic) ──────────────────────────────────
           Sits where the tabbar sits on the dashboard. Back affordance
           + breadcrumb. The trailing crumb (".full-crumb__here") is the
           ONLY part that changes per source.                          -->
      <div class="full-bar">
        <button class="full-back" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Research_
        </button>
        <nav class="full-crumb" aria-label="Breadcrumb">
          <span class="full-crumb__root">Research_</span>
          <span class="full-crumb__sep" aria-hidden="true">/</span>
          <span class="full-crumb__here">Release Radar</span>
        </nav>
        <span class="full-bar__meta">updated 2026-05-15</span>
      </div>

      <!-- ── FULL TOOLBAR  (generic) ──────────────────────────────
           Search + filter chips on the left, sort + result count on the
           right. Chips/sort are source-defined; the shell is the same.  -->
      <div class="full-toolbar">
        <div class="full-toolbar__l">
          <label class="full-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Filter dependencies…" aria-label="Filter dependencies" />
          </label>
          <div class="full-chips" role="group" aria-label="Filter">
            <button class="full-chip is-active" type="button">All <span class="full-chip__n">23</span></button>
            <button class="full-chip" type="button">⚠ Attention <span class="full-chip__n">2</span></button>
            <button class="full-chip" type="button">◆ Active <span class="full-chip__n">6</span></button>
            <button class="full-chip" type="button">Idle <span class="full-chip__n">15</span></button>
          </div>
        </div>
        <div class="full-toolbar__r">
          <button class="full-sort" type="button">
            Sort: Priority
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span class="full-count">23 results</span>
        </div>
      </div>

      <!-- ── FULL BODY ────────────────────────────────────────────
           ┌──────────────────────────────────────────────────────┐
           │  SWAP POINT — this region is the only per-source part. │
           │  Release Radar shown. Drop in Hacker News, Morning     │
           │  Brief, etc. using the same .card / .rank-list / etc.  │
           └──────────────────────────────────────────────────────┘ -->
      <div class="dash__body full-body">

        <section class="card" aria-label="Release radar — full">
          <div class="rsrch-head">
            <span class="rsrch-head__title">Release Radar · all tracked deps</span>
            <div class="rsrch-head__right">
              <span class="rsrch-date">23 packages · 8 repos</span>
            </div>
          </div>

          <div class="rank-list">

            <!-- escalations first -->
            <div class="rank-group rank-group--attention">⚠ Needs Attention</div>
            <div class="rank-row">
              <span class="rank-row__num">1</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">better-auth/better-auth<span class="rank-row__pts">v1.7.0</span><span class="badge badge--breaking">BREAKING</span></div>
                <div class="rank-row__desc">Session cookie API changed — affects vibe-voicer + fp-tracker. Migration guide flags <code>getSession()</code> signature change.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">2</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">nodemailer/nodemailer<span class="rank-row__pts">v8.0.8</span><span class="badge badge--security">SECURITY</span></div>
                <div class="rank-row__desc">Patches a header-injection advisory (CVE-2026-XXXX) — used in vibe-voicer transactional mail.</div>
              </div>
            </div>

            <!-- active repo -->
            <div class="rank-group">◆ Active · <span class="rank-group__repo">movie-db</span></div>
            <div class="rank-row">
              <span class="rank-row__num">3</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">vercel/next.js<span class="rank-row__pts">v16.3.0</span><span class="badge badge--pos">MINOR</span></div>
                <div class="rank-row__desc">Turbopack production builds stable; faster App Router cold starts.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">4</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">facebook/react<span class="rank-row__pts">v19.3.0</span><span class="badge badge--pos">MINOR</span></div>
                <div class="rank-row__desc">Adds the &lt;Activity&gt; component; clearer hydration mismatch errors.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">5</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">tailwindlabs/tailwindcss<span class="rank-row__pts">v4.3.0</span><span class="badge badge--pos">MINOR</span></div>
                <div class="rank-row__desc">New container-query variants; smaller generated CSS.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">6</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">prisma/prisma<span class="rank-row__pts">v7.3.1</span><span class="badge badge--neutral">PATCH</span></div>
                <div class="rank-row__desc">Fixes a JSON filter on the pg adapter — movie-db's ORM.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">7</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">colinhacks/zod<span class="rank-row__pts">v4.1.2</span><span class="badge badge--neutral">PATCH</span></div>
                <div class="rank-row__desc">Narrower inferred types for <code>.pick()</code> on discriminated unions.</div>
              </div>
            </div>

            <!-- idle repos -->
            <div class="rank-group">◇ Idle · <span class="rank-group__repo">fp-tracker</span></div>
            <div class="rank-row">
              <span class="rank-row__num">8</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">drizzle-team/drizzle-orm<span class="rank-row__pts">v0.41.0</span><span class="badge badge--pos">MINOR</span></div>
                <div class="rank-row__desc">Relational query builder v2 out of beta; partial-select perf wins.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">9</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">TanStack/query<span class="rank-row__pts">v6.0.1</span><span class="badge badge--neutral">PATCH</span></div>
                <div class="rank-row__desc">Hydration boundary fix for streamed RSC payloads.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">10</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">pmndrs/zustand<span class="rank-row__pts">v5.1.0</span><span class="badge badge--neutral">PATCH</span></div>
                <div class="rank-row__desc">Smaller bundle; <code>useShallow</code> now tree-shakes cleanly.</div>
              </div>
            </div>

            <div class="rank-group">◇ Idle · <span class="rank-group__repo">vibe-voicer</span></div>
            <div class="rank-row">
              <span class="rank-row__num">11</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">openai/openai-node<span class="rank-row__pts">v5.8.0</span><span class="badge badge--pos">MINOR</span></div>
                <div class="rank-row__desc">Streaming helpers for the Responses API; typed tool-call deltas.</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">12</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">pingdotgg/uploadthing<span class="rank-row__pts">v7.2.0</span><span class="badge badge--neutral">PATCH</span></div>
                <div class="rank-row__desc">Resumable uploads default on; fixes a Safari multipart edge case.</div>
              </div>
            </div>

          </div>
        </section>

      </div>

    </div>`;

export const FULL_HN_MARKUP = `<div class="dash" role="region" aria-label="Agentic OS — Hacker News full view">

      <!-- ── HEADER (reused verbatim) ──────────────────────────── -->
      <header class="shell-head">
        <div class="shell-head__brand">
          <svg class="waveform" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="0"  y="8"  width="2.4" height="6"  rx="1.2" />
            <rect x="4"  y="4"  width="2.4" height="14" rx="1.2" />
            <rect x="8"  y="1"  width="2.4" height="20" rx="1.2" />
            <rect x="12" y="5"  width="2.4" height="12" rx="1.2" />
            <rect x="16" y="9"  width="2.4" height="4"  rx="1.2" />
            <rect x="20" y="6"  width="2.4" height="10" rx="1.2" />
          </svg>
          <span class="wordmark">Agentic OS</span>
        </div>
        <div class="shell-head__actions">
          <span class="status-pill" data-tone="live">
            <span class="status-pill__dot"></span>
            Live
          </span>
          <button class="icon-btn" type="button" aria-label="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ── FULL BAR (generic) ────────────────────────────────── -->
      <div class="full-bar">
        <button class="full-back" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Research_
        </button>
        <nav class="full-crumb" aria-label="Breadcrumb">
          <span class="full-crumb__root">Research_</span>
          <span class="full-crumb__sep" aria-hidden="true">/</span>
          <span class="full-crumb__here">Hacker News</span>
        </nav>
        <span class="full-bar__meta">updated 2026-05-15 · 06:40</span>
      </div>

      <!-- ── FULL TOOLBAR (generic) ────────────────────────────── -->
      <div class="full-toolbar">
        <div class="full-toolbar__l">
          <label class="full-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Filter stories…" aria-label="Filter stories" />
          </label>
          <div class="full-chips" role="group" aria-label="Filter">
            <button class="full-chip is-active" type="button">Top <span class="full-chip__n">30</span></button>
            <button class="full-chip" type="button">Show HN <span class="full-chip__n">8</span></button>
            <button class="full-chip" type="button">Ask HN <span class="full-chip__n">5</span></button>
            <button class="full-chip" type="button">New <span class="full-chip__n">—</span></button>
          </div>
        </div>
        <div class="full-toolbar__r">
          <button class="full-sort" type="button">
            Sort: Points
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span class="full-count">30 stories</span>
        </div>
      </div>

      <!-- ── FULL BODY ─ Hacker News (swap point) ──────────────── -->
      <div class="dash__body full-body">
        <section class="card" aria-label="Hacker News — full">
          <div class="rsrch-head">
            <span class="rsrch-head__title">Hacker News · front page</span>
            <div class="rsrch-head__right">
              <span class="rsrch-date">top 30 by points</span>
            </div>
          </div>

          <div class="rank-list">
            <div class="rank-row">
              <span class="rank-row__num">1</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Show HN: I built a local-first sync engine in Rust<span class="rank-row__pts">412↑</span></div>
                <div class="rank-row__desc">github.com/example · 188 comments · 3h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">2</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">The hidden cost of microservices nobody talks about<span class="rank-row__pts">387↑</span></div>
                <div class="rank-row__desc">martinfowler.com · 240 comments · 5h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">3</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Why SQLite is the database of the decade<span class="rank-row__pts">298↑</span></div>
                <div class="rank-row__desc">fly.io · 156 comments · 6h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">4</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">A from-scratch guide to writing a toy compiler<span class="rank-row__pts">256↑</span></div>
                <div class="rank-row__desc">austinhenley.com · 73 comments · 7h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">5</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Postgres full-text search is criminally underrated<span class="rank-row__pts">201↑</span></div>
                <div class="rank-row__desc">supabase.com · 94 comments · 8h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">6</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Ask HN: How do you keep up with your reading queue?<span class="rank-row__pts">188↑</span></div>
                <div class="rank-row__desc">news.ycombinator.com · 311 comments · 9h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">7</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">CRDTs explained without the category theory<span class="rank-row__pts">174↑</span></div>
                <div class="rank-row__desc">jakelazaroff.com · 48 comments · 10h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">8</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Show HN: A terminal dashboard for your home server<span class="rank-row__pts">160↑</span></div>
                <div class="rank-row__desc">github.com/example · 61 comments · 11h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">9</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">The case against over-engineering your side projects<span class="rank-row__pts">142↑</span></div>
                <div class="rank-row__desc">blog.example.dev · 87 comments · 12h</div>
              </div>
            </div>
            <div class="rank-row">
              <span class="rank-row__num">10</span>
              <div class="rank-row__body">
                <div class="rank-row__line1">Tailwind v4 internals: how the new engine works<span class="rank-row__pts">131↑</span></div>
                <div class="rank-row__desc">tailwindcss.com · 39 comments · 13h</div>
              </div>
            </div>
          </div>
        </section>
      </div>

    </div>`;

export const FULL_BRIEF_MARKUP = `<div class="dash" role="region" aria-label="Agentic OS — Morning Brief full view">

      <!-- ── HEADER (reused verbatim) ──────────────────────────── -->
      <header class="shell-head">
        <div class="shell-head__brand">
          <svg class="waveform" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="0"  y="8"  width="2.4" height="6"  rx="1.2" />
            <rect x="4"  y="4"  width="2.4" height="14" rx="1.2" />
            <rect x="8"  y="1"  width="2.4" height="20" rx="1.2" />
            <rect x="12" y="5"  width="2.4" height="12" rx="1.2" />
            <rect x="16" y="9"  width="2.4" height="4"  rx="1.2" />
            <rect x="20" y="6"  width="2.4" height="10" rx="1.2" />
          </svg>
          <span class="wordmark">Agentic OS</span>
        </div>
        <div class="shell-head__actions">
          <span class="status-pill" data-tone="live">
            <span class="status-pill__dot"></span>
            Live
          </span>
          <button class="icon-btn" type="button" aria-label="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <!-- ── FULL BAR (generic) ────────────────────────────────── -->
      <div class="full-bar">
        <button class="full-back" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Research_
        </button>
        <nav class="full-crumb" aria-label="Breadcrumb">
          <span class="full-crumb__root">Research_</span>
          <span class="full-crumb__sep" aria-hidden="true">/</span>
          <span class="full-crumb__here">Morning Brief</span>
        </nav>
        <span class="full-bar__meta">2026-05-14</span>
      </div>

      <!-- ── FULL TOOLBAR (generic) ────────────────────────────── -->
      <div class="full-toolbar">
        <div class="full-toolbar__l">
          <label class="full-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Search the brief…" aria-label="Search the brief" />
          </label>
          <div class="full-chips" role="group" aria-label="Sections">
            <button class="full-chip is-active" type="button">All</button>
            <button class="full-chip" type="button">Headlines <span class="full-chip__n">5</span></button>
            <button class="full-chip" type="button">Reading <span class="full-chip__n">6</span></button>
            <button class="full-chip" type="button">𝕏 Voices <span class="full-chip__n">4</span></button>
            <button class="full-chip" type="button">Notes <span class="full-chip__n">4</span></button>
          </div>
        </div>
        <div class="full-toolbar__r">
          <button class="full-sort" type="button">
            Sort: Priority
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span class="full-count">19 items</span>
        </div>
      </div>

      <!-- ── FULL BODY ─ Morning Brief (swap point) ────────────── -->
      <div class="dash__body full-body">
        <section class="card brief" aria-label="Morning brief — full">
          <div class="brief__grid">

            <!-- HEADLINES -->
            <div class="brief__panel" aria-label="Headlines">
              <div class="brief__panel-head"><span class="brief__panel-title">Headlines</span></div>
              <div class="brief__bullets">
                <div class="brief__bullet">Anthropic ships an extended context window tuned for agentic coding workloads.</div>
                <div class="brief__bullet">EU AI Act enforcement begins — high-risk system audits start in Q3.</div>
                <div class="brief__bullet">An open-weights model matches frontier benchmarks at a tenth of the params.</div>
                <div class="brief__bullet">Vercel posts a record Turbopack build-time benchmark for large App Router apps.</div>
                <div class="brief__bullet">A widely-used auth library ships a breaking session-cookie change — see Release Radar.</div>
              </div>
            </div>

            <!-- READING QUEUE -->
            <div class="brief__panel" aria-label="Reading queue">
              <div class="brief__panel-head"><span class="brief__panel-title">Reading Queue</span></div>
              <div class="reading-list">
                <div class="reading-item">
                  <span class="reading-item__title">The Hidden Cost of Microservices</span>
                  <span class="reading-item__meta"><span class="reading-item__src">martinfowler.com</span><span class="reading-item__time">14 min read</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">Local-First Software: You Own Your Data</span>
                  <span class="reading-item__meta"><span class="reading-item__src">inkandswitch.com</span><span class="reading-item__time">saved 2d ago</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">A Decade of Dynamo, and the Next Wave</span>
                  <span class="reading-item__meta"><span class="reading-item__src">allthingsdistributed.com</span><span class="reading-item__time">9 min read</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">CRDTs Explained Without the Category Theory</span>
                  <span class="reading-item__meta"><span class="reading-item__src">jakelazaroff.com</span><span class="reading-item__time">11 min read</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">Postgres Full-Text Search, End to End</span>
                  <span class="reading-item__meta"><span class="reading-item__src">supabase.com</span><span class="reading-item__time">saved 1d ago</span></span>
                </div>
                <div class="reading-item">
                  <span class="reading-item__title">Designing Data-Intensive Applications — Ch. 5 reread</span>
                  <span class="reading-item__meta"><span class="reading-item__src">local note</span><span class="reading-item__time">in progress</span></span>
                </div>
              </div>
            </div>

            <!-- 𝕏 CONVERSATION -->
            <div class="brief__panel" aria-label="X conversation">
              <div class="brief__panel-head"><span class="brief__panel-title">𝕏 Conversation</span></div>
              <div class="x-list">
                <div class="x-block">
                  <span class="x-block__label">Mood</span>
                  <span class="x-block__text">Cautiously bullish on agent reliability after this week's releases.</span>
                </div>
                <div class="x-block">
                  <span class="x-block__label">Top voices</span>
                  <div class="x-voices">
                    <span class="chip">@karpathy</span>
                    <span class="chip">@swyx</span>
                    <span class="chip">@simonw</span>
                    <span class="chip">@dhh</span>
                  </div>
                </div>
                <div class="x-block">
                  <span class="x-block__label">Hot takes</span>
                  <span class="x-block__text">“Context windows are the new RAM — stop optimizing prompts, start optimizing memory.”</span>
                </div>
                <div class="x-block">
                  <span class="x-block__label">Contrarian</span>
                  <span class="x-block__text">“Local-first is a great demo and a maintenance nightmare at scale. Prove me wrong.”</span>
                </div>
              </div>
            </div>

            <!-- NOTE OPPORTUNITIES -->
            <div class="brief__panel" aria-label="Note opportunities">
              <div class="brief__panel-head"><span class="brief__panel-title">Note Opportunities</span></div>
              <div class="opp-list">
                <div class="opp-item">
                  <span class="opp-item__num">1</span>
                  <span class="opp-item__text">No note yet on <em>local-first sync</em> — three sources cited it this week.</span>
                </div>
                <div class="opp-item">
                  <span class="opp-item__num">2</span>
                  <span class="opp-item__text">Atomize your “Agent Architectures” capture into linked atomic notes.</span>
                </div>
                <div class="opp-item">
                  <span class="opp-item__num">3</span>
                  <span class="opp-item__text">Link today's CRDT reading to your <em>Distributed Systems</em> MOC.</span>
                </div>
                <div class="opp-item">
                  <span class="opp-item__num">4</span>
                  <span class="opp-item__text">Start a <em>Postgres FTS</em> note — two readings + one HN thread overlap.</span>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>

    </div>`;
