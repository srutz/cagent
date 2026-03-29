import type { Tool } from "../providers";
import list_files from "./list_files";
import query from "./query";
import read_file from "./read_file";
import run_command from "./run_command";
import type { ToolDefinition } from "./types";
import web_search from "./web_search";
import write_file from "./write_file";

const definitions: ToolDefinition[] = [
	write_file,
	read_file,
	run_command,
	list_files,
	web_search,
	query,
];

export const TOOLS: Tool[] = definitions.map(({ name, description, input_schema }) => ({
	name,
	description,
	input_schema,
}));

export function executeTool(
	workspace: string,
	name: string,
	input: Record<string, unknown>,
): string {
	const tool = definitions.find((t) => t.name === name);
	if (!tool) return `Error: unknown tool "${name}"`;
	try {
		return tool.execute(workspace, input);
	} catch (err: unknown) {
		console.error("Tool execution error:", err);
		return `Error: ${err instanceof Error ? err.message : String(err)}`;
	}
}

export type { ToolDefinition } from "./types";
