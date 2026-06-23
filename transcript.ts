// Renders a Claude Code session transcript via the `claude-history` CLI for the
// session-transcript pane. The CLI bakes line-wrapping + the ledger gutter into its
// output, so reflow is achieved by passing the pane's width as COLUMNS and re-running
// on resize (a full transcript renders in ~15ms). Desktop-only (Node child_process),
// like usage.ts / github.ts / session.ts.
import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";

export interface RenderOpts {
	/** Target wrap width in monospace columns — maps to the CLI's COLUMNS. */
	columns: number;
	/** Expand tool calls inline (CLI --show-tools), else collapse to "Called N tools". */
	showTools: boolean;
}

/** Cargo installs the binary here; GUI-launched Obsidian doesn't inherit the shell
 *  PATH, so we add it (plus the usual Homebrew/usr spots) the way github.ts does. */
const CARGO_BIN = join(homedir(), ".cargo", "bin");

/** Run `claude-history --render <path>` and return its ledger text. Rejects if the
 *  binary is missing/unauthed or the file can't be read — the caller surfaces that. */
export function renderTranscript(path: string, opts: RenderOpts): Promise<string> {
	const args = [
		"--render",
		path,
		"--no-color",
		opts.showTools ? "--show-tools" : "--no-tools",
		// Thinking blocks are stored without text (signature only), so there's nothing
		// to render — always hide them.
		"--hide-thinking",
	];
	return new Promise((resolve, reject) => {
		execFile(
			"claude-history",
			args,
			{
				env: {
					...process.env,
					COLUMNS: String(opts.columns),
					PATH: `${process.env.PATH ?? ""}:${CARGO_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
				},
				maxBuffer: 64 * 1024 * 1024,
				timeout: 30_000,
			},
			(err, stdout) => (err ? reject(err) : resolve(stdout)),
		);
	});
}
