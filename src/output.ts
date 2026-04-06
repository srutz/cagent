import { createInkOutput, type InkOutput } from "./inkoutput.js";

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

export type SectionOptions = { toolName?: string; box?: boolean; keepEmptyLines?: boolean };

export type Section = {
	type: "user" | "assistant" | "tool_use" | "tool_result" | "echo" | "confirm";
	content: string[];
	partial?: string;
	options?: SectionOptions | undefined;
};

// biome-ignore lint/style/noNonNullAssertion: saves me fingers
export let output: InkOutput = null!;

export function initOutput() {
	output = createInkOutput();
}
