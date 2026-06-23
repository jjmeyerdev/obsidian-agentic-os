// Claude service availability for the Token Burn live label. Reads Anthropic's
// official Statuspage JSON endpoint and maps incident severity to the small
// dashboard vocabulary: Live, Degraded, Offline, or Unknown.
import { requestUrl } from "obsidian";

export type ClaudeStatusTone = "live" | "warn" | "error" | "neutral";

export interface ClaudeStatus {
	/** false when the Statuspage endpoint cannot be reached or returns malformed JSON. */
	ok: boolean;
	/** CSS tone for `.micro-label__live[data-tone]`. */
	tone: ClaudeStatusTone;
	/** Short label that fits in the header pill. */
	label: string;
	/** Full Statuspage description, used as the pill tooltip/accessibility label. */
	description: string;
	/** Raw Statuspage indicator, kept for debugging unexpected future values. */
	indicator: string | null;
	/** Statuspage's page update timestamp, ISO 8601 when present. */
	updatedAt: string | null;
}

interface StatuspageResponse {
	page?: {
		updated_at?: string;
	};
	status?: {
		indicator?: string;
		description?: string;
	};
}

const CLAUDE_STATUS_URL = "https://status.claude.com/api/v2/status.json";

function mapIndicator(indicator: string | null, description: string): Pick<ClaudeStatus, "tone" | "label"> {
	switch (indicator) {
		case "none":
			return { tone: "live", label: "Live" };
		case "minor":
			return { tone: "warn", label: "Degraded" };
		case "major":
		case "critical":
			return { tone: "error", label: "Offline" };
		case "maintenance":
			return { tone: "warn", label: "Maintenance" };
		default:
			const operational = /operational/i.test(description);
			return {
				tone: operational ? "live" : "neutral",
				label: operational ? "Live" : "Unknown",
			};
	}
}

/** Read Claude's aggregate Statuspage state. This is deliberately aggregate-level:
 *  the header should reflect any active Claude incident, not just one component. */
export async function readClaudeStatus(): Promise<ClaudeStatus> {
	try {
		const res = await requestUrl({ url: CLAUDE_STATUS_URL, throw: false });
		if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
		const json = res.json as StatuspageResponse | null;
		const indicator = json?.status?.indicator ?? null;
		const description = json?.status?.description ?? "";
		if (!indicator || !description) throw new Error("missing status fields");

		return {
			ok: true,
			...mapIndicator(indicator, description),
			description,
			indicator,
			updatedAt: json?.page?.updated_at ?? null,
		};
	} catch {
		return {
			ok: false,
			tone: "neutral",
			label: "Unknown",
			description: "Claude status unavailable",
			indicator: null,
			updatedAt: null,
		};
	}
}
