import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "./types";

const tool: ToolDefinition = {
	name: "list_files",
	description: "List all files currently in the workspace.",
	input_schema: {
		type: "object",
		properties: {},
	},
	execute(workspace) {
		const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "target"]);
		const files = fs
			.readdirSync(workspace, { recursive: true })
			.map(String)
			.filter((f) => !f.split(path.sep).some((seg) => SKIP.has(seg)))
			.map((f) => `  ${f}`);
		return files.length ? files.join("\n") : "(workspace is empty)";
	},
};

export default tool;
