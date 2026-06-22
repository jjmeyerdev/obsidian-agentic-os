// Source of truth for the Overview "Activity Feed" panel.
//
// The agentic slash commands (/morning-brief first; others over time) append one JSON
// line per run to a vault-root, append-only log at .agentic-os/runs.jsonl. This reads the
// tail of that log into typed rows — newest first — so the feed mirrors recent agentic
// work in the mockup's shape (a category badge, a one-line message, a relative time).
// JSONL, not daily-note frontmatter, because this is an unbounded cross-day stream rather
// than "today's" one-per-day data. Desktop-only (Node fs), like usage.ts/session.ts.
import { promises as fs } from "fs";
import { join } from "path";

export interface ActivityRun {
	/** Epoch ms of the run (parsed from the entry's ISO `ts`). */
	ts: number;
	/** Run category → the badge text (e.g. "plan", "research", "brief"). Free-form. */
	type: string;
	/** One-line human description of what the run did → the row message. */
	msg: string;
}

/** The run-log path relative to the vault root. A dotfolder so it stays out of the way in
 *  Obsidian's file explorer; read here via Node fs regardless of that visibility. */
const RUNLOG_PATH = (vaultBase: string): string => join(vaultBase, ".agentic-os", "runs.jsonl");

/** Read the most recent agentic runs from the vault-root run-log, newest-first.
 *  Returns at most `limit` rows. Degrades to [] on a missing file or any read/parse error —
 *  a malformed or partially-written tail line is skipped, never thrown. */
export async function readActivity(vaultBase: string, limit: number): Promise<ActivityRun[]> {
	let text: string;
	try {
		text = await fs.readFile(RUNLOG_PATH(vaultBase), "utf8");
	} catch {
		return []; // No log yet (no run has been recorded) → empty feed.
	}

	const runs: ActivityRun[] = [];
	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		let rec: any;
		try {
			rec = JSON.parse(line);
		} catch {
			continue; // Partial/garbage line (e.g. an interrupted append) — skip.
		}
		if (typeof rec.type !== "string" || typeof rec.msg !== "string" || typeof rec.ts !== "string") continue;
		const ts = Date.parse(rec.ts);
		if (Number.isNaN(ts)) continue;
		runs.push({ ts, type: rec.type, msg: rec.msg });
	}

	runs.sort((a, b) => b.ts - a.ts);
	return runs.slice(0, limit);
}
