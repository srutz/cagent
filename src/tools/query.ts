import { exec } from "./agentexec";
import { getDsn } from "../constants";
import type { ToolDefinition } from "./types";

const tool: ToolDefinition = {
	name: "query",
	description:
		"Run a SQL query against the connected PostgreSQL database using the install psql tool. Returns results in plain text. Use this for SELECT, INSERT, UPDATE, DELETE, or any SQL statement. When no --dsn is provided, it uses inherited PG* environment variables (PGHOST, PGUSER, PGDATABASE, etc.).",
	input_schema: {
		type: "object",
		properties: {
			sql: {
				type: "string",
				description: "SQL statement to execute",
			},
		},
		required: ["sql"],
	},
	execute(_workspace, input) {
		const sql = input.sql as string;
		const dsn = getDsn();
		const psqlArgs = dsn ? [dsn, "-Atc", sql] : ["-Atc", sql];
		const result = exec({ command: "psql", args: psqlArgs });

		if (result.exitCode !== 0 && result.stderr) {
			return `Error: ${result.stderr}`;
		}
		return result.stdout || "(no rows)";
	},
};

export default tool;
