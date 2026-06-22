// Source of truth for the Morning Brief's Inbox panel — what's waiting across the
// user's accounts. v1 (Phase 1) covers GitHub notifications across *every* account
// authenticated in `gh`; email (Gmail, per-account OAuth) lands in Phase 2.
//
// Live like github.ts / usage.ts (Node child_process, desktop-only): the plugin
// fetches on a timer and paints into the panel. Nothing is written to disk — by
// design, so private inbox content never reaches the (potentially synced) vault.
import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { requestUrl } from "obsidian";

export type InboxKind = "github" | "email";

export interface InboxItem {
	kind: InboxKind;
	/** The account this came from — a `gh` login (Phase 2: a Gmail address/label). */
	account: string;
	/** Primary line: the PR/issue title (Phase 2: the email subject). */
	title: string;
	/** Secondary line: "owner/repo" (Phase 2: the sender). */
	source: string;
	/** Short badge label — the mapped notification reason (Phase 2: "email"). */
	badge: string;
	/** "PullRequest" | "Issue" | … for github; "" for email. */
	type: string;
	/** Coarse relative age, e.g. "3h" / "2d". */
	meta: string;
	/** Sort key (ms since epoch). */
	ts: number;
}

export interface Inbox {
	/** false when no source could be read at all (e.g. `gh` missing/unauthed). An
	 *  authed user with nothing waiting is `ok: true, items: []`. */
	ok: boolean;
	items: InboxItem[];
}

/** Most items to surface across all accounts, newest first. */
const INBOX_MAX = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** GitHub notification `reason` → a short badge label. Unmapped reasons pass through. */
const REASON_LABEL: Record<string, string> = {
	review_requested: "review",
	mention: "mention",
	team_mention: "team",
	assign: "assigned",
	author: "author",
	comment: "comment",
	state_change: "state",
	ci_activity: "ci",
	security_alert: "security",
	subscribed: "watching",
	manual: "subscribed",
};

/** GUI-launched Obsidian doesn't inherit the shell PATH, so augment it with the
 *  usual Homebrew/usr spots (same as github.ts). With `token`, run as that account. */
function ghEnv(token?: string): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = {
		...process.env,
		PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
	};
	if (token) env.GH_TOKEN = token;
	return env;
}

function runGh(args: string[], token?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"gh",
			args,
			{ env: ghEnv(token), maxBuffer: 16 * 1024 * 1024, timeout: 30_000 },
			(err, stdout) => (err ? reject(err) : resolve(stdout)),
		);
	});
}

/** Logins of every account authenticated in `gh`. Parsed from `gh auth status`
 *  (printed to stdout or stderr depending on version, so read both); empty when gh
 *  is missing or no account is logged in. Zero-config — picks up however many
 *  accounts the user has run `gh auth login` for. */
function ghAccounts(): Promise<string[]> {
	return new Promise((resolve) => {
		execFile(
			"gh",
			["auth", "status"],
			{ env: ghEnv(), timeout: 15_000 },
			(_err, stdout, stderr) => {
				const text = `${stdout ?? ""}\n${stderr ?? ""}`;
				const logins: string[] = [];
				for (const m of text.matchAll(/Logged in to \S+ account (\S+)/g)) {
					if (m[1] && !logins.includes(m[1])) logins.push(m[1]);
				}
				resolve(logins);
			},
		);
	});
}

/** Coarse "2d" / "3h" / "5m" relative age from a millisecond delta. */
function relAge(ms: number): string {
	const s = Math.max(0, ms);
	const d = Math.floor(s / DAY_MS);
	if (d >= 7) return `${Math.floor(d / 7)}w`;
	if (d >= 1) return `${d}d`;
	const h = Math.floor(s / 3_600_000);
	if (h >= 1) return `${h}h`;
	return `${Math.max(1, Math.floor(s / 60_000))}m`;
}

/** Unread GitHub notifications for one account → inbox items. Best-effort: a missing
 *  token or a failed call degrades that account to no items rather than throwing, so
 *  one un-authed account never sinks the others. */
async function githubNotifications(login: string, now: number): Promise<InboxItem[]> {
	let token: string;
	try {
		token = (await runGh(["auth", "token", "--user", login])).trim();
	} catch {
		return [];
	}
	if (!token) return [];

	let out: string;
	try {
		// Default /notifications is unread-only. Project just the fields we paint —
		// keeps the payload (and any content held in memory) minimal. NDJSON out.
		out = await runGh(
			[
				// "?all=true" includes already-read items (user's call), so the panel reads
				// as a recent cross-account activity feed. Drop "?all=true" for unread-only.
				"api", "notifications?all=true",
				"--jq", ".[] | {reason, updated_at, type: .subject.type, title: .subject.title, repo: .repository.full_name}",
			],
			token,
		);
	} catch {
		return [];
	}

	const items: InboxItem[] = [];
	for (const line of out.split("\n")) {
		if (!line.trim()) continue;
		let n: any;
		try {
			n = JSON.parse(line);
		} catch {
			continue;
		}
		const parsed = n.updated_at ? Date.parse(n.updated_at) : NaN;
		const ts = Number.isNaN(parsed) ? 0 : parsed;
		const reason = typeof n.reason === "string" ? n.reason : "";
		items.push({
			kind: "github",
			account: login,
			title: typeof n.title === "string" ? n.title : "",
			source: typeof n.repo === "string" ? n.repo : "",
			badge: REASON_LABEL[reason] ?? reason,
			type: typeof n.type === "string" ? n.type : "",
			meta: ts ? relAge(now - ts) : "",
			ts,
		});
	}
	return items;
}

async function readGithubItems(now: number): Promise<{ ok: boolean; items: InboxItem[] }> {
	const accounts = await ghAccounts();
	if (accounts.length === 0) return { ok: false, items: [] };
	const lists = await Promise.all(accounts.map((login) => githubNotifications(login, now)));
	return { ok: true, items: lists.flat() };
}

// ── Email (Gmail) ─────────────────────────────────────────────────────────────
// Per-account OAuth: a refresh token (minted once by scripts/gmail-auth.mjs, kept in
// ~/.config/agentic-os/gmail.json — outside the vault) is exchanged for a short-lived
// access token, then we list *today's* inbox and read each message's From/Subject. We
// only ever read headers, and nothing is written to disk.

const GMAIL_JSON = process.env.AGENTIC_OS_GMAIL_JSON || path.join(os.homedir(), ".config/agentic-os/gmail.json");
/** Messages pulled per account before the merged list is capped to INBOX_MAX. */
const EMAIL_PER_ACCOUNT = 8;

interface GmailAccount {
	label?: string;
	email?: string;
	client_id?: string;
	client_secret?: string;
	refresh_token?: string;
}

/** Gmail search for the current calendar day's inbox — recomputed each fetch, so it
 *  rolls over at local midnight and older mail drops off. Read + unread, mirroring the
 *  GitHub side. (Drop the `after:` / add `is:unread` to change that.) */
function todayQuery(now: number): string {
	const d = new Date(now);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `in:inbox after:${d.getFullYear()}/${m}/${day}`;
}

/** "Name <email>" → Name; a bare address → the address. */
function senderName(from: string): string {
	const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
	if (m) return m[1].trim() || m[2].trim();
	return from.trim();
}

async function gmailAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
	try {
		const res = await requestUrl({
			url: "https://oauth2.googleapis.com/token",
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				refresh_token: refreshToken,
				grant_type: "refresh_token",
			}).toString(),
			throw: false,
		});
		const tok = res.status === 200 ? res.json?.access_token : null;
		return typeof tok === "string" ? tok : null;
	} catch {
		return null;
	}
}

/** Today's inbox for one Gmail account → email inbox items. Best-effort: a revoked or
 *  expired token, or any failed call, degrades that account to no items. */
async function gmailToday(acct: GmailAccount, clientId: string, clientSecret: string, now: number): Promise<InboxItem[]> {
	if (!acct.refresh_token) return [];
	const access = await gmailAccessToken(clientId, clientSecret, acct.refresh_token);
	if (!access) return [];
	const auth = { Authorization: `Bearer ${access}` };

	let ids: string[] = [];
	try {
		const q = encodeURIComponent(todayQuery(now));
		const res = await requestUrl({
			url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${EMAIL_PER_ACCOUNT}`,
			headers: auth,
			throw: false,
		});
		if (res.status !== 200) return [];
		ids = (res.json?.messages ?? []).map((m: any) => m?.id).filter((x: any): x is string => typeof x === "string");
	} catch {
		return [];
	}

	const label = acct.label || acct.email || "email";
	const items = await Promise.all(
		ids.map(async (id): Promise<InboxItem | null> => {
			try {
				const res = await requestUrl({
					url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
					headers: auth,
					throw: false,
				});
				if (res.status !== 200) return null;
				const headers: any[] = res.json?.payload?.headers ?? [];
				const header = (n: string): string => {
					const h = headers.find((x) => String(x?.name || "").toLowerCase() === n);
					return h && typeof h.value === "string" ? h.value : "";
				};
				const internal = Number(res.json?.internalDate);
				const ts = Number.isNaN(internal) ? now : internal;
				return {
					kind: "email",
					account: label,
					title: header("subject") || "(no subject)",
					source: senderName(header("from")),
					badge: "email",
					type: "",
					meta: relAge(now - ts),
					ts,
				};
			} catch {
				return null;
			}
		}),
	);
	return items.filter((x): x is InboxItem => x !== null);
}

async function readEmailItems(now: number): Promise<{ ok: boolean; items: InboxItem[] }> {
	let cfg: any;
	try {
		cfg = JSON.parse(fs.readFileSync(GMAIL_JSON, "utf8"));
	} catch {
		return { ok: false, items: [] }; // no config file → email simply isn't set up
	}
	const accounts: GmailAccount[] = Array.isArray(cfg.accounts) ? cfg.accounts : [];
	// client_id/secret are shared (one OAuth client) — top-level, or from any block.
	const withCreds = accounts.find((a) => a.client_id && a.client_secret);
	const clientId: string | undefined = cfg.client_id || withCreds?.client_id;
	const clientSecret: string | undefined = cfg.client_secret || withCreds?.client_secret;
	const usable = accounts.filter((a) => a.refresh_token);
	if (!clientId || !clientSecret || usable.length === 0) return { ok: false, items: [] };
	const lists = await Promise.all(usable.map((a) => gmailToday(a, clientId, clientSecret, now)));
	return { ok: true, items: lists.flat() };
}

/** Read the live inbox: GitHub notifications across every authed `gh` account + today's
 *  Gmail across every authorized account in gmail.json, merged newest-first. Both sources
 *  are best-effort and independent — either can be empty or unconfigured without sinking
 *  the other. Live and in-memory: nothing is written to disk. */
export async function readInbox(): Promise<Inbox> {
	const now = Date.now();
	const [github, email] = await Promise.all([readGithubItems(now), readEmailItems(now)]);
	const items = [...github.items, ...email.items].sort((a, b) => b.ts - a.ts).slice(0, INBOX_MAX);
	return { ok: github.ok || email.ok, items };
}
