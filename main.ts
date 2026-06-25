import { addIcon, App, FileSystemAdapter, ItemView, Modal, moment, normalizePath, Notice, Plugin, PluginSettingTab, Setting, ViewStateResult, WorkspaceLeaf } from "obsidian";
import {
	DASHBOARD_MARKUP,
	FULL_SESSIONS_MARKUP,
	FULL_RADAR_MARKUP,
	FULL_HN_MARKUP,
	FULL_BRIEF_MARKUP,
} from "./markup";
import { readUsage, RateWindow, Usage, watchSnapshot } from "./usage";
import { readGitHubStats, GitHubStats, readProjectStats, readProjectRepos, ProjectStats, ProjectRepo } from "./github";
import {
	readLatestSession,
	LatestSession,
	readFolderSessions,
	FolderSessions,
	listProjectFolders,
	ProjectFolder,
} from "./session";
import { readDayPlan, setTaskDone, addTask, todayDailyNotePath, DayPlan } from "./dayplan";
import { readBrief, Brief } from "./brief";
import { readActivity, ActivityRun } from "./activity";
import { readHackerNews, HNStory, HNKind } from "./hn";
import { readReleaseRadar, readRadarOverlay, writeRadarInput, discoverGhAccounts, RadarRow, RadarGroup } from "./radar";
import { readClaudeStatus, ClaudeStatus } from "./claudeStatus";
import { renderTranscript } from "./transcript";

export const VIEW_TYPE_AGENTIC_OS = "agentic-os-view";
export const VIEW_TYPE_REPO_BROWSER = "agentic-os-repo-browser";
export const VIEW_TYPE_SESSION_TRANSCRIPT = "agentic-os-session-transcript";

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

type ViewState = "dashboard" | "full-sessions" | "full-radar" | "full-hn" | "full-brief";

const MARKUP: Record<ViewState, string> = {
	"dashboard": DASHBOARD_MARKUP,
	"full-sessions": FULL_SESSIONS_MARKUP,
	"full-radar": FULL_RADAR_MARKUP,
	"full-hn": FULL_HN_MARKUP,
	"full-brief": FULL_BRIEF_MARKUP,
};

/** Sort orders for the full sessions list, cycled by the toolbar's "Sort:" button.
 *  lastTs may be null (no dated turns); treat that as oldest. */
const SESSION_SORTS: Array<{ label: string; cmp: (a: LatestSession, b: LatestSession) => number }> = [
	{ label: "Recent", cmp: (a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0) },
	{ label: "Oldest", cmp: (a, b) => (a.lastTs ?? 0) - (b.lastTs ?? 0) },
	{ label: "Tokens", cmp: (a, b) => b.tokens - a.tokens },
	{ label: "Messages", cmp: (a, b) => b.messages - a.messages },
];

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
	/** Folders to merge in the full sessions list, for a project that has moved across
	 *  paths. One group per line, comma-separated folder paths within a line; blank =
	 *  off (each folder's sessions stay separate). Machine-specific, hence a setting. */
	sessionFolderGroups: string;
	/** Quick Action button wiring: one `Button Label = command-id` per line, mapping a
	 *  dashboard button to an Obsidian command (e.g. a Shell Commands command) it runs
	 *  on click. Vault-specific command IDs, hence a setting. */
	quickActions: string;
	/** Authed gh accounts the Release Radar should NOT scan (by login). Default empty =
	 *  every discovered account is included. A per-account opt-out, so the default "all on"
	 *  needs no stored state and newly-added accounts appear automatically. */
	radarExcludedAccounts: string[];
}

const DEFAULT_SETTINGS: AgenticOSSettings = {
	openOnStartup: false,
	window: "five_hour",
	calibration: { five_hour: [], seven_day: [] },
	githubUsername: "",
	sessionFolderGroups: "",
	quickActions: "",
	radarExcludedAccounts: [],
};

/** Token Burn background refresh cadence — the steady "Live" heartbeat. Focus
 *  events repaint on demand, so this only has to keep an idle pane current. */
const TOKEN_BURN_INTERVAL_MS = 60_000;

/** Claude Statuspage refresh cadence. Incidents change slower than token usage,
 *  but the header should recover without waiting for a manual pane focus. */
const CLAUDE_STATUS_INTERVAL_MS = 5 * 60_000;

/** GitHub stat-card refresh cadence — far slower than Token Burn: these figures
 *  drift over days, and the star-history pass makes a request per starred repo. */
const GITHUB_INTERVAL_MS = 30 * 60_000;

/** Hacker News refresh cadence — the front page turns over slowly, and this fetches
 *  one request per story, so keep it well off the 60s heartbeat. */
const HN_INTERVAL_MS = 10 * 60_000;

/** Stories shown on the dashboard card vs. the full "Hacker News" view. The full read
 *  is a superset, so it's cached and the card just slices the first few. */
const HN_CARD_LIMIT = 5;
const HN_FULL_LIMIT = 30;

/** Release Radar rows on the dashboard card; the full view shows all. */
const RADAR_CARD_LIMIT = 6;

/** How many run-log entries the Activity Feed shows — the designer's row count. */
const ACTIVITY_LIMIT = 8;

/** Run type → badge variant, matching the mockup's three styles. Unknown types
 *  default to neutral so a new command's runs still render. */
const ACTIVITY_BADGE_VARIANT: Record<string, string> = {
	metrics: "badge--pos",
	pipeline: "badge--pos",
	review: "badge--pos",
	research: "badge--accent",
	brief: "badge--accent",
	inbox: "badge--accent",
	radar: "badge--accent",
	atomize: "badge--accent",
	plan: "badge--neutral",
	cleanup: "badge--neutral",
};

/** Decorative checkmark glyph for a painted task row — matches the static markup's
 *  `.task-box` svg (CSS reveals it when the row's checkbox is checked). Constant and
 *  trusted, so it's the one bit of innerHTML in the otherwise DOM-built task rows. */
const TASK_CHECK_SVG =
	'<svg viewBox="0 0 12 12"><path d="M2 6.2l2.6 2.6L10 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

/** A cwd → its transcript-directory name under ~/.claude/projects. Claude Code maps
 *  every non-alphanumeric character (slashes, spaces, dots, …) to "-", e.g.
 *  "/Users/jay/Dev/My Repo" → "-Users-jay-Dev-My-Repo". */
function encodeProjectDir(cwd: string): string {
	return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Parse the "merge session folders" setting into groups of transcript-directory
 *  names. A blank line separates independent groups; within a group, folder paths go
 *  one per line (commas also accepted). Each path is encoded to its directory name.
 *  Groups with fewer than two folders are dropped — nothing to merge. */
function parseFolderGroups(raw: string): string[][] {
	return raw
		.split(/\n\s*\n/)
		.map((block) =>
			block
				.split(/[\n,]/)
				.map((p) => p.trim())
				.filter(Boolean)
				.map((p) => (p.includes("/") ? encodeProjectDir(p) : p)),
		)
		.filter((g) => g.length > 1);
}

/** Parse the Quick Actions map: one `Button Label = command-id` per line. Blank lines
 *  and `#` comments are ignored. The label must match the button's visible text
 *  exactly (e.g. "Deep Research…" includes the ellipsis). Splits on the first `=`. */
function parseQuickActions(raw: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const line of raw.split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const eq = t.indexOf("=");
		if (eq < 0) continue;
		const label = t.slice(0, eq).trim();
		const cmd = t.slice(eq + 1).trim();
		if (label && cmd) map.set(label, cmd);
	}
	return map;
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

/** Compact activity-row age, matching the mockup's bare style: "now", "2m", "1h", "3d". */
function formatActivityAge(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	if (s < 60) return "now";
	const m = Math.round(s / 60);
	if (m < 60) return m + "m";
	const h = Math.round(m / 60);
	if (h < 24) return h + "h";
	return Math.round(h / 24) + "d";
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
	/** Stale-paint guard for Claude Statuspage reads. */
	private claudeStatusToken = 0;
	/** Guards against an in-flight async read painting into a stale render. */
	private burnToken = 0;
	/** Same stale-paint guard for the (slower) GitHub fetch. */
	private ghToken = 0;
	/** Stale-paint guard for the Latest Session card. */
	private sessionToken = 0;
	/** Stale-paint guard for the Activity Feed run-log read. */
	private activityToken = 0;
	/** Stale-paint guard for the full sessions list ("Full ↗" deep-dive). */
	private sessionsListToken = 0;
	/** Full sessions list state: fetched rows (newest-first) plus the toolbar's live
	 *  sort/filter, so re-sorting and filtering repaint from cache without refetching. */
	private folderSessions: LatestSession[] = [];
	private sessionsSortMode = 0;
	private sessionsFilter = "";
	/** Stale-paint guard for the Hacker News fetch (dashboard card + full view). */
	private hnToken = 0;
	/** Cached HN stories (top 30), so opening the full view paints instantly and the
	 *  chips/search filter from cache without refetching. */
	private hnStories: HNStory[] = [];
	/** Full HN view toolbar state: active chip and the search box text. */
	private hnChip: "top" | "new" | HNKind = "top";
	private hnFilter = "";
	/** Stale-paint guard for the Release Radar (dashboard card + full view). */
	private radarToken = 0;
	/** Cached radar rows (all tracked deps, pre-sorted by priority), so the full view
	 *  paints instantly and the chips/search filter from cache without refetching. */
	private radarRows: RadarRow[] = [];
	/** Radar is the heaviest fetch (repos × package.json × npm), so it's lazy like
	 *  Projects: fetched on first Research-tab view, then kept fresh on a slow timer. */
	private radarLoaded = false;
	/** Full radar view toolbar state: active chip and the search box text. */
	private radarChip: "all" | RadarGroup = "all";
	private radarFilter = "";
	/** Distinct repos scanned (with a package.json) — the full view's "N packages · M repos". */
	private radarRepoCount = 0;
	/** Stale-paint guard for the Projects tab (heaviest fetch — commit history). */
	private projectsToken = 0;
	/** Stale-paint guard for the light repos-only refresh (on tab open). */
	private reposToken = 0;
	/** Projects data is fetched lazily on first tab view, then kept fresh. */
	private projectsLoaded = false;
	/** Last-read day plan (today's daily note), kept so task write-back handlers have the
	 *  backing file + index mapping. No stale-paint token: the read is synchronous. */
	private dayPlan: DayPlan | null = null;

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
				void this.refreshActivity();
				this.refreshDayPlan();
				this.refreshBrief();
			}, TOKEN_BURN_INTERVAL_MS),
		);
		this.registerInterval(window.setInterval(() => void this.refreshClaudeStatus(), CLAUDE_STATUS_INTERVAL_MS));
		this.registerInterval(
			window.setInterval(() => {
				void this.refreshGitHub();
				if (this.projectsLoaded) void this.refreshProjects();
				if (this.radarLoaded) void this.refreshRadar();
			}, GITHUB_INTERVAL_MS),
		);
		this.registerInterval(window.setInterval(() => void this.refreshHackerNews(), HN_INTERVAL_MS));
		// ...plus an instant repaint whenever this pane becomes the active leaf.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf !== this.leaf) return;
				void this.refreshClaudeStatus();
				void this.refreshTokenBurn();
				void this.refreshLatestSession();
				void this.refreshActivity();
				void this.refreshGitHub();
				this.refreshDayPlan();
				this.refreshBrief();
				void this.refreshHackerNews();
				if (this.radarLoaded) void this.refreshRadar();
				if (this.activeTab === "panel-projects") void this.refreshProjects();
				if (this.state === "full-sessions") void this.refreshFolderSessions();
			}),
		);
		// Repaint Schedule + Tasks + Morning Brief the moment today's daily note changes on
		// disk — covers a `plan-today` / `morning-brief` run writing it and our own task
		// write-back. Both refreshers self-guard on the current view state.
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.path !== todayDailyNotePath(this.app)) return;
				this.refreshDayPlan();
				this.refreshBrief();
			}),
		);
		// Repaint Token Burn the instant the usage snapshot is rewritten — e.g. the
		// "Pull Metrics" quick action — rather than waiting up to 60s for the heartbeat.
		// refreshTokenBurn already no-ops unless the dashboard is the active state.
		this.register(watchSnapshot(() => void this.refreshTokenBurn()));
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
		void this.refreshClaudeStatus();
		if (this.state === "dashboard") {
			this.wireDashboard(this.root);
			void this.refreshTokenBurn();
			void this.refreshLatestSession();
			void this.refreshActivity();
			void this.refreshGitHub();
			this.refreshDayPlan();
			this.refreshBrief();
			void this.refreshHackerNews();
			// innerHTML reset wipes painted Projects/Radar data, so repaint if already loaded.
			if (this.projectsLoaded) void this.refreshProjects();
			// Radar refetch is heavy; on re-render just repaint the card from cache (the
			// timer + active-leaf repaint keep the data itself fresh).
			if (this.radarLoaded) this.paintRadarCard(this.root);
		} else {
			this.wireFullView(this.root);
			if (this.state === "full-hn") {
				// Fresh entry starts on the "Top" chip with an empty search, matching the
				// markup's is-active chip and empty search box.
				this.hnChip = "top";
				this.hnFilter = "";
				// Shimmer over the placeholder rows until the fetch (or the cache) paints.
				this.showHNSkeleton(this.root);
				void this.refreshHackerNews();
			}
			if (this.state === "full-radar") {
				// Fresh entry starts on the "All" chip with an empty search, matching the
				// markup's is-active chip and empty search box.
				this.radarChip = "all";
				this.radarFilter = "";
				// Cached (the dashboard usually loaded it first) → paint instantly; the
				// timer keeps it fresh. Otherwise shimmer + fetch.
				if (this.radarRows.length) this.renderRadarList(this.root);
				else {
					this.showRadarSkeleton(this.root);
					void this.refreshRadar();
				}
			}
			if (this.state === "full-sessions") {
				// Fresh entry starts unsorted-from-newest and unfiltered, matching the
				// markup's empty search box and "Sort: Recent" default.
				this.sessionsSortMode = 0;
				this.sessionsFilter = "";
				// Shimmer over the placeholder rows until the read paints real data.
				this.showSessionsSkeleton(this.root);
				void this.refreshFolderSessions();
			}
			if (this.state === "full-brief") {
				this.refreshBrief();
			}
		}
	}

	/** Fetch Claude's aggregate service status and paint the Token Burn live label.
	 *  Guarding prevents an older render's response from rewriting a newer dashboard. */
	async refreshClaudeStatus(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const ticket = ++this.claudeStatusToken;

		const status = await readClaudeStatus();

		if (!this.root || ticket !== this.claudeStatusToken) return;
		this.paintClaudeStatus(this.root, status);
	}

	private paintClaudeStatus(root: HTMLElement, status: ClaudeStatus): void {
		const label = root.querySelector<HTMLElement>(".token-hero .micro-label__live");
		if (!label) return;
		label.dataset.tone = status.tone;
		const title = status.updatedAt
			? `Claude status: ${status.description} (${status.updatedAt})`
			: `Claude status: ${status.description}`;
		label.setAttribute("aria-label", title);
		label.setAttribute("title", title);

		// Preserve the generated dot element and replace only the readable label.
		const dot = label.querySelector<HTMLElement>(".live-dot");
		for (const child of Array.from(label.childNodes)) {
			if (child !== dot) child.remove();
		}
		if (dot && dot.parentElement !== label) label.prepend(dot);
		label.appendChild(document.createTextNode(" " + status.label));
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

		const displayCap = await this.plugin.updateCalibration(usage);
		this.paintTokenBurn(this.root, usage, win, displayCap);
	}

	private paintTokenBurn(root: HTMLElement, usage: Usage, win: RateWindow, displayCap: number | null): void {
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

		// Token figures are local transcript estimates, aligned to the snapshot's window.
		set(".token-hero__value", formatTokens(usage.measuredTokens));
		set(
			".token-hero__sub:not(.token-hero__sub--proj)",
			displayCap === null ? "/ est —" : "/ est " + formatTokens(displayCap),
		);
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
		setChip(chips[0] ?? null, s.ok && s.branch !== "HEAD" ? s.branch : null);
		setChip(chips[1] ?? null, s.ok ? s.cwd : null);
	}

	/** Read the vault-root run-log and paint the Activity Feed. No-op unless the dashboard
	 *  is rendered; guarded against stale paints like the other reads. Needs the vault's
	 *  absolute path (Node fs), which only the desktop FileSystemAdapter exposes. */
	async refreshActivity(): Promise<void> {
		if (!this.root || this.state !== "dashboard") return;
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) return; // Mobile — no fs access.
		const ticket = ++this.activityToken;

		const runs = await readActivity(adapter.getBasePath(), ACTIVITY_LIMIT);

		if (!this.root || ticket !== this.activityToken) return;
		this.paintActivity(this.root, runs);
	}

	private paintActivity(root: HTMLElement, runs: ActivityRun[]): void {
		const feed = root.querySelector<HTMLElement>(".activity-feed");
		if (!feed) return;
		const meta = feed.querySelector<HTMLElement>(".panel__meta");

		// Clear the designer's placeholder rows (everything but the panel head).
		feed.querySelectorAll(".activity-row").forEach((r) => r.remove());

		if (runs.length === 0) {
			feed.createDiv({ cls: "activity-empty", text: "No recent runs yet" });
			if (meta) meta.textContent = "0 runs";
			return;
		}
		// A prior empty paint leaves the empty-state div behind — drop it before repainting.
		feed.querySelectorAll(".activity-empty").forEach((e) => e.remove());

		for (const run of runs) {
			const row = feed.createDiv({ cls: "activity-row" });
			const check = row.createSvg("svg", {
				cls: "activity-row__check",
				attr: { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
			});
			check.createSvg("path", { attr: { d: "M20 6 9 17l-5-5" } });
			const variant = ACTIVITY_BADGE_VARIANT[run.type] ?? "badge--neutral";
			row.createSpan({ cls: `badge ${variant}`, text: run.type });
			row.createSpan({ cls: "activity-row__msg", text: run.msg });
			row.createSpan({ cls: "chip", text: "log" });
			row.createSpan({ cls: "chip", text: "{}" });
			row.createSpan({ cls: "activity-row__time", text: formatActivityAge(Date.now() - run.ts) });
		}
		if (meta) meta.textContent = `${runs.length} run${runs.length === 1 ? "" : "s"}`;
	}

	/** Read today's daily note and paint the Schedule + Daily Tasks panels. Synchronous
	 *  (metadata cache is in-memory), so no stale-paint token is needed. No-op off the
	 *  dashboard. */
	refreshDayPlan(): void {
		if (!this.root || this.state !== "dashboard") return;
		this.dayPlan = readDayPlan(this.app);
		this.paintSchedule(this.root, this.dayPlan);
		this.paintTasks(this.root, this.dayPlan);
	}

	/** "13:00" → "1:00 PM", "09:05" → " 9:05 AM"; all-day "" stays blank; malformed passes
	 *  through. Single-digit hours are padded with a figure space (U+2007, a digit's width)
	 *  so the colons/minutes line up under two-digit hours like "12:00 PM". */
	private to12h(t: string): string {
		const m = /^(\d{1,2}):(\d{2})$/.exec(t);
		if (!m) return t;
		let h = Number(m[1]);
		const ampm = h < 12 ? "AM" : "PM";
		h = h % 12 || 12;
		return `${h < 10 ? "\u2007" : ""}${h}:${m[2]} ${ampm}`;
	}

	private paintSchedule(root: HTMLElement, plan: DayPlan): void {
		const grid = root.querySelector<HTMLElement>(".schedule-grid");
		const meta = root.querySelector<HTMLElement>(".schedule-panel .panel__meta");
		if (!grid) return;
		grid.empty();

		if (!plan.ok || plan.schedule.length === 0) {
			grid.createDiv({ cls: "schedule-empty", text: plan.ok ? "No events today" : "▶ Run Plan Today" });
			if (meta) meta.textContent = "↻ 0 events";
			return;
		}
		for (const e of plan.schedule) {
			const row = grid.createDiv({ cls: "schedule-row" });
			row.createSpan({ cls: "schedule-row__time", text: this.to12h(e.time) });
			row.createSpan({ cls: "schedule-row__name", text: e.label });
		}
		const n = plan.schedule.length;
		if (meta) meta.textContent = `↻ ${n} event${n === 1 ? "" : "s"}`;
	}

	private paintTasks(root: HTMLElement, plan: DayPlan): void {
		const grid = root.querySelector<HTMLElement>(".task-grid");
		const meta = root.querySelector<HTMLElement>(".tasks-panel .panel__meta");
		const fill = root.querySelector<HTMLElement>(".tasks-panel .task-progress__fill");
		const addBtn = root.querySelector<HTMLElement>(".tasks-panel .task-add");
		if (!grid) return;
		grid.empty();

		if (!plan.ok) {
			grid.createDiv({ cls: "task-empty", text: "▶ Run Plan Today" });
			if (meta) meta.textContent = "—";
			if (fill) fill.style.width = "0%";
			if (addBtn) addBtn.style.display = "none";
			return;
		}
		if (addBtn) addBtn.style.display = "";

		// Row index = frontmatter `tasks` index, so the change handler writes the right one.
		plan.tasks.forEach((t, i) => {
			const rowEl = grid.createEl("label", { cls: t.carryover ? "task-row task-row--carry" : "task-row" });
			const cb = rowEl.createEl("input", { cls: "task-check", attr: { type: "checkbox" } });
			cb.checked = t.done;
			cb.dataset.taskIndex = String(i);
			const box = rowEl.createSpan({ cls: "task-box", attr: { "aria-hidden": "true" } });
			box.innerHTML = TASK_CHECK_SVG;
			const labelEl = rowEl.createSpan({ cls: "task-label", text: t.label + " " });
			if (t.carryover) labelEl.createSpan({ cls: "task-tag", text: "carryover" });
		});

		const done = plan.tasks.filter((t) => t.done).length;
		const total = plan.tasks.length;
		if (meta) meta.textContent = `${done}/${total}`;
		if (fill) fill.style.width = total ? `${(done / total) * 100}%` : "0%";
	}

	/** Delegated wiring for the Daily Tasks panel — attached once per render off the
	 *  (static) panel container, so it survives the row repaints `paintTasks` does. */
	private wireDayPlan(root: HTMLElement): void {
		const panel = root.querySelector<HTMLElement>(".tasks-panel");
		if (!panel) return;

		// Toggling a checkbox writes `done` back to the daily note frontmatter; the
		// metadata-cache watcher then repaints (progress meter, etc.).
		this.on(panel, "change", (ev) => {
			const cb = (ev.target as HTMLElement).closest<HTMLInputElement>(".task-check");
			const file = this.dayPlan?.file;
			if (!cb || !file) return;
			const idx = Number(cb.dataset.taskIndex);
			if (Number.isNaN(idx)) return;
			void setTaskDone(this.app, file, idx, cb.checked);
		});

		const addBtn = panel.querySelector<HTMLElement>(".task-add");
		if (addBtn) {
			this.on(addBtn, "click", () => {
				const file = this.dayPlan?.file;
				if (!file) {
					new Notice("No daily note for today yet — run Plan Today first.");
					return;
				}
				void addTask(this.app, file).then(() => this.app.workspace.getLeaf(true).openFile(file));
			});
		}
	}

	/** Read today's daily-note `brief:` and paint the Morning Brief panels — the dashboard
	 *  card and the full view share the `.brief__panel` classes. Synchronous like
	 *  refreshDayPlan; no stale-paint token. No-op off the brief views. */
	refreshBrief(): void {
		if (!this.root) return;
		if (this.state !== "dashboard" && this.state !== "full-brief") return;
		this.paintBrief(this.root, readBrief(this.app));
	}

	private paintBrief(root: HTMLElement, b: Brief): void {
		// The card shows a few items per panel; the full view shows them all.
		const cap = this.state === "dashboard" ? 3 : Infinity;

		// Date slot: the card's .brief__date, the full view's .full-bar__meta.
		const date = b.generated ? b.generated.slice(0, 10) : moment().format("YYYY-MM-DD");
		const dateEl = root.querySelector<HTMLElement>(".brief__date");
		if (dateEl) dateEl.textContent = date;
		const barMeta = root.querySelector<HTMLElement>(".full-bar__meta");
		if (barMeta) barMeta.textContent = date;

		const box = (label: string, inner: string): HTMLElement | null =>
			root.querySelector<HTMLElement>(`.brief__panel[aria-label="${label}"] ${inner}`);
		const cta = "▶ Run Morning Brief";

		// HEADLINES
		const hbox = box("Headlines", ".brief__bullets");
		if (hbox) {
			hbox.empty();
			if (!b.has) hbox.createDiv({ cls: "brief-empty", text: cta });
			else if (b.headlines.length === 0) hbox.createDiv({ cls: "brief-empty", text: "No headlines" });
			else for (const h of b.headlines.slice(0, cap)) hbox.createDiv({ cls: "brief__bullet", text: h.text });
		}

		// READING QUEUE
		const rbox = box("Reading queue", ".reading-list");
		if (rbox) {
			rbox.empty();
			if (!b.has) rbox.createDiv({ cls: "brief-empty", text: cta });
			else if (b.reading.length === 0) rbox.createDiv({ cls: "brief-empty", text: "Reading queue empty" });
			else for (const r of b.reading.slice(0, cap)) {
				const item = rbox.createDiv({ cls: "reading-item" });
				item.createSpan({ cls: "reading-item__title", text: r.title });
				const m = item.createSpan({ cls: "reading-item__meta" });
				if (r.src) m.createSpan({ cls: "reading-item__src", text: r.src });
				if (r.meta) m.createSpan({ cls: "reading-item__time", text: r.meta });
			}
		}

		// NOTE OPPORTUNITIES
		const nbox = box("Note opportunities", ".opp-list");
		if (nbox) {
			nbox.empty();
			if (!b.has) nbox.createDiv({ cls: "brief-empty", text: cta });
			else if (b.notes.length === 0) nbox.createDiv({ cls: "brief-empty", text: "No note opportunities" });
			else b.notes.slice(0, cap).forEach((text, i) => {
				const item = nbox.createDiv({ cls: "opp-item" });
				item.createSpan({ cls: "opp-item__num", text: String(i + 1) });
				item.createSpan({ cls: "opp-item__text", text });
			});
		}

		// 𝕏 CONVERSATION — deferred slice; a placeholder until a later slice wires it.
		const xbox = box("X conversation", ".x-list");
		if (xbox) {
			xbox.empty();
			xbox.createDiv({ cls: "brief-empty", text: "𝕏 Conversation — coming soon" });
		}

		// Counts — dashboard header (.brief__count b) and full toolbar (.full-chip__n), both
		// ordered [Headlines, Reading, 𝕏, Notes]; 𝕏 is deferred → 0. Only one selector set
		// exists per layout; the other no-ops.
		const nums = [b.headlines.length, b.reading.length, 0, b.notes.length];
		const setCounts = (els: HTMLElement[]): void => {
			if (els.length >= 4) els.forEach((el, i) => (el.textContent = String(nums[i])));
		};
		setCounts(Array.from(root.querySelectorAll<HTMLElement>(".brief__counts .brief__count b")));
		setCounts(Array.from(root.querySelectorAll<HTMLElement>(".full-chip__n")));

		const total = b.headlines.length + b.reading.length + b.notes.length;
		const fc = root.querySelector<HTMLElement>(".full-count");
		if (fc) fc.textContent = `${total} item${total === 1 ? "" : "s"}`;
	}

/** Regenerate the brief by running the "Morning Brief" Quick Action command (a Shell
	 *  Commands command that writes today's note); the daily-note watcher repaints when it
	 *  lands. Mirrors wireQuickActions' execute path. */
	private runMorningBrief(): void {
		const id = parseQuickActions(this.plugin.settings.quickActions).get("Morning Brief");
		if (!id) {
			new Notice('No command mapped for "Morning Brief". Add one in Agentic OS settings.');
			return;
		}
		const ok = (this.app as any).commands?.executeCommandById(id);
		if (!ok) {
			new Notice(`Command not found: ${id} — check Agentic OS settings.`);
			return;
		}
		new Notice("Morning Brief — generating…");
	}

	/** Read every session in the card's folder and paint the full sessions list. No-op
	 *  unless that view is rendered; guarded against stale paints like the others. */
	async refreshFolderSessions(): Promise<void> {
		if (!this.root || this.state !== "full-sessions") return;
		const ticket = ++this.sessionsListToken;

		const data = await readFolderSessions(parseFolderGroups(this.plugin.settings.sessionFolderGroups));

		if (!this.root || ticket !== this.sessionsListToken || this.state !== "full-sessions") return;
		this.paintFolderSessions(this.root, data);
	}

	/** Swap the static placeholder rows for shimmering skeletons while the read runs,
	 *  and neutralize the design's placeholder folder text so it can't flash. */
	private showSessionsSkeleton(root: HTMLElement): void {
		const title = root.querySelector<HTMLElement>(".rsrch-head__title");
		if (title) title.textContent = "Sessions";
		const meta = root.querySelector<HTMLElement>(".full-bar__meta");
		if (meta) meta.textContent = "";

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.add("is-loading");
		const row =
			'<div class="rank-row"><span class="rank-row__num"></span>' +
			'<div class="rank-row__body"><div class="rank-row__line1"></div>' +
			'<div class="rank-row__desc"></div></div></div>';
		list.innerHTML = row.repeat(6);
	}

	private paintFolderSessions(root: HTMLElement, data: FolderSessions): void {
		// Cache the rows so the toolbar's sort/filter can repaint without refetching.
		this.folderSessions = data.sessions;

		const title = root.querySelector<HTMLElement>(".rsrch-head__title");
		if (title) title.textContent = data.folder ? `Sessions · ${data.folder}` : "Sessions";

		const meta = root.querySelector<HTMLElement>(".full-bar__meta");
		if (meta) meta.textContent = data.folder ?? "";

		this.renderSessionsList(root);
	}

	/** Apply the current sort + filter to the cached rows and paint the list, the
	 *  count slots, and the sort-button label. */
	private renderSessionsList(root: HTMLElement): void {
		const sort = SESSION_SORTS[this.sessionsSortMode];
		const sortBtn = root.querySelector<HTMLElement>(".full-sort");
		if (sortBtn) sortBtn.textContent = `Sort: ${sort.label}`;

		const q = this.sessionsFilter.trim().toLowerCase();
		const rows = (q
			? this.folderSessions.filter(
					(s) =>
						(s.title ?? "").toLowerCase().includes(q) || (s.branch ?? "").toLowerCase().includes(q),
				)
			: this.folderSessions
		)
			.slice()
			.sort(sort.cmp);

		// Count slots: the body header's right label and the toolbar count.
		const n = rows.length;
		const countLabel = `${n} ${n === 1 ? "session" : "sessions"}`;
		const date = root.querySelector<HTMLElement>(".rsrch-date");
		if (date) date.textContent = countLabel;
		const count = root.querySelector<HTMLElement>(".full-count");
		if (count) count.textContent = countLabel;

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading"); // real data (or an empty state) — stop shimmering.
		if (!n) {
			const msg = this.folderSessions.length
				? "No sessions match your filter."
				: "No sessions found for this folder.";
			list.innerHTML = `<div class="rank-row"><div class="rank-row__body"><div class="rank-row__desc">${msg}</div></div></div>`;
			return;
		}
		list.innerHTML = rows.map((s, i) => this.sessionRowHtml(s, i + 1)).join("");
	}

	/** One session row, modeled on the HN rank-row: ordinal, title + age, then a
	 *  meta line of branch · messages · tokens · tool calls · model. */
	private sessionRowHtml(s: LatestSession, num: number): string {
		const age = s.lastTs !== null ? formatSessionAge(Date.now() - s.lastTs) : "";
		const desc = [
			// "HEAD" is a detached-HEAD placeholder, not a real branch — omit it.
			s.branch === "HEAD" ? null : s.branch,
			`${s.messages.toLocaleString("en-US")} msgs`,
			`${formatTokens(s.tokens)} tokens`,
			`${s.toolCalls.toLocaleString("en-US")} tools`,
			s.model,
		]
			.filter((p): p is string => Boolean(p))
			.map((p) => this.esc(p))
			.join(" · ");
		// A row opens its transcript only when we have the source path; the delegated
		// handler in wireSessionsToolbar keys off data-transcript.
		const open = s.path
			? ` data-transcript="${this.esc(s.path)}" data-title="${this.esc(s.title ?? "Session")}" role="link" tabindex="0"`
			: "";
		return (
			`<div class="rank-row"${open}>` +
			`<span class="rank-row__num">${num}</span>` +
			'<div class="rank-row__body">' +
			`<div class="rank-row__line1">${this.esc(s.title ?? "Untitled session")}` +
			`<span class="rank-row__pts">${this.esc(age)}</span></div>` +
			`<div class="rank-row__desc">${desc}</div>` +
			"</div></div>"
		);
	}

	/** Fetch the top HN stories and paint whichever Research view is showing — the
	 *  dashboard card (top 5) or the full list (top 30 with chips + search). The full
	 *  read is a superset, so it's cached: the card slices it, the toolbar filters it. */
	async refreshHackerNews(): Promise<void> {
		if (!this.root || (this.state !== "dashboard" && this.state !== "full-hn")) return;
		const ticket = ++this.hnToken;

		const feed = await readHackerNews(HN_FULL_LIMIT, Date.now());

		if (!this.root || ticket !== this.hnToken) return;
		if (this.state === "dashboard") {
			if (!feed.ok && this.hnStories.length === 0) {
				this.paintHNError(this.root);
				return;
			}
			if (feed.ok) this.hnStories = feed.stories;
			this.paintHNCard(this.root);
		} else if (this.state === "full-hn") {
			if (!feed.ok && this.hnStories.length === 0) {
				this.paintHNError(this.root);
				return;
			}
			if (feed.ok) this.hnStories = feed.stories;
			this.renderHNList(this.root);
		}
	}

	/** Paint the dashboard's Hacker News card: the first few stories as compact rows
	 *  (title + points, no meta line) and a fresh date stamp. */
	private paintHNCard(root: HTMLElement): void {
		const card = root.querySelector<HTMLElement>('.card[aria-label="Hacker News"]');
		if (!card) return;
		const date = card.querySelector<HTMLElement>(".rsrch-date");
		if (date) date.textContent = moment().format("YYYY-MM-DD");
		const list = card.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading"); // clear the manual-refresh skeleton
		const rows = this.hnStories.slice(0, HN_CARD_LIMIT);
		list.innerHTML = rows.length
			? rows.map((s, i) => this.hnRowHtml(s, i + 1, false)).join("")
			: '<div class="rank-row"><div class="rank-row__body"><div class="rank-row__desc">No stories right now.</div></div></div>';
	}

	/** Apply the active chip + search to the cached stories and paint the full list,
	 *  the chip counts, the result count, and the "updated" meta. */
	private renderHNList(root: HTMLElement): void {
		const q = this.hnFilter.trim().toLowerCase();
		const matchesSearch = (s: HNStory) =>
			!q || s.title.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q);

		let rows = this.hnStories.filter((s) => {
			if (this.hnChip === "show" && s.kind !== "show") return false;
			if (this.hnChip === "ask" && s.kind !== "ask") return false;
			return matchesSearch(s);
		});
		// "New" keeps every story but re-orders newest-first; the others stay in HN rank.
		if (this.hnChip === "new") rows = rows.slice().sort((a, b) => b.time - a.time);

		// Chip counts reflect the search-filtered pool so the numbers track the list.
		const pool = this.hnStories.filter(matchesSearch);
		const counts = [
			pool.length, // Top
			pool.filter((s) => s.kind === "show").length, // Show HN
			pool.filter((s) => s.kind === "ask").length, // Ask HN
			pool.length, // New (same pool, re-sorted)
		];
		const chipNums = Array.from(root.querySelectorAll<HTMLElement>(".full-chip__n"));
		chipNums.forEach((el, i) => {
			if (i < counts.length) el.textContent = String(counts[i]);
		});

		const meta = root.querySelector<HTMLElement>(".full-bar__meta");
		if (meta) meta.textContent = `updated ${moment().format("YYYY-MM-DD · HH:mm")}`;
		const date = root.querySelector<HTMLElement>(".rsrch-date");
		if (date) date.textContent = `top ${this.hnStories.length} by points`;
		const count = root.querySelector<HTMLElement>(".full-count");
		if (count) count.textContent = `${rows.length} ${rows.length === 1 ? "story" : "stories"}`;

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading");
		list.innerHTML = rows.length
			? rows.map((s, i) => this.hnRowHtml(s, i + 1, true)).join("")
			: `<div class="rank-row"><div class="rank-row__body"><div class="rank-row__desc">${
					this.hnStories.length ? "No stories match your filter." : "No stories right now."
			  }</div></div></div>`;
	}

	/** One HN rank-row: ordinal, title + points, optionally a domain · comments · age
	 *  meta line. The row carries the URL so the list's delegated click can open it. */
	private hnRowHtml(s: HNStory, num: number, withDesc: boolean): string {
		const pts = `${s.score.toLocaleString("en-US")}↑`;
		const desc = withDesc
			? `<div class="rank-row__desc">${this.esc(s.domain)} · ${s.comments.toLocaleString(
					"en-US",
			  )} comments · ${this.esc(s.age)}</div>`
			: "";
		return (
			`<div class="rank-row" data-url="${this.esc(s.url)}" data-title="${this.esc(
				s.title,
			)}" role="link" tabindex="0">` +
			`<span class="rank-row__num">${num}</span>` +
			'<div class="rank-row__body">' +
			`<div class="rank-row__line1">${this.esc(s.title)}<span class="rank-row__pts">${this.esc(
				pts,
			)}</span></div>` +
			desc +
			"</div></div>"
		);
	}

	/** Swap the rank-list for shimmering skeleton rows while an HN fetch runs. On the
	 *  dashboard, scope to the Hacker News card — its rank-list is the *second* on the
	 *  page (the radar's comes first), so an unscoped query would skeleton the wrong card. */
	private showHNSkeleton(root: HTMLElement): void {
		const card =
			this.state === "dashboard" ? root.querySelector<HTMLElement>('.card[aria-label="Hacker News"]') : root;
		const list = card?.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.add("is-loading");
		const row =
			'<div class="rank-row"><span class="rank-row__num"></span>' +
			'<div class="rank-row__body"><div class="rank-row__line1"></div>' +
			'<div class="rank-row__desc"></div></div></div>';
		list.innerHTML = row.repeat(10);
	}

	/** Render the designed error state into the active Research view's rank-list, with a
	 *  Retry that refetches. Used only when nothing has painted yet (no cached stories). */
	private paintHNError(root: HTMLElement): void {
		const card =
			this.state === "dashboard"
				? root.querySelector<HTMLElement>('.card[aria-label="Hacker News"]')
				: root;
		const list = card?.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading");
		list.empty();
		const err = list.createDiv({ cls: "state-error" });
		err.createSpan({ cls: "state-error__msg", text: "Couldn't reach Hacker News" });
		const retry = err.createEl("button", { cls: "state-error__retry", text: "Retry", attr: { type: "button" } });
		this.on(retry, "click", () => void this.refreshHackerNews());
	}

	// ── Release Radar ──────────────────────────────────────────────────────────

	/** Authed accounts the radar should scan: every discovered account minus those
	 *  excluded in settings. Empty → nothing to scan (the read returns an error state). */
	private async radarEnabledAccounts(): Promise<string[]> {
		const all = await discoverGhAccounts();
		const excluded = new Set(this.plugin.settings.radarExcludedAccounts);
		return all.filter((a) => !excluded.has(a));
	}

	/** Fetch the live radar (both accounts' deps) and paint whichever Research view is
	 *  showing — the dashboard card (top few) or the full grouped list with the toolbar.
	 *  The full read is the superset, so it's cached: the card slices it, the chips filter
	 *  it. Heaviest fetch in the app, hence lazy + on a slow timer (see refresh wiring). */
	async refreshRadar(): Promise<void> {
		if (!this.root || (this.state !== "dashboard" && this.state !== "full-radar")) return;
		const ticket = ++this.radarToken;

		const accounts = await this.radarEnabledAccounts();
		const adapter = this.app.vault.adapter;
		const overlay = adapter instanceof FileSystemAdapter ? readRadarOverlay(adapter.getBasePath()) : {};
		const data = await readReleaseRadar(accounts, overlay);

		if (!this.root || ticket !== this.radarToken) return;
		if (data.ok) {
			this.radarRows = data.rows;
			this.radarRepoCount = data.repoCount;
			this.radarLoaded = true;
			// Keep the /release-radar worklist current with the live escalated rows.
			if (adapter instanceof FileSystemAdapter) writeRadarInput(adapter.getBasePath(), data.rows);
		} else if (this.radarRows.length === 0) {
			this.paintRadarError(this.root);
			return;
		}
		if (this.state === "dashboard") this.paintRadarCard(this.root);
		else this.renderRadarList(this.root);
	}

	/** Paint the dashboard's Release Radar card: the top few rows (escalated first),
	 *  grouped, with a fresh date stamp. */
	private paintRadarCard(root: HTMLElement): void {
		const card = root.querySelector<HTMLElement>('.card[aria-label="Release radar"]');
		if (!card) return;
		const date = card.querySelector<HTMLElement>(".rsrch-date");
		if (date) date.textContent = moment().format("YYYY-MM-DD");
		const list = card.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading");
		const rows = this.radarRows.slice(0, RADAR_CARD_LIMIT);
		list.innerHTML = rows.length
			? this.radarRowsHtml(rows)
			: '<div class="rank-row"><div class="rank-row__body"><div class="rank-row__desc">Everything’s up to date.</div></div></div>';
	}

	/** Apply the active chip + search to the cached rows and paint the full list, the
	 *  chip counts, the result count, and the "updated"/"N packages · M repos" meta. */
	private renderRadarList(root: HTMLElement): void {
		const q = this.radarFilter.trim().toLowerCase();
		const matchesSearch = (r: RadarRow) =>
			!q ||
			r.pkg.toLowerCase().includes(q) ||
			r.desc.toLowerCase().includes(q) ||
			r.affects.some((a) => a.toLowerCase().includes(q));

		const pool = this.radarRows.filter(matchesSearch);
		const rows = pool.filter((r) => this.radarChip === "all" || r.group === this.radarChip);

		// Chip counts (search-filtered pool) — markup order: All, Attention, Active, Idle.
		const counts = [
			pool.length,
			pool.filter((r) => r.group === "attention").length,
			pool.filter((r) => r.group === "active").length,
			pool.filter((r) => r.group === "idle").length,
		];
		Array.from(root.querySelectorAll<HTMLElement>(".full-chip__n")).forEach((el, i) => {
			if (i < counts.length) el.textContent = String(counts[i]);
		});

		const meta = root.querySelector<HTMLElement>(".full-bar__meta");
		if (meta) meta.textContent = `updated ${moment().format("YYYY-MM-DD · h:mm A")}`;
		const date = root.querySelector<HTMLElement>(".rsrch-date");
		if (date) {
			const p = this.radarRows.length;
			const r = this.radarRepoCount;
			date.textContent = `${p} package${p === 1 ? "" : "s"} · ${r} repo${r === 1 ? "" : "s"}`;
		}

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading");
		list.innerHTML = rows.length
			? this.radarRowsHtml(rows)
			: `<div class="rank-row"><div class="rank-row__body"><div class="rank-row__desc">${
					this.radarRows.length ? "No dependencies match your filter." : "Everything’s up to date."
			  }</div></div></div>`;
	}

	/** Walk a priority-sorted row slice, emitting a group header whenever the group (or,
	 *  for Active/Idle, the owning repo) changes, with rows numbered 1..N across groups. */
	private radarRowsHtml(rows: RadarRow[]): string {
		let html = "";
		let lastKey = "";
		rows.forEach((r, i) => {
			const key = r.group === "attention" ? "attention" : `${r.group}:${r.groupRepo}`;
			if (key !== lastKey) {
				lastKey = key;
				html += this.radarGroupHeader(r);
			}
			html += this.radarRowHtml(r, i + 1);
		});
		return html;
	}

	private radarGroupHeader(r: RadarRow): string {
		if (r.group === "attention") return '<div class="rank-group rank-group--attention">⚠ Needs Attention</div>';
		const sigil = r.group === "active" ? "◆ Active" : "◇ Idle";
		return `<div class="rank-group">${sigil} · <span class="rank-group__repo">${this.esc(r.groupRepo)}</span></div>`;
	}

	private radarRowHtml(r: RadarRow, num: number): string {
		const badgeClass = {
			BREAKING: "badge--breaking",
			SECURITY: "badge--security",
			MINOR: "badge--pos",
			PATCH: "badge--neutral",
		}[r.badge];
		// Escalated rows have no group-repo header, so surface the impacted repos as their
		// own accent chips — clearer than burying them in the muted description text.
		const affectsHtml =
			r.escalated && r.affects.length
				? `<div class="rank-row__affects"><span class="rank-row__affects-label">affects</span>${r.affects
						.map((a) => `<span class="rank-row__repo">${this.esc(a)}</span>`)
						.join("")}</div>`
				: "";
		return (
			`<div class="rank-row" data-url="${this.esc(r.url)}" data-title="${this.esc(r.name)}" role="link" tabindex="0">` +
			`<span class="rank-row__num">${num}</span>` +
			'<div class="rank-row__body">' +
			`<div class="rank-row__line1">${this.esc(r.name)}<span class="rank-row__pts">${this.esc(
				r.latest,
			)}</span><span class="badge ${badgeClass}">${r.badge}</span></div>` +
			`<div class="rank-row__desc">${this.esc(r.desc)}</div>` +
			affectsHtml +
			"</div></div>"
		);
	}

	/** Swap the rank-list for shimmering skeleton rows while the first radar fetch runs,
	 *  and blank the static header/toolbar placeholders (mock date, chip counts, "N
	 *  packages · M repos") so the designer's sample values don't show during the (slow)
	 *  fetch. The real values land when renderRadarList/paintRadarCard paints. */
	private showRadarSkeleton(root: HTMLElement): void {
		const card =
			this.state === "dashboard" ? root.querySelector<HTMLElement>('.card[aria-label="Release radar"]') : root;
		const list = card?.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.add("is-loading");
		const row =
			'<div class="rank-row"><span class="rank-row__num"></span>' +
			'<div class="rank-row__body"><div class="rank-row__line1"></div>' +
			'<div class="rank-row__desc"></div></div></div>';
		list.innerHTML = row.repeat(this.state === "dashboard" ? RADAR_CARD_LIMIT : 10);

		// Clear the placeholder figures the skeleton doesn't cover.
		const date = card?.querySelector<HTMLElement>(".rsrch-date");
		if (date) date.textContent = "";
		if (this.state === "full-radar") {
			root.querySelectorAll<HTMLElement>(".full-chip__n").forEach((el) => (el.textContent = ""));
			const meta = root.querySelector<HTMLElement>(".full-bar__meta");
			if (meta) meta.textContent = "loading…";
		}
	}

	/** The designed error state into the active Research view's rank-list, with a Retry
	 *  that refetches. Used only when nothing has painted yet (no cached rows). */
	private paintRadarError(root: HTMLElement): void {
		const card =
			this.state === "dashboard" ? root.querySelector<HTMLElement>('.card[aria-label="Release radar"]') : root;
		const list = card?.querySelector<HTMLElement>(".rank-list");
		if (!list) return;
		list.classList.remove("is-loading");
		list.empty();
		const err = list.createDiv({ cls: "state-error" });
		err.createSpan({ cls: "state-error__msg", text: "Couldn’t reach GitHub" });
		const retry = err.createEl("button", { cls: "state-error__retry", text: "Retry", attr: { type: "button" } });
		this.on(retry, "click", () => void this.refreshRadar());
	}

	/** The radar full-view toolbar: chips switch the group filter (All/Attention/Active/
	 *  Idle), the search box filters by package/repo/description. Both repaint from cache —
	 *  no refetch. (Rows stay in priority order; no sort control.) */
	private wireRadarToolbar(root: HTMLElement): void {
		const chips = Array.from(root.querySelectorAll<HTMLButtonElement>(".full-chip"));
		// Chips are in DOM order: All, ⚠ Attention, ◆ Active, Idle.
		const order: Array<"all" | RadarGroup> = ["all", "attention", "active", "idle"];
		chips.forEach((chip, i) => {
			const kind = order[i];
			if (!kind) return;
			this.on(chip, "click", () => {
				this.radarChip = kind;
				for (const c of chips) c.classList.toggle("is-active", c === chip);
				this.renderRadarList(root);
			});
		});

		const search = root.querySelector<HTMLInputElement>(".full-search input");
		if (search) {
			this.on(search, "input", () => {
				this.radarFilter = search.value;
				this.renderRadarList(root);
			});
		}

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (list) this.wireRadarRows(list);
	}

	/** Delegate clicks/Enter on a (re-painted) radar rank-list to open the dep's release
	 *  notes / repo page in the embedded browser — rows carry their URL in data-url. */
	private wireRadarRows(list: HTMLElement): void {
		const open = (ev: Event): void => {
			const row = (ev.target as HTMLElement).closest<HTMLElement>("[data-url]");
			const url = row?.getAttribute("data-url");
			if (url) void this.openRepo(url, row?.getAttribute("data-title") ?? "Release Radar");
		};
		this.on(list, "click", open);
		this.on(list, "keydown", (ev) => {
			const e = ev as KeyboardEvent;
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				open(ev);
			}
		});
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
		const link = r.url
			? ` data-repo-url="${this.esc(r.url)}" data-repo-name="${this.esc(r.name)}" role="link" tabindex="0"`
			: "";
		return (
			`<article class="card gh-repo" aria-label="Repository: ${this.esc(r.name)}"${link}>` +
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
			// Release Radar is the heaviest fetch (repos × package.json × npm), so it's
			// lazy too: shimmer + fetch on first Research view; later opens keep the cache
			// (the slow timer + active-leaf repaint keep it fresh).
			if (target === "panel-research" && !this.radarLoaded) {
				this.showRadarSkeleton(root);
				void this.refreshRadar();
			}
		};

		for (const tab of tabs) {
			this.on(tab, "click", () => selectTab(tab));
		}

		// Restore the tab we left from (defaults to Overview).
		const restore = tabs.find((t) => t.getAttribute("aria-controls") === this.activeTab);
		if (restore) selectTab(restore);

		const shellRefresh = root.querySelector<HTMLElement>(".shell-head__actions .icon-btn");
		if (shellRefresh) this.on(shellRefresh, "click", () => this.plugin.reloadSelf());

		// Repo cards are painted async, so delegate off the (static) grid container:
		// clicking/Entering a card opens that repo in an embedded browser tab.
		const grid = root.querySelector<HTMLElement>(".gh-repo-grid");
		if (grid) {
			const open = (ev: Event): void => {
				const card = (ev.target as HTMLElement).closest<HTMLElement>("[data-repo-url]");
				const url = card?.getAttribute("data-repo-url");
				if (url) void this.openRepo(url, card?.getAttribute("data-repo-name") ?? "Repository");
			};
			this.on(grid, "click", open);
			this.on(grid, "keydown", (ev) => {
				const e = ev as KeyboardEvent;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					open(ev);
				}
			});
		}

		// Each "Full ↗" pill swaps the whole pane to its deep-dive view.
		for (const btn of Array.from(root.querySelectorAll<HTMLElement>("[data-full]"))) {
			this.on(btn, "click", () => {
				const target = btn.getAttribute("data-full") as ViewState;
				// Coming back should land on the tab the pill lives on: the Sessions
				// pill is on Overview, the rest on Research_.
				this.activeTab = target === "full-sessions" ? "panel-overview" : "panel-research";
				this.navigate(target);
			});
		}

		this.wireQuickActions(root);
		this.wireDayPlan(root);

		// The brief card's ⟳ regenerates the brief (same command as the "Morning Brief"
		// quick action); the painted panels refresh from disk when the note is rewritten.
		const briefRefresh = root.querySelector<HTMLElement>(".brief .icon-btn");
		if (briefRefresh) this.on(briefRefresh, "click", () => this.runMorningBrief());

		// Hacker News card: its ⟳ shows the skeleton then refetches (so the click is
		// visible feedback, not a silent no-op); clicking a story opens it.
		const hnCard = root.querySelector<HTMLElement>('.card[aria-label="Hacker News"]');
		if (hnCard) {
			const hnRefresh = hnCard.querySelector<HTMLElement>(".icon-btn");
			if (hnRefresh)
				this.on(hnRefresh, "click", () => {
					this.showHNSkeleton(root);
					void this.refreshHackerNews();
				});
			const list = hnCard.querySelector<HTMLElement>(".rank-list");
			if (list) this.wireHNRows(list);
		}

		// Release Radar card: its ⟳ shows the skeleton then refetches; clicking a row
		// opens the dep's release notes / repo page.
		const radarCard = root.querySelector<HTMLElement>('.card[aria-label="Release radar"]');
		if (radarCard) {
			const radarRefresh = radarCard.querySelector<HTMLElement>(".icon-btn");
			if (radarRefresh)
				this.on(radarRefresh, "click", () => {
					this.showRadarSkeleton(root);
					void this.refreshRadar();
				});
			const list = radarCard.querySelector<HTMLElement>(".rank-list");
			if (list) this.wireRadarRows(list);
		}
	}

	/** Each Quick Action button runs the Obsidian command (typically a Shell Commands
	 *  command) mapped to its label in settings. The map is parsed at click time so
	 *  settings edits take effect without a re-render; unmapped buttons say so. */
	private wireQuickActions(root: HTMLElement): void {
		for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>(".quick-action"))) {
			const label = (btn.textContent ?? "").trim();
			this.on(btn, "click", () => {
				const id = parseQuickActions(this.plugin.settings.quickActions).get(label);
				if (!id) {
					new Notice(`No command mapped for "${label}". Add one in Agentic OS settings.`);
					return;
				}
				// app.commands is Obsidian's internal command API (untyped) — the same
				// call Meta Bind's `type: command` action uses. Returns false if the
				// command isn't found (e.g. Shell Commands not installed / wrong ID).
				const ok = (this.app as any).commands?.executeCommandById(id);
				if (!ok) {
					new Notice(`Command not found: ${id} — check Agentic OS settings.`);
					return;
				}
				// "Pull Metrics" reads the snapshot, it can't rewrite it: only an
				// interactive statusline render produces the live rate-limit percentage,
				// which headless `claude -p` never sees. So there's no file change for
				// watchSnapshot to catch — re-read it ourselves so the panel repaints and
				// "last pull" reflects the snapshot's true current age on demand.
				if (label === "Pull Metrics") void this.refreshTokenBurn();
			});
		}
	}

	/** Back button returns a full view to the dashboard. */
	private wireFullView(root: HTMLElement): void {
		const back = root.querySelector<HTMLElement>(".full-back");
		if (back) {
			this.on(back, "click", () => this.navigate("dashboard"));
		}
		// The shell header's ⟳ is wired per-state in wireDashboard; full views render via
		// this path, so wire it here too — otherwise it's a dead button on every "Full ↗"
		// view. Data-backed views refetch in place (with the skeleton for feedback); the
		// rest fall back to the dashboard's full reload.
		const shellRefresh = root.querySelector<HTMLElement>(".shell-head__actions .icon-btn");
		if (shellRefresh)
			this.on(shellRefresh, "click", () => {
				if (this.state === "full-radar") {
					this.showRadarSkeleton(root);
					void this.refreshRadar();
				} else if (this.state === "full-hn") {
					this.showHNSkeleton(root);
					void this.refreshHackerNews();
				} else {
					this.plugin.reloadSelf();
				}
			});
		if (this.state === "full-sessions") this.wireSessionsToolbar(root);
		if (this.state === "full-hn") this.wireHNToolbar(root);
		if (this.state === "full-radar") this.wireRadarToolbar(root);
	}

	/** The Hacker News list toolbar: the chips switch the filter (Top/Show/Ask/New), the
	 *  search box filters by title/domain, and clicking a story opens it. All repaint from
	 *  the cached stories — no refetch. */
	private wireHNToolbar(root: HTMLElement): void {
		const chips = Array.from(root.querySelectorAll<HTMLButtonElement>(".full-chip"));
		// Chips are in DOM order: Top, Show HN, Ask HN, New.
		const order: Array<"top" | HNKind | "new"> = ["top", "show", "ask", "new"];
		chips.forEach((chip, i) => {
			const kind = order[i];
			if (!kind) return;
			this.on(chip, "click", () => {
				this.hnChip = kind;
				for (const c of chips) c.classList.toggle("is-active", c === chip);
				this.renderHNList(root);
			});
		});

		const search = root.querySelector<HTMLInputElement>(".full-search input");
		if (search) {
			this.on(search, "input", () => {
				this.hnFilter = search.value;
				this.renderHNList(root);
			});
		}

		const list = root.querySelector<HTMLElement>(".rank-list");
		if (list) this.wireHNRows(list);
	}

	/** Delegate clicks/Enter on a (re-painted) HN rank-list to open the story's URL in
	 *  the embedded browser tab — the rows carry their URL in data-url. */
	private wireHNRows(list: HTMLElement): void {
		const open = (ev: Event): void => {
			const row = (ev.target as HTMLElement).closest<HTMLElement>("[data-url]");
			const url = row?.getAttribute("data-url");
			if (url) void this.openRepo(url, row?.getAttribute("data-title") ?? "Hacker News");
		};
		this.on(list, "click", open);
		this.on(list, "keydown", (ev) => {
			const e = ev as KeyboardEvent;
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				open(ev);
			}
		});
	}

	/** The sessions list toolbar: the "Sort:" button cycles orders, the search box
	 *  filters by title/branch. Both repaint from the cached rows (no refetch). */
	private wireSessionsToolbar(root: HTMLElement): void {
		const sortBtn = root.querySelector<HTMLElement>(".full-sort");
		if (sortBtn) {
			this.on(sortBtn, "click", () => {
				this.sessionsSortMode = (this.sessionsSortMode + 1) % SESSION_SORTS.length;
				this.renderSessionsList(root);
			});
		}
		const search = root.querySelector<HTMLInputElement>(".full-search input");
		if (search) {
			this.on(search, "input", () => {
				this.sessionsFilter = search.value;
				this.renderSessionsList(root);
			});
		}

		// A row click/Enter opens that session's transcript in its own pane. Delegated
		// on the list since rows are repainted by sort/filter; mirrors wireHNRows.
		const list = root.querySelector<HTMLElement>(".rank-list");
		if (list) {
			const open = (ev: Event): void => {
				const row = (ev.target as HTMLElement).closest<HTMLElement>("[data-transcript]");
				const path = row?.getAttribute("data-transcript");
				if (path) void this.openTranscript(path, row?.getAttribute("data-title") ?? "Session");
			};
			this.on(list, "click", open);
			this.on(list, "keydown", (ev) => {
				const e = ev as KeyboardEvent;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					open(ev);
				}
			});
		}
	}

	/** Bring the full sessions list to the front of this view — the transcript pane's
	 *  back button calls this on the dashboard leaf so closing a transcript lands you
	 *  back on the list, not the Overview tab. A no-op re-entry if already there
	 *  (navigate guards on equal state). */
	revealSessionsList(): void {
		this.activeTab = "panel-overview";
		this.navigate("full-sessions");
	}

	/** Open a session transcript in its own pane (reuses one if already open). */
	private async openTranscript(path: string, title: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_SESSION_TRANSCRIPT)[0];
		const leaf = existing ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_SESSION_TRANSCRIPT, active: true, state: { path, title } });
		workspace.revealLeaf(leaf);
	}

	/** Open a repo in an embedded browser tab (reuses one if already open). */
	private async openRepo(url: string, name: string): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_REPO_BROWSER)[0];
		const leaf = existing ?? workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_REPO_BROWSER, active: true, state: { url, title: name } });
		workspace.revealLeaf(leaf);
	}
}

/** A minimal in-app browser tab: an Electron <webview> filling a center leaf.
 *  Desktop-only (the <webview> tag is an Electron feature), used to open a repo's
 *  GitHub page without leaving Obsidian. URL/title arrive via view state so the
 *  tab survives a workspace reload. */
class RepoBrowserView extends ItemView {
	private url = "";
	private title = "Repository";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_REPO_BROWSER;
	}

	getDisplayText(): string {
		return this.title;
	}

	getIcon(): string {
		return "globe";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = state as { url?: string; title?: string } | null;
		if (s && typeof s.url === "string") {
			this.url = s.url;
			this.title = s.title || s.url;
		}
		this.renderWebview();
		await super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { url: this.url, title: this.title };
	}

	async onOpen(): Promise<void> {
		this.renderWebview();
	}

	/** (Re)mount the webview for the current URL. contentEl padding is zeroed so
	 *  the page fills the pane edge-to-edge. */
	private renderWebview(): void {
		this.contentEl.empty();
		if (!this.url) return;
		this.contentEl.style.padding = "0";
		const webview = document.createElement("webview");
		webview.setAttribute("src", this.url);
		webview.setAttribute("allowpopups", "");
		webview.style.width = "100%";
		webview.style.height = "100%";
		webview.style.border = "0";
		this.contentEl.appendChild(webview);
	}
}

/** A session transcript rendered in a center leaf by shelling out to the
 *  `claude-history` CLI (`--render`). The CLI bakes wrapping + the ledger gutter into
 *  its text, so we "reflow" by measuring the pane in monospace columns, passing that
 *  as COLUMNS, and re-rendering (debounced) when the pane resizes — a render is ~15ms.
 *  Header toggles flip tool-call / thinking detail. Path/title/toggles ride view state
 *  so the tab survives a workspace reload. Desktop-only (the CLI is a child process). */
class SessionTranscriptView extends ItemView {
	private path = "";
	private title = "Session";
	private showTools = false;

	private body: HTMLElement | null = null;
	private toolsBtn: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeTimer: number | null = null;
	/** Guards against a slow render painting over a newer one (resize/toggle races). */
	private renderToken = 0;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SESSION_TRANSCRIPT;
	}

	getDisplayText(): string {
		return this.title;
	}

	getIcon(): string {
		return "message-square";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = state as { path?: string; title?: string } | null;
		if (s && typeof s.path === "string") {
			this.path = s.path;
			this.title = s.title || "Session";
		}
		this.buildChrome();
		void this.render();
		await super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { path: this.path, title: this.title };
	}

	async onOpen(): Promise<void> {
		this.buildChrome();
		void this.render();
	}

	async onClose(): Promise<void> {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
	}

	/** Close this transcript and return to the dashboard's full sessions list. Reuses
	 *  an open dashboard leaf if there is one, else opens one; then reveals it on the
	 *  sessions list and detaches this pane so "back" actually leaves the transcript. */
	private async backToSessions(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_AGENTIC_OS, active: true });
		}
		const view = leaf.view;
		if (view instanceof AgenticOSView) view.revealSessionsList();
		workspace.revealLeaf(leaf);
		this.leaf.detach();
	}

	/** (Re)build the header toolbar + the scrolling body, and (re)attach the resize
	 *  observer that reflows the transcript to the pane width. */
	private buildChrome(): void {
		this.contentEl.empty();
		this.contentEl.addClass("agentic-os", "transcript-view");
		if (!this.path) return;

		const bar = this.contentEl.createDiv({ cls: "transcript-bar" });
		const back = bar.createEl("button", { cls: "transcript-back", text: "← Sessions" });
		back.addEventListener("click", () => void this.backToSessions());

		this.toolsBtn = bar.createEl("button", { cls: "transcript-toggle", text: "+ Tools" });
		this.toolsBtn.addEventListener("click", () => {
			this.showTools = !this.showTools;
			void this.render();
		});

		this.body = this.contentEl.createDiv({ cls: "transcript-body" });

		this.resizeObserver = new ResizeObserver(() => {
			if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
			this.resizeTimer = window.setTimeout(() => void this.render(), 150);
		});
		this.resizeObserver.observe(this.contentEl);
	}

	/** Target wrap width in monospace columns. We measure the body's char width and
	 *  fill the visible pane, then add back the gutter width the CLI reserves for its
	 *  role labels (which we strip when grouping) so wrapped lines reach the bubble
	 *  edge. Falls back to 80 before the pane is laid out. */
	private columns(): number {
		const body = this.body;
		if (!body || !body.clientWidth) return 80;
		const probe = body.createSpan({ text: "0".repeat(100) });
		const charWidth = probe.getBoundingClientRect().width / 100;
		probe.remove();
		if (!charWidth) return 80;
		// GUTTER_COLS: the CLI's "<label> │ " prefix; BUBBLE_PX: per-message rail +
		// paddings that the text can't use. Both are approximate — a few columns off
		// just wraps slightly narrow, which is harmless.
		const GUTTER_COLS = 12;
		const BUBBLE_PX = 64;
		const cols = Math.floor((body.clientWidth - BUBBLE_PX) / charWidth) + GUTTER_COLS;
		return Math.max(24, Math.min(400, cols));
	}

	/** Render the transcript at the current width + toggle state, guarded so a stale
	 *  read (older resize/toggle) can't paint over a newer one. */
	private async render(): Promise<void> {
		if (!this.body || !this.path) return;
		const ticket = ++this.renderToken;
		this.syncToggleState();

		let text: string;
		try {
			text = await renderTranscript(this.path, {
				columns: this.columns(),
				showTools: this.showTools,
			});
		} catch {
			if (ticket !== this.renderToken || !this.body) return;
			this.body.empty();
			this.body.createDiv({
				cls: "transcript-empty",
				text:
					"Couldn't render this transcript. The `claude-history` CLI must be installed and on " +
					"PATH (cargo installs it to ~/.cargo/bin). Install it, then reopen this session.",
			});
			return;
		}

		if (ticket !== this.renderToken || !this.body) return;
		this.paint(text);
	}

	/** Group the CLI's flat ledger into per-turn message blocks and paint each as a
	 *  styled bubble (role chip + monospace body). The ledger is a fixed-width
	 *  right-aligned label, a "│" gutter, then content; continuation lines repeat the
	 *  gutter with a blank label; blank lines (no gutter) separate turns. We key off
	 *  the gutter's column — found once from the first "│" — so content that itself
	 *  contains "│" (tables, box art) can't be mistaken for the separator. */
	private paint(text: string): void {
		const body = this.body;
		if (!body) return;
		body.empty();

		const lines = text.split("\n");
		let col = -1;
		for (const l of lines) {
			const i = l.indexOf("│");
			if (i >= 0) {
				col = i;
				break;
			}
		}
		if (col < 0) {
			// No ledger gutter (empty transcript or an unexpected format) — show raw.
			body.createEl("pre", { cls: "tx-text", text: text.trim() });
			return;
		}

		type Block = { key: string; name: string; lines: string[] };
		const blocks: Block[] = [];
		let cur: Block | null = null;
		for (const l of lines) {
			if (l[col] !== "│") continue; // Turn boundary — next labelled line opens a block.
			const label = l.slice(0, col).trim();
			const content = l.slice(col + 1).replace(/^ /, "");
			if (label) {
				cur = { ...this.role(label), lines: [content] };
				blocks.push(cur);
			} else if (cur) {
				cur.lines.push(content);
			}
		}

		for (const b of blocks) {
			while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop();
			while (b.lines.length && !b.lines[0].trim()) b.lines.shift();
			if (!b.lines.length) continue;
			const msg = body.createDiv({ cls: "tx-msg" });
			msg.dataset.role = b.key;
			msg.createDiv({ cls: "tx-role", text: b.name });
			msg.createEl("pre", { cls: "tx-text", text: b.lines.join("\n") });
		}
	}

	/** Map a ledger label to a style key + display name. */
	private role(label: string): { key: string; name: string } {
		if (label === "You") return { key: "user", name: "You" };
		if (label === "Claude") return { key: "claude", name: "Claude" };
		if (label.startsWith("↳") || label === "Result") return { key: "result", name: "Result" };
		return { key: "meta", name: label };
	}

	/** Reflect the active toggle on its button. */
	private syncToggleState(): void {
		this.toolsBtn?.toggleClass("is-active", this.showTools);
	}
}

export default class AgenticOSPlugin extends Plugin {
	settings: AgenticOSSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.injectFonts();

		addIcon(AGENTIC_OS_ICON_ID, AGENTIC_OS_ICON_SVG);

		this.registerView(VIEW_TYPE_AGENTIC_OS, (leaf) => new AgenticOSView(leaf, this));
		this.registerView(VIEW_TYPE_REPO_BROWSER, (leaf) => new RepoBrowserView(leaf));
		this.registerView(VIEW_TYPE_SESSION_TRANSCRIPT, (leaf) => new SessionTranscriptView(leaf));

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

	/** Force-reload this plugin through Obsidian's plugin manager. This intentionally
	 *  avoids Hot Reload's scan command because scans only reload after a changed
	 *  `main.js`/`styles.css` mtime is detected; the header button should be a
	 *  dependable manual reload. */
	reloadSelf(): void {
		const plugins = (this.app as any).plugins;
		const id = this.manifest.id;
		if (!plugins?.disablePlugin || !plugins?.enablePlugin || !plugins?.enabledPlugins?.has(id)) {
			new Notice("Agentic OS reload is unavailable in this Obsidian session.");
			return;
		}

		new Notice("Reloading Agentic OS…");
		window.setTimeout(() => {
			void (async () => {
				try {
					await plugins.disablePlugin(id);
					await plugins.enablePlugin(id);
					new Notice("Agentic OS reloaded.");
				} catch (err) {
					console.error("Agentic OS reload failed", err);
					new Notice("Agentic OS reload failed. Check the developer console.");
				}
			})();
		}, 0);
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

	/** Re-read the full sessions list in every open view — used after the merge-folders
	 *  setting changes. No-op in views not currently on the sessions screen. */
	repaintFolderSessions(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS)) {
			const view = leaf.view;
			if (view instanceof AgenticOSView) void view.refreshFolderSessions();
		}
	}

	/** Re-fetch the Release Radar in every open view — used after the account checklist
	 *  changes. No-op in views that haven't loaded the radar yet. */
	repaintRadar(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS)) {
			const view = leaf.view;
			if (view instanceof AgenticOSView) void view.refreshRadar();
		}
	}
}

/** A checklist of detected Claude Code project folders, for building the "merge
 *  session folders" group without typing paths. Returns the chosen folders' real
 *  cwd paths via onSave. */
class FolderPickerModal extends Modal {
	constructor(
		app: App,
		private folders: ProjectFolder[],
		private selected: Set<string>,
		private onSave: (paths: string[]) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Merge session folders" });
		contentEl.createEl("p", {
			text: "Select the folders that are really the same project. They'll be shown as one history in the sessions list.",
			cls: "setting-item-description",
		});

		const checks = new Map<string, HTMLInputElement>();
		const list = contentEl.createDiv();
		list.style.maxHeight = "50vh";
		list.style.overflowY = "auto";
		list.style.margin = "12px 0";

		if (!this.folders.length) {
			list.createEl("p", { text: "No Claude Code project folders found.", cls: "setting-item-description" });
		}

		for (const f of this.folders) {
			const row = list.createEl("label");
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.gap = "10px";
			row.style.padding = "6px 4px";
			row.style.cursor = "pointer";

			const cb = row.createEl("input", { attr: { type: "checkbox" } });
			cb.checked = this.selected.has(f.dir);
			checks.set(f.dir, cb);

			const text = row.createDiv();
			text.createDiv({ text: f.cwd });
			const meta = text.createDiv({
				text: `${f.sessions} ${f.sessions === 1 ? "session" : "sessions"} · ${formatSessionAge(Date.now() - f.lastTs)}`,
				cls: "setting-item-description",
			});
			meta.style.fontSize = "11px";
		}

		const footer = contentEl.createDiv();
		footer.style.display = "flex";
		footer.style.justifyContent = "flex-end";
		footer.style.gap = "8px";
		footer.style.marginTop = "12px";

		footer.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = footer.createEl("button", { text: "Save", cls: "mod-cta" });
		save.onclick = () => {
			const paths = this.folders.filter((f) => checks.get(f.dir)?.checked).map((f) => f.cwd);
			this.onSave(paths);
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
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

		// Release Radar account checklist — discovered from `gh auth status` (async), one
		// toggle per authed account. Default on; toggling off records the account in
		// radarExcludedAccounts so newly-added accounts always start included.
		new Setting(containerEl).setName("Release Radar accounts").setHeading();
		const radarHost = containerEl.createDiv();
		radarHost.createDiv({
			cls: "setting-item-description",
			text: "Which authed GitHub accounts the radar scans for dependency updates. All on by default.",
		});
		void (async () => {
			const accounts = await discoverGhAccounts();
			if (!accounts.length) {
				radarHost.createDiv({
					cls: "setting-item-description",
					text: "No gh accounts found — run `gh auth login`.",
				});
				return;
			}
			for (const acct of accounts) {
				new Setting(radarHost).setName(acct).addToggle((t) =>
					t.setValue(!this.plugin.settings.radarExcludedAccounts.includes(acct)).onChange(async (on) => {
						const cur = new Set(this.plugin.settings.radarExcludedAccounts);
						if (on) cur.delete(acct);
						else cur.add(acct);
						this.plugin.settings.radarExcludedAccounts = [...cur];
						await this.plugin.saveSettings();
						this.plugin.repaintRadar();
					}),
				);
			}
		})();

		const mergeSetting = new Setting(containerEl)
			.setName("Merge session folders")
			.setDesc(
				"Treat folders that are really the same project — e.g. after moving or renaming it — as one history in the full sessions list. Pick them with the button, or edit the paths below (one per line; blank line separates unrelated projects). Empty = every folder on its own.",
			);

		// Full-width textarea below the row for manual edits / multiple groups; the
		// picker button writes into it. Created after the Setting so it lands beneath.
		const ta = containerEl.createEl("textarea");
		ta.value = this.plugin.settings.sessionFolderGroups;
		ta.placeholder = "/Users/you/old-location/my-project\n/Users/you/new-location/my-project";
		ta.rows = 4;
		ta.style.width = "100%";
		ta.style.fontFamily = "var(--font-monospace)";
		ta.style.fontSize = "12px";
		ta.style.marginBottom = "var(--size-4-4)";
		ta.addEventListener("input", async () => {
			this.plugin.settings.sessionFolderGroups = ta.value;
			await this.plugin.saveSettings();
			this.plugin.repaintFolderSessions();
		});

		mergeSetting.addButton((btn) =>
			btn.setButtonText("Choose folders…").onClick(async () => {
				const folders = await listProjectFolders();
				const selected = new Set(parseFolderGroups(ta.value).flat());
				new FolderPickerModal(this.app, folders, selected, (paths) => {
					ta.value = paths.join("\n");
					ta.dispatchEvent(new Event("input")); // reuse the save+repaint handler
				}).open();
			}),
		);

		new Setting(containerEl)
			.setName("Quick actions")
			.setDesc(
				"Wire the dashboard Quick Action buttons to commands (e.g. Shell Commands). One " +
					"'Button Label = command-id' per line; the label must match the button text exactly. " +
					"Labels: Plan Today, Plan Tomorrow, Morning Brief, Inbox Brief, Deep Research…, " +
					"Atomize…, Reading Pipeline, Weekly Review, Vault Cleanup, Pull Metrics.",
			);

		// Full-width textarea below the row, matching the merge-folders editor above.
		const qa = containerEl.createEl("textarea");
		qa.value = this.plugin.settings.quickActions;
		qa.placeholder = "Plan Today = obsidian-shellcommands:shell-command-2h6af961p2";
		qa.rows = 6;
		qa.style.width = "100%";
		qa.style.fontFamily = "var(--font-monospace)";
		qa.style.fontSize = "12px";
		qa.style.marginBottom = "var(--size-4-4)";
		qa.addEventListener("input", async () => {
			this.plugin.settings.quickActions = qa.value;
			await this.plugin.saveSettings();
		});
	}
}
