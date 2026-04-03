import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "readline";

const HISTORY_DIR = path.join(os.homedir(), ".customagent");
const HISTORY_FILE = path.join(HISTORY_DIR, "readline.history");
const MAX_HISTORY = 500;

export function loadHistory(): string[] {
	try {
		if (!fs.existsSync(HISTORY_FILE)) return [];
		return fs
			.readFileSync(HISTORY_FILE, "utf8")
			.split("\n")
			.filter((l) => l.length > 0);
	} catch {
		return [];
	}
}

export function saveHistory(lines: string[]): void {
	fs.mkdirSync(HISTORY_DIR, { recursive: true });
	fs.writeFileSync(HISTORY_FILE, lines.slice(-MAX_HISTORY).join("\n") + "\n", "utf8");
}

export function appendHistory(line: string, lines: string[]): void {
	if (line && lines[lines.length - 1] !== line) {
		lines.push(line);
	}
	saveHistory(lines);
}

export interface Repl {
	rl: readline.Interface;
	historyLines: string[];
	appendHistory(line: string): void;
}

export function createRepl(prompt: string): Repl {
	const historyLines = loadHistory();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt,
		history: historyLines.slice().reverse(),
		historySize: MAX_HISTORY,
	});

	return {
		rl,
		historyLines,
		appendHistory(line: string) {
			appendHistory(line, historyLines);
		},
	};
}
