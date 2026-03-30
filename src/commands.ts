import { execSync } from "node:child_process";
import { log } from "node:console";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { getSessionTokens, type LlmOptions, toggleStream, toggleThinking } from "./api";
import { config } from "./config";
import { getConfigDir, getMemoryPath, getSkillsPath } from "./constants";
import { getProvider, type Message } from "./providers";
import type { Repl } from "./readlineutils";
import { setConf } from "./systemconf";
import { c } from "./utils";

export type AgentContext = {
	repl: Repl;
	history: Message[];
	llm: LlmOptions;
	sessionFile: string | undefined;
	setSessionFile: (file: string) => void;
};

function listMdFiles(dir: string): { name: string; size: number }[] {
	try {
		return fs
			.readdirSync(dir)
			.filter((f) => f.toLowerCase().endsWith(".md"))
			.map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }));
	} catch {
		return [];
	}
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

export async function command(context: AgentContext, task: string): Promise<boolean> {
	if (task === "/exit") {
		context.repl.rl.close();
		console.log(`\n${c.dim}bye.${c.reset}\n`);
		process.exit(0);
	}

	if (task === "/help" || task === "/?") {
		console.log(`\n${c.bold}Available commands:${c.reset}`);
		console.log(`  ${c.cyan}/help${c.reset}, ${c.cyan}/?${c.reset}      Show this help message`);
		console.log(`  ${c.cyan}/exit${c.reset}          Exit the agent`);
		console.log(`  ${c.cyan}/model${c.reset}         List models or switch: /model <key>`);
		console.log(`  ${c.cyan}/stream${c.reset}        Toggle streaming on/off`);
		console.log(`  ${c.cyan}/think${c.reset}         Toggle thinking display on/off`);
		console.log(`  ${c.cyan}/status${c.reset}        Show session info, tokens, skills, memory`);
		console.log(`  ${c.cyan}/clear${c.reset}         Clear conversation history`);
		console.log(`  ${c.cyan}/history${c.reset}       Show conversation history`);
		console.log(`  ${c.cyan}/e${c.reset}             Open last response in $EDITOR`);
		console.log(`  ${c.cyan}/p${c.reset}             Open last response in $PAGER\n`);
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/model" || task.startsWith("/model ")) {
		const models = config?.settings.models ?? [];
		const arg = task.slice("/model".length).trim();
		if (!arg) {
			// List all models, mark current
			console.log(`\n${c.bold}Available models:${c.reset}`);
			for (const m of models) {
				const active = m.key === context.llm.model.key ? ` ${c.green}(active)${c.reset}` : "";
				console.log(`  ${c.cyan}${m.key}${c.reset} — ${m.provider}: ${m.modelName}${active}`);
			}
			console.log();
		} else {
			const match = models.find((m) => m.key === arg);
			if (!match) {
				log("✗", c.red, `unknown model key "${arg}". Use /model to list.`);
			} else {
				const envKey = `CUSTOMAGENT_APIKEY_${match.provider.toUpperCase()}`;
				const apiKey = process.env[envKey] ?? "";
				if (!apiKey && !match.noApiKey) {
					log("✗", c.red, `API key not set for ${match.provider}. Set ${envKey}`);
				} else {
					context.llm.model = match;
					context.llm.provider = getProvider(match.provider);
					context.llm.apiKey = apiKey;
					setConf("model", match.key);
					log("✓", c.green, `switched to ${match.provider}: ${match.modelName}`);
				}
			}
		}
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/stream") {
		const enabled = toggleStream();
		setConf("stream", enabled ? "on" : "off");
		log("✓", c.green, `streaming ${enabled ? "on" : "off"}`);
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/think") {
		const enabled = toggleThinking();
		setConf("thinking", enabled ? "on" : "off");
		log("✓", c.green, `thinking display ${enabled ? "on" : "off"}`);
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/status") {
		const tokens = getSessionTokens();
		console.log(`\n${c.bold}Session status:${c.reset}`);
		console.log(
			`  ${c.cyan}Model:${c.reset}    ${context.llm.model.provider}: ${context.llm.model.modelName}`,
		);
		console.log(`  ${c.cyan}History:${c.reset}  ${context.history.length} messages`);
		console.log(
			`  ${c.cyan}Tokens:${c.reset}   ${tokens.total.toLocaleString()} total (${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out)`,
		);

		// Skills
		const skills = listMdFiles(getSkillsPath());
		if (skills.length > 0) {
			console.log(`\n  ${c.bold}Skills${c.reset} (${getSkillsPath()}):`);
			for (const f of skills) console.log(`    ${c.dim}${f.name}${c.reset} ${formatSize(f.size)}`);
		} else {
			console.log(`\n  ${c.dim}No skills (${getSkillsPath()})${c.reset}`);
		}

		// Memory
		const memory = listMdFiles(getMemoryPath());
		if (memory.length > 0) {
			console.log(`  ${c.bold}Memory${c.reset} (${getMemoryPath()}):`);
			for (const f of memory) console.log(`    ${c.dim}${f.name}${c.reset} ${formatSize(f.size)}`);
		} else {
			console.log(`  ${c.dim}No memory (${getMemoryPath()})${c.reset}`);
		}

		// Session file
		if (context.sessionFile) {
			try {
				const size = fs.statSync(context.sessionFile).size;
				console.log(
					`\n  ${c.cyan}History file:${c.reset} ${context.sessionFile} (${formatSize(size)})`,
				);
			} catch {
				console.log(
					`\n  ${c.cyan}History file:${c.reset} ${context.sessionFile} (not yet written)`,
				);
			}
		} else if (context.history.length > 0) {
			// Offer to save
			const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
			const answer = await new Promise<string>((resolve) => {
				rl.question(`\n  ${c.yellow}No history file.${c.reset} Save current history? [Y/n] `, (a) =>
					resolve(a.trim()),
				);
			});
			rl.close();
			if (!answer || answer.toLowerCase() === "y") {
				const dir = path.join(getConfigDir(), "historyfiles");
				fs.mkdirSync(dir, { recursive: true });
				const file = path.join(dir, `${randomUUID()}.json`);
				fs.writeFileSync(file, JSON.stringify(context.history, null, 2));
				context.setSessionFile(file);
				console.log(`  ${c.green}✓${c.reset} Saved to ${c.bold}${file}${c.reset}`);
			}
		} else {
			console.log(`\n  ${c.dim}No history file (no messages yet)${c.reset}`);
		}

		console.log();
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/clear") {
		context.history.length = 0;
		log("✓", c.green, "conversation history cleared");
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/history") {
		if (context.history.length === 0) {
			log("✗", c.red, "no history yet");
			context.repl.rl.prompt();
			return true;
		}
		const lines: string[] = [];
		for (const msg of context.history) {
			const role = msg.role === "assistant" ? "assistant" : "user";
			for (const block of msg.content) {
				if (block.type === "text") {
					lines.push(`[${role}] ${(block as { type: "text"; text: string }).text}`);
				} else if (block.type === "tool_use") {
					const tb = block as { type: "tool_use"; name: string };
					lines.push(`[${role}] tool_use: ${tb.name}`);
				} else if ("tool_use_id" in block) {
					lines.push(`[${role}] tool_result`);
				}
			}
			lines.push("");
		}
		const text = lines.join("\n");
		const termRows = process.stdout.rows || 24;
		if (text.split("\n").length > termRows) {
			const tmpFile = path.join(os.tmpdir(), `customagent-history-${Date.now()}.txt`);
			fs.writeFileSync(tmpFile, text);
			const pager = process.env.PAGER || "less";
			try {
				execSync(`${pager} ${tmpFile}`, { stdio: "inherit" });
			} catch {
				console.log(text);
			} finally {
				fs.rmSync(tmpFile, { force: true });
			}
		} else {
			console.log(text);
		}
		context.repl.rl.prompt();
		return true;
	}

	if (task === "/e" || task === "/p") {
		const lastAssistant = [...context.history].reverse().find((m) => m.role === "assistant");
		if (!lastAssistant) {
			log("✗", c.red, "no assistant response yet");
			context.repl.rl.prompt();
			return true;
		}
		const text = lastAssistant.content
			.filter((b) => b.type === "text")
			.map((b) => (b as { type: "text"; text: string }).text)
			.join("\n");
		if (!text.trim()) {
			log("✗", c.red, "last response has no text content");
			context.repl.rl.prompt();
			return true;
		}
		const tmpFile = path.join(os.tmpdir(), `customagent-response-${Date.now()}.md`);
		fs.writeFileSync(tmpFile, text);
		const program = task === "/e" ? process.env.EDITOR || "vi" : process.env.PAGER || "less";
		try {
			execSync(`${program} ${tmpFile}`, { stdio: "inherit" });
		} catch {
			log("✗", c.red, `failed to open ${program}`);
		} finally {
			fs.rmSync(tmpFile, { force: true });
		}
		context.repl.rl.prompt();
		return true;
	}

	return false;
}
