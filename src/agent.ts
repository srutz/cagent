#!/usr/bin/env node

/**
 * Coding Agent — TypeScript CLI
 * Uses Claude + tool calling to write, run, and fix code autonomously.
 *
 * Setup:
 *   npm install tsx typescript @types/node
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   chmod +x agent.ts
 *   ./agent.ts             (interactive REPL)
 *   ./agent.ts "sort a list of numbers in perl"  (one-shot)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import {
	buildSystemPrompt,
	callLlm,
	getSessionTokens,
	getThinkingEnabled,
	type LlmOptions,
	setStream,
	setVerbose,
	toggleThinking,
} from "./api";
import { command } from "./commands";
import { loadConfig } from "./config";
import { getDsn, getWorkspacePath, setDsn, setWorkspacePath } from "./constants";
import { c, output } from "./output";
import { getProvider, type Message, type ToolResultBlock } from "./providers";
import { createRepl } from "./readlineutils";
import { getConf, loadSystemConf } from "./systemconf";
import { executeTool, shouldConfirm } from "./tools";
import { loadExternalTools } from "./tools/loader";
import { checkForUpdate } from "./versioncheck";

// ─── CLI args ────────────────────────────────────────────────────────────────

const { values: args, positionals } = parseArgs({
	options: {
		verbose: { type: "boolean", short: "v", default: false },
		help: { type: "boolean", short: "h", default: false },
		session: { type: "string", short: "s" },
		workspace: { type: "string", short: "w" },
		dsn: { type: "string", short: "d" },
		tools: { type: "string", short: "t", multiple: true },
	},
	allowPositionals: true,
});

if (args.help) {
	output.writeln(`${c.bold}cagent${c.reset} — a coding agent by ${c.magenta}stepan.rutz${c.reset}`);
	output.writeln();
	output.writeln(`Usage: cagent [options] [task]`);
	output.writeln();
	output.writeln(`Options:`);
	output.writeln(`  -v, --verbose          Log API requests and responses`);
	output.writeln(`  -s, --session <file>   Persist/restore conversation history`);
	output.writeln(`  -w, --workspace <dir>  Set working directory (default: cwd)`);
	output.writeln(
		`  -d, --dsn <url>        PostgreSQL connection string (default: inherit PG* env vars)`,
	);
	output.writeln(
		`  -t, --tools <path>     Load external tools from .js file or directory (repeatable)`,
	);
	output.writeln(`  -h, --help             Show this message`);
	output.writeln();
	output.writeln(`Use /help inside the REPL for interactive commands.`);
	process.exit(0);
}

if (args.workspace) {
	const resolved = path.resolve(args.workspace);
	if (!fs.existsSync(resolved)) {
		output.error(`${c.red}workspace not found: ${resolved}${c.reset}`);
		process.exit(1);
	}
	setWorkspacePath(resolved);
}

if (args.dsn) {
	setDsn(args.dsn);
}

if (args.verbose) {
	setVerbose(true);
}

// ─── Session persistence ─────────────────────────────────────────────────────

let sessionFile = args.session;

function loadSession(): Message[] {
	if (!sessionFile) return [];
	try {
		const data = fs.readFileSync(sessionFile, "utf-8");
		return JSON.parse(data) as Message[];
	} catch {
		return [];
	}
}

function saveSession(history: Message[]) {
	if (!sessionFile) return;
	fs.writeFileSync(sessionFile, JSON.stringify(history, null, 2));
}

// ─── Config ──────────────────────────────────────────────────────────────────

function formatTokens(): string {
	const t = getSessionTokens();
	if (t.total === 0) return "";
	return `${c.dim}(${t.total.toLocaleString()} tokens)${c.reset} `;
}

const MAX_TURNS = 20;
const WORKSPACE = getWorkspacePath();

// ─── Agent loop ───────────────────────────────────────────────────────────────

async function runAgent(userMessage: string, history: Message[], llm: LlmOptions): Promise<void> {
	history.push({ role: "user", content: [{ type: "text", text: userMessage }] });

	let turns = 0;

	while (turns < MAX_TURNS) {
		turns++;
		if (getThinkingEnabled()) {
			output.write(`${c.dim}[thinking...]${c.reset}\r`);
		}

		let streamStarted = false;
		const response = await callLlm(history, llm, {
			onText(text) {
				if (!streamStarted) {
					// Clear thinking indicator and print header
					output.clearLine();
					output.log("◆ agent", c.cyan, "");
					streamStarted = true;
				}
				output.write(text);
			},
		});

		// Clear the thinking indicator (in case no streaming happened)
		if (!streamStarted) {
			output.clearLine();
		} else {
			// End the streamed line
			output.writeln();
		}

		const tokenStr = formatTokens();

		// Add assistant message to history
		history.push({ role: "assistant", content: response.content });

		// Print text blocks only if we didn't stream them
		if (!streamStarted) {
			for (const block of response.content) {
				if (block.type === "text" && block.text.trim()) {
					output.log(`◆ agent ${tokenStr}`, c.cyan, "");
					output.writeln(block.text.trim());
				}
			}
		} else if (tokenStr) {
			output.writeln(`${c.cyan}◆${c.reset} ${tokenStr}`);
		}

		// Done?
		if (response.stop_reason === "end_turn") break;

		// Process tool calls
		if (response.stop_reason === "tool_use") {
			const toolResults: ToolResultBlock[] = [];

			for (const block of response.content) {
				if (block.type !== "tool_use") continue;

				const { id, name, input } = block;

				// Pretty-print the tool call
				output.divider(`tool: ${name}`);
				const inputLines = JSON.stringify(input, null, 2)
					.split("\n")
					.map((l) => `  ${l}`)
					.join("\n");
				output.writeln(`${c.yellow}${inputLines}${c.reset}`);

				// Confirm before executing (unless tool opts out)
				if (shouldConfirm(name) && !(await output.confirm(`Execute tool "${name}"?`))) {
					toolResults.push({
						type: "tool_result",
						tool_use_id: id,
						content: "Tool execution denied by user.",
					});
					continue;
				}

				// Run it
				const result = await executeTool(WORKSPACE, name, input);

				// Print result
				output.writeln(`${c.gray}─ result ─${c.reset}`);
				result.split("\n").forEach((line) => {
					output.writeln(`${c.green}  ${line}${c.reset}`);
				});

				toolResults.push({ type: "tool_result", tool_use_id: id, content: result });
			}

			// Feed results back
			history.push({ role: "user", content: toolResults });
			continue;
		}

		// max_tokens or unexpected stop
		break;
	}

	if (turns >= MAX_TURNS) {
		output.log("⚠ agent", c.yellow, `Hit max turns (${MAX_TURNS}). Stopping.`);
	}
}

// ─── REPL / one-shot entry ────────────────────────────────────────────────────

async function main() {
	const config = await loadConfig();
	await loadExternalTools((args.tools as string[]) ?? []);
	buildSystemPrompt(config);
	loadSystemConf();

	// Resolve model: saved preference → first in settings
	const savedModelKey = getConf("model");
	const model =
		(savedModelKey && config.settings.models.find((m) => m.key === savedModelKey)) ||
		config.settings.models[0];

	if (!model) {
		output.error(`${c.red}Error: No models configured in settings.json.${c.reset}`);
		process.exit(1);
	}

	// Restore stream preference
	const savedStream = getConf("stream");
	if (savedStream === "on") setStream(true);

	// Restore thinking preference (default: on)
	const savedThinking = getConf("thinking");
	if (savedThinking === "off") toggleThinking();

	const provider = getProvider(model.provider);
	const envKey = `CUSTOMAGENT_APIKEY_${model.provider.toUpperCase()}`;
	const apiKey = process.env[envKey] ?? "";

	if (!apiKey && !model.noApiKey) {
		output.error(
			`${c.red}Error: API key not set.${c.reset}\n` + `  Set ${envKey} in your environment`,
		);
		process.exit(1);
	}

	const llm: LlmOptions = { model, provider, apiKey };

	output.writeln(
		`${c.bold}${c.magenta}◆ cagent v${require("../package.json").version}${c.reset} by stepan.rutz / ${c.dim}Model: ${model.provider}: ${model.modelName}${c.reset}`,
	);
	await checkForUpdate(require("../package.json").version);
	output.writeln(`${c.dim}  workspace: ${WORKSPACE}${c.reset}`);
	output.writeln(
		`${c.dim}  Disclaimer: cagent may do dangerous harm if you are not careful. use at your own risk.${c.reset}`,
	);
	const dsn = getDsn();
	if (dsn) {
		output.writeln(`${c.dim}  database:  ${dsn}${c.reset}`);
	} else if (process.env.PGDATABASE) {
		output.writeln(`${c.dim}  database:  ${process.env.PGDATABASE} (from PG* env vars)${c.reset}`);
	}

	const history: Message[] = loadSession();
	if (sessionFile && history.length > 0) {
		output.writeln(`${c.dim}  restored ${history.length} messages from ${sessionFile}${c.reset}`);
	}

	// One-shot mode: argument passed directly
	const oneShot = positionals.join(" ").trim();
	if (oneShot) {
		output.writeln(`\n${c.dim}task: ${oneShot}${c.reset}\n`);
		await runAgent(oneShot, history, llm);
		saveSession(history);
		output.writeln(`\n${c.dim}done.${c.reset}\n`);
		return;
	}

	// Interactive REPL
	output.writeln(`${c.dim}  Agentloop running. Ctrl+C to exit. /help for commands.\n${c.reset}`);

	const repl = createRepl(`${c.magenta}you > ${c.reset}`);

	repl.rl.prompt();

	for await (const line of repl.rl) {
		const task = line.trim();
		if (!task) {
			repl.rl.prompt();
			continue;
		}

		repl.appendHistory(task);
		const ctx = {
			repl,
			history,
			llm,
			sessionFile,
			setSessionFile: (f: string) => {
				sessionFile = f;
			},
		};
		if (await command(ctx, task)) {
			continue;
		}

		//console.log();
		try {
			await runAgent(task, history, llm);
			saveSession(history);
		} catch (err) {
			output.log("✗ error", c.red, String(err));
		}
		output.writeln();
		repl.rl.prompt();
	}

	output.writeln(`\n${c.dim}bye.${c.reset}\n`);
}

main().catch((err) => {
	output.error(`${c.red}Fatal: ${err.message}${c.reset}`);
	process.exit(1);
});
