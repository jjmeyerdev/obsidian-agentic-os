// Source of truth for the Overview tab's "Latest Session" card.
//
// Claude Code writes one JSONL transcript per session under ~/.claude/projects/
// <encoded-cwd>/<session-id>.jsonl, appending a record per turn. We surface the most
// recent session you are *not* currently sitting in — the one you last finished — so
// the card answers "what was I working on?" rather than mirroring the live window
// (which you already know). A session is "live" when a Claude Code process has it
// open, recorded in ~/.claude/sessions/<pid>.json; those are skipped. The card's
// figures are derived directly from the transcript records — no stored history.
// Desktop-only (Node fs/os), like usage.ts.
import { promises as fs } from "fs";
import { homedir } from "os";
import { basename, dirname, join } from "path";

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
const SESSIONS_DIR = (home: string): string => join(home, ".claude", "sessions");

/** sessionIds with a Claude Code process currently holding them open. Each live
 *  interactive process writes ~/.claude/sessions/<pid>.json carrying its sessionId;
 *  the file outlives a crash, so we confirm the pid is still alive (signal 0 throws
 *  if it isn't) before trusting it — a stale entry would otherwise hide a finished
 *  session forever. */
async function liveSessionIds(home: string): Promise<Set<string>> {
	const ids = new Set<string>();
	let entries;
	try {
		entries = await fs.readdir(SESSIONS_DIR(home), { withFileTypes: true });
	} catch {
		return ids; // No sessions dir → nothing is open.
	}
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		let rec: any;
		try {
			rec = JSON.parse(await fs.readFile(join(SESSIONS_DIR(home), entry.name), "utf8"));
		} catch {
			continue;
		}
		if (typeof rec.sessionId !== "string" || typeof rec.pid !== "number") continue;
		try {
			process.kill(rec.pid, 0); // Probe only — throws ESRCH if the process is gone.
		} catch {
			continue; // Stale file from a crashed session.
		}
		ids.add(rec.sessionId);
	}
	return ids;
}

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

/** The transcript whose figures the card shows: the most recent *finished* session
 *  across all projects (newest-first, holding actual turns, not open in a live
 *  window). If every session with content is live (e.g. only the window you're in
 *  exists), falls back to the newest of those so nothing is ever blank. Returns the
 *  path alongside the parsed session — the path's directory is the session's folder,
 *  which the full sessions list anchors on. */
async function latestFinished(home: string): Promise<{ path: string; session: LatestSession } | null> {
	const live = await liveSessionIds(home);
	let liveFallback: { path: string; session: LatestSession } | null = null;

	for (const path of await transcriptsByRecency(PROJECTS_DIR(home))) {
		const session = await parseSession(path);
		if (!session) continue;
		// Transcripts are named <sessionId>.jsonl; skip the ones held open right now.
		if (live.has(basename(path, ".jsonl"))) {
			liveFallback ??= { path, session }; // Newest live, kept as last resort.
			continue;
		}
		return { path, session };
	}
	return liveFallback;
}

/** Read the most recent *finished* Claude Code session across all projects. */
export async function readLatestSession(): Promise<LatestSession> {
	let home: string;
	try {
		home = homedir();
	} catch {
		return EMPTY; // No OS home (mobile) — transcripts unreachable.
	}
	return (await latestFinished(home))?.session ?? EMPTY;
}

/** Every session in the same folder as the card's session, newest-first — backs the
 *  "Full ↗" sessions list. */
export interface FolderSessions {
	/** false when no readable transcript exists (mobile, or none written yet). */
	ok: boolean;
	/** The folder (cwd basename) the sessions belong to, or null. */
	folder: string | null;
	/** Each session in the folder, newest-first. Includes the live one, if any. */
	sessions: LatestSession[];
}

const EMPTY_FOLDER: FolderSessions = { ok: false, folder: null, sessions: [] };

/** List every session sharing a folder with the card's session. The folder is the
 *  one the card's session (the most recent finished one) ran in; its transcripts all
 *  live in a single ~/.claude/projects/<encoded-cwd>/ directory, so we parse every
 *  *.jsonl there. Unlike the card, this includes any live session — it's a full
 *  history, newest-first.
 *
 *  `folderGroups` lets a project that has moved across paths read as one history:
 *  each group is a list of transcript-directory names that are "the same project",
 *  and when the anchor's directory is in a group, every directory in it is unioned
 *  (their transcript files persist under ~/.claude/projects even after the source
 *  folder is renamed or deleted). Empty/absent → the plain single-directory behavior. */
export async function readFolderSessions(folderGroups: string[][] = []): Promise<FolderSessions> {
	let home: string;
	try {
		home = homedir();
	} catch {
		return EMPTY_FOLDER;
	}

	const anchor = await latestFinished(home);
	if (!anchor) return EMPTY_FOLDER;

	const anchorDir = dirname(anchor.path);
	const group = folderGroups.find((g) => g.includes(basename(anchorDir)));
	const dirs = group ? group.map((name) => join(PROJECTS_DIR(home), name)) : [anchorDir];

	const sessions: LatestSession[] = [];
	for (const dir of dirs) {
		// A group may name a directory that no longer exists; transcriptsByRecency
		// returns [] for an unreadable dir, so missing folders are skipped silently.
		for (const path of await transcriptsByRecency(dir)) {
			const session = await parseSession(path);
			if (session) sessions.push(session);
		}
	}
	return { ok: sessions.length > 0, folder: anchor.session.cwd, sessions };
}

/** One Claude Code project directory, for the folder-merge picker. */
export interface ProjectFolder {
	/** Directory name under ~/.claude/projects (the encoded cwd). */
	dir: string;
	/** Real working-directory path it represents, read from a transcript (the source
	 *  folder may since have moved/been deleted, but the recorded path persists). */
	cwd: string;
	/** Number of transcripts in the folder. */
	sessions: number;
	/** Newest transcript's mtime (epoch ms), for sorting + an "age" hint. */
	lastTs: number;
}

/** Read the first `cwd` value out of a transcript without parsing the whole file —
 *  it appears on early records, so a head read of the file suffices. */
async function firstCwd(file: string): Promise<string | null> {
	let fh;
	try {
		fh = await fs.open(file, "r");
	} catch {
		return null;
	}
	try {
		const buf = Buffer.alloc(65536);
		const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
		for (const line of buf.toString("utf8", 0, bytesRead).split("\n")) {
			if (!line) continue;
			try {
				const rec = JSON.parse(line);
				if (typeof rec.cwd === "string") return rec.cwd;
			} catch {
				// Partial/truncated line at the read boundary — skip.
			}
		}
		return null;
	} finally {
		await fh.close();
	}
}

/** Enumerate every project directory under ~/.claude/projects that holds at least one
 *  transcript, newest-first. Backs the settings folder picker. */
export async function listProjectFolders(): Promise<ProjectFolder[]> {
	let home: string;
	try {
		home = homedir();
	} catch {
		return [];
	}

	const base = PROJECTS_DIR(home);
	let entries;
	try {
		entries = await fs.readdir(base, { withFileTypes: true });
	} catch {
		return [];
	}

	const folders: ProjectFolder[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const files = await transcriptsByRecency(join(base, entry.name));
		if (!files.length) continue;
		let lastTs = 0;
		try {
			lastTs = (await fs.stat(files[0])).mtimeMs;
		} catch {
			// Vanished between listing and stat — fall back to 0.
		}
		folders.push({
			dir: entry.name,
			cwd: (await firstCwd(files[0])) ?? entry.name,
			sessions: files.length,
			lastTs,
		});
	}
	return folders.sort((a, b) => b.lastTs - a.lastTs);
}
