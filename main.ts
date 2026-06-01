import { addIcon, App, ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import {
	DASHBOARD_MARKUP,
	FULL_RADAR_MARKUP,
	FULL_HN_MARKUP,
	FULL_BRIEF_MARKUP,
} from "./markup";

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

interface AgenticOSSettings {
	openOnStartup: boolean;
}

const DEFAULT_SETTINGS: AgenticOSSettings = {
	openOnStartup: false,
};

class AgenticOSView extends ItemView {
	private root: HTMLElement | null = null;
	private state: ViewState = "dashboard";
	/** Which dashboard tab to restore when returning from a full view. */
	private activeTab = "panel-overview";
	/** Per-render listener removers, flushed on every re-render and on close. */
	private cleanups: Array<() => void> = [];

	constructor(leaf: WorkspaceLeaf) {
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
		} else {
			this.wireFullView(this.root);
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

		addIcon(AGENTIC_OS_ICON_ID, AGENTIC_OS_ICON_SVG);

		this.registerView(VIEW_TYPE_AGENTIC_OS, (leaf) => new AgenticOSView(leaf));

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

	/** Open the pane in the right split, or reveal it if it already exists. */
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_OS);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_AGENTIC_OS, active: true });
		await workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
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
	}
}
