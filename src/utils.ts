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

export function log(prefix: string, color: string, msg: string) {
	console.log(`${color}${prefix}${c.reset} ${msg}`);
}

export function divider(label: string) {
	const line = "─".repeat(60);
	console.log(`\n${c.dim}${line}${c.reset}`);
	if (label) console.log(`${c.dim}  ${label}${c.reset}`);
}
