// Release Radar — live dependency-update data for the user's own projects, drawn from
// every authed GitHub account. The DIRECT-FETCH half of the hybrid model (see
// docs/prd-release-radar.md): everything mechanical is computed here — newest npm
// versions, semver/security badges, which repos a dep affects, Active/Idle grouping —
// and the panel is fully functional with no agentic data present. The optional `overlay`
// (written by the `/release-radar` command into .agentic-os/radar.json) only upgrades an
// escalated row's terse description to a plain-English sentence.
//
// Desktop-only: leans on github.ts's `runGh` (Node child_process). npm registry reads go
// through Obsidian's requestUrl so they work inside the Electron renderer. Best-effort
// throughout — every sub-fetch degrades its own field and the whole read never throws.
import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { requestUrl } from "obsidian";
import { runGh } from "./github";

export type RadarBadge = "BREAKING" | "SECURITY" | "MINOR" | "PATCH";
export type RadarGroup = "attention" | "active" | "idle";

export interface RadarRow {
	/** npm package name — also the display label and the overlay key prefix. (The repo
	 *  slug isn't shown: monorepos like @radix-ui/* all share one repo, so the package
	 *  name is the only unambiguous identifier.) */
	pkg: string;
	/** Alias of `pkg`, kept as the row's display label. */
	name: string;
	/** Release-notes / repo page (or the npm page when the repo can't be resolved). */
	url: string;
	/** Resolved current version (the lowest pinned across the repos that use it). */
	current: string;
	/** Newest published version on npm. */
	latest: string;
	badge: RadarBadge;
	/** BREAKING or SECURITY — escalated to the Attention group. */
	escalated: boolean;
	/** Terse "v1.6.0 → v1.7.0 · affects …", or the overlay's rich sentence when present. */
	desc: string;
	/** Repo names that list this dep, most-recently-pushed first. */
	affects: string[];
	group: RadarGroup;
	/** The repo this row is grouped under (active/idle); "" for attention. */
	groupRepo: string;
	/** That repo's pushedAt (ms) — orders the repo groups by recency. */
	groupPushedAt: number;
}

export interface RadarData {
	/** false only when no account could be read / no repo enumerated (→ error state).
	 *  true with rows:[] means "everything's up to date", a real empty state. */
	ok: boolean;
	rows: RadarRow[];
	/** Distinct repos scanned that had a package.json. */
	repoCount: number;
	/** Distinct packages with an available update (== rows.length). */
	pkgCount: number;
}

/** Newest-pushed N repos per account scanned for a package.json — bounds the contents
 *  + npm fan-out. The radar tracks what you're actively shipping, so recency is the cut. */
const MAX_REPOS_PER_ACCOUNT = 40;
/** A repo pushed within this many days is "Active"; older repos' updates are "Idle". */
const ACTIVE_WITHIN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Packages per GitHub Advisory GraphQL call (aliased) — keeps each query small. */
const ADVISORY_CHUNK = 30;

// ── version helpers ──────────────────────────────────────────────────────────

type SemVer = [number, number, number];

/** Strict x.y.z (npm `latest` is always full). */
function parseStrict(s: string): SemVer | null {
	const m = String(s).match(/(\d+)\.(\d+)\.(\d+)/);
	return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Loose: a range like `^1.6.0`, `>=2 <3`, `1.x`, `~3.4` → its baseline version, missing
 *  parts as 0. Returns null for `*` / `latest` / `workspace:*` (no determinable floor). */
function parseLoose(range: string): SemVer | null {
	const m = String(range).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
	if (!m) return null;
	return [+m[1], +(m[2] ?? 0), +(m[3] ?? 0)];
}

/** -1 / 0 / 1. */
function cmp(a: SemVer, b: SemVer): number {
	for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
	return 0;
}

/** The badge for cur → lat, assuming lat > cur. */
function bump(cur: SemVer, lat: SemVer): "MINOR" | "PATCH" | "BREAKING" {
	if (lat[0] !== cur[0]) return "BREAKING";
	if (lat[1] !== cur[1]) return "MINOR";
	return "PATCH";
}

// ── gh account discovery ───────────────────────────────────────────────────────

/** Run `gh auth status`, capturing both streams (gh prints the account list to stderr).
 *  Resolves "" on any failure so discovery degrades to "no accounts". */
function ghAuthStatus(): Promise<string> {
	return new Promise((resolve) => {
		execFile(
			"gh",
			["auth", "status"],
			{
				env: { ...process.env, PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin` },
				timeout: 15_000,
			},
			(_err, stdout, stderr) => resolve(`${stdout ?? ""}\n${stderr ?? ""}`),
		);
	});
}

/** Every account `gh` is logged into, e.g. ["jjmeyerdev", "JDesigns716"]. Empty when gh
 *  is absent / unauthenticated. Order follows gh's own output. */
export async function discoverGhAccounts(): Promise<string[]> {
	const text = await ghAuthStatus();
	const accounts: string[] = [];
	const re = /account (\S+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		if (!accounts.includes(m[1])) accounts.push(m[1]);
	}
	return accounts;
}

/** That account's token, for per-call GH_TOKEN injection. null if it can't be read. */
async function accountToken(account: string): Promise<string | null> {
	try {
		const out = (await runGh(["auth", "token", "--user", account])).trim();
		return out || null;
	} catch {
		return null;
	}
}

// ── repo + package.json reads ──────────────────────────────────────────────────

interface RepoRef {
	name: string;
	owner: string;
	pushedAt: number;
	token: string;
}

/** Owned, non-fork, non-archived repos for one account, newest-pushed first, capped. */
async function listAccountRepos(token: string): Promise<RepoRef[]> {
	let out: string;
	try {
		out = await runGh(
			[
				"api", "--paginate", "user/repos?per_page=100&affiliation=owner",
				"--jq", ".[] | select(.fork==false and .archived==false) | {name:.name, owner:.owner.login, pushedAt:.pushed_at}",
			],
			token,
		);
	} catch {
		return [];
	}
	const repos: RepoRef[] = [];
	for (const line of out.split("\n")) {
		if (!line.trim()) continue;
		try {
			const r = JSON.parse(line);
			repos.push({ name: r.name, owner: r.owner, pushedAt: Date.parse(r.pushedAt) || 0, token });
		} catch {
			/* skip a malformed line */
		}
	}
	return repos.sort((a, b) => b.pushedAt - a.pushedAt).slice(0, MAX_REPOS_PER_ACCOUNT);
}

/** A repo's package.json `dependencies` map, or null when there's no package.json / it
 *  doesn't parse. Raw content via the gh contents API with the raw media type. */
async function readDependencies(repo: RepoRef): Promise<Record<string, string> | null> {
	try {
		const raw = await runGh(
			["api", `repos/${repo.owner}/${repo.name}/contents/package.json`, "-H", "Accept: application/vnd.github.raw"],
			repo.token,
		);
		const pkg = JSON.parse(raw);
		const deps = pkg?.dependencies;
		return deps && typeof deps === "object" ? deps : {};
	} catch {
		return null; // no package.json, private submodule, parse error → contributes nothing
	}
}

// ── npm + advisory reads ─────────────────────────────────────────────────────

interface NpmLatest {
	version: string;
	/** owner/repo if the repository field points at GitHub. */
	slug: string | null;
}

/** npm registry `/latest`: newest version + a GitHub slug parsed from the repository
 *  field. null on any miss (deprecated/unpublished/network) → the dep is dropped. */
async function npmLatest(pkg: string): Promise<NpmLatest | null> {
	try {
		const res = await requestUrl({ url: `https://registry.npmjs.org/${pkg}/latest`, throw: false });
		if (res.status !== 200) return null;
		const j = res.json as { version?: string; repository?: { url?: string } | string };
		if (!j?.version) return null;
		const repoUrl = typeof j.repository === "string" ? j.repository : j.repository?.url ?? "";
		// Owner/repo from forms like `git+https://github.com/vercel/next.js.git`. Repo
		// names can contain dots (next.js, socket.io), so match up to the next slash and
		// strip a trailing `.git` rather than stopping at the first dot.
		const gh = repoUrl.match(/github\.com[/:]([^/\s]+)\/([^/\s]+)/);
		const slug = gh ? `${gh[1]}/${gh[2].replace(/\.git$/, "")}` : null;
		return { version: j.version, slug };
	} catch {
		return null;
	}
}

/** GitHub Advisory DB: packages whose current version sits below a published security
 *  patch (firstPatchedVersion). Returns the set of such package names. Public data, so
 *  the default gh identity is fine — no token injection. Best-effort per chunk. */
async function securityFlags(pkgs: Array<{ pkg: string; current: SemVer }>): Promise<Set<string>> {
	const flagged = new Set<string>();
	for (let i = 0; i < pkgs.length; i += ADVISORY_CHUNK) {
		const chunk = pkgs.slice(i, i + ADVISORY_CHUNK);
		const fields = chunk
			.map(
				(c, j) =>
					`a${j}: securityVulnerabilities(ecosystem: NPM, package: ${JSON.stringify(c.pkg)}, first: 5) { nodes { firstPatchedVersion { identifier } } }`,
			)
			.join(" ");
		try {
			const out = await runGh(["api", "graphql", "-f", `query={ ${fields} }`]);
			const data = JSON.parse(out)?.data ?? {};
			chunk.forEach((c, j) => {
				for (const node of data[`a${j}`]?.nodes ?? []) {
					const patched = parseStrict(node?.firstPatchedVersion?.identifier ?? "");
					if (patched && cmp(c.current, patched) < 0) {
						flagged.add(c.pkg);
						break;
					}
				}
			});
		} catch {
			/* advisory chunk failed → those packages just don't get a SECURITY badge */
		}
	}
	return flagged;
}

// ── assembly ───────────────────────────────────────────────────────────────────

const EMPTY: RadarData = { ok: false, rows: [], repoCount: 0, pkgCount: 0 };

interface DepUse {
	repos: Array<{ name: string; pushedAt: number }>;
	ranges: string[];
}

/** Build the live radar across `accounts` (the enabled set — caller discovers via
 *  `discoverGhAccounts()` and drops any excluded in settings). `overlay` maps
 *  `pkg@latest` → a rich description that replaces the terse one for that exact version.
 *  Empty `accounts` → nothing to scan (EMPTY). */
export async function readReleaseRadar(
	accounts: string[],
	overlay: Record<string, string> = {},
): Promise<RadarData> {
	if (!accounts.length) return EMPTY;

	// Resolve a token per account, then enumerate each account's repos in parallel.
	const tokens = await Promise.all(accounts.map(accountToken));
	const repoLists = await Promise.all(
		tokens.map((t) => (t ? listAccountRepos(t) : Promise.resolve([] as RepoRef[]))),
	);
	const repos = repoLists.flat();
	if (!repos.length) return EMPTY;

	// Read every package.json's dependencies, union them, remembering which repos use each.
	const depMaps = await Promise.all(repos.map(readDependencies));
	const uses = new Map<string, DepUse>();
	let repoCount = 0;
	repos.forEach((repo, i) => {
		const deps = depMaps[i];
		if (deps === null) return;
		repoCount++;
		for (const [pkg, range] of Object.entries(deps)) {
			if (typeof range !== "string") continue;
			let u = uses.get(pkg);
			if (!u) uses.set(pkg, (u = { repos: [], ranges: [] }));
			u.repos.push({ name: repo.name, pushedAt: repo.pushedAt });
			u.ranges.push(range);
		}
	});
	if (!uses.size) return { ok: true, rows: [], repoCount, pkgCount: 0 };

	// For each dep: newest version (npm) + the lowest pinned current across its repos.
	// Keep only those with an available update (latest > current).
	const pkgs = [...uses.keys()];
	const latests = await Promise.all(pkgs.map(npmLatest));

	interface Pending {
		pkg: string; url: string; current: SemVer; latest: SemVer;
		badge: "BREAKING" | "MINOR" | "PATCH"; use: DepUse;
	}
	const pending: Pending[] = [];
	pkgs.forEach((pkg, i) => {
		const np = latests[i];
		const use = uses.get(pkg);
		if (!np || !use) return;
		const lat = parseStrict(np.version);
		if (!lat) return;
		// Lowest current across the repos → the largest meaningful delta.
		let cur: SemVer | null = null;
		for (const r of use.ranges) {
			const v = parseLoose(r);
			if (v && (cur === null || cmp(v, cur) < 0)) cur = v;
		}
		if (!cur || cmp(lat, cur) <= 0) return; // unparsable or already current
		const url = np.slug ? `https://github.com/${np.slug}/releases` : `https://www.npmjs.com/package/${pkg}`;
		pending.push({ pkg, url, current: cur, latest: lat, badge: bump(cur, lat), use });
	});

	// Security overlay: any pending dep below a published patch → SECURITY (escalated).
	const secure = await securityFlags(pending.map((p) => ({ pkg: p.pkg, current: p.current })));

	const now = Date.now();
	const fmt = (v: SemVer) => `v${v[0]}.${v[1]}.${v[2]}`;
	const rows: RadarRow[] = pending.map((p) => {
		const isSecurity = secure.has(p.pkg);
		const badge: RadarBadge = isSecurity ? "SECURITY" : p.badge;
		const escalated = badge === "BREAKING" || badge === "SECURITY";
		const affects = p.use.repos
			.slice()
			.sort((a, b) => b.pushedAt - a.pushedAt)
			.map((r) => r.name)
			.filter((n, i, a) => a.indexOf(n) === i);
		const top = p.use.repos.reduce((best, r) => (r.pushedAt > best.pushedAt ? r : best));
		const group: RadarGroup = escalated
			? "attention"
			: now - top.pushedAt <= ACTIVE_WITHIN_DAYS * DAY_MS
				? "active"
				: "idle";
		const affectsNote = affects.length ? ` · affects ${affects.join(" + ")}` : "";
		const terse = `${fmt(p.current)} → ${fmt(p.latest)}${affectsNote}`;
		const rich = overlay[`${p.pkg}@${p.latest[0]}.${p.latest[1]}.${p.latest[2]}`];
		return {
			pkg: p.pkg,
			name: p.pkg,
			url: p.url,
			current: fmt(p.current),
			latest: fmt(p.latest),
			badge,
			escalated,
			desc: rich || terse,
			affects,
			group,
			groupRepo: escalated ? "" : top.name,
			groupPushedAt: top.pushedAt,
		};
	});

	rows.sort(byPriority);
	return { ok: true, rows, repoCount, pkgCount: rows.length };
}

/** Write the escalated rows to `<vault>/.agentic-os/radar-input.json` — the worklist the
 *  `/release-radar` command reads to know which deps to enrich. Each item's `key` matches
 *  the overlay key the merge looks up (`pkg@x.y.z`), so the command's output lines up with
 *  no version munging. Best-effort: a write failure just leaves the command without fresh
 *  input. Only escalated (Attention) rows are enriched, per the PRD. */
export function writeRadarInput(basePath: string, rows: RadarRow[]): void {
	try {
		const dir = join(basePath, ".agentic-os");
		mkdirSync(dir, { recursive: true });
		const escalated = rows
			.filter((r) => r.escalated)
			.map((r) => ({
				key: `${r.pkg}@${r.latest.replace(/^v/, "")}`,
				pkg: r.pkg,
				current: r.current,
				latest: r.latest,
				badge: r.badge,
				url: r.url,
				affects: r.affects,
			}));
		const payload = { generated: new Date().toISOString().slice(0, 16), escalated };
		writeFileSync(join(dir, "radar-input.json"), JSON.stringify(payload, null, 2));
	} catch {
		/* best-effort — the command degrades to "no input" */
	}
}

/** The agentic overlay written by `/release-radar`: `pkg@version` → rich description.
 *  Read from `<vault>/.agentic-os/radar.json`. Absent / malformed → {} (terse stands). */
export function readRadarOverlay(basePath: string): Record<string, string> {
	try {
		const path = join(basePath, ".agentic-os", "radar.json");
		if (!existsSync(path)) return {};
		const j = JSON.parse(readFileSync(path, "utf8"));
		return j?.items && typeof j.items === "object" ? j.items : {};
	} catch {
		return {};
	}
}

const GROUP_RANK: Record<RadarGroup, number> = { attention: 0, active: 1, idle: 2 };
const ATTENTION_BADGE_RANK: Record<string, number> = { BREAKING: 0, SECURITY: 1 };
const REPO_BADGE_RANK: Record<string, number> = { MINOR: 0, PATCH: 1 };

/** Attention first (BREAKING before SECURITY); then Active repos, then Idle repos, each
 *  repo group ordered by recency; within a repo MINOR before PATCH, then by name. */
function byPriority(a: RadarRow, b: RadarRow): number {
	if (a.group !== b.group) return GROUP_RANK[a.group] - GROUP_RANK[b.group];
	if (a.group === "attention") {
		const d = (ATTENTION_BADGE_RANK[a.badge] ?? 9) - (ATTENTION_BADGE_RANK[b.badge] ?? 9);
		return d || a.pkg.localeCompare(b.pkg);
	}
	if (a.groupPushedAt !== b.groupPushedAt) return b.groupPushedAt - a.groupPushedAt;
	if (a.groupRepo !== b.groupRepo) return a.groupRepo.localeCompare(b.groupRepo);
	const d = (REPO_BADGE_RANK[a.badge] ?? 9) - (REPO_BADGE_RANK[b.badge] ?? 9);
	return d || a.pkg.localeCompare(b.pkg);
}
