import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "./types";

const tool: ToolDefinition = {
	name: "write_file",
	description:
		"Write content to a file in the workspace. Creates the file (and any parent directories) if it doesn't exist.",
	input_schema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Relative path inside the workspace, e.g. 'solution.py'",
			},
			content: {
				type: "string",
				description: "Full content to write to the file",
			},
		},
		required: ["path", "content"],
	},
	execute(workspace, input) {
		const rel = input.path as string;
		const content = input.content as string;
		const abs = path.join(workspace, rel);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, content, "utf8");
		return `✓ Written ${rel} (${content.length} chars)`;
	},
};

export default tool;
