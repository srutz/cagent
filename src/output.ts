/**
 * Centralized output abstraction for cagent.
 *
 * All terminal output goes through the `output` singleton so the agent can be
 * embedded in other environments (e.g. Ink, web UI) by swapping the
 * implementation via `setOutput()`.
 */

import * as readline from "node:readline";
import { appendHistory, loadHistory } from "./readlineutils.js";

export const c = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	bold: "\x1b[1m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m",
	gray: "\x1b[90m",
};

/** Types of output */
export type Section = {
	type: "user" | "assistant" | "tool_use" | "tool_result" | "echo";
	content: string[];
};

/** Interface every output backend must implement. */
export interface IOutput {
	exit(): void;
	startupWriteLn(text: string): void;
	write(text: string): void;
	writeln(text?: string): void;
	error(text: string): void;
	warn(text: string): void;
	log(prefix: string, color: string, msg: string): void;
	divider(label: string): void;
	clearLine(): void;
	confirm(question: string): Promise<boolean>;
	/** Read a line of user input (with prompt and history). */
	readLine(prompt: string): Promise<string>;
}

const MAX_HISTORY = 500;

/** Console-based output (the default). */
export class ConsoleOutput implements IOutput {
	private rl: readline.Interface | null = null;
	private historyLines: string[] = [];

	private ensureRl(prompt: string): readline.Interface {
		if (!this.rl) {
			this.historyLines = loadHistory();
			this.rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
				prompt,
				history: this.historyLines.slice().reverse(),
				historySize: MAX_HISTORY,
			});
		}
		this.rl.setPrompt(prompt);
		return this.rl;
	}

	exit() {
		// Clean up readline interface if it exists
	}

	startupWriteLn(text: string): void {
		console.log(text);
	}

	write(text: string): void {
		process.stdout.write(text);
	}

	writeln(text = ""): void {
		console.log(text);
	}

	error(text: string): void {
		console.error(text);
	}

	warn(text: string): void {
		console.warn(text);
	}

	log(prefix: string, color: string, msg: string): void {
		console.log(`${color}${prefix}${c.reset} ${msg}`);
	}

	divider(label: string): void {
		const line = "─".repeat(60);
		console.log(`\n${c.dim}${line}${c.reset}`);
		if (label) console.log(`${c.dim}  ${label}${c.reset}`);
	}

	clearLine(): void {
		process.stdout.write(`\x1b[2K\r`);
	}

	confirm(question: string): Promise<boolean> {
		return new Promise((resolve) => {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			rl.question(`${c.yellow}${question} [Y/n] ${c.reset}`, (answer: string) => {
				rl.close();
				const a = answer.trim().toLowerCase();
				resolve(a === "" || a === "y" || a === "yes");
			});
		});
	}

	readLine(prompt: string): Promise<string> {
		const rl = this.ensureRl(prompt);
		return new Promise((resolve) => {
			rl.prompt();
			rl.once("line", (line: string) => {
				const text = line.trim();
				if (text) {
					appendHistory(text, this.historyLines);
				}
				resolve(text);
			});
			rl.once("close", () => resolve("/exit"));
		});
	}
}

/** Default singleton instance — import this in all modules. */
export let output: IOutput = new ConsoleOutput();

/** Swap the global output backend (e.g. to InkOutput). */
export function setOutput(impl: IOutput): void {
	output = impl;
}
