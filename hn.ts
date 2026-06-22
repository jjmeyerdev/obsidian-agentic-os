// Hacker News feed for the Research tab — the dashboard card (top 5) and the full
// "Hacker News" view (top 30, with the Top/Show HN/Ask HN/New chips + search). Reads
// the public Firebase API (https://github.com/HackerNews/API), no auth. Unlike the
// gh/fs modules this uses Obsidian's requestUrl, so it works inside the Electron
// renderer without CORS trouble and doesn't depend on Node — read-only, never throws.
import { requestUrl } from "obsidian";

export type HNKind = "show" | "ask" | "story";

export interface HNStory {
	id: number;
	title: string;
	score: number;
	comments: number;
	/** External article URL, or the HN item page for text posts (e.g. Ask HN). */
	url: string;
	/** Always the HN discussion page. */
	hnUrl: string;
	/** Display domain (host of url, "www." stripped), or "news.ycombinator.com". */
	domain: string;
	/** Submission time, unix seconds — kept so the "New" chip can re-sort by recency. */
	time: number;
	/** Compact relative age, e.g. "3h" / "2d". */
	age: string;
	kind: HNKind;
}

export interface HNFeed {
	/** false only when the top-stories list itself couldn't be fetched (→ error state).
	 *  Individual item misses are dropped silently, not a feed-level failure. */
	ok: boolean;
	stories: HNStory[];
}

const API = "https://hacker-news.firebaseio.com/v0";
const ITEM = "https://news.ycombinator.com/item?id=";

interface RawItem {
	id: number;
	type?: string;
	title?: string;
	score?: number;
	descendants?: number;
	url?: string;
	time?: number; // unix seconds
	dead?: boolean;
	deleted?: boolean;
}

async function getJson<T>(url: string): Promise<T | null> {
	try {
		const res = await requestUrl({ url, throw: false });
		if (res.status !== 200) return null;
		return res.json as T;
	} catch {
		return null;
	}
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

/** Compact age like the mockup: "3h", "2d". Sub-hour shows minutes; under a minute "now". */
function formatAge(unixSeconds: number, nowMs: number): string {
	const mins = Math.max(0, Math.floor((nowMs - unixSeconds * 1000) / 60000));
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	return `${Math.floor(hrs / 24)}d`;
}

function classify(title: string): HNKind {
	if (/^show hn\b/i.test(title)) return "show";
	if (/^ask hn\b/i.test(title)) return "ask";
	return "story";
}

/** Fetch the top `limit` HN stories in HN rank order. The caller passes Date.now() so
 *  age formatting has a single clock per refresh. ok:false (top list unreachable) tells
 *  the caller to show the error state; otherwise dead/deleted/title-less items are dropped. */
export async function readHackerNews(limit: number, nowMs: number): Promise<HNFeed> {
	const ids = await getJson<number[]>(`${API}/topstories.json`);
	if (!ids) return { ok: false, stories: [] };

	const raw = await Promise.all(ids.slice(0, limit).map((id) => getJson<RawItem>(`${API}/item/${id}.json`)));

	const stories: HNStory[] = [];
	for (const it of raw) {
		if (!it || it.dead || it.deleted || !it.title) continue;
		const url = it.url ?? `${ITEM}${it.id}`;
		stories.push({
			id: it.id,
			title: it.title,
			score: it.score ?? 0,
			comments: it.descendants ?? 0,
			url,
			hnUrl: `${ITEM}${it.id}`,
			domain: it.url ? hostOf(it.url) || "news.ycombinator.com" : "news.ycombinator.com",
			time: it.time ?? 0,
			age: it.time ? formatAge(it.time, nowMs) : "",
			kind: classify(it.title),
		});
	}
	return { ok: true, stories };
}
