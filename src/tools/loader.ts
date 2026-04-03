import * as fs from "node:fs";
import * as path from "node:path";
import { getToolsPath } from "../constants.js";
import { c, output } from "../output.js";
import { registerTool } from "./index.js";
import type { ToolDefinition } from "./types.js";

/**
 * Dynamically load tool definitions from .js files.
 * Each file must default-export a ToolDefinition object.
 */
async function loadToolFromFile(filePath: string): Promise<ToolDefinition | null> {
	try {
		const abs = path.resolve(filePath);
		const module = await import(abs);
		const tool: ToolDefinition = module.default ?? module;

		if (!tool.name || !tool.description || !tool.input_schema || !tool.execute) {
			output.warn(
				`${c.yellow}⚠ Skipping ${filePath}: missing required fields (name, description, input_schema, execute)${c.reset}`,
			);
			return null;
		}
		return tool;
	} catch (err) {
		output.warn(
			`${c.yellow}⚠ Failed to load tool from ${filePath}: ${err instanceof Error ? err.message : String(err)}${c.reset}`,
		);
		return null;
	}
}

/**
 * Load all .js tool files from a directory.
 */
async function loadToolsFromDir(dir: string): Promise<ToolDefinition[]> {
	const tools: ToolDefinition[] = [];
	try {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			if (!file.endsWith(".js")) continue;
			const tool = await loadToolFromFile(path.join(dir, file));
			if (tool) tools.push(tool);
		}
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code !== "ENOENT") {
			output.warn(
				`${c.yellow}⚠ Error reading tools dir ${dir}: ${err instanceof Error ? err.message : String(err)}${c.reset}`,
			);
		}
	}
	return tools;
}

/**
 * Load external tools from:
 * 1. The default tools directory (~/.customagent/tools/)
 * 2. Any additional paths passed via --tools CLI flag
 *
 * Each path can be a .js file or a directory containing .js files.
 */
export async function loadExternalTools(extraPaths: string[] = []): Promise<void> {
	const allPaths = [getToolsPath(), ...extraPaths];
	let loaded = 0;

	for (const p of allPaths) {
		const resolved = path.resolve(p);

		if (!fs.existsSync(resolved)) continue;

		const stat = fs.statSync(resolved);
		let tools: ToolDefinition[];

		if (stat.isDirectory()) {
			tools = await loadToolsFromDir(resolved);
		} else if (resolved.endsWith(".js")) {
			const tool = await loadToolFromFile(resolved);
			tools = tool ? [tool] : [];
		} else {
			output.warn(`${c.yellow}⚠ Skipping ${resolved}: not a .js file or directory${c.reset}`);
			continue;
		}

		for (const tool of tools) {
			registerTool(tool);
			loaded++;
			output.writeln(`${c.dim}  loaded tool: ${tool.name} (from ${resolved})${c.reset}`);
		}
	}

	if (loaded > 0) {
		output.writeln(`${c.dim}  ${loaded} external tool(s) loaded${c.reset}`);
	}
}
