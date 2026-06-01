// Source of truth for the Token Burn panel.
//
// The authoritative 5h rate-limit percentage is NOT reconstructable from local
// token sums — it comes from Anthropic's server-side rate-limit headers, which
// Claude Code surfaces to the statusline. The user's statusline script mirrors
// that payload to ~/.claude/usage-snapshot.json expressly for this dashboard.
//
// So: the percentage and reset boundary come from that snapshot (exact). The
// absolute token figure ("≈5.67M") is an *estimate* — a weighted sum of the
// local transcripts over the snapshot's actual window — used only to ballpark
// how many tokens the percentage represents. Desktop-only (Node fs/os).
import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";

/** Which rate-limit the panel tracks — both are reported in the snapshot. */
export type RateWindow = "five_hour" | "seven_day";

export interface Usage {
	/** false when the snapshot is unreachable (mobile, statusline never ran). */
	ok: boolean;
	/** Authoritative five_hour.used_percentage (0–100), or null if absent. */
	pct: number | null;
	/** Epoch seconds when the 5h window resets, or null. */
	resetsAt: number | null;
	/** Epoch seconds the snapshot was written (drives "last pull" + alignment). */
	snapshotTs: number | null;
	/** Weighted local tokens in the snapshot's window — the ballpark numerator. */
	measuredTokens: number;
}

/** Cache reads dominate raw counts (~90%+) but are metered/priced at a tenth of
 *  a fresh token, so they're weighted to match. This weighting only affects the
 *  estimated token figures; the displayed percentage is always the snapshot's. */
const CACHE_READ_WEIGHT = 0.1;

const SNAPSHOT_PATH = (home: string): string => join(home, ".claude", "usage-snapshot.json");
const PROJECTS_DIR = (home: string): string => join(home, ".claude", "projects");

function messageTokens(usage: Record<string, unknown>): number {
	const n = (k: string): number => {
		const v = usage[k];
		return typeof v === "number" ? v : 0;
	};
	return (
		n("input_tokens") +
		n("output_tokens") +
		n("cache_creation_input_tokens") +
		n("cache_read_input_tokens") * CACHE_READ_WEIGHT
	);
}

/** Recursively collect *.jsonl paths under dir whose mtime is at or after `since`
 *  — a file untouched during the window can't hold in-window messages. */
async function recentTranscripts(dir: string, since: number): Promise<string[]> {
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const out: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await recentTranscripts(full, since)));
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			try {
				if ((await fs.stat(full)).mtimeMs >= since) out.push(full);
			} catch {
				// Vanished between readdir and stat — ignore.
			}
		}
	}
	return out;
}

/** Sum weighted tokens from messages whose timestamp falls in [start, end] ms. */
async function tokensInWindow(home: string, start: number, end: number): Promise<number> {
	let total = 0;
	for (const file of await recentTranscripts(PROJECTS_DIR(home), start)) {
		let text: string;
		try {
			text = await fs.readFile(file, "utf8");
		} catch {
			continue;
		}
		for (const line of text.split("\n")) {
			if (!line) continue;
			let rec: any;
			try {
				rec = JSON.parse(line);
			} catch {
				continue;
			}
			const usage = rec?.message?.usage;
			const ts = rec?.timestamp ? Date.parse(rec.timestamp) : NaN;
			if (!usage || Number.isNaN(ts) || ts < start || ts > end) continue;
			total += messageTokens(usage);
		}
	}
	return total;
}

export async function readUsage(window: RateWindow, windowHours: number): Promise<Usage> {
	const empty: Usage = { ok: false, pct: null, resetsAt: null, snapshotTs: null, measuredTokens: 0 };

	let home: string;
	try {
		home = homedir();
	} catch {
		return empty; // No OS home (mobile) — snapshot unreachable.
	}

	let snap: any;
	try {
		snap = JSON.parse(await fs.readFile(SNAPSHOT_PATH(home), "utf8"));
	} catch {
		return empty; // Statusline never wrote a snapshot yet.
	}

	const limit = snap?.rate_limits?.[window];
	const pct = typeof limit?.used_percentage === "number" ? limit.used_percentage : null;
	const resetsAt = typeof limit?.resets_at === "number" ? limit.resets_at : null;
	const snapshotTs = typeof snap?.ts === "number" ? snap.ts : null;

	// Align the token sum to the exact window the percentage describes:
	// [reset − windowHours, snapshot capture]. Without both boundaries we can't
	// align, so the token estimate is skipped (percentage still shows).
	let measuredTokens = 0;
	if (resetsAt !== null && snapshotTs !== null) {
		const start = (resetsAt - windowHours * 3600) * 1000;
		const end = snapshotTs * 1000;
		measuredTokens = await tokensInWindow(home, start, end);
	}

	return { ok: true, pct, resetsAt, snapshotTs, measuredTokens };
}
