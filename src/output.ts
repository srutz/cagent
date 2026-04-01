/**
 * Centralized output class for cagent.
 *
 * All terminal output goes through this singleton so the agent can be
 * embedded in other environments (e.g. Ink, web UI) by swapping the
 * implementation.
 */

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

export class Output {
	/** Raw write without trailing newline. */
	write(text: string): void {
		process.stdout.write(text);
	}

	/** Write a line (like console.log). Multiple args are joined by space. */
	writeln(text = ""): void {
		console.log(text);
	}

	/** Write to stderr (like console.error). */
	error(text: string): void {
		console.error(text);
	}

	/** Write a warning to stderr (like console.warn). */
	warn(text: string): void {
		console.warn(text);
	}

	/** Prefixed log line:  `<color><prefix></color> <msg>` */
	log(prefix: string, color: string, msg: string): void {
		console.log(`${color}${prefix}${c.reset} ${msg}`);
	}

	/** Print a horizontal divider with optional label. */
	divider(label: string): void {
		const line = "─".repeat(60);
		console.log(`\n${c.dim}${line}${c.reset}`);
		if (label) console.log(`${c.dim}  ${label}${c.reset}`);
	}

	/** Clear the current terminal line. */
	clearLine(): void {
		process.stdout.write(`\x1b[2K\r`);
	}

	/** Interactive yes/no confirmation prompt. */
	confirm(question: string): Promise<boolean> {
		return new Promise((resolve) => {
			const rl = require("node:readline").createInterface({
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
}

/** Default singleton instance — import this in all modules. */
export const output = new Output();
