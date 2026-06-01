import { addIcon, App, ItemView, normalizePath, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import {
	DASHBOARD_MARKUP,
	FULL_RADAR_MARKUP,
	FULL_HN_MARKUP,
	FULL_BRIEF_MARKUP,
} from "./markup";
import { readUsage, RateWindow, Usage } from "./usage";

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
}

const DEFAULT_SETTINGS: AgenticOSSettings = {
	openOnStartup: false,
	window: "five_hour",
	calibration: { five_hour: [], seven_day: [] },
};

/** Token Burn background refresh cadence — the steady "Live" heartbeat. Focus
 *  events repaint on demand, so this only has to keep an idle pane current. */
const TOKEN_BURN_INTERVAL_MS = 60_000;

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

		// Steady background heartbeat (auto-cleared on view unload)...
		this.registerInterval(
			window.setInterval(() => void this.refreshTokenBurn(), TOKEN_BURN_INTERVAL_MS),
		);
		// ...plus an instant repaint whenever this pane becomes the active leaf.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) void this.refreshTokenBurn();
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
	}
}
