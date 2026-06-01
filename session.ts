// Source of truth for the Overview tab's "Latest Session" card.
//
// Claude Code writes one JSONL transcript per session under ~/.claude/projects/
// <encoded-cwd>/<session-id>.jsonl, appending a record per turn. The newest file
// by mtime is the most recent (or still-active) session. We read it and derive the
// card's figures directly from the records — no stored history. Desktop-only
// (Node fs/os), like usage.ts.
import { promises as fs } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

export interface LatestSession {
	/** false when no readable transcript exists (mobile, or none written yet). */
	ok: boolean;
	/** AI-generated session title, else the opening prompt — null if neither. */
	title: string | null;
	/** Epoch ms of the last recorded turn — drives the "Nh old" age line. */
	lastTs: number | null;
	/** Visible conversation turns: your prompts + Claude's text replies. Tool-result
	 *  plumbing and silent tool-use steps are excluded (the latter is the tool-call
	 *  stat), so messages / tokens / tool calls stay orthogonal. */
	messages: number;
	/** Raw tokens across the session (input + output + cache create + cache read). */
	tokens: number;
	/** tool_use blocks across all assistant turns. */
	toolCalls: number;
	/** Model, trimmed for the badge ("claude-opus-4-8" → "opus-4.8"). */
	model: string | null;
	/** Git branch the session ran on, or null if not in a repo. */
	branch: string | null;
	/** Working directory basename (the repo/folder name), or null. */
	cwd: string | null;
}

const EMPTY: LatestSession = {
	ok: false,
	title: null,
	lastTs: null,
	messages: 0,
	tokens: 0,
	toolCalls: 0,
	model: null,
	branch: null,
	cwd: null,
};

const PROJECTS_DIR = (home: string): string => join(home, ".claude", "projects");

/** "claude-opus-4-8" → "opus-4.8"; "claude-sonnet-4-6" → "sonnet-4.6". Strips the
 *  "claude-" prefix and any "[…]" suffix, keeps the family, and joins the short
 *  version segments with dots (dropping long trailing date stamps like 20251001). */
function trimModel(id: string): string {
	const clean = id.replace(/\[.*$/, "").replace(/^claude-/, "");
	const parts = clean.split("-");
	const family = parts.shift() ?? clean;
	const version = parts.filter((p) => /^\d{1,2}$/.test(p)).join(".");
	return version ? `${family}-${version}` : family;
}

/** Newest-first list of every *.jsonl transcript path under dir, by mtime. */
async function transcriptsByRecency(dir: string): Promise<string[]> {
	const found: Array<{ path: string; mtime: number }> = [];

	async function walk(d: string): Promise<void> {
		let entries;
		try {
			entries = await fs.readdir(d, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = join(d, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
				try {
					found.push({ path: full, mtime: (await fs.stat(full)).mtimeMs });
				} catch {
					// Vanished between readdir and stat — ignore.
				}
			}
		}
	}

	await walk(dir);
	return found.sort((a, b) => b.mtime - a.mtime).map((f) => f.path);
}

/** Parse one transcript into the card's figures, or null if it holds no turns. */
async function parseSession(file: string): Promise<LatestSession | null> {
	let text: string;
	try {
		text = await fs.readFile(file, "utf8");
	} catch {
		return null;
	}

	let messages = 0;
	let tokens = 0;
	let toolCalls = 0;
	let lastTs: number | null = null;
	let model: string | null = null;
	let branch: string | null = null;
	let cwd: string | null = null;
	let aiTitle: string | null = null;
	let lastPrompt: string | null = null;
	let firstUserText: string | null = null;

	for (const line of text.split("\n")) {
		if (!line) continue;
		let rec: any;
		try {
			rec = JSON.parse(line);
		} catch {
			continue;
		}

		// Title sources, in preference order (aiTitle > lastPrompt > first user text).
		if (rec.type === "ai-title" && typeof rec.aiTitle === "string") aiTitle = rec.aiTitle;
		if (rec.type === "last-prompt" && typeof rec.lastPrompt === "string") lastPrompt = rec.lastPrompt;

		if (typeof rec.cwd === "string") cwd = rec.cwd;
		if (typeof rec.gitBranch === "string" && rec.gitBranch) branch = rec.gitBranch;

		const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
		if (!Number.isNaN(ts)) lastTs = lastTs === null ? ts : Math.max(lastTs, ts);

		const msg = rec.message;
		if (!msg || (msg.role !== "user" && msg.role !== "assistant")) continue;

		// Tokens cover *all* turns (the true cost), independent of what counts as a
		// "message" below.
		const u = msg.usage;
		if (u) {
			tokens +=
				(u.input_tokens || 0) +
				(u.output_tokens || 0) +
				(u.cache_creation_input_tokens || 0) +
				(u.cache_read_input_tokens || 0);
		}

		const content = msg.content;
		if (msg.role === "assistant") {
			if (typeof msg.model === "string") model = msg.model;
			let hasText = typeof content === "string" && content.trim().length > 0;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (block?.type === "tool_use") toolCalls++;
					else if (block?.type === "text") hasText = true;
				}
			}
			// A reply counts only when Claude actually says something — pure tool_use
			// steps are agentic work, surfaced in the tool-call stat instead.
			if (hasText) messages++;
		} else {
			// A user turn carrying only tool_result blocks is harness plumbing handing
			// tool output back, not a message; real prompts (text/string) count.
			const toolResultOnly =
				Array.isArray(content) && content.length > 0 && content.every((b: any) => b?.type === "tool_result");
			if (!toolResultOnly) messages++;

			if (firstUserText === null) {
				if (typeof content === "string") firstUserText = content;
				else if (Array.isArray(content)) {
					const t = content.find((b: any) => b?.type === "text");
					if (t) firstUserText = t.text;
				}
			}
		}
	}

	if (messages === 0) return null;

	const title = aiTitle ?? lastPrompt ?? firstUserText;
	return {
		ok: true,
		title: title ? title.trim() : null,
		lastTs,
		messages,
		tokens,
		toolCalls,
		model: model ? trimModel(model) : null,
		branch,
		cwd: cwd ? basename(cwd) : null,
	};
}

/** Read the most recent Claude Code session across all projects. Scans transcripts
 *  newest-first and returns the first one holding actual turns. */
export async function readLatestSession(): Promise<LatestSession> {
	let home: string;
	try {
		home = homedir();
	} catch {
		return EMPTY; // No OS home (mobile) — transcripts unreachable.
	}

	for (const path of await transcriptsByRecency(PROJECTS_DIR(home))) {
		const session = await parseSession(path);
		if (session) return session;
	}
	return EMPTY;
}
