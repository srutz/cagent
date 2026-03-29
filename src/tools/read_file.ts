import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "./types";

const tool: ToolDefinition = {
	name: "read_file",
	description: "Read the contents of a file in the workspace.",
	input_schema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Relative path inside the workspace",
			},
		},
		required: ["path"],
	},
	execute(workspace, input) {
		const rel = input.path as string;
		const abs = path.join(workspace, rel);
		if (!fs.existsSync(abs)) return `Error: file not found — ${rel}`;
		return fs.readFileSync(abs, "utf8");
	},
};

export default tool;
