import { output } from "../output.js";
import type { Tool } from "../providers/index.js";
import browser from "./browser.js";
import list_files from "./list_files.js";
import query from "./query.js";
import read_file from "./read_file.js";
import run_command from "./run_command.js";
import type { ToolDefinition } from "./types.js";
import web_search from "./web_search.js";
import write_file from "./write_file.js";

const definitions: ToolDefinition[] = [
	write_file,
	read_file,
	run_command,
	list_files,
	web_search,
	query,
	browser,
];

export function registerTool(tool: ToolDefinition): void {
	const existing = definitions.findIndex((t) => t.name === tool.name);
	if (existing >= 0) {
		definitions[existing] = tool;
	} else {
		definitions.push(tool);
	}
}

function isEnabled(tool: ToolDefinition): boolean {
	return tool.enabled !== false;
}

export function getTools(): Tool[] {
	return definitions.filter(isEnabled).map(({ name, description, input_schema }) => ({
		name,
		description,
		input_schema,
	}));
}

export function shouldConfirm(name: string): boolean {
	const tool = definitions.find((t) => t.name === name);
	return tool?.confirmExec !== false;
}

export async function executeTool(
	workspace: string,
	name: string,
	input: Record<string, unknown>,
): Promise<string> {
	const tool = definitions.find((t) => t.name === name);
	if (!tool) return `Error: unknown tool "${name}"`;
	if (!isEnabled(tool)) return `Error: tool "${name}" is disabled`;
	try {
		return await tool.execute(workspace, input);
	} catch (err: unknown) {
		output.error(`Tool execution error: ${err instanceof Error ? err.message : String(err)}`);
		return `Error: ${err instanceof Error ? err.message : String(err)}`;
	}
}

export type { ToolDefinition } from "./types.js";
