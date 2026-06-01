/*
 * Regenerates ../markup.ts from the source HTML dashboards.
 *
 * Run:  pnpm gen-markup
 *
 * Source location comes from AGENTIC_OS_SRC_DIR (set it in .env), or pass the
 * directory as the first CLI argument. That folder must contain:
 *   preview.html, sessions-full.html, research-full-radar.html, research-full-hn.html,
 *   research-full-brief.html
 *
 * For each file it extracts the full `.dash` element (the only child of the
 * `.agentic-os` root) and emits it as a template-literal export. It also injects
 * `data-full` attributes onto the four dashboard "Full ↗" pills so main.ts can
 * wire navigation off them.
 */
import fs from "fs";
import path from "path";
import process from "process";

// Minimal .env loader (no dependency): KEY=VALUE lines, existing env wins.
function loadDotEnv() {
	const envPath = new URL("../.env", import.meta.url);
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
		const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
		if (!m) continue;
		const key = m[1];
		const val = m[2].replace(/^["']|["']$/g, "");
		if (!(key in process.env)) process.env[key] = val;
	}
}
loadDotEnv();

const SRC = process.env.AGENTIC_OS_SRC_DIR || process.argv[2];
if (!SRC) {
	console.error(
		"No source dir. Set AGENTIC_OS_SRC_DIR in .env or pass it as an argument:\n" +
			"  node scripts/gen-markup.mjs /path/to/agentic-os-pane"
	);
	process.exit(1);
}

/** Slice out the `.dash` element: from its opening tag to the `.agentic-os`
 *  closing `</div>`, which sits at a 2-space indent (inner divs are deeper). */
function extractDash(file) {
	const text = fs.readFileSync(path.join(SRC, file), "utf8");
	const start = text.indexOf('<div class="dash"');
	if (start === -1) throw new Error(`no .dash element found in ${file}`);
	const end = text.indexOf("\n  </div>", start);
	if (end === -1) throw new Error(`no .agentic-os closing tag found in ${file}`);
	return text.slice(start, end).replace(/\s+$/, "");
}

let dash = extractDash("preview.html");
const sessions = extractDash("sessions-full.html");
const radar = extractDash("research-full-radar.html");
const hn = extractDash("research-full-hn.html");
const brief = extractDash("research-full-brief.html");

// Tag the four dashboard "Full ↗" pills, in DOM order. The Latest Session card sits
// on the Overview panel (first in the DOM), so its pill leads; the other three are on
// the Research panel.
const targets = ["full-sessions", "full-radar", "full-hn", "full-brief"];
const pill = '<button class="pill-link" type="button">';
const parts = dash.split(pill);
if (parts.length !== targets.length + 1) {
	throw new Error(`expected ${targets.length} pill-links in preview.html, found ${parts.length - 1}`);
}
let rebuilt = parts[0];
for (let i = 1; i < parts.length; i++) {
	rebuilt += `<button class="pill-link" type="button" data-full="${targets[i - 1]}">` + parts[i];
}
dash = rebuilt;

// Escape for safe embedding in a template literal.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const entries = [
	["DASHBOARD_MARKUP", dash],
	["FULL_SESSIONS_MARKUP", sessions],
	["FULL_RADAR_MARKUP", radar],
	["FULL_HN_MARKUP", hn],
	["FULL_BRIEF_MARKUP", brief],
];

const header =
	"// AUTO-GENERATED from the source HTML dashboards (preview.html, sessions-full.html, research-full-*.html).\n" +
	"// Each constant is the full `.dash` element; the view injects it under a scoped `.agentic-os` root.\n" +
	"// Do not edit by hand — regenerate with `pnpm gen-markup` after changing the source HTML.\n\n";

const body = entries.map(([name, val]) => `export const ${name} = \`${esc(val)}\`;\n`).join("\n");

const outPath = new URL("../markup.ts", import.meta.url);
fs.writeFileSync(outPath, header + body);

console.log(`Wrote markup.ts (${(header + body).length} bytes) from ${SRC}`);
console.log(`  data-full pills injected: ${dash.match(/data-full=/g)?.length ?? 0}`);
