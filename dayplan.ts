// Source of truth for the Overview tab's Schedule + Daily Tasks panels.
//
// Unlike usage.ts / github.ts / session.ts (pure Node, reading machine-global files),
// this data lives *inside the vault* — today's daily note frontmatter — so it reads
// through Obsidian's metadata cache and writes back through the FileManager. The
// `plan-today` slash command populates the frontmatter; this module only reads it and
// toggles task `done` state. Schedule is read-only here (it's a calendar snapshot the
// command writes); tasks are interactive.
import { App, TFile, moment } from "obsidian";

export interface ScheduleItem {
	/** 24h "HH:MM", or "" for an all-day event (sorts last). */
	time: string;
	label: string;
}

export interface TaskItem {
	label: string;
	done: boolean;
	/** Rolled over from a previous day's unfinished task — renders the "carryover" tag. */
	carryover: boolean;
}

export interface DayPlan {
	/** true when today's daily note exists and was read (even if its keys are empty). */
	ok: boolean;
	/** The note backing the plan, for task write-back — null when it doesn't exist yet. */
	file: TFile | null;
	schedule: ScheduleItem[];
	/** Index-aligned with the note's `tasks:` frontmatter array, so a rendered row's
	 *  index is a valid write-back target. */
	tasks: TaskItem[];
}

const EMPTY: DayPlan = { ok: false, file: null, schedule: [], tasks: [] };

/** Today's daily-note path, honoring the core Daily Notes plugin config (folder +
 *  moment date format), falling back to `daily-notes/YYYY-MM-DD.md`. */
export function todayDailyNotePath(app: App): string {
	const opts = (app as any).internalPlugins?.getPluginById?.("daily-notes")?.instance?.options ?? {};
	const folder = String(opts.folder ?? "").trim();
	const format = String(opts.format ?? "").trim() || "YYYY-MM-DD";
	const name = `${moment().format(format)}.md`;
	return folder ? `${folder}/${name}` : name;
}

function coerceSchedule(raw: unknown): ScheduleItem[] {
	if (!Array.isArray(raw)) return [];
	const items: ScheduleItem[] = [];
	for (const r of raw) {
		if (!r || typeof r !== "object") continue;
		const label = typeof (r as any).label === "string" ? (r as any).label : "";
		if (!label) continue;
		const time = typeof (r as any).time === "string" ? (r as any).time : "";
		items.push({ time, label });
	}
	// Zero-padded 24h sorts lexically; blank times ("") fall to the end.
	return items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

function coerceTasks(raw: unknown): TaskItem[] {
	if (!Array.isArray(raw)) return [];
	// Map every element 1:1 so a row's index matches the frontmatter index for write-back.
	return raw.map((r) => {
		const obj = r && typeof r === "object" ? (r as any) : {};
		return {
			label: typeof obj.label === "string" ? obj.label : "",
			done: obj.done === true,
			carryover: obj.carryover === true,
		};
	});
}

/** Read today's daily-note frontmatter into the dashboard's shape. Missing note or
 *  missing keys → an empty plan; never throws. Synchronous (the metadata cache is
 *  in-memory), so callers need no stale-paint guard. */
export function readDayPlan(app: App): DayPlan {
	const path = todayDailyNotePath(app);
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return EMPTY;
	const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	return { ok: true, file, schedule: coerceSchedule(fm.schedule), tasks: coerceTasks(fm.tasks) };
}

/** Flip one task's `done` in the note frontmatter (index into the `tasks` array as
 *  read). Safe no-op if the index no longer points at a task object. */
export async function setTaskDone(app: App, file: TFile, index: number, done: boolean): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (Array.isArray(fm.tasks) && fm.tasks[index] && typeof fm.tasks[index] === "object") {
			fm.tasks[index].done = done;
		}
	});
}

/** Append a blank task to the note frontmatter; the caller opens the note so the user
 *  can name it. */
export async function addTask(app: App, file: TFile): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (!Array.isArray(fm.tasks)) fm.tasks = [];
		fm.tasks.push({ label: "New task", done: false });
	});
}
