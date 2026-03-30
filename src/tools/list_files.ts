import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "./types";

const MAX_FILES = 200;
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "target", ".idea", ".vscode", "__pycache__", ".gradle", ".mvn"]);

function matchGlob(filename: string, pattern: string): boolean {
	// Simple glob: support * and ** wildcards
	const regex = pattern
		.replace(/\./g, "\\.")
		.replace(/\*\*/g, "\0")
		.replace(/\*/g, "[^/]*")
		.replace(/\0/g, ".*");
	return new RegExp(`^${regex}$`).test(filename);
}

const tool: ToolDefinition = {
	name: "list_files",
	description:
		"List files in the workspace. Use 'directory' to scope to a subdirectory and 'pattern' to filter by glob (e.g. '*.java', '**/*.ts'). Returns at most 200 results. Always scope your request to the narrowest directory and/or pattern needed.",
	input_schema: {
		type: "object",
		properties: {
			directory: {
				type: "string",
				description:
					"Relative subdirectory to list (e.g. 'src/main/java'). Defaults to workspace root.",
			},
			pattern: {
				type: "string",
				description:
					"Glob pattern to filter files (e.g. '*.java', '**/*.xml'). If omitted, all files are listed.",
			},
		},
	},
	execute(workspace, input) {
		const subdir = typeof input.directory === "string" ? input.directory : "";
		const pattern = typeof input.pattern === "string" ? input.pattern : "";
		const root = path.resolve(workspace, subdir);

		if (!fs.existsSync(root)) {
			return `Error: directory "${subdir}" does not exist in workspace.`;
		}

		const entries = fs
			.readdirSync(root, { recursive: true })
			.map(String)
			.filter((f) => !f.split(path.sep).some((seg) => SKIP.has(seg)));

		let files = pattern ? entries.filter((f) => matchGlob(f, pattern)) : entries;

		const total = files.length;
		const truncated = total > MAX_FILES;
		if (truncated) {
			files = files.slice(0, MAX_FILES);
		}

		const prefix = subdir ? `${subdir}/` : "";
		const lines = files.map((f) => `  ${prefix}${f}`);
		const header = truncated
			? `Showing ${MAX_FILES} of ${total} files (truncated). Use 'directory' or 'pattern' to narrow results.\n`
			: "";
		return lines.length ? header + lines.join("\n") : "(no files found)";
	},
};

export default tool;
