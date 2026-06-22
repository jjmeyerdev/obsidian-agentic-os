// Source of truth for the Morning Brief panels (dashboard card + the full Morning Brief
// view). Like dayplan.ts, the data lives inside the vault — today's daily note
// frontmatter, under a `brief:` key written by the `/morning-brief` slash command — so it
// reads through Obsidian's metadata cache. Read-only here: the command generates the
// brief; this module only paints it. v1 covers Headlines, Reading Queue and Note
// Opportunities; 𝕏 Conversation is a deferred slice (no `x:` key is read yet).
import { App, TFile } from "obsidian";
import { todayDailyNotePath } from "./dayplan";

export interface Headline {
	text: string;
	/** Source domain, optional; surfaced in the full view. */
	src: string;
}

export interface ReadingItem {
	title: string;
	src: string;
	/** Free-text meta, e.g. "14 min read" / "saved 2d ago" / "in progress". */
	meta: string;
}

export interface Brief {
	/** true when today's daily note exists and was read. */
	ok: boolean;
	/** true when a `brief:` key is present — distinguishes "run the brief" (no key) from
	 *  a section that's simply empty (key present, section empty). */
	has: boolean;
	/** Timestamp the command stamped (e.g. "2026-06-21T07:32"), or "". */
	generated: string;
	headlines: Headline[];
	reading: ReadingItem[];
	notes: string[];
}

const EMPTY: Brief = { ok: false, has: false, generated: "", headlines: [], reading: [], notes: [] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function coerceHeadlines(raw: unknown): Headline[] {
	if (!Array.isArray(raw)) return [];
	const out: Headline[] = [];
	for (const r of raw) {
		// Accept a bare string or a { text, src } object.
		if (typeof r === "string") {
			if (r) out.push({ text: r, src: "" });
			continue;
		}
		if (!r || typeof r !== "object") continue;
		const text = str((r as any).text);
		if (text) out.push({ text, src: str((r as any).src) });
	}
	return out;
}

function coerceReading(raw: unknown): ReadingItem[] {
	if (!Array.isArray(raw)) return [];
	const out: ReadingItem[] = [];
	for (const r of raw) {
		if (!r || typeof r !== "object") continue;
		const title = str((r as any).title);
		if (!title) continue;
		out.push({ title, src: str((r as any).src), meta: str((r as any).meta) });
	}
	return out;
}

function coerceNotes(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter((r): r is string => typeof r === "string" && r.length > 0);
}

/** Read today's daily-note `brief:` into the dashboard's shape. Missing note → not ok;
 *  note present but no `brief:` key → ok but not `has`. Never throws. Synchronous (the
 *  metadata cache is in-memory), so callers need no stale-paint guard. */
export function readBrief(app: App): Brief {
	const path = todayDailyNotePath(app);
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return EMPTY;
	const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	const b = fm.brief;
	if (!b || typeof b !== "object") return { ...EMPTY, ok: true };
	return {
		ok: true,
		has: true,
		generated: str((b as any).generated),
		headlines: coerceHeadlines((b as any).headlines),
		reading: coerceReading((b as any).reading),
		notes: coerceNotes((b as any).notes),
	};
}
