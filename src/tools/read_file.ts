import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "./types.js";

const MAX_LINES = 500;

const tool: ToolDefinition = {
	name: "read_file",
	confirmExec: false,
	description:
		"Read the contents of a file in the workspace. Returns up to 500 lines by default. Use 'offset' and 'limit' to paginate through larger files.",
	input_schema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Relative path inside the workspace",
			},
			offset: {
				type: "number",
				description: "Line number to start from (1-based, default: 1)",
			},
			limit: {
				type: "number",
				description: `Max lines to return (default/max: ${MAX_LINES})`,
			},
		},
		required: ["path"],
	},
	execute(workspace, input) {
		const rel = input.path as string;
		const abs = path.join(workspace, rel);
		if (!fs.existsSync(abs)) return `Error: file not found — ${rel}`;

		const content = fs.readFileSync(abs, "utf8");
		const allLines = content.split("\n");
		const totalLines = allLines.length;

		const offset = Math.max(1, typeof input.offset === "number" ? input.offset : 1);
		const limit = Math.min(MAX_LINES, Math.max(1, typeof input.limit === "number" ? input.limit : MAX_LINES));

		const start = offset - 1;
		const slice = allLines.slice(start, start + limit);
		const numbered = slice.map((line, i) => `${start + i + 1}\t${line}`).join("\n");

		const end = Math.min(start + limit, totalLines);
		const header = `[${rel}: lines ${offset}–${end} of ${totalLines}]`;

		if (end < totalLines) {
			return `${header}\n${numbered}\n[… ${totalLines - end} more lines — use offset=${end + 1} to continue]`;
		}
		return `${header}\n${numbered}`;
	},
};

export default tool;
