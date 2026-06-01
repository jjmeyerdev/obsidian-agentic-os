// Source of truth for the Overview tab's four GitHub stat cards.
//
// Rather than manage a token, we shell out to the `gh` CLI and reuse the user's
// existing `gh auth` — so there is no secret to store. Desktop-only (Node
// child_process), like usage.ts.
//
// Every figure here is a *current* count (no stored history): the headline is an
// all-time total, and the secondary line is a live sub-stat — repos created this
// year, contributions this month, the most-starred repo, following count. All are
// recomputed each refresh from what the API returns right now.
import { execFile } from "child_process";

export interface GitHubStats {
	/** false when `gh` is missing, unauthenticated, or the user can't be read. */
	ok: boolean;
	login: string | null;
	/** Owned repos incl. private for the gh-authed user; public-only for a named one. */
	repositories: number | null;
	/** Repos created in the current calendar year. */
	reposNewThisYear: number | null;
	followers: number | null;
	following: number | null;
	/** Sum of stargazers across owned repos. */
	totalStars: number | null;
	topRepoStars: number | null;
	topRepoName: string | null;
	/** All-time contributions, summed across every year since the account opened. */
	contributions: number | null;
	/** Contributions so far this calendar month. */
	contribThisMonth: number | null;
}

const EMPTY: GitHubStats = {
	ok: false,
	login: null,
	repositories: null,
	reposNewThisYear: null,
	followers: null,
	following: null,
	totalStars: null,
	topRepoStars: null,
	topRepoName: null,
	contributions: null,
	contribThisMonth: null,
};

/** GUI-launched Obsidian on macOS doesn't inherit the shell PATH, so `gh` at a
 *  Homebrew/usr path won't be found by name. Augment PATH with the usual spots
 *  rather than probing for the binary. */
function runGh(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"gh",
			args,
			{
				env: { ...process.env, PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin` },
				maxBuffer: 16 * 1024 * 1024,
				timeout: 30_000,
			},
			(err, stdout) => (err ? reject(err) : resolve(stdout)),
		);
	});
}

interface YearContrib {
	total: number | null;
	/** [date, count] for each day — only requested for the current year. */
	days?: Array<{ date: string; count: number }>;
}

/** Contributions for one ≤1-year window. With `withDays`, also returns the daily
 *  grid (used to sum the current month). */
async function yearContributions(login: string, fromIso: string, toIso: string, withDays: boolean): Promise<YearContrib> {
	const calendar = withDays
		? "totalContributions weeks{contributionDays{date contributionCount}}"
		: "totalContributions";
	const query =
		`query($login:String!,$from:DateTime!,$to:DateTime!){` +
		`user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{${calendar}}}}}`;
	try {
		const out = await runGh([
			"api", "graphql",
			"-f", `query=${query}`,
			"-f", `login=${login}`,
			"-f", `from=${fromIso}`,
			"-f", `to=${toIso}`,
		]);
		const cal = JSON.parse(out)?.data?.user?.contributionsCollection?.contributionCalendar;
		const total = typeof cal?.totalContributions === "number" ? cal.totalContributions : null;
		if (!withDays) return { total };
		const days: Array<{ date: string; count: number }> = [];
		for (const week of cal?.weeks ?? []) {
			for (const d of week?.contributionDays ?? []) {
				if (typeof d?.date === "string") days.push({ date: d.date, count: d.contributionCount ?? 0 });
			}
		}
		return { total, days };
	} catch {
		return { total: null };
	}
}

/** Read the four card figures for `username` (blank = the gh-authenticated user).
 *  Best-effort: any sub-fetch that fails degrades just its own field to null. */
export async function readGitHubStats(username: string): Promise<GitHubStats> {
	// 1. Resolve login + the cheap headline counts (followers, following).
	const named = username.trim();
	let user: any;
	try {
		user = JSON.parse(await runGh(["api", named ? `users/${named}` : "user"]));
	} catch {
		return EMPTY; // gh absent, not authenticated, or no such user.
	}
	const login: string = named || user.login;
	if (!login) return EMPTY;

	const followers = typeof user.followers === "number" ? user.followers : null;
	const following = typeof user.following === "number" ? user.following : null;

	const now = Date.now();
	const nowDate = new Date(now);
	// Local time, not UTC: late-evening-local is already the next day in UTC, which
	// would point "this month"/"this year" at an empty future bucket. The contribution
	// calendar's date strings track the account's local days.
	const currentYear = nowDate.getFullYear();
	const monthPrefix = `${currentYear}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;

	// 2. Owned repos → count, this-year additions, total + top stars. For the
	//    authed user this includes private repos (visibility=all); for a named
	//    user only their public repos are visible.
	const reposEndpoint = named
		? `users/${login}/repos?per_page=100&type=owner`
		: `user/repos?per_page=100&affiliation=owner&visibility=all`;
	const repos: Array<{ name: string; stars: number; created: number }> = [];
	const reposPromise = runGh([
		"api", "--paginate", reposEndpoint,
		"--jq", ".[] | {name: .name, stars: .stargazers_count, created: .created_at}",
	])
		.then((out) => {
			for (const line of out.split("\n")) {
				if (!line.trim()) continue;
				const r = JSON.parse(line);
				repos.push({
					name: r.name,
					stars: typeof r.stars === "number" ? r.stars : 0,
					created: Date.parse(r.created),
				});
			}
		})
		.catch(() => {
			/* leave repos empty → those fields stay null */
		});

	// 3. All-time contributions: the calendar caps at one year, so query each year
	//    since the account opened (in parallel) and sum. The current year also
	//    returns its daily grid, from which we total this month.
	const createdYear = user.created_at ? new Date(user.created_at).getUTCFullYear() : currentYear;
	const years: number[] = [];
	for (let y = createdYear; y <= currentYear; y++) years.push(y);
	const contribPromise = Promise.all(
		years.map((y) => {
			const from = `${y}-01-01T00:00:00Z`;
			const to = y === currentYear ? nowDate.toISOString() : `${y}-12-31T23:59:59Z`;
			return yearContributions(login, from, to, y === currentYear);
		}),
	);

	await Promise.all([reposPromise, contribPromise]);
	const yearly = await contribPromise;

	// Repo-derived fields.
	const repositories = repos.length ? repos.length : null;
	const reposNewThisYear = repos.length
		? repos.filter((r) => !Number.isNaN(r.created) && new Date(r.created).getFullYear() === currentYear).length
		: null;
	const totalStars = repos.length ? repos.reduce((sum, r) => sum + r.stars, 0) : null;
	const top = repos.reduce<{ name: string; stars: number } | null>(
		(best, r) => (best === null || r.stars > best.stars ? { name: r.name, stars: r.stars } : best),
		null,
	);
	const topRepoStars = top && top.stars > 0 ? top.stars : null;
	const topRepoName = top && top.stars > 0 ? top.name : null;

	// Contribution-derived fields. The current year (last in the list) carries the
	// daily grid; if its query failed, both contribution figures degrade to null.
	const currentYearContrib = yearly[yearly.length - 1];
	let contributions: number | null = null;
	let contribThisMonth: number | null = null;
	if (currentYearContrib.total !== null) {
		contributions = yearly.reduce((sum, y) => sum + (y.total ?? 0), 0);
		contribThisMonth = (currentYearContrib.days ?? [])
			.filter((d) => d.date.startsWith(monthPrefix))
			.reduce((sum, d) => sum + d.count, 0);
	}

	return {
		ok: true,
		login,
		repositories,
		reposNewThisYear,
		followers,
		following,
		totalStars,
		topRepoStars,
		topRepoName,
		contributions,
		contribThisMonth,
	};
}

// ── Projects tab ────────────────────────────────────────────────────────────
// Everything below feeds the Projects ("GitHub Activity") tab. One GraphQL call
// covers the calendar, prior-year total, per-repo metadata, languages, and
// releases; the day-by-day commit timestamps (which the calendar lacks) come
// from paginating each owned repo's commit history — the source for velocity,
// the peak day/hour, and the activity heatmap.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES_MON = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** The seven heatmap time columns, matching the design's AM·10·12·2PM·4·6·Eve. */
const BUCKET_LABELS = ["early AM", "10 AM–12 PM", "12–2 PM", "2–4 PM", "4–6 PM", "6–8 PM", "evening"];
/** GitHub-style language colors; anything unlisted falls back to grey. */
const LANG_COLORS: Record<string, string> = {
	TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Shell: "#89e051", CSS: "#563d7c",
	HTML: "#e34c26", Rust: "#dea584", Go: "#00ADD8", Ruby: "#701516", Java: "#b07219", C: "#555555",
	"C++": "#f34b7d", "C#": "#178600", Vue: "#41b883", Svelte: "#ff3e00", Lua: "#000080", Dockerfile: "#384d54",
	Swift: "#F05138", Kotlin: "#A97BFF", PHP: "#4F5D95", SCSS: "#c6538c", MDX: "#fcb32c",
};
const LANG_FALLBACK = "#8b8b8b";

export interface ProjectRepo {
	name: string; desc: string; lang: string | null; langColor: string;
	stars: number; updated: string; commits: number; openPRs: number; issues: number;
}
export interface ProjectRelease { tag: string; repo: string; desc: string; age: string; }
export interface ProjectLang { name: string; pct: number; color: string; }

export interface ProjectStats {
	ok: boolean;
	// ① contribution chart
	months: Array<{ label: string; count: number }>;
	totalThisYear: number;
	yearDeltaPct: number | null;
	rangeLabel: string;
	// ② streak / velocity / peak
	currentStreak: number;
	longestStreak: number;
	weeklyCommits: number[];
	commitsThisWeek: number;
	velocityPct: number | null;
	peakDay: string | null;
	peakTimeLabel: string | null;
	// ③ repo cards · ④ languages · ⑤ releases
	repos: ProjectRepo[];
	languages: ProjectLang[];
	releases: ProjectRelease[];
	releaseCount: number;
	// ⑥ heatmap [day Mon..Sun][bucket] → level 0–4
	heat: number[][];
}

function hourBucket(h: number): number {
	if (h < 10) return 0;
	if (h < 12) return 1;
	if (h < 14) return 2;
	if (h < 16) return 3;
	if (h < 18) return 4;
	if (h < 20) return 5;
	return 6;
}

/** Index of the largest element, or null when every entry is zero. */
function argmax(arr: number[]): number | null {
	let bi = -1;
	let bv = 0;
	arr.forEach((v, i) => {
		if (v > bv) {
			bv = v;
			bi = i;
		}
	});
	return bi < 0 ? null : bi;
}

/** Coarse "2d ago" / "3h ago" / "1w ago" relative age from a millisecond delta. */
function relAge(ms: number): string {
	const s = Math.max(0, ms);
	const d = Math.floor(s / DAY_MS);
	if (d >= 7) return `${Math.floor(d / 7)}w ago`;
	if (d >= 1) return `${d}d ago`;
	const h = Math.floor(s / 3_600_000);
	if (h >= 1) return `${h}h ago`;
	return `${Math.max(1, Math.floor(s / 60_000))}m ago`;
}

export async function readProjectStats(username: string): Promise<ProjectStats> {
	const empty: ProjectStats = {
		ok: false, months: [], totalThisYear: 0, yearDeltaPct: null, rangeLabel: "",
		currentStreak: 0, longestStreak: 0, weeklyCommits: [], commitsThisWeek: 0, velocityPct: null,
		peakDay: null, peakTimeLabel: null, repos: [], languages: [], releases: [], releaseCount: 0,
		heat: Array.from({ length: 7 }, () => new Array(7).fill(0)),
	};

	let login = username.trim();
	if (!login) {
		try {
			login = JSON.parse(await runGh(["api", "user"])).login;
		} catch {
			return empty;
		}
	}
	if (!login) return empty;

	const now = Date.now();
	const yearAgo = new Date(now - 365 * DAY_MS).toISOString();
	const prevFrom = new Date(now - 730 * DAY_MS).toISOString();
	const prevTo = new Date(now - 365 * DAY_MS).toISOString();

	// One call: calendar + prior-year total + repo meta + languages + releases.
	const query =
		`query($l:String!,$pf:DateTime!,$pt:DateTime!){user(login:$l){` +
		`cur:contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}` +
		`prev:contributionsCollection(from:$pf,to:$pt){contributionCalendar{totalContributions}}` +
		`repositories(first:100,ownerAffiliations:OWNER,isFork:false){nodes{` +
		`name description primaryLanguage{name} stargazerCount pushedAt ` +
		`issues(states:OPEN){totalCount} pullRequests(states:OPEN){totalCount} ` +
		`languages(first:8){edges{size node{name}}} releases(last:1){nodes{tagName name publishedAt}}}}}}`;
	let user: any;
	try {
		user = JSON.parse(
			await runGh(["api", "graphql", "-f", `query=${query}`, "-f", `l=${login}`, "-f", `pf=${prevFrom}`, "-f", `pt=${prevTo}`]),
		)?.data?.user;
	} catch {
		return empty;
	}
	if (!user) return empty;

	// Daily contribution grid → months, streaks.
	const days: Array<{ date: string; count: number }> = [];
	for (const w of user.cur?.contributionCalendar?.weeks ?? []) {
		for (const d of w?.contributionDays ?? []) {
			if (typeof d?.date === "string") days.push({ date: d.date, count: d.contributionCount ?? 0 });
		}
	}
	days.sort((a, b) => (a.date < b.date ? -1 : 1));

	const totalThisYear = user.cur?.contributionCalendar?.totalContributions ?? 0;
	const prevTotal = user.prev?.contributionCalendar?.totalContributions ?? null;
	const yearDeltaPct = prevTotal !== null && prevTotal > 0 ? ((totalThisYear - prevTotal) / prevTotal) * 100 : null;

	const base = new Date(now);
	const monthKeys: string[] = [];
	for (let i = 11; i >= 0; i--) {
		const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
		monthKeys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
	}
	const monthTotals = new Map<string, number>(monthKeys.map((k) => [k, 0]));
	for (const d of days) {
		const key = d.date.slice(0, 7);
		if (monthTotals.has(key)) monthTotals.set(key, (monthTotals.get(key) as number) + d.count);
	}
	const months = monthKeys.map((k) => ({ label: MONTH_ABBR[parseInt(k.slice(5, 7), 10) - 1], count: monthTotals.get(k) as number }));
	const monthFull = (k: string): string => `${MONTH_ABBR[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`;
	const rangeLabel = `${monthFull(monthKeys[0])} → ${monthFull(monthKeys[11])}`;

	let longestStreak = 0;
	let run = 0;
	for (const d of days) {
		if (d.count > 0) {
			run++;
			longestStreak = Math.max(longestStreak, run);
		} else {
			run = 0;
		}
	}
	let currentStreak = 0;
	for (let i = days.length - 1; i >= 0; i--) {
		if (days[i].count > 0) currentStreak++;
		else if (i === days.length - 1) continue; // today not done yet — don't break the streak
		else break;
	}

	// Per-repo commit timestamps (the calendar has none) → velocity, peak, heatmap.
	const repoNodes: any[] = user.repositories?.nodes ?? [];
	const commitsPerRepo = await Promise.all(
		repoNodes.map((r) =>
			runGh([
				"api", "--paginate",
				`repos/${login}/${r.name}/commits?author=${login}&since=${yearAgo}&per_page=100`,
				"--jq", ".[].commit.author.date",
			])
				.then((out) => out.split("\n").map((s) => s.trim()).filter(Boolean))
				.catch(() => [] as string[]),
		),
	);
	const allCommits: number[] = [];
	for (const arr of commitsPerRepo) {
		for (const ds of arr) {
			const t = Date.parse(ds);
			if (!Number.isNaN(t)) allCommits.push(t);
		}
	}

	const weeklyCommits = new Array(8).fill(0);
	const dayTotals = new Array(7).fill(0);
	const bucketTotals = new Array(7).fill(0);
	const heatCount = Array.from({ length: 7 }, () => new Array(7).fill(0));
	for (const t of allCommits) {
		const ago = now - t;
		if (ago >= 0 && ago < 8 * 7 * DAY_MS) {
			const idx = 7 - Math.floor(ago / (7 * DAY_MS));
			if (idx >= 0 && idx < 8) weeklyCommits[idx]++;
		}
		const dt = new Date(t);
		const dayIdx = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
		const b = hourBucket(dt.getHours());
		dayTotals[dayIdx]++;
		bucketTotals[b]++;
		heatCount[dayIdx][b]++;
	}
	const commitsThisWeek = weeklyCommits[7];
	const lastWeek = weeklyCommits[6];
	const velocityPct = lastWeek > 0 ? ((commitsThisWeek - lastWeek) / lastWeek) * 100 : null;
	const peakDayIdx = argmax(dayTotals);
	const peakBucketIdx = argmax(bucketTotals);
	const peakDay = peakDayIdx === null ? null : DAY_NAMES_MON[peakDayIdx];
	const peakTimeLabel = peakBucketIdx === null ? null : BUCKET_LABELS[peakBucketIdx];
	const maxCell = Math.max(1, ...heatCount.flat());
	const heat = heatCount.map((row) => row.map((c) => (c === 0 ? 0 : Math.max(1, Math.round((c / maxCell) * 4)))));

	// Top 3 repos by most recent push.
	const repos: ProjectRepo[] = repoNodes
		.map((r, i) => ({ r, commits: commitsPerRepo[i].length }))
		.sort((a, b) => (String(a.r.pushedAt) < String(b.r.pushedAt) ? 1 : -1))
		.slice(0, 3)
		.map(({ r, commits }) => {
			const lang = r.primaryLanguage?.name ?? null;
			return {
				name: r.name,
				desc: r.description || "",
				lang,
				langColor: lang ? (LANG_COLORS[lang] ?? LANG_FALLBACK) : LANG_FALLBACK,
				stars: r.stargazerCount ?? 0,
				updated: r.pushedAt ? relAge(now - Date.parse(r.pushedAt)) : "",
				commits,
				openPRs: r.pullRequests?.totalCount ?? 0,
				issues: r.issues?.totalCount ?? 0,
			};
		});

	// Aggregate language bytes across all repos → top 5 + Other.
	const langBytes = new Map<string, number>();
	for (const r of repoNodes) {
		for (const e of r.languages?.edges ?? []) {
			const n = e?.node?.name;
			if (n) langBytes.set(n, (langBytes.get(n) ?? 0) + (e.size ?? 0));
		}
	}
	const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0);
	let languages: ProjectLang[] = [];
	if (totalBytes > 0) {
		const sorted = [...langBytes.entries()].sort((a, b) => b[1] - a[1]);
		const top = sorted.slice(0, 5);
		languages = top.map(([n, b]) => ({ name: n, pct: Math.round((b / totalBytes) * 100), color: LANG_COLORS[n] ?? LANG_FALLBACK }));
		const otherPct = Math.round(((totalBytes - top.reduce((s, [, b]) => s + b, 0)) / totalBytes) * 100);
		if (otherPct > 0) languages.push({ name: "Other", pct: otherPct, color: "#3a3a3a" });
	}

	// Latest release per repo → newest 3.
	const relRaw = repoNodes.flatMap((r) => {
		const rn = r.releases?.nodes?.[0];
		return rn ? [{ tag: rn.tagName || rn.name || "", repo: r.name, desc: rn.name || "", ts: rn.publishedAt ? Date.parse(rn.publishedAt) : 0 }] : [];
	});
	relRaw.sort((a, b) => b.ts - a.ts);
	const releases: ProjectRelease[] = relRaw.slice(0, 3).map((x) => ({ tag: x.tag, repo: x.repo, desc: x.desc, age: x.ts ? relAge(now - x.ts) : "" }));

	return {
		ok: true,
		months, totalThisYear, yearDeltaPct, rangeLabel,
		currentStreak, longestStreak, weeklyCommits, commitsThisWeek, velocityPct,
		peakDay, peakTimeLabel, repos, languages, releases, releaseCount: relRaw.length, heat,
	};
}
