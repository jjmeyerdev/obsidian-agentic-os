/*
 * One-time Gmail OAuth helper for the Agentic OS Inbox (Phase 2).
 *
 * Mints a refresh_token for ONE Gmail account and writes it into gmail.json.
 * Run once per account, from the repo root:
 *
 *   node scripts/gmail-auth.mjs josh.meyer.137@gmail.com
 *
 * Prereqs (see the Phase 2 directions): a Google Cloud project with the Gmail API
 * enabled and a *Desktop app* OAuth client; paste its client_id + client_secret into
 * gmail.json first (one block is enough — shared creds are read from any block).
 *
 * No npm dependencies — Node built-ins + a localhost (127.0.0.1) loopback redirect,
 * which Desktop-app OAuth clients allow without registering a redirect URI.
 */
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import https from "https";
import { exec } from "child_process";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const CONFIG = process.env.AGENTIC_OS_GMAIL_JSON || path.join(os.homedir(), ".config/agentic-os/gmail.json");

const selector = process.argv[2];
if (!selector) {
	console.error("Usage: node scripts/gmail-auth.mjs <email-or-label>");
	process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const accounts = Array.isArray(cfg.accounts) ? cfg.accounts : [];
const acct = accounts.find((a) => a.email === selector || a.label === selector);
if (!acct) {
	console.error(`No account in ${CONFIG} matches "${selector}".`);
	console.error(`Known: ${accounts.map((a) => `${a.label} <${a.email}>`).join(", ")}`);
	process.exit(1);
}

// client_id/secret are shared (one OAuth client) — read from a top-level field, the
// selected block, or any block that has them filled.
const withCreds = accounts.find((a) => a.client_id && a.client_secret);
const clientId = cfg.client_id || acct.client_id || withCreds?.client_id;
const clientSecret = cfg.client_secret || acct.client_secret || withCreds?.client_secret;
if (!clientId || !clientSecret) {
	console.error("Missing client_id / client_secret. Paste them into gmail.json first (see the directions).");
	process.exit(1);
}

function postForm(url, form) {
	const body = new URLSearchParams(form).toString();
	return new Promise((resolve, reject) => {
		const req = https.request(
			url,
			{ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } },
			(res) => {
				let data = "";
				res.on("data", (c) => (data += c));
				res.on("end", () => {
					try {
						resolve(JSON.parse(data));
					} catch {
						reject(new Error(`Bad token response: ${data}`));
					}
				});
			},
		);
		req.on("error", reject);
		req.write(body);
		req.end();
	});
}

let redirectUri = "";

const server = http.createServer(async (req, res) => {
	const u = new URL(req.url, "http://127.0.0.1");
	const code = u.searchParams.get("code");
	const err = u.searchParams.get("error");
	if (!code && !err) {
		res.writeHead(204).end(); // favicon / stray requests
		return;
	}
	res.writeHead(200, { "Content-Type": "text/html" });
	res.end(
		`<html><body style="font-family:sans-serif;padding:2rem">` +
			`<h2>${err ? "Authorization failed: " + err : "Done — refresh token saved."}</h2>` +
			`<p>You can close this tab and return to the terminal.</p></body></html>`,
	);
	server.close();
	if (err) {
		console.error(`Consent failed: ${err}`);
		process.exit(1);
	}
	try {
		const tok = await postForm("https://oauth2.googleapis.com/token", {
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		});
		if (!tok.refresh_token) {
			console.error(`No refresh_token returned: ${JSON.stringify(tok)}`);
			console.error("Tip: revoke prior access at https://myaccount.google.com/permissions, then re-run.");
			process.exit(1);
		}
		acct.refresh_token = tok.refresh_token;
		fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n");
		console.log(`\n✓ Saved refresh_token for ${acct.email} (label "${acct.label}") → ${CONFIG}`);
		process.exit(0);
	} catch (e) {
		console.error(e.message || String(e));
		process.exit(1);
	}
});

server.listen(0, "127.0.0.1", () => {
	const port = server.address().port;
	redirectUri = `http://127.0.0.1:${port}`;
	const authUrl =
		"https://accounts.google.com/o/oauth2/v2/auth?" +
		new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: SCOPE,
			access_type: "offline",
			prompt: "consent",
			login_hint: acct.email,
		}).toString();
	console.log(`\nAuthorizing ${acct.email} (label "${acct.label}")…`);
	console.log(`If your browser doesn't open, paste this URL:\n${authUrl}\n`);
	exec(`open "${authUrl}"`, () => {});
});
