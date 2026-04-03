import { execShell, formatResult } from "./agentexec.js";
import type { ToolDefinition } from "./types.js";

const tool: ToolDefinition = {
	name: "run_command",
	description:
		"Run a shell command in the workspace directory. Use this to execute code, install packages, run tests, or inspect output. Timeout is 15 seconds. Do NOT use find/ls to list source files — use the list_files tool instead, which automatically excludes node_modules/dist/build directories.",
	input_schema: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "Shell command to run",
			},
		},
		required: ["command"],
	},
	execute(workspace, input) {
		const cmd = input.command as string;
		return formatResult(execShell(cmd, { cwd: workspace }));
	},
};

export default tool;
