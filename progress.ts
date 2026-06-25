// Source for the Quick Action live-progress affordance.
//
// Each Quick Action command (morning-brief, plan-today, …) writes a "living note" to the
// vault's `dashboard-runs/` folder and rewrites it after every step: YAML frontmatter
// (action/status/step/updated) plus a markdown checklist it ticks off. This module reads the
// newest note for a given action and watches the folder so the dashboard can reflect a run
// as it happens. Desktop-only (Node fs), like usage.ts/activity.ts.
import { promises as fs, watch, mkdirSync } from "fs";
import { join } from "path";

/** The vault-relative folder the commands write run notes into (visible, browsable). */
export const RUNS_DIR = "dashboard-runs";

/** Debounce for folder-watch repaints — a single rewrite can emit several fs events. */
const RUNS_DEBOUNCE_MS = 150;

export interface RunProgress {
	/** Frontmatter `action` — matches the Quick Action button label exactly. */
	action: string;
	/** Frontmatter `status`; anything other than done/failed is treated as running. */
	status: "running" | "done" | "failed";
	/** 1-based current step, or null if the note omits it. */
	step: number | null;
	/** Total steps, or null if omitted. */
	stepsTotal: number | null;
	/** Human text of the current step (the ⏳/first-unchecked line), or "Done"/a failure note. */
	current: string;
	/** `started` parsed to epoch ms (NaN if absent/unparseable). Local time, minute-granular. */
	startedMs: number;
	/** `updated` parsed to epoch ms (NaN if absent). Bumps every step → drives staleness. */
	updatedMs: number;
}

/** Strip a checklist line down to its text: drop the `- [ ]`/`- [x]` marker and any ⏳. */
function stepText(line: string): string {
	return line.replace(/^\s*-\s*\[[ xX]\]\s*/, "").replace(/⏳/g, "").trim();
}

/** Parse one run note's text into RunProgress, or null if it isn't a well-formed run note. */
function parseRun(text: string): RunProgress | null {
	const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!fm) return null;
	const [, head, body] = fm;
	const get = (k: string): string => {
		const m = head.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
		return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
	};

	const action = get("action");
	if (!action) return null;
	const raw = get("status");
	const status = raw === "done" ? "done" : raw === "failed" ? "failed" : "running";
	const step = Number(get("step")) || null;
	const stepsTotal = Number(get("steps_total")) || null;
	const startedMs = Date.parse(get("started"));
	const updatedMs = Date.parse(get("updated"));

	let current: string;
	if (status === "done") {
		current = "Done";
	} else {
		const lines = body.split("\n");
		const pick = lines.find((l) => l.includes("⏳")) ?? lines.find((l) => /^\s*-\s*\[ \]/.test(l));
		if (status === "failed") current = pick ? `Failed at: ${stepText(pick)}` : "Failed";
		else current = pick ? stepText(pick) : "Working";
	}

	return { action, status, step, stepsTotal, current, startedMs, updatedMs };
}

/** Read the most recent `dashboard-runs/` note whose `action` matches. Notes are named
 *  `YYYY-MM-DD-HHMM-<slug>.md`, so a reverse lexical sort is newest-first; we return the
 *  first match (usually the freshest file, so few reads). Returns null on a missing folder,
 *  no match, or any read error — never throws. */
export async function readActiveRun(vaultBase: string, action: string): Promise<RunProgress | null> {
	const dir = join(vaultBase, RUNS_DIR);
	let names: string[];
	try {
		names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md"));
	} catch {
		return null;
	}
	names.sort().reverse();
	for (const name of names) {
		let text: string;
		try {
			text = await fs.readFile(join(dir, name), "utf8");
		} catch {
			continue;
		}
		const run = parseRun(text);
		if (run && run.action === action) return run;
	}
	return null;
}

/** Invoke `onChange` (debounced) whenever a `.md` in `dashboard-runs/` is written, so the
 *  dashboard can repaint a run in progress. Ensures the folder exists first (the commands
 *  also create it). Returns a disposer; a no-op disposer if the watch can't be set up. */
export function watchRuns(vaultBase: string, onChange: () => void): () => void {
	const dir = join(vaultBase, RUNS_DIR);
	try {
		mkdirSync(dir, { recursive: true });
	} catch {
		/* if we can't create it, the watch below will simply fail and no-op */
	}

	let timer: ReturnType<typeof setTimeout> | null = null;
	let watcher: ReturnType<typeof watch>;
	try {
		watcher = watch(dir, (_event, filename) => {
			if (filename && !filename.endsWith(".md")) return; // ignore non-note churn
			if (timer) clearTimeout(timer);
			timer = setTimeout(onChange, RUNS_DEBOUNCE_MS);
		});
	} catch {
		return () => {};
	}

	return () => {
		if (timer) clearTimeout(timer);
		watcher.close();
	};
}
