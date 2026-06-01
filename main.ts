import { addIcon, App, ItemView, normalizePath, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import {
	DASHBOARD_MARKUP,
	FULL_RADAR_MARKUP,
	FULL_HN_MARKUP,
	FULL_BRIEF_MARKUP,
} from "./markup";
import { readUsage, RateWindow, Usage } from "./usage";
import { readGitHubStats, GitHubStats, readProjectStats, readProjectRepos, ProjectStats, ProjectRepo } from "./github";
import { readLatestSession, LatestSession } from "./session";

export const VIEW_TYPE_AGENTIC_OS = "agentic-os-view";

/** Custom ribbon + tab icon: the brand waveform glyph from the dashboard header.
 *  The original art is a 22×22 viewBox; Obsidian renders icons in 0 0 100 100,
 *  so it's scaled to fit and uses currentColor to inherit the theme color. */
const AGENTIC_OS_ICON_ID = "agentic-os-waveform";
const AGENTIC_OS_ICON_SVG =
	'<g fill="currentColor" transform="translate(3 4) scale(4.2)">' +
	'<rect x="0" y="8" width="2.4" height="6" rx="1.2" />' +
	'<rect x="4" y="4" width="2.4" height="14" rx="1.2" />' +
	'<rect x="8" y="1" width="2.4" height="20" rx="1.2" />' +
	'<rect x="12" y="5" width="2.4" height="12" rx="1.2" />' +
	'<rect x="16" y="9" width="2.4" height="4" rx="1.2" />' +
	'<rect x="20" y="6" width="2.4" height="10" rx="1.2" />' +
	"</g>";

type ViewState = "dashboard" | "full-radar" | "full-hn" | "full-brief";

const MARKUP: Record<ViewState, string> = {
	"dashboard": DASHBOARD_MARKUP,
	"full-radar": FULL_RADAR_MARKUP,
	"full-hn": FULL_HN_MARKUP,
	"full-brief": FULL_BRIEF_MARKUP,
};

/** One calibration sample: weighted tokens measured at a known authoritative %.
 *  Their ratio implies a token cap; the running median across samples is the
 *  self-calibrating ballpark for "100%". */
interface CalibrationSample {
	t: number; // weighted tokens
	p: number; // authoritative percentage
}

interface AgenticOSSettings {
	openOnStartup: boolean;
	/** Which rate-limit window the panel tracks. */
	window: RateWindow;
	/** (tokens, %) samples per window — the 5h and 7d caps are distinct ceilings,
	 *  so their calibration histories must not mix. */
	calibration: Record<RateWindow, CalibrationSample[]>;
	/** GitHub handle for the Overview stat cards; blank = the gh-authed user. */
	githubUsername: string;
}

const DEFAULT_SETTINGS: AgenticOSSettings = {
	openOnStartup: false,
	window: "five_hour",
	calibration: { five_hour: [], seven_day: [] },
	githubUsername: "",
};

/** Token Burn background refresh cadence — the steady "Live" heartbeat. Focus
 *  events repaint on demand, so this only has to keep an idle pane current. */
const TOKEN_BURN_INTERVAL_MS = 60_000;

/** GitHub stat-card refresh cadence — far slower than Token Burn: these figures
 *  drift over days, and the star-history pass makes a request per starred repo. */
const GITHUB_INTERVAL_MS = 30 * 60_000;

/** Per-window length (for aligning the token sum to the snapshot's window) and
 *  display label. Lengths are fixed by Anthropic's limits, not user-tunable. */
const WINDOWS: Record<RateWindow, { hours: number; label: string }> = {
	five_hour: { hours: 5, label: "5H Window" },
	seven_day: { hours: 168, label: "7D Window" },
};

/** Below this percentage, integer rounding makes tokens÷pct too noisy to trust
 *  as a calibration point, so the sample is skipped. */
const MIN_CALIBRATION_PCT = 5;

/** Cap on retained samples — newest win, keeping the estimate current. */
const MAX_SAMPLES = 60;

/** 312510 → "312.51K", 2_000_000 → "2.00M". Sub-1K values render as-is. */
function formatTokens(n: number): string {
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
	if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
	return String(Math.round(n));
}

/** "last pull" age from a timestamp. */
function formatAge(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	if (s < 60) return s + "s ago";
	const m = Math.round(s / 60);
	if (m < 60) return m + "m ago";
	const h = Math.round(m / 60);
	return h + "h ago";
}

/** Session age, e.g. "11h old" / "23m old" / "2d old"; sub-minute reads "just now". */
function formatSessionAge(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	if (s < 60) return "just now";
	const m = Math.round(s / 60);
	if (m < 60) return m + "m old";
	const h = Math.round(m / 60);
	if (h < 24) return h + "h old";
	return Math.round(h / 24) + "d old";
}

/** Reset countdown, e.g. "5d 3h left" / "4h 12m left" / "37m left". */
function formatCountdown(ms: number): string {
	if (ms <= 0) return "resetting…";
	const totalMin = Math.round(ms / 60_000);
	const d = Math.floor(totalMin / 1440);
	const h = Math.floor((totalMin % 1440) / 60);
	const m = totalMin % 60;
	if (d > 0) return d + "d " + h + "h left";
	if (h > 0) return h + "h " + m + "m left";
	return m + "m left";
}

/** Implied 100% token cap = median of tokens÷(pct/100) across samples. Falls
 *  back to the single live reading when no samples have accrued yet. */
function estimateCap(samples: CalibrationSample[], live: Usage): number | null {
	const caps = samples.map((s) => s.t / (s.p / 100)).sort((a, b) => a - b);
	if (caps.length > 0) {
		const mid = Math.floor(caps.length / 2);
		return caps.length % 2 ? caps[mid] : (caps[mid - 1] + caps[mid]) / 2;
	}
	if (live.pct && live.pct > 0 && live.measuredTokens > 0) {
		return live.measuredTokens / (live.pct / 100);
	}
	return null;
}

class AgenticOSView extends ItemView {
	private root: HTMLElement | null = null;
	private state: ViewState = "dashboard";
	/** Which dashboard tab to restore when returning from a full view. */
	private activeTab = "panel-overview";
	/** Per-render listener removers, flushed on every re-render and on close. */
	private cleanups: Array<() => void> = [];
	/** Guards against an in-flight async read painting into a stale render. */
	private burnToken = 0;
	/** Same stale-paint guard for the (slower) GitHub fetch. */
	private ghToken = 0;
	/** Stale-paint guard for the Latest Session card. */
	private sessionToken = 0;
	/** Stale-paint guard for the Projects tab (heaviest fetch — commit history). */
	private projectsToken = 0;
	/** Stale-paint guard for the light repos-only refresh (on tab open). */
	private reposToken = 0;
	/** Projects data is fetched lazily on first tab view, then kept fresh. */
	private projectsLoaded = false;

	constructor(leaf: WorkspaceLeaf, private plugin: AgenticOSPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_AGENTIC_OS;
	}

	getDisplayText(): string {
		return "Agentic OS";
	}

	getIcon(): string {
		return AGENTIC_OS_ICON_ID;
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		// .agentic-os is the scoping root every selector in styles.css hangs off.
		this.root = this.contentEl.createDiv({ cls: "agentic-os" });
		this.render();

		// Steady background heartbeats (auto-cleared on view unload)...
		this.registerInterval(
			window.setInterval(() => {
				void this.refreshTokenBurn();
				void this.refreshLatestSession();
			}, TOKEN_BURN_INTERVAL_MS),
		);
		this.registerInterval(
			window.setInterval(() => {
				void this.refreshGitHub();
				if (this.projectsLoaded) void this.refreshProjects();
			}, GITHUB_INTERVAL_MS),
		);
		// ...plus an instant repaint whenever this pane becomes the active leaf.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf !== this.leaf) return;
				void this.refreshTokenBurn();
				void this.refreshLatestSession();
				void this.refreshGitHub();
				if (this.activeTab === "panel-projects") void this.refreshProjects();
			}),
		);
	}

	async onClose(): Promise<void> {
		this.clearListeners();
		this.root?.empty();
		this.root = null;
	}

	private clearListeners(): void {
		for (const off of this.cleanups) off();
		this.cleanups = [];
	}

	private on(el: Element, type: string, handler: EventListener): void {
		el.addEventListener(type, handler);
		this.cleanups.push(() => el.removeEventListener(type, handler));
	}

	private navigate(state: ViewState): void {
		if (this.state === state) return;
		this.state = state;
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.clearListeners();
		// Single, well-scoped innerHTML on the root container — the markup is
		// static trusted content generated from the source dashboards.
		this.root.innerHTML = MARKUP[this.state];
		if (this.state === "dashboard") {
			this.wireDashboard(this.root);
			void this.refreshTokenBurn();
			void this.refreshLatestSession();
			void this.refreshGitHub();
			// innerHTML reset wipes painted Projects data, so repaint if already loaded.
			if (this.projectsLoaded) void this.refreshProjects();
		} else {
			this.wireFullView(this.root);
		}
	}

	/** Read the authoritative snapshot (+ aligned token estimate), feed the
	 *  calibration, and paint the panel. No-op unless the dashboard is rendered. */
	async refreshTokenBurn(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.burnToken;

		const win = this.plugin.settings.window;
		const usage = await readUsage(win, WINDOWS[win].hours);

		// Bail if a re-render or newer refresh superseded us mid-read.
		if (!this.root || ticket !== this.burnToken) return;

		const cap = await this.plugin.updateCalibration(usage);
		this.paintTokenBurn(this.root, usage, cap, win);
	}

	private paintTokenBurn(root: HTMLElement, usage: Usage, cap: number | null, win: RateWindow): void {
		const hero = root.querySelector<HTMLElement>(".token-hero");
		if (!hero) return;

		// Only the window portion is dynamic; "Token Burn" is a static gradient span.
		const labelNode = hero.querySelector(".micro-label__text");
		if (labelNode) labelNode.textContent = " · " + WINDOWS[win].label + " · ";

		const set = (sel: string, text: string): void => {
			const el = hero.querySelector(sel);
			if (el) el.textContent = text;
		};
		// The "%" glyph is a child span, so only the leading text node is replaced.
		const setPct = (text: string): void => {
			const node = hero.querySelector(".token-hero__pct")?.firstChild;
			if (node) node.nodeValue = text;
		};
		const setFill = (width: string): void => {
			const el = hero.querySelector<HTMLElement>(".meter__fill");
			if (el) el.style.width = width;
		};

		// Snapshot unreachable, or present but missing a percentage — degrade.
		if (!usage.ok || usage.pct === null) {
			set(".token-hero__pull", "no data");
			setPct("0");
			setFill("0%");
			set(".token-hero__value", "—");
			set(".token-hero__sub:not(.token-hero__sub--proj)", "/ —");
			set(".token-hero__sub--proj", "");
			return;
		}

		// Percentage + meter come straight from the authoritative snapshot.
		setPct(String(Math.round(usage.pct)));
		setFill(Math.min(usage.pct, 100) + "%");
		set(
			".token-hero__pull",
			usage.snapshotTs === null ? "live" : "last pull " + formatAge(Date.now() - usage.snapshotTs * 1000),
		);

		// Meter now reads as a percentage, so ticks are 0–100%.
		const ticks = hero.querySelectorAll<HTMLElement>(".meter__ticks span");
		ticks.forEach((tick, i) => {
			const frac = (i / (ticks.length - 1)) * 100;
			tick.textContent = i === 0 ? "0" : Math.round(frac) + "%";
		});

		// Token figures are estimates (≈), aligned to the snapshot's window.
		set(".token-hero__value", formatTokens(usage.measuredTokens));
		set(".token-hero__sub:not(.token-hero__sub--proj)", cap === null ? "/ ?" : "/ " + formatTokens(cap));
		set(
			".token-hero__sub--proj",
			usage.resetsAt === null ? "" : "↺ " + formatCountdown(usage.resetsAt * 1000 - Date.now()),
		);
	}

	/** Fetch the GitHub figures (via the gh CLI) and paint the stat cards. No-op
	 *  unless the dashboard is rendered; guarded against stale paints like burn. */
	async refreshGitHub(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.ghToken;

		const stats = await readGitHubStats(this.plugin.settings.githubUsername);

		if (!this.root || ticket !== this.ghToken) return;
		this.paintGitHub(this.root, stats);
	}

	private paintGitHub(root: HTMLElement, s: GitHubStats): void {
		if (!s.ok) {
			for (const mod of ["repos", "contrib", "followers", "stars"]) this.clearStatCard(root, mod);
			return;
		}
		const newRepos = s.reposNewThisYear ?? 0;
		this.paintStatCard(root, "repos", s.repositories, `${newRepos} new`, "this year", newRepos > 0 ? "up" : "flat");

		const thisMonth = s.contribThisMonth ?? 0;
		this.paintStatCard(root, "contrib", s.contributions, `${thisMonth}`, "this month", thisMonth > 0 ? "up" : "flat");

		this.paintStatCard(root, "followers", s.followers, `${s.following ?? 0}`, "following", "flat");

		const hasStars = (s.totalStars ?? 0) > 0;
		this.paintStatCard(
			root, "stars", s.totalStars,
			hasStars ? `★ ${s.topRepoStars}` : "",
			hasStars ? (s.topRepoName ?? "most-starred") : "no stars yet",
			"flat",
		);
	}

	/** Blank one card (value + sub-line) when GitHub is unreachable. */
	private clearStatCard(root: HTMLElement, mod: string): void {
		const card = root.querySelector<HTMLElement>(`.stat-card--${mod}`);
		const valEl = card?.querySelector<HTMLElement>(".stat-card__value");
		if (valEl) valEl.textContent = "—";
		const deltaEl = card?.querySelector<HTMLElement>(".stat-card__delta");
		if (deltaEl) deltaEl.style.display = "none";
	}

	/** Update one `.stat-card--<mod>` card: the headline value, plus the secondary
	 *  line repurposed from the design's delta slot — a `lead` figure and a dim
	 *  `label`. `tone` colors the lead (up = positive accent, flat = neutral). */
	private paintStatCard(
		root: HTMLElement, mod: string, value: number | null, lead: string, label: string, tone: "up" | "flat",
	): void {
		const card = root.querySelector<HTMLElement>(`.stat-card--${mod}`);
		if (!card) return;

		const valEl = card.querySelector<HTMLElement>(".stat-card__value");
		if (valEl) valEl.textContent = value === null ? "—" : value.toLocaleString("en-US");

		const deltaEl = card.querySelector<HTMLElement>(".stat-card__delta");
		if (!deltaEl) return;
		deltaEl.style.display = "";
		deltaEl.classList.remove("stat-card__delta--up", "stat-card__delta--down", "stat-card__delta--flat");
		deltaEl.classList.add(`stat-card__delta--${tone}`);
		// The slot is `<text>…</text><span class="stat-card__sub">…</span>`; set the
		// leading text node (the lead) and the sub-span (the label) independently.
		const first = deltaEl.firstChild;
		if (first && first.nodeType === Node.TEXT_NODE) first.nodeValue = lead;
		else deltaEl.insertBefore(document.createTextNode(lead), deltaEl.firstChild);
		const sub = deltaEl.querySelector<HTMLElement>(".stat-card__sub");
		if (sub) sub.textContent = label;
	}

	/** Read the most recent Claude Code session from disk and paint the card. No-op
	 *  unless the dashboard is rendered; guarded against stale paints like burn. */
	async refreshLatestSession(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.sessionToken;

		const session = await readLatestSession();

		if (!this.root || ticket !== this.sessionToken) return;
		this.paintLatestSession(this.root, session);
	}

	private paintLatestSession(root: HTMLElement, s: LatestSession): void {
		const card = root.querySelector<HTMLElement>(".latest-session");
		if (!card) return;

		// Age line: keep the leading status-dot span, replace only its trailing text.
		const ageEl = card.querySelector<HTMLElement>(".latest-session__age");
		if (ageEl) {
			const ageText = s.ok && s.lastTs !== null ? formatSessionAge(Date.now() - s.lastTs) : "no data";
			const last = ageEl.lastChild;
			if (last && last.nodeType === Node.TEXT_NODE) last.nodeValue = ageText;
			else ageEl.appendChild(document.createTextNode(ageText));
		}

		const title = card.querySelector<HTMLElement>(".latest-session__title");
		if (title) title.textContent = s.ok ? (s.title ?? "Untitled session") : "No recent session";

		// Three stat slots in DOM order: messages, tokens, tool calls.
		const stats = card.querySelectorAll<HTMLElement>(".latest-session__stats > span > b");
		if (stats.length >= 3) {
			stats[0].textContent = s.ok ? s.messages.toLocaleString("en-US") : "—";
			stats[1].textContent = s.ok ? formatTokens(s.tokens) : "—";
			stats[2].textContent = s.ok ? s.toolCalls.toLocaleString("en-US") : "—";
		}

		// Meta row: model badge, then branch + cwd chips. Hide any with no value.
		const badge = card.querySelector<HTMLElement>(".latest-session__meta .badge");
		if (badge) {
			badge.style.display = s.model ? "" : "none";
			if (s.model) badge.textContent = s.model;
		}
		// Each chip is "<glyph> <text>" — preserve the leading glyph, swap the text.
		const setChip = (chip: HTMLElement | null, value: string | null): void => {
			if (!chip) return;
			chip.style.display = value ? "" : "none";
			if (!value) return;
			const cur = chip.textContent ?? "";
			const sp = cur.indexOf(" ");
			chip.textContent = (sp >= 0 ? cur.slice(0, sp + 1) : "") + value;
		};
		const chips = card.querySelectorAll<HTMLElement>(".latest-session__meta .chip");
		setChip(chips[0] ?? null, s.ok ? s.branch : null);
		setChip(chips[1] ?? null, s.ok ? s.cwd : null);
	}

	/** Fetch + paint the Projects ("GitHub Activity") tab. Heaviest read (per-repo
	 *  commit history), so it's lazy: triggered on first tab view, then kept fresh. */
	async refreshProjects(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.projectsToken;

		// First load runs the heaviest fetch (per-repo commit history). Show the
		// shimmer skeleton meanwhile so the markup's placeholder data never flashes;
		// later refreshes repaint live data in place, so they don't re-shimmer.
		const firstLoad = !this.projectsLoaded;
		if (firstLoad) this.setProjectsLoading(true);

		const stats = await readProjectStats(this.plugin.settings.githubUsername);

		if (!this.root || ticket !== this.projectsToken) return;
		if (stats.ok) this.projectsLoaded = true;
		this.paintProjects(this.root, stats);
		if (firstLoad) this.setProjectsLoading(false);
	}

	/** Repaint just the repo cards from the cheap GraphQL-only fetch — fired when
	 *  the Projects tab is opened so they stay current, while the heavier panel
	 *  stats keep to their slower interval. No-op if gh is unreachable. */
	async refreshProjectRepos(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.reposToken;

		const repos = await readProjectRepos(this.plugin.settings.githubUsername);

		if (!this.root || ticket !== this.reposToken || !repos) return;
		const panel = this.root.querySelector<HTMLElement>("#panel-projects");
		if (panel) this.paintRepoCards(panel, repos);
	}

	/** Toggle the first-load shimmer skeleton on the Projects panel. */
	private setProjectsLoading(on: boolean): void {
		this.root?.querySelector<HTMLElement>("#panel-projects")?.classList.toggle("is-loading", on);
	}

	private esc(t: string): string {
		return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
	}

	private paintProjects(root: HTMLElement, s: ProjectStats): void {
		if (!s.ok) return; // gh unreachable — leave the static design rather than blank it.
		const panel = root.querySelector<HTMLElement>("#panel-projects");
		if (!panel) return;
		this.paintContribChart(panel, s);
		this.paintGhStats(panel, s);
		this.paintRepoCards(panel, s.repos);
		this.paintLangBreakdown(panel, s);
		this.paintReleases(panel, s);
		this.paintHeatmap(panel, s);
	}

	private paintContribChart(panel: HTMLElement, s: ProjectStats): void {
		const max = Math.max(1, ...s.months.map((m) => m.count));
		panel.querySelectorAll<HTMLElement>(".gh-chart__bar").forEach((bar, i) => {
			const m = s.months[i];
			bar.style.height = m ? `${m.count === 0 ? 2 : Math.max(4, Math.round((m.count / max) * 100))}%` : "2%";
		});
		panel.querySelectorAll<HTMLElement>(".gh-chart__x-label").forEach((el, i) => {
			if (s.months[i]) el.textContent = s.months[i].label;
		});
		const total = panel.querySelector<HTMLElement>(".gh-chart__total");
		if (total) total.textContent = s.totalThisYear.toLocaleString("en-US");
		const range = panel.querySelector<HTMLElement>(".gh-chart__foot > .micro-label");
		if (range) range.textContent = s.rangeLabel;
		const delta = panel.querySelector<HTMLElement>(".gh-chart__delta");
		if (delta) {
			if (s.yearDeltaPct === null) {
				delta.style.display = "none";
			} else {
				delta.style.display = "";
				const up = s.yearDeltaPct >= 0;
				delta.classList.toggle("gh-chart__delta--pos", up);
				delta.classList.toggle("gh-chart__delta--neg", !up);
				delta.textContent = `${up ? "+" : "−"}${Math.abs(Math.round(s.yearDeltaPct))}%`;
			}
		}
	}

	private paintGhStats(panel: HTMLElement, s: ProjectStats): void {
		const card = (label: string): HTMLElement | null =>
			panel.querySelector<HTMLElement>(`.gh-stat-card[aria-label="${label}"]`);
		const setText = (host: HTMLElement | null, sel: string, text: string): void => {
			const el = host?.querySelector<HTMLElement>(sel);
			if (el) el.textContent = text;
		};

		const streak = card("Current streak");
		setText(streak, ".gh-stat-card__value", `${s.currentStreak} ${s.currentStreak === 1 ? "day" : "days"}`);
		setText(streak, ".gh-stat-card__sub", `Longest: ${s.longestStreak} days`);

		const vel = card("Commit velocity");
		setText(vel, ".gh-stat-card__value", `${s.commitsThisWeek} ${s.commitsThisWeek === 1 ? "commit" : "commits"}`);
		if (s.velocityPct === null) setText(vel, ".gh-stat-card__sub", "vs last week");
		else {
			const up = s.velocityPct >= 0;
			setText(vel, ".gh-stat-card__sub", `${up ? "↑" : "↓"} ${up ? "+" : "−"}${Math.abs(Math.round(s.velocityPct))}% vs last week`);
		}
		const vmax = Math.max(1, ...s.weeklyCommits);
		vel?.querySelectorAll<HTMLElement>(".velocity-bar").forEach((bar, i) => {
			const c = s.weeklyCommits[i] ?? 0;
			bar.style.height = `${c === 0 ? 6 : Math.max(8, Math.round((c / vmax) * 100))}%`;
		});

		const peak = card("Most active time");
		setText(peak, ".gh-stat-card__value", s.peakDay ?? "—");
		setText(peak, ".gh-stat-card__sub", s.peakTimeLabel ? `Peak: ${s.peakTimeLabel}` : "no commits yet");
	}

	private paintRepoCards(panel: HTMLElement, repos: ProjectRepo[]): void {
		const grid = panel.querySelector<HTMLElement>(".gh-repo-grid");
		if (!grid || repos.length === 0) return;
		grid.innerHTML = repos.map((r) => this.repoCardHtml(r)).join("");
	}

	private repoCardHtml(r: ProjectRepo): string {
		const repoIcon =
			'<svg class="gh-repo__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/></svg>';
		const starIcon =
			'<svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>';
		const stars = r.stars >= 1000 ? (r.stars / 1000).toFixed(1) + "k" : String(r.stars);
		const lang = r.lang
			? `<div class="gh-repo__lang"><span class="gh-repo__lang-dot" style="background:${r.langColor}"></span><span class="gh-repo__lang-name">${this.esc(r.lang)}</span></div>`
			: '<div class="gh-repo__lang"></div>';
		return (
			`<article class="card gh-repo" aria-label="Repository: ${this.esc(r.name)}">` +
			`<div class="gh-repo__head"><div class="gh-repo__name-row">${repoIcon}<span class="gh-repo__name">${this.esc(r.name)}</span></div>` +
			`<span class="gh-repo__updated micro-label">${r.updated ? "Updated " + this.esc(r.updated) : ""}</span></div>` +
			`<p class="gh-repo__desc">${this.esc(r.desc)}</p>` +
			`<div class="gh-repo__stats">` +
			`<div class="gh-repo__stat"><span class="gh-repo__stat-value">${r.commits.toLocaleString("en-US")}</span><span class="gh-repo__stat-label">Commits</span></div>` +
			`<div class="gh-repo__stat"><span class="gh-repo__stat-value">${r.openPRs}</span><span class="gh-repo__stat-label">Open PRs</span></div>` +
			`<div class="gh-repo__stat"><span class="gh-repo__stat-value">${r.issues}</span><span class="gh-repo__stat-label">Issues</span></div></div>` +
			`<div class="gh-repo__foot">${lang}<div class="gh-repo__star">${starIcon}${stars}</div></div>` +
			`</article>`
		);
	}

	private paintLangBreakdown(panel: HTMLElement, s: ProjectStats): void {
		const track = panel.querySelector<HTMLElement>(".lang-bar-track");
		const legend = panel.querySelector<HTMLElement>(".lang-legend");
		if (!track || !legend || s.languages.length === 0) return;
		track.innerHTML = s.languages
			.map((l) => `<span class="lang-bar-track__seg" style="flex:${l.pct};background:${l.color}"></span>`)
			.join("");
		legend.innerHTML = s.languages
			.map((l) => `<div class="lang-legend__item"><span class="lang-legend__dot" style="background:${l.color}"></span>${this.esc(l.name)} <span class="lang-legend__pct">${l.pct}%</span></div>`)
			.join("");
	}

	private paintReleases(panel: HTMLElement, s: ProjectStats): void {
		const card = panel.querySelector<HTMLElement>(".releases-card");
		if (!card) return;
		const meta = card.querySelectorAll<HTMLElement>(".releases-card__head .micro-label");
		if (meta.length >= 2) meta[1].textContent = `${s.releaseCount} ${s.releaseCount === 1 ? "tag" : "tags"}`;
		card.querySelectorAll(".release-row, .releases-empty").forEach((el) => el.remove());
		const rows = s.releases.length
			? s.releases
				.map((r) => `<div class="release-row"><span class="release-tag">${this.esc(r.tag)}</span><span class="release-repo">${this.esc(r.repo)}</span><span class="release-desc">${this.esc(r.desc)}</span><span class="release-age">${this.esc(r.age)}</span></div>`)
				.join("")
			: '<div class="releases-empty micro-label">No releases yet</div>';
		card.insertAdjacentHTML("beforeend", rows);
	}

	private paintHeatmap(panel: HTMLElement, s: ProjectStats): void {
		panel.querySelectorAll<HTMLElement>(".day-grid .day-col").forEach((col, d) => {
			col.querySelectorAll<HTMLElement>(".day-slot").forEach((slot, b) => {
				slot.setAttribute("data-level", String(s.heat[d]?.[b] ?? 0));
			});
		});
		const head = panel.querySelectorAll<HTMLElement>(".active-time-card__head .micro-label");
		if (head.length >= 2 && s.peakDay) {
			head[1].textContent = `Peak: ${s.peakDay.slice(0, 3)}${s.peakTimeLabel ? " · " + s.peakTimeLabel : ""}`;
		}
	}

	/** Tab switching + "Full ↗" navigation for the main dashboard. */
	private wireDashboard(root: HTMLElement): void {
		const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(".tab"));
		const panels = Array.from(root.querySelectorAll<HTMLElement>(".dash__body"));

		const selectTab = (tab: HTMLButtonElement): void => {
			const target = tab.getAttribute("aria-controls");
			if (!target) return;
			this.activeTab = target;
			for (const t of tabs) {
				t.setAttribute("aria-selected", String(t === tab));
			}
			for (const p of panels) {
				p.toggleAttribute("hidden", p.id !== target);
			}
			// Projects fetch is heavy (commit history), so defer the full load until
			// first viewed; on later opens refresh just the repo cards (cheap fetch).
			if (target === "panel-projects") {
				if (!this.projectsLoaded) void this.refreshProjects();
				else void this.refreshProjectRepos();
			}
		};

		for (const tab of tabs) {
			this.on(tab, "click", () => selectTab(tab));
		}

		// Restore the tab we left from (defaults to Overview).
		const restore = tabs.find((t) => t.getAttribute("aria-controls") === this.activeTab);
		if (restore) selectTab(restore);

		// Each "Full ↗" pill swaps the whole pane to its deep-dive view.
		for (const btn of Array.from(root.querySelectorAll<HTMLElement>("[data-full]"))) {
			this.on(btn, "click", () => {
				// Coming back should land on Research_, where these buttons live.
				this.activeTab = "panel-research";
				this.navigate(btn.getAttribute("data-full") as ViewState);
			});
		}
	}

	/** Back button returns a full view to the dashboard. */
	private wireFullView(root: HTMLElement): void {
		const back = root.querySelector<HTMLElement>(".full-back");
		if (back) {
			this.on(back, "click", () => this.navigate("dashboard"));
		}
	}
}

export default class AgenticOSPlugin extends Plugin {
	settings: AgenticOSSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.injectFonts();

		addIcon(AGENTIC_OS_ICON_ID, AGENTIC_OS_ICON_SVG);

		this.registerView(VIEW_TYPE_AGENTIC_OS, (leaf) => new AgenticOSView(leaf, this));

		this.addRibbonIcon(AGENTIC_OS_ICON_ID, "Open Agentic OS", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-agentic-os",
			name: "Open Agentic OS",
			callback: () => {
				void this.activateView();
			},
		});

		this.addSettingTab(new AgenticOSSettingTab(this.app, this));

		if (this.settings.openOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				void this.activateView();
			});
		}
	}

	/** Register the bundled @font-face declarations at runtime.
	 *  Obsidian injects a plugin's styles.css into the document head, where relative
	 *  url() paths don't resolve — so the fonts must be loaded from a real resource
	 *  path (app://...) resolved via the adapter, not from CSS. */
	private injectFonts(): void {
		const dir = this.manifest.dir;
		if (!dir) return;

		const faces: Array<[string, number, string]> = [
			["JetBrains Mono", 400, "JetBrainsMono-Regular.woff2"],
			["JetBrains Mono", 500, "JetBrainsMono-Medium.woff2"],
			["JetBrains Mono", 600, "JetBrainsMono-SemiBold.woff2"],
			["JetBrains Mono", 700, "JetBrainsMono-Bold.woff2"],
			["Space Grotesk", 400, "SpaceGrotesk-Regular.woff2"],
			["Space Grotesk", 500, "SpaceGrotesk-Medium.woff2"],
			["Space Grotesk", 600, "SpaceGrotesk-SemiBold.woff2"],
			["Space Grotesk", 700, "SpaceGrotesk-Bold.woff2"],
		];

		const rules = faces.map(([family, weight, file]) => {
			const url = this.app.vault.adapter.getResourcePath(normalizePath(`${dir}/fonts/${file}`));
			return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
				`font-display:swap;src:url("${url}") format("woff2");}`;
		});

		const style = document.createElement("style");
		style.id = "agentic-os-fonts";
		style.textContent = rules.join("\n");
		document.head.appendChild(style);
		this.register(() => style.remove());
	}

	/** Open the dashboard in the main (center) area, or reveal it if already open. */
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_AGENTIC_OS, active: true });
		await workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		const stored = this.settings as unknown as Record<string, unknown>;
		let dirty = false;

		// Drop keys from earlier versions (manual budget/window, since superseded
		// by the snapshot + self-calibration) so they don't linger in data.json.
		for (const key of ["tokenBudget", "windowHours"]) {
			if (key in stored) {
				delete stored[key];
				dirty = true;
			}
		}

		// Migrate the original flat calibration array → per-window, and ensure both
		// window buckets exist regardless of how old the stored shape is.
		const cal = stored.calibration as any;
		const asList = (v: any): CalibrationSample[] => (Array.isArray(v) ? v : []);
		const migrated = {
			five_hour: asList(Array.isArray(cal) ? cal : cal?.five_hour),
			seven_day: asList(cal?.seven_day),
		};
		if (Array.isArray(cal) || !cal?.five_hour || !cal?.seven_day) dirty = true;
		this.settings.calibration = migrated;

		if (dirty) await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Fold the latest reading into the calibration history and return the current
	 *  token-cap estimate. A sample is recorded only when the percentage is high
	 *  enough to be meaningful and has moved since the last sample (the integer %
	 *  steps up as you burn), so refreshes don't spam duplicates. */
	async updateCalibration(usage: Usage): Promise<number | null> {
		const samples = this.settings.calibration[this.settings.window];
		const eligible =
			usage.ok && usage.pct !== null && usage.pct >= MIN_CALIBRATION_PCT && usage.measuredTokens > 0;

		if (eligible && samples[samples.length - 1]?.p !== usage.pct) {
			samples.push({ t: usage.measuredTokens, p: usage.pct as number });
			if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
			await this.saveSettings();
		}

		return estimateCap(samples, usage);
	}

	/** Repaint the panel in every open view — used after a window switch. */
	repaintTokenBurn(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS)) {
			const view = leaf.view;
			if (view instanceof AgenticOSView) void view.refreshTokenBurn();
		}
	}

	/** Re-fetch the GitHub cards in every open view — used after the username changes. */
	repaintGitHub(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS)) {
			const view = leaf.view;
			if (view instanceof AgenticOSView) void view.refreshGitHub();
		}
	}
}

class AgenticOSSettingTab extends PluginSettingTab {
	plugin: AgenticOSPlugin;

	constructor(app: App, plugin: AgenticOSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Open pane on startup")
			.setDesc("Automatically open the Agentic OS pane when Obsidian finishes loading.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.openOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Rate-limit window")
			.setDesc("Which usage window the Token Burn panel tracks. Each keeps its own cap calibration.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("five_hour", "5 hours")
					.addOption("seven_day", "7 days")
					.setValue(this.plugin.settings.window)
					.onChange(async (value) => {
						this.plugin.settings.window = value as RateWindow;
						await this.plugin.saveSettings();
						this.plugin.repaintTokenBurn();
					})
			);

		new Setting(containerEl)
			.setName("GitHub username")
			.setDesc("Handle for the Overview stat cards. Leave blank to use the gh-authenticated account. Stats are read via the gh CLI.")
			.addText((text) =>
				text
					.setPlaceholder("(gh-authenticated user)")
					.setValue(this.plugin.settings.githubUsername)
					.onChange(async (value) => {
						this.plugin.settings.githubUsername = value.trim();
						await this.plugin.saveSettings();
						this.plugin.repaintGitHub();
					})
			);
	}
}
