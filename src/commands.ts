import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getSessionTokens, type LlmOptions, toggleStream, toggleThinking } from "./api.js";
import { config } from "./config.js";
import { getConfigDir, getMemoryPath, getSkillsPath } from "./constants.js";
import { c, output } from "./output.js";
import { getProvider, type Message } from "./providers/index.js";
import { setConf } from "./systemconf.js";

export type AgentContext = {
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
	if (task === "/help" || task === "/?") {
		output.writeln(`\n${c.bold}Available commands:${c.reset}`);
		output.writeln(`  ${c.cyan}/help${c.reset}, ${c.cyan}/?${c.reset}      Show this help message`);
		output.writeln(`  ${c.cyan}/exit${c.reset}          Exit the agent`);
		output.writeln(`  ${c.cyan}/model${c.reset}         List models or switch: /model <key>`);
		output.writeln(`  ${c.cyan}/stream${c.reset}        Toggle streaming on/off`);
		output.writeln(`  ${c.cyan}/think${c.reset}         Toggle thinking display on/off`);
		output.writeln(`  ${c.cyan}/status${c.reset}        Show session info, tokens, skills, memory`);
		output.writeln(`  ${c.cyan}/clear${c.reset}         Clear conversation history`);
		output.writeln(`  ${c.cyan}/history${c.reset}       Show conversation history`);
		output.writeln(`  ${c.cyan}/e${c.reset}             Open last response in $EDITOR`);
		output.writeln(`  ${c.cyan}/p${c.reset}             Open last response in $PAGER\n`);

		return true;
	}

	if (task === "/model" || task.startsWith("/model ")) {
		const models = config?.settings.models ?? [];
		const arg = task.slice("/model".length).trim();
		if (!arg) {
			// List all models, mark current
			output.writeln(`\n${c.bold}Available models:${c.reset}`);
			for (const m of models) {
				const active = m.key === context.llm.model.key ? ` ${c.green}(active)${c.reset}` : "";
				output.writeln(`  ${c.cyan}${m.key}${c.reset} — ${m.provider}: ${m.modelName}${active}`);
			}
			output.writeln();
		} else {
			const match = models.find((m) => m.key === arg);
			if (!match) {
				output.log("✗", c.red, `unknown model key "${arg}". Use /model to list.`);
			} else {
				const provider = getProvider(match.provider);
				const envKey = `CUSTOMAGENT_APIKEY_${match.provider.toUpperCase()}`;
				const apiKey = process.env[envKey] ?? "";
				if (!apiKey && !match.noApiKey && !provider.noApiKey) {
					output.log("✗", c.red, `API key not set for ${match.provider}. Set ${envKey}`);
				} else {
					context.llm.model = match;
					context.llm.provider = getProvider(match.provider);
					context.llm.apiKey = apiKey;
					setConf("model", match.key);
					output.log("✓", c.green, `switched to ${match.provider}: ${match.modelName}`);
				}
			}
		}

		return true;
	}

	if (task === "/stream") {
		const enabled = toggleStream();
		setConf("stream", enabled ? "on" : "off");
		output.log("✓", c.green, `streaming ${enabled ? "on" : "off"}`);

		return true;
	}

	if (task === "/think") {
		const enabled = toggleThinking();
		setConf("thinking", enabled ? "on" : "off");
		output.log("✓", c.green, `thinking display ${enabled ? "on" : "off"}`);

		return true;
	}

	if (task === "/status") {
		const tokens = getSessionTokens();
		output.writeln(`\n${c.bold}Session status:${c.reset}`);
		output.writeln(
			`  ${c.cyan}Model:${c.reset}    ${context.llm.model.provider}: ${context.llm.model.modelName}`,
		);
		output.writeln(`  ${c.cyan}History:${c.reset}  ${context.history.length} messages`);
		output.writeln(
			`  ${c.cyan}Tokens:${c.reset}   ${tokens.total.toLocaleString()} total (${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out)`,
		);

		// Skills
		const skills = listMdFiles(getSkillsPath());
		if (skills.length > 0) {
			output.writeln(`\n  ${c.bold}Skills${c.reset} (${getSkillsPath()}):`);
			for (const f of skills) output.writeln(`    ${c.dim}${f.name}${c.reset} ${formatSize(f.size)}`);
		} else {
			output.writeln(`\n  ${c.dim}No skills (${getSkillsPath()})${c.reset}`);
		}

		// Memory
		const memory = listMdFiles(getMemoryPath());
		if (memory.length > 0) {
			output.writeln(`  ${c.bold}Memory${c.reset} (${getMemoryPath()}):`);
			for (const f of memory) output.writeln(`    ${c.dim}${f.name}${c.reset} ${formatSize(f.size)}`);
		} else {
			output.writeln(`  ${c.dim}No memory (${getMemoryPath()})${c.reset}`);
		}

		// Session file
		if (context.sessionFile) {
			try {
				const size = fs.statSync(context.sessionFile).size;
				output.writeln(
					`\n  ${c.cyan}History file:${c.reset} ${context.sessionFile} (${formatSize(size)})`,
				);
			} catch {
				output.writeln(
					`\n  ${c.cyan}History file:${c.reset} ${context.sessionFile} (not yet written)`,
				);
			}
		} else if (context.history.length > 0) {
			// Offer to save
			if (await output.confirm("No history file. Save current history?")) {
				const dir = path.join(getConfigDir(), "historyfiles");
				fs.mkdirSync(dir, { recursive: true });
				const file = path.join(dir, `${randomUUID()}.json`);
				fs.writeFileSync(file, JSON.stringify(context.history, null, 2));
				context.setSessionFile(file);
				output.writeln(`  ${c.green}✓${c.reset} Saved to ${c.bold}${file}${c.reset}`);
			}
		} else {
			output.writeln(`\n  ${c.dim}No history file (no messages yet)${c.reset}`);
		}

		output.writeln();

		return true;
	}

	if (task === "/clear") {
		context.history.length = 0;
		output.log("✓", c.green, "conversation history cleared");

		return true;
	}

	if (task === "/history") {
		if (context.history.length === 0) {
			output.log("✗", c.red, "no history yet");
	
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
				output.writeln(text);
			} finally {
				fs.rmSync(tmpFile, { force: true });
			}
		} else {
			output.writeln(text);
		}

		return true;
	}

	if (task === "/e" || task === "/p") {
		const lastAssistant = [...context.history].reverse().find((m) => m.role === "assistant");
		if (!lastAssistant) {
			output.log("✗", c.red, "no assistant response yet");
	
			return true;
		}
		const text = lastAssistant.content
			.filter((b) => b.type === "text")
			.map((b) => (b as { type: "text"; text: string }).text)
			.join("\n");
		if (!text.trim()) {
			output.log("✗", c.red, "last response has no text content");
	
			return true;
		}
		const tmpFile = path.join(os.tmpdir(), `customagent-response-${Date.now()}.md`);
		fs.writeFileSync(tmpFile, text);
		const program = task === "/e" ? process.env.EDITOR || "vi" : process.env.PAGER || "less";
		try {
			execSync(`${program} ${tmpFile}`, { stdio: "inherit" });
		} catch {
			output.log("✗", c.red, `failed to open ${program}`);
		} finally {
			fs.rmSync(tmpFile, { force: true });
		}

		return true;
	}

	return false;
}
