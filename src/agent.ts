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
import { createRequire } from "node:module";
import * as path from "node:path";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);

import {
	buildSystemPrompt,
	callLlm,
	getSessionTokens,
	getThinkingEnabled,
	type LlmOptions,
	setStream,
	setVerbose,
	toggleThinking,
} from "./api.js";
import { command } from "./commands.js";
import { loadConfig } from "./config.js";
import { getDsn, getWorkspacePath, setDsn, setWorkspacePath } from "./constants.js";
import { createInkOutput } from "./inkoutput.js";
import { c, output, setOutput } from "./output.js";
import { getProvider, type Message, type ToolResultBlock } from "./providers/index.js";
import { getConf, loadSystemConf } from "./systemconf.js";
import { executeTool, shouldConfirm } from "./tools/index.js";
import { loadExternalTools } from "./tools/loader.js";
import { checkForUpdate } from "./versioncheck.js";

const { values: args, positionals } = parseArgs({
	options: {
		verbose: { type: "boolean", short: "v", default: false },
		help: { type: "boolean", short: "h", default: false },
		session: { type: "string", short: "s" },
		workspace: { type: "string", short: "w" },
		dsn: { type: "string", short: "d" },
		tools: { type: "string", short: "t", multiple: true },
		ink: { type: "boolean", default: false },
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
	output.writeln(`      --ink               Use Ink (React) terminal UI`);
	output.writeln(`  -h, --help             Show this message`);
	output.writeln();
	output.writeln(`Use /help inside the REPL for interactive commands.`);
	process.exit(0);
}

if (args.ink) {
	setOutput(createInkOutput());
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

// Session persistence

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

// Config

function formatTokens(): string {
	const t = getSessionTokens();
	if (t.total === 0) return "";
	return `${c.dim}(${t.total.toLocaleString()} tokens)${c.reset} `;
}

const DEFAULT_MAX_TURNS = 20;
const WORKSPACE = getWorkspacePath();

// Agent loop
async function runAgent(userMessage: string, history: Message[], llm: LlmOptions) {
	history.push({ role: "user", content: [{ type: "text", text: userMessage }] });

	const maxTurns = llm.model.maxTurns ?? DEFAULT_MAX_TURNS;
	let turns = 0;

	while (turns < maxTurns) {
		turns++;
		if (getThinkingEnabled()) {
			output.setThinking(true);
			//output.write(`${c.dim}[thinking...]${c.reset}\r`);
		}

		output.open("assistant");
		let streamStarted = false;
		const response = await callLlm(history, llm, {
			onText(text) {
				if (!streamStarted) {
					// Clear thinking indicator and print header
					output.setThinking(false);
					//output.log("◆ agent", c.cyan, "");
					streamStarted = true;
				}
				output.write(text);
			},
		});

		if (streamStarted) {
			output.writeln();
			output.close();
		}
		output.setThinking(false);

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

	if (turns >= maxTurns) {
		output.log("⚠ agent", c.yellow, `Hit max turns (${maxTurns}). Stopping.`);
	}
}

// REPL / one-shot entry

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
	const modelWantsApiKey = !model.noApiKey && !provider.noApiKey;

	if (!apiKey && modelWantsApiKey) {
		output.error(
			`${c.red}Error: API key not set.${c.reset}\n` + `  Set ${envKey} in your environment`,
		);
		process.exit(1);
	}

	const llm: LlmOptions = { model, provider, apiKey };

	output.open("echo");
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
	output.close();

	// One-shot mode: argument passed directly
	const oneShot = positionals.join(" ").trim();
	if (oneShot) {
		//output.startupWriteLn(`\n${c.dim}task: ${oneShot}${c.reset}\n`);
		output.open("user");
		output.writeln(oneShot);
		output.close();
		await runAgent(oneShot, history, llm);
		saveSession(history);
		output.open("echo");
		output.writeln("done");
		output.close();

		setTimeout(() => output.exit(), 1);
		return;
	}

	// Interactive REPL
	output.open("echo");
	output.writeln(`${c.dim}  Agentloop running. Ctrl+C to exit. /help for commands.\n${c.reset}`);
	output.close();

	const prompt = `${c.magenta}you > ${c.reset}`;

	while (true) {
		const task = await output.readLine(prompt);
		if (!task) continue;
		if (task === "/exit") break;

		const ctx = {
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

		try {
			await runAgent(task, history, llm);
			saveSession(history);
		} catch (err) {
			output.log("✗ error", c.red, String(err));
		}
		output.writeln();
	}

	output.writeln(`\n${c.dim}bye.${c.reset}\n`);
}

main().catch((err) => {
	output.error(`${c.red}Fatal: ${err.message}${c.reset}`);
	process.exit(1);
});
