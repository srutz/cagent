import { spawnSync, type SpawnSyncOptions } from "node:child_process";

export interface ExecOptions {
	/** Command to run */
	command: string;
	/** Arguments to pass */
	args?: string[];
	/** Working directory */
	cwd?: string;
	/** Timeout in milliseconds (default: 15000) */
	timeout?: number;
}

export interface ExecResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Central wrapper for all tool subprocess invocations.
 * Returns normalized stdout/stderr/exitCode.
 */
export function exec(opts: ExecOptions): ExecResult {
	const spawnOpts: SpawnSyncOptions = {
		encoding: "utf8",
		timeout: opts.timeout ?? 15_000,
	};
	if (opts.cwd) spawnOpts.cwd = opts.cwd;

	const result = spawnSync(opts.command, opts.args ?? [], spawnOpts);

	return {
		stdout: (result.stdout as string)?.trim() ?? "",
		stderr: (result.stderr as string)?.trim() ?? "",
		exitCode: result.status ?? -1,
	};
}

/** Run a command via bash -c */
export function execShell(
	command: string,
	opts?: Omit<ExecOptions, "command" | "args">,
): ExecResult {
	return exec({
		command: "bash",
		args: ["-c", command],
		...opts,
	});
}

/** Format an ExecResult as a human-readable string for tool output */
export function formatResult(result: ExecResult): string {
	let out = "";
	if (result.stdout) out += result.stdout;
	if (result.stderr)
		out += (out ? "\n--- stderr ---\n" : "") + result.stderr;
	if (!out) out = "(no output)";
	out += `\n[exit code: ${result.exitCode}]`;
	return out;
}
